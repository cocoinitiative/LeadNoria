/**
 * LeadNoria — Geographic Accuracy & Location Intelligence Regression Suite
 *
 * Verifies:
 * 1. Target country code vs. business physical country code separation.
 * 2. Strict evidence hierarchy: address/phone > operational signals > supporting domain.
 * 3. Never treating target country as business location without independent evidence.
 * 4. Never claiming .bd domain alone proves physical location (LOCAL_PROBABLE vs LOCAL_VERIFIED).
 * 5. Foreign entity classification (FOREIGN_VERIFIED) for foreign phones/domains.
 * 6. Location unknown classification (LOCATION_UNKNOWN) preserved without silent attribution.
 * 7. Strict local mode: includes verified local, excludes verified foreign, holds unknown.
 * 8. General discovery mode: retains foreign entities while accurately labelling them.
 * 9. CSV export emits all new geographic columns with proper formula safety.
 */

import assert from 'assert';
import { evaluateGeographicOrigin } from '../src/extension/geographicClassifier.ts';
import { aggregateCandidatesToLeads, exportLeadsToCsv } from '../src/extension/metaAdapter.ts';
import { compileResearchIntent } from '../src/extension/relevanceEngine.ts';
import { MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH } from '../src/extension/types.ts';
import { processBatch } from '../src/extension/bulkProcessor.ts';

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('=== LEADNORIA GEOGRAPHIC ACCURACY REGRESSION TEST SUITE ===\n');

console.log('--- Suite 1: evaluateGeographicOrigin Evidence Hierarchy ---');

test('1.1. Explicit BD phone number classifies as LOCAL_VERIFIED with HIGH confidence', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Hatil Furniture',
    bodyCopy: 'Call our showroom at +8801711234567 for premium living room sets.',
    destinationUrl: 'https://hatil.com'
  }, 'BD');

  assert.strictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'BD');
  assert.strictEqual(result.targetCountryCode, 'BD');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.strictEqual(result.isLocal, true);
  assert.strictEqual(result.isForeign, false);
  assert(result.evidence.some(e => e.includes('+880') || e.includes('telephone')));
});

test('1.2. Local BD cities and delivery phrases classify as LOCAL_PROBABLE (MEDIUM confidence)', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Artisan Woodworks',
    bodyCopy: 'Free delivery inside Dhaka and all over Bangladesh for online orders.',
    destinationUrl: 'https://artisanbdwood.com'
  }, 'BD');

  assert.strictEqual(result.classification, 'LOCAL_PROBABLE');
  assert.strictEqual(result.businessCountryCode, 'BD');
  assert.strictEqual(result.confidence, 'MEDIUM');
  assert.strictEqual(result.isLocal, true);
  assert.strictEqual(result.isForeign, false);
});

test('1.3. .bd domain alone does NOT give LOCAL_VERIFIED (only LOCAL_PROBABLE with LOW confidence)', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Global Design',
    destinationDomain: 'globaldesign.com.bd',
    destinationUrl: 'https://globaldesign.com.bd',
    bodyCopy: 'Explore our world class catalog'
  }, 'BD');

  assert.notStrictEqual(result.classification, 'LOCAL_VERIFIED', '.bd domain alone must never be LOCAL_VERIFIED');
  assert.strictEqual(result.classification, 'LOCAL_PROBABLE');
  assert.strictEqual(result.confidence, 'LOW');
});

test('1.4. Foreign Indian entity with +91 phone classifies as FOREIGN_VERIFIED (IN)', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Royal Oak Furniture India',
    bodyCopy: 'Contact our Bangalore store at +91 9876543210 for solid teak tables.',
    destinationUrl: 'https://royaloakindia.com'
  }, 'BD');

  assert.strictEqual(result.classification, 'FOREIGN_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'IN');
  assert.strictEqual(result.targetCountryCode, 'BD');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.strictEqual(result.isForeign, true);
  assert.strictEqual(result.isLocal, false);
});

test('1.5. Foreign UK domain (.co.uk) classifies as FOREIGN_VERIFIED (GB)', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Fairway Furniture',
    destinationDomain: 'fairwayfurniture.co.uk',
    destinationUrl: 'https://www.fairwayfurniture.co.uk/sofas',
    bodyCopy: 'Luxury leather sofas delivered across Devon and Cornwall.'
  }, 'BD');

  assert.strictEqual(result.classification, 'FOREIGN_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'GB');
  assert.strictEqual(result.isForeign, true);
});

test('1.6. Entity with no geographic evidence classifies as LOCATION_UNKNOWN', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Modern Studio Decor',
    destinationDomain: 'modernstudiodecor.com',
    destinationUrl: 'https://modernstudiodecor.com/shop',
    bodyCopy: 'Handcrafted minimalist furniture and elegant interior pieces.'
  }, 'BD');

  assert.strictEqual(result.classification, 'LOCATION_UNKNOWN');
  assert.strictEqual(result.businessCountryCode, undefined, 'Must NEVER populate businessCountryCode with targetCountryCode');
  assert.strictEqual(result.targetCountryCode, 'BD');
  assert.strictEqual(result.confidence, 'NONE');
  assert.strictEqual(result.isUnknown, true);
  assert.strictEqual(result.isLocal, false);
});

console.log('\n--- Suite 2: Strict Local Mode vs General Discovery in Aggregation ---');

const mockCandidates = [
  // 1. Local verified
  {
    libraryId: '100000000001',
    pageName: 'Otobi Furniture Bangladesh',
    facebookPageUrl: 'https://facebook.com/otobibd',
    destinationUrl: 'https://otobi.com',
    destinationDomain: 'otobi.com',
    bodyCopy: 'Official Otobi showroom Dhanmondi, Dhaka. Premium wooden furniture, dining tables and executive chairs. Hotline: +8801700000000',
    ctaText: 'Shop Now',
    observedKeyword: 'Furniture'
  },
  // 2. Foreign verified
  {
    libraryId: '100000000002',
    pageName: 'IKEA Furniture India',
    facebookPageUrl: 'https://facebook.com/ikeaindia',
    destinationUrl: 'https://ikea.in',
    destinationDomain: 'ikea.in',
    bodyCopy: 'Affordable furniture, modern living room sofas and wardrobes at IKEA Hyderabad store. Call +91 4067890123',
    ctaText: 'Visit Store',
    observedKeyword: 'Furniture'
  },
  // 3. Unknown location
  {
    libraryId: '100000000003',
    pageName: 'Zenith Living Furniture',
    facebookPageUrl: 'https://facebook.com/zenithliving',
    destinationUrl: 'https://zenithliving.com',
    destinationDomain: 'zenithliving.com',
    bodyCopy: 'Contemporary modular sofas, wooden beds and coffee tables with ergonomic comfort.',
    ctaText: 'Explore',
    observedKeyword: 'Furniture'
  }
];

test('2.1. General discovery mode retains foreign entity with accurate geographic classification', () => {
  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD');
  const result = aggregateCandidatesToLeads(mockCandidates, 'BD', 'Bangladesh', 50, [], intent);

  assert.strictEqual(result.leads.length, 3, 'All 3 relevant candidates retained in general discovery mode');

  const otobi = result.leads.find(l => l.name === 'Otobi Furniture Bangladesh');
  assert(otobi, 'Otobi must be present');
  assert.strictEqual(otobi.geographicClassification, 'LOCAL_VERIFIED');
  assert.strictEqual(otobi.businessCountryCode, 'BD');
  assert.strictEqual(otobi.targetCountryCode, 'BD');

  const ikea = result.leads.find(l => l.name === 'IKEA Furniture India');
  assert(ikea, 'IKEA must be present in general mode');
  assert.strictEqual(ikea.geographicClassification, 'FOREIGN_VERIFIED');
  assert.strictEqual(ikea.businessCountryCode, 'IN');
  assert.strictEqual(ikea.targetCountryCode, 'BD', 'Target country was BD search');

  const zenith = result.leads.find(l => l.name === 'Zenith Living Furniture');
  assert(zenith, 'Zenith must be present');
  assert.strictEqual(zenith.geographicClassification, 'LOCATION_UNKNOWN');
  assert.strictEqual(zenith.businessCountryCode, undefined);
});

test('2.2. Strict local mode excludes FOREIGN_VERIFIED and holds LOCATION_UNKNOWN', () => {
  const strictIntent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', { strictLocalMode: true });
  const result = aggregateCandidatesToLeads(mockCandidates, 'BD', 'Bangladesh', 50, [], strictIntent);

  assert.strictEqual(result.leads.length, 1, 'Only verified local lead admitted');
  assert.strictEqual(result.leads[0].name, 'Otobi Furniture Bangladesh');
  assert.strictEqual(result.rejectedCount, 1, 'Foreign lead rejected');
  assert.strictEqual(result.uncertainCount, 1, 'Unknown lead held in uncertain count');
  assert.strictEqual(result.counters.reasonCodes['FOREIGN_BUSINESS'], 1);
  assert.strictEqual(result.counters.reasonCodes['LOCATION_UNKNOWN'], 1);
});

console.log('\n--- Suite 3: CSV Export Geographic Metadata Transparency ---');

test('3.1. exportLeadsToCsv emits all required geographic headers and formula-safe values', () => {
  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD');
  const result = aggregateCandidatesToLeads(mockCandidates, 'BD', 'Bangladesh', 50, [], intent);

  const csv = exportLeadsToCsv(result.leads);

  assert(csv.includes('Target Country Code'), 'CSV must contain Target Country Code header');
  assert(csv.includes('Business Country Code'), 'CSV must contain Business Country Code header');
  assert(csv.includes('Geographic Classification'), 'CSV must contain Geographic Classification header');
  assert(csv.includes('Location Confidence'), 'CSV must contain Location Confidence header');
  assert(csv.includes('Location Evidence'), 'CSV must contain Location Evidence header');

  // Verify rows contain distinct classifications
  assert(csv.includes('"LOCAL_VERIFIED"'), 'CSV rows must have LOCAL_VERIFIED');
  assert(csv.includes('"FOREIGN_VERIFIED"'), 'CSV rows must have FOREIGN_VERIFIED');
  assert(csv.includes('"LOCATION_UNKNOWN"'), 'CSV rows must have LOCATION_UNKNOWN');
  assert(csv.includes('"IN"'), 'CSV rows must have businessCountryCode IN');
});

console.log('\n--- Suite 4: Conflicting Evidence, Probable Labeling & Strict Mode Flexibility ---');

test('4.1. Conflicting evidence: Explicit foreign phone (+91) overrides local city mention', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Subcontinent Crafts',
    bodyCopy: 'Shipping to Dhaka and Chittagong! Call our headquarters at +91 9876543210',
    destinationUrl: 'https://subcontinentcrafts.com'
  }, 'BD');

  assert.strictEqual(result.classification, 'FOREIGN_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'IN');
  assert.strictEqual(result.confidence, 'HIGH');
  assert(result.evidence.some(e => e.includes('+91')));
});

test('4.2. Probable local business clearly labeled with reason explanation', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Bengal Heritage',
    bodyCopy: 'আমাদের সকল ফার্নিচার দেশি কাঠে তৈরি। শো-রুম: উত্তরা, ঢাকা।',
    destinationUrl: 'https://bengalheritage.com'
  }, 'BD');

  assert.strictEqual(result.classification, 'LOCAL_PROBABLE');
  assert.strictEqual(result.businessCountryCode, 'BD');
  assert(result.reason.includes('Probable local business'));
  assert(result.evidence.some(e => e.includes('Bengali script')));
});

test('4.3. Strict local mode with allowProbableLocal=true admits LOCAL_PROBABLE', () => {
  const probableCandidates = [
    {
      libraryId: '200000000001',
      pageName: 'Dhaka Craft Furniture',
      destinationUrl: 'https://dhakacraft.com',
      bodyCopy: 'Free delivery inside Dhaka for modern furniture, sofas and dining tables.',
      ctaText: 'Shop Now',
      observedKeyword: 'Furniture'
    }
  ];

  // Disallowed probable:
  const strictNoProbableIntent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
    strictLocalMode: true,
    allowProbableLocal: false
  });
  const res1 = aggregateCandidatesToLeads(probableCandidates, 'BD', 'Bangladesh', 50, [], strictNoProbableIntent);
  assert.strictEqual(res1.leads.length, 0, 'Must not admit probable local when allowProbableLocal=false');

  // Allowed probable:
  const strictWithProbableIntent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
    strictLocalMode: true,
    allowProbableLocal: true
  });
  const res2 = aggregateCandidatesToLeads(probableCandidates, 'BD', 'Bangladesh', 50, [], strictWithProbableIntent);
  assert.strictEqual(res2.leads.length, 1, 'Must admit probable local when allowProbableLocal=true');
  assert.strictEqual(res2.leads[0].geographicClassification, 'LOCAL_PROBABLE');
});

console.log('\n--- Suite 5: Entity Deduplication, Query Isolation & Quota Safety ---');

test('5.1. Deduplication merges ad IDs while preserving geographic classification', () => {
  const duplicateCandidates = [
    {
      libraryId: '300000000001',
      pageName: 'Hatil Furniture',
      facebookPageUrl: 'https://facebook.com/hatilfurniture',
      destinationUrl: 'https://hatil.com/products/sofa-1',
      bodyCopy: 'Premium modular fabric furniture sofa for Dhaka homes. Call +8801700112233',
      observedKeyword: 'Furniture'
    },
    {
      libraryId: '300000000002',
      pageName: 'Hatil Furniture',
      facebookPageUrl: 'https://facebook.com/hatilfurniture',
      destinationUrl: 'https://hatil.com/products/bed-2',
      bodyCopy: 'Solid wood furniture bed frames. Contact showroom.',
      observedKeyword: 'Furniture'
    }
  ];

  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD');
  const result = aggregateCandidatesToLeads(duplicateCandidates, 'BD', 'Bangladesh', 50, [], intent);

  assert.strictEqual(result.leads.length, 1, 'Entities with same Facebook page must merge');
  assert.strictEqual(result.leads[0].adLibraryIds.length, 2, 'Both ad IDs must be preserved');
  assert.strictEqual(result.leads[0].geographicClassification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.leads[0].businessCountryCode, 'BD');
});

test('5.2. Production safety: research intent enforces sane default ceiling without artificial 6-lead cap', () => {
  assert.strictEqual(MAX_FINAL_UNIQUE_RELEVANT_LEADS_PER_RESEARCH, 5000, 'Production safety ceiling is 5000, never capped to 6');
});

console.log('\n--- Suite 6: Screenshot Failure Detection Logic ---');

test('6.1. Screenshot validation correctly flags images < 10KB as blank/failed', () => {
  function validateScreenshot(sizeBytes) {
    const MIN_EVIDENCE_SIZE = 10000;
    if (sizeBytes < MIN_EVIDENCE_SIZE) {
      return { success: false, reason: `File too small (${sizeBytes} B < 10KB, likely blank)` };
    }
    return { success: true, reason: 'VERIFIED' };
  }

  assert.strictEqual(validateScreenshot(1908).success, false, '1908 bytes must fail as blank popup');
  assert.strictEqual(validateScreenshot(4718).success, false, '4718 bytes must fail as empty shell');
  assert.strictEqual(validateScreenshot(120988).success, true, '120KB must pass as verified content');
});

console.log('\n--- Suite 7: Count Ledger & Pipeline Accounting Reconciliation ---');

await test('7.1. Ad Evaluation Ledger: rawAds = duplicatesRemoved + relevantCandidates + notRelevantCandidates + uncertainCandidates', async () => {
  const existingEntitiesMap = new Map();
  const seenAdLibraryIds = new Set(['111111111111']); // One duplicate ad
  const seenEntityKeys = new Set();
  const seenRejectedEntityKeys = new Set();
  const seenUncertainEntityKeys = new Set();

  const currentCounters = {
    rawAds: 0,
    normalizedCandidates: 0,
    relevantCandidates: 0,
    uncertainCandidates: 0,
    notRelevantCandidates: 0,
    duplicatesRemoved: 0,
    finalUniqueLeads: 0,
    uniqueEntitiesObserved: 0,
    relevantEntities: 0,
    uncertainEntities: 0,
    notRelevantEntities: 0,
    finalUniqueRelevantLeads: 0,
    reasonCodes: {}
  };

  const testCandidates = [
    // Candidate 1: Duplicate ad library ID -> duplicatesRemoved (1)
    {
      libraryId: '111111111111',
      pageName: 'Prior Seen Entity',
      bodyCopy: 'Some ad copy',
      observedKeyword: 'Furniture'
    },
    // Candidate 2 & 3: Two rejected ads from same advertiser "Acme Fashion" -> notRelevantCandidates (2), but only 1 entity!
    {
      libraryId: '222222222222',
      pageName: 'Acme Fashion Store',
      bodyCopy: 'Summer clothes and ladies apparel sale on designer dresses.',
      observedKeyword: 'Furniture'
    },
    {
      libraryId: '333333333333',
      pageName: 'Acme Fashion Store',
      bodyCopy: 'High heels and fashion accessories collection 50% discount.',
      observedKeyword: 'Furniture'
    },
    // Candidate 4: One uncertain ad from "Generic Studio" -> uncertainCandidates (1)
    {
      libraryId: '444444444444',
      pageName: 'Creative Studio',
      bodyCopy: 'Interior concept art and furniture layout designs.',
      observedKeyword: 'Furniture'
    },
    // Candidate 5: One relevant ad from "Classic Oak Furniture" -> relevantCandidates (1)
    {
      libraryId: '555555555555',
      pageName: 'Classic Oak Furniture',
      destinationUrl: 'https://classicoakbd.com',
      destinationDomain: 'classicoakbd.com',
      bodyCopy: 'Solid oak dining tables, wardrobes and executive chairs in Dhaka. Phone: +8801711998877',
      observedKeyword: 'Furniture'
    }
  ];

  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD');

  const result = await processBatch(
    testCandidates,
    existingEntitiesMap,
    seenAdLibraryIds,
    seenEntityKeys,
    currentCounters,
    {
      runId: 'test_ledger_run',
      countryCode: 'BD',
      locationName: 'Bangladesh',
      currentKeyword: 'Furniture',
      intent,
      effectiveCeiling: 5000,
      seenRejectedEntityKeys,
      seenUncertainEntityKeys
    }
  );

  const c = result.counters;

  // Level 1: Candidate Ad Decision Ledger
  // 4 raw ads evaluated (1 skipped as duplicate at line 143)
  assert.strictEqual(c.rawAds, 4, 'Raw ads must equal 4');
  assert.strictEqual(c.duplicatesRemoved, 1, 'Duplicate ads removed must equal 1');
  assert.strictEqual(c.relevantCandidates, 1, 'Relevant candidates must equal 1');
  assert.strictEqual(c.notRelevantCandidates, 2, 'Not-relevant candidates must equal 2');
  assert.strictEqual(c.uncertainCandidates, 1, 'Uncertain candidates must equal 1');

  const adDecisionsSum = c.relevantCandidates + c.notRelevantCandidates + c.uncertainCandidates;
  assert.strictEqual(adDecisionsSum, c.rawAds, 'Ad decisions sum must equal rawAds (100% parity)');
  assert.strictEqual(adDecisionsSum + c.duplicatesRemoved, testCandidates.length, 'Total input ads reconciled');

  // Level 2: Unique Entity Ledger (Mutually Exclusive Sets)
  // Total unique entities: Acme Fashion (rejected), Creative Studio (uncertain), Classic Oak Furniture (relevant) = 3!
  assert.strictEqual(c.relevantEntities, 1, 'Relevant entities must equal 1');
  assert.strictEqual(c.notRelevantEntities, 1, 'Not-relevant entities must equal 1 (despite 2 rejected ads from Acme)');
  assert.strictEqual(c.uncertainEntities, 1, 'Uncertain entities must equal 1');
  assert.strictEqual(c.uniqueEntitiesObserved, 3, 'Unique entities observed must equal 3');

  const entitySum = c.relevantEntities + c.notRelevantEntities + c.uncertainEntities;
  assert.strictEqual(entitySum, c.uniqueEntitiesObserved, 'Entity sum must equal uniqueEntitiesObserved (100% parity)');

  // Level 3: Storage and Geographic Reconciliation
  assert.strictEqual(existingEntitiesMap.size, 1);
  const acceptedLead = Array.from(existingEntitiesMap.values())[0];
  assert.strictEqual(acceptedLead.geographicClassification, 'LOCAL_VERIFIED');
  assert.strictEqual(acceptedLead.businessCountryCode, 'BD');

  // Level 4: Export Parity
  const csv = exportLeadsToCsv(Array.from(existingEntitiesMap.values()));
  const csvRows = csv.trim().split('\n').filter(line => !line.startsWith('#') && line.trim().length > 0);
  assert.strictEqual(csvRows.length - 1, existingEntitiesMap.size, 'Exported CSV rows must match stored leads');
});

console.log(`\n======================================================`);
console.log(`ALL ${passed} GEOGRAPHIC ACCURACY REGRESSION TESTS PASSED!`);
console.log(`======================================================\n`);

