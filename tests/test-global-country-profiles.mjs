/**
 * LeadNoria — Global Country Profiles & Geographic Intelligence Regression Suite
 *
 * Verifies Phase 0.3 Requirements:
 * 1. Global country coverage for BD, US, GB, CA, AU, IE.
 * 2. Country-code normalization and alias handling (UK -> GB, USA -> US, Eire -> IE, etc.).
 * 3. Evidence hierarchy: Physical address & verified phone > operational phrases > domain suffix > keywords.
 * 4. Multi-country isolation: targetCountryCode !== businessCountryCode.
 * 5. Ireland business targeting Bangladesh classified as FOREIGN_VERIFIED (IE).
 * 6. Shared NANP (+1) prefix handling between US and CA (requires regional corroboration).
 * 7. Unsupported/invalid country codes handled gracefully as LOCATION_UNKNOWN.
 * 8. Contradictory evidence (multi-country addresses) handled as CONFLICTING_LOCATION_EVIDENCE.
 * 9. Entity merge triggers geographic reclassification when new evidence emerges.
 * 10. Strict-local gate admits only LOCAL_VERIFIED by default, rejects FOREIGN_VERIFIED, holds LOCATION_UNKNOWN.
 * 11. Lead qualification respects niche/category requirements regardless of geographic pass.
 */

import assert from 'assert';
import { evaluateGeographicOrigin } from '../src/extension/geographicClassifier.ts';
import { normalizeCountryCode, getCountryProfile } from '../src/extension/countryProfiles/index.ts';
import { aggregateCandidatesToLeads } from '../src/extension/metaAdapter.ts';
import { compileResearchIntent } from '../src/extension/relevanceEngine.ts';
import { mergeCandidateIntoEntity } from '../src/extension/entityResolver.ts';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('=== LEADNORIA GLOBAL COUNTRY PROFILES REGRESSION TEST SUITE ===\n');

console.log('--- Suite 1: Country Code Normalization & Profile Registry ---');

test('1.1. Country code normalization resolves standard codes and common aliases', () => {
  assert.strictEqual(normalizeCountryCode('BD'), 'BD');
  assert.strictEqual(normalizeCountryCode('Bangladesh'), 'BD');
  assert.strictEqual(normalizeCountryCode('US'), 'US');
  assert.strictEqual(normalizeCountryCode('USA'), 'US');
  assert.strictEqual(normalizeCountryCode('America'), 'US');
  assert.strictEqual(normalizeCountryCode('GB'), 'GB');
  assert.strictEqual(normalizeCountryCode('UK'), 'GB');
  assert.strictEqual(normalizeCountryCode('United Kingdom'), 'GB');
  assert.strictEqual(normalizeCountryCode('CA'), 'CA');
  assert.strictEqual(normalizeCountryCode('Canada'), 'CA');
  assert.strictEqual(normalizeCountryCode('AU'), 'AU');
  assert.strictEqual(normalizeCountryCode('Australia'), 'AU');
  assert.strictEqual(normalizeCountryCode('IE'), 'IE');
  assert.strictEqual(normalizeCountryCode('Ireland'), 'IE');
  assert.strictEqual(normalizeCountryCode('Eire'), 'IE');
  assert.strictEqual(normalizeCountryCode('IN'), 'IN');
  assert.strictEqual(normalizeCountryCode('India'), 'IN');
  assert.strictEqual(normalizeCountryCode('CN'), 'CN');
  assert.strictEqual(normalizeCountryCode('China'), 'CN');
});

test('1.2. Unsupported country code produces graceful LOCATION_UNKNOWN', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Arctic Goods',
    bodyCopy: 'Snowmobile gear available across Antarctica',
    destinationUrl: 'https://arcticgoods.aq'
  }, 'AQ');

  assert.strictEqual(result.classification, 'LOCATION_UNKNOWN');
  assert.strictEqual(result.businessCountryCode, undefined);
  assert.strictEqual(result.confidence, 'NONE');
  assert.strictEqual(result.reasonCode, 'UNSUPPORTED_TARGET_COUNTRY');
  assert(result.reason.includes('AQ'));
});

console.log('\n--- Suite 2: Multi-Country Coverage Positive Cases ---');

test('2.1. United States (US): Physical address with city and state classifies as LOCAL_VERIFIED', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Empire Office Furniture',
    bodyCopy: 'Visit our flagship showroom on 5th Avenue, New York, NY 10001 for executive desks.',
    destinationUrl: 'https://empireofficefurn.com'
  }, 'US');

  assert.strictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'US');
  assert.strictEqual(result.targetCountryCode, 'US');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.strictEqual(result.reasonCode, 'EXPLICIT_LOCAL_ADDRESS');
  assert(result.evidence.some(e => e.includes('New York') || e.includes('ZIP')));
});

test('2.2. United Kingdom (GB via UK alias): UK postcode and city classify as LOCAL_VERIFIED', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Mayfair Leather Sofas',
    bodyCopy: 'Showroom open at 14 High Street, Manchester, M1 1AE. Call +44 161 999 8888',
    destinationUrl: 'https://mayfairleather.co.uk'
  }, 'UK'); // Using alias 'UK'

  assert.strictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'GB');
  assert.strictEqual(result.targetCountryCode, 'GB', 'UK alias must normalize to GB');
  assert.strictEqual(result.confidence, 'HIGH');
  assert(result.evidence.some(e => e.includes('+44')));
});

test('2.3. Canada (CA): Canadian postal code and Ontario province classify as LOCAL_VERIFIED', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Maple Leaf Woodcraft',
    bodyCopy: 'Handcrafted solid dining sets. Warehouse: 250 Queen Street, Toronto, ON M5V 2A8.',
    destinationUrl: 'https://mapleleafwood.ca'
  }, 'CA');

  assert.strictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'CA');
  assert.strictEqual(result.targetCountryCode, 'CA');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.strictEqual(result.reasonCode, 'EXPLICIT_LOCAL_ADDRESS');
});

test('2.4. Australia (AU): Australian +61 phone, Sydney address and ABN classify as LOCAL_VERIFIED', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Bondi Timber Living',
    bodyCopy: 'Showroom at 45 George Street, Sydney NSW 2000. Phone: +61 2 9876 5432. ABN 12 345 678 901.',
    destinationUrl: 'https://bonditimber.com.au'
  }, 'AU');

  assert.strictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'AU');
  assert.strictEqual(result.targetCountryCode, 'AU');
  assert.strictEqual(result.confidence, 'HIGH');
  assert(result.evidence.some(e => e.includes('+61')));
});

test('2.5. Ireland (IE): Irish +353 phone and Dublin address classify as LOCAL_VERIFIED', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Dublin Oak Interiors',
    bodyCopy: 'Premium solid oak tables at 12 Grafton Street, Dublin. Call +353 1 234 5678.',
    destinationUrl: 'https://dublinoak.ie'
  }, 'IE');

  assert.strictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'IE');
  assert.strictEqual(result.targetCountryCode, 'IE');
  assert.strictEqual(result.confidence, 'HIGH');
  assert(result.evidence.some(e => e.includes('+353')));
});

console.log('\n--- Suite 3: Negative Cases & Geographic Isolation ---');

test('3.1. Ireland business targeting Bangladesh classified as FOREIGN_VERIFIED (IE)', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Emerald Island Exports',
    bodyCopy: 'Now shipping handmade Celtic wool throws to customers worldwide! Visit our Dublin showroom or call +353 1 456 7890.',
    destinationUrl: 'https://emeraldislandexports.ie'
  }, 'BD'); // User researching Bangladesh

  assert.strictEqual(result.classification, 'FOREIGN_VERIFIED');
  assert.strictEqual(result.businessCountryCode, 'IE', 'Must identify business country as IE');
  assert.strictEqual(result.targetCountryCode, 'BD', 'Must keep targetCountryCode as BD');
  assert.strictEqual(result.isForeign, true);
  assert.strictEqual(result.isLocal, false);
});

test('3.2. Generic .com domain without location signals classifies as LOCATION_UNKNOWN', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Artisan Living Global',
    bodyCopy: 'Discover timeless contemporary sofas and wooden beds crafted with elegance.',
    destinationUrl: 'https://artisanlivingglobal.com',
    destinationDomain: 'artisanlivingglobal.com'
  }, 'US');

  assert.strictEqual(result.classification, 'LOCATION_UNKNOWN');
  assert.strictEqual(result.businessCountryCode, undefined);
  assert.strictEqual(result.confidence, 'NONE');
  assert.strictEqual(result.reasonCode, 'COUNTRY_EVIDENCE_MISSING');
});

test('3.3. Shared NANP (+1) phone without city or state corroboration is NOT LOCAL_VERIFIED', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Direct Deals Depot',
    bodyCopy: 'Call our hotline at +1 800-555-0199 to place your order today!',
    destinationUrl: 'https://directdealsdepot.com'
  }, 'US');

  // Must not grant LOCAL_VERIFIED for NANP (+1) without state/city/zip
  assert.notStrictEqual(result.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.classification, 'LOCAL_PROBABLE');
  assert.strictEqual(result.confidence, 'MEDIUM');
});

test('3.4. Conflicting high-quality addresses across two countries resolves to CONFLICTING_LOCATION_EVIDENCE', () => {
  const result = evaluateGeographicOrigin({
    pageName: 'Dual Presence Logistics',
    bodyCopy: 'Headquarters: House 12, Road 5, Dhanmondi, Dhaka. UK Operations: 10 High Street, London.',
    destinationUrl: 'https://dualpresence.com'
  }, 'BD');

  assert.strictEqual(result.classification, 'LOCATION_UNKNOWN');
  assert.strictEqual(result.businessCountryCode, undefined);
  assert.strictEqual(result.reasonCode, 'CONFLICTING_LOCATION_EVIDENCE');
  assert(result.reason.includes('Conflicting'));
});

console.log('\n--- Suite 4: Entity Merge & Dynamic Geographic Reclassification ---');

test('4.1. Entity merge triggers reclassification from LOCAL_PROBABLE to LOCAL_VERIFIED', () => {
  const initialEntity = {
    id: 'lead_test_001',
    name: 'Apex Living',
    canonicalName: 'Apex Living',
    facebookPageUrl: 'https://facebook.com/apexliving',
    locationCode: 'US',
    locationName: 'United States',
    targetCountryCode: 'US',
    businessCountryCode: 'US',
    geographicClassification: 'LOCAL_PROBABLE',
    businessLocationConfidence: 'MEDIUM',
    businessLocationEvidence: ['Mention of major United States metropolitan area: "Chicago"'],
    sampleCopy: 'Modern furniture sets for Chicago apartments.',
    adLibraryIds: ['100000000000001']
  };

  const newCandidate = {
    libraryId: '100000000000002',
    pageName: 'Apex Living',
    bodyCopy: 'Flagship showroom: 120 North Michigan Avenue, Chicago, IL 60611. Phone: +1 312-555-0144.',
    destinationUrl: 'https://apexliving.com'
  };

  const mergeDecision = {
    shouldMerge: true,
    targetKey: 'apex_living',
    confidence: 'STRONG',
    reason: 'MERGE_CANDIDATE_IDENTICAL_PAGE'
  };

  mergeCandidateIntoEntity(initialEntity, newCandidate, mergeDecision, 'furniture', 'US');

  // Classification must be upgraded to LOCAL_VERIFIED
  assert.strictEqual(initialEntity.geographicClassification, 'LOCAL_VERIFIED');
  assert.strictEqual(initialEntity.businessLocationConfidence, 'HIGH');
  assert.strictEqual(initialEntity.businessCountryCode, 'US');
  assert.strictEqual(initialEntity.adLibraryIds.length, 2);
  assert(initialEntity.businessLocationEvidence.some(e => e.includes('Chicago') || e.includes('ZIP')));
});

test('4.2. Entity merge with contradictory foreign headquarters reclassifies to FOREIGN_VERIFIED', () => {
  const initialEntity = {
    id: 'lead_test_002',
    name: 'Nordic Wood Imports',
    canonicalName: 'Nordic Wood Imports',
    locationCode: 'BD',
    locationName: 'Bangladesh',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_PROBABLE',
    businessLocationConfidence: 'MEDIUM',
    businessLocationEvidence: ['Explicit local operational coverage phrase: "delivery all over bangladesh"'],
    sampleCopy: 'Fast delivery all over bangladesh for solid pine furniture.',
    adLibraryIds: ['200000000000001']
  };

  // Brand releases new ad showing they are actually an Indian exporter operating from Mumbai
  const newCandidate = {
    libraryId: '200000000000002',
    pageName: 'Nordic Wood Imports',
    bodyCopy: 'Exporting worldwide! Head office: Bandra West, Mumbai, India. Call headquarters at +91 22 2654 3210.',
    destinationUrl: 'https://nordicwoodimports.in'
  };

  const mergeDecision = {
    shouldMerge: true,
    targetKey: 'nordic_wood',
    confidence: 'STRONG',
    reason: 'MERGE_CANDIDATE_EXACT_NAME'
  };

  mergeCandidateIntoEntity(initialEntity, newCandidate, mergeDecision, 'furniture', 'BD');

  // Reclassification MUST override prior probable local assumption!
  assert.strictEqual(initialEntity.geographicClassification, 'FOREIGN_VERIFIED');
  assert.strictEqual(initialEntity.businessCountryCode, 'IN');
  assert.strictEqual(initialEntity.targetCountryCode, 'BD');
  assert.strictEqual(initialEntity.businessLocationConfidence, 'HIGH');
});

console.log('\n--- Suite 5: Strict-Local Qualification Gate Across Countries ---');

test('5.1. Strict-local mode in US research admits LOCAL_VERIFIED and excludes foreign/unknown', () => {
  const candidates = [
    {
      libraryId: '300000000000001',
      pageName: 'Manhattan Living Furniture',
      bodyCopy: 'Luxury handcrafted furniture, sofas and dining tables at 450 Broadway, New York, NY 10013. Call +1 212-555-0188.',
      destinationUrl: 'https://manhattanliving.com',
      destinationDomain: 'manhattanliving.com',
      ctaText: 'Shop Now',
      observedKeyword: 'furniture'
    },
    {
      libraryId: '300000000000002',
      pageName: 'Shanghai Factory Direct Furniture',
      bodyCopy: 'Factory-direct modular sofas and furniture from our 50,000 square meter factory in Foshan, China. OEM and ODM.',
      destinationUrl: 'https://shanghaifurniture.cn',
      destinationDomain: 'shanghaifurniture.cn',
      ctaText: 'Contact Us',
      observedKeyword: 'furniture'
    },
    {
      libraryId: '300000000000003',
      pageName: 'Nebula Design Furniture',
      bodyCopy: 'Modern furniture catalog available online.',
      destinationUrl: 'https://nebuladesign.com',
      destinationDomain: 'nebuladesign.com',
      ctaText: 'Shop Now',
      observedKeyword: 'furniture'
    }
  ];

  const strictIntent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'US', { strictLocalMode: true });
  const result = aggregateCandidatesToLeads(candidates, 'US', 'United States', 50, [], strictIntent);

  assert.strictEqual(result.leads.length, 1, 'Only the verified local US business should be admitted');
  assert.strictEqual(result.leads[0].name, 'Manhattan Living Furniture');
  assert.strictEqual(result.leads[0].geographicClassification, 'LOCAL_VERIFIED');
  assert.strictEqual(result.leads[0].businessCountryCode, 'US');
  assert.strictEqual(result.rejectedCount, 1, 'Foreign Chinese entity rejected');
  assert.strictEqual(result.uncertainCount, 1, 'Unknown entity held in review queue');
});

test('5.2. Verified local lead in non-matching niche is rejected by relevance engine (Gate integrity)', () => {
  const fashionCandidates = [
    {
      libraryId: '400000000000001',
      pageName: 'Oxford Street Boutique',
      bodyCopy: 'Summer dresses and ladies fashion shoes at 150 Oxford Street, London, W1D 1DJ. Phone: +44 20 7946 0991.',
      destinationUrl: 'https://oxfordstreetfashion.co.uk',
      destinationDomain: 'oxfordstreetfashion.co.uk',
      observedKeyword: 'furniture' // Matched query was furniture, but lead is fashion!
    }
  ];

  // Researching furniture, lead is verified local in GB, but relevance decision must REJECT
  const furnitureIntent = compileResearchIntent('CUSTOM', ['furniture', 'sofa', 'table'], undefined, 'GB', { strictLocalMode: true });
  const result = aggregateCandidatesToLeads(fashionCandidates, 'GB', 'United Kingdom', 50, [], furnitureIntent);

  assert.strictEqual(result.leads.length, 0, 'Must NOT admit non-relevant business even if LOCAL_VERIFIED');
  assert(result.rejectedCount >= 1, 'Fashion business rejected by relevance gate');
});

console.log(`\n================================================================`);
console.log(`ALL ${passed} GLOBAL COUNTRY PROFILE REGRESSION TESTS PASSED!`);
console.log(`================================================================\n`);
