/**
 * LEADNORIA v1.7.6 — DEDICATED STRICT LOCAL MODE CONTRACT & EXPORT AUDIT SUITE
 *
 * Verifies the contract for both:
 * 1. General Discovery Mode (all relevant entities retained, foreign stamped transparently)
 * 2. Strict Local Mode (foreign strictly excluded, location unknown held for review)
 * 3. Ultra-Strict Local Mode (only LOCAL_VERIFIED admitted, probable held for review)
 *
 * Tested across:
 * - metaAdapter.aggregateCandidatesToLeads()
 * - bulkProcessor.processBatch()
 * - exportLeadsToCsv()
 */

import assert from 'node:assert';
import { aggregateCandidatesToLeads, exportLeadsToCsv } from '../src/extension/metaAdapter.ts';
import { processBatch } from '../src/extension/bulkProcessor.ts';
import { compileResearchIntent } from '../src/extension/relevanceEngine.ts';

console.log('========================================================================');
console.log('LEADNORIA v1.7.6 — DEDICATED STRICT LOCAL MODE CONTRACT AUDIT');
console.log('========================================================================\n');

// 4 Mixed Candidate Fixtures (Targeting Bangladesh, BD)
const candidateFixtures = [
  // 1. LOCAL_VERIFIED: Explicit BD phone (+880) and physical Dhaka location
  {
    libraryId: '100000000000001',
    pageName: 'Dhaka Modern Furniture',
    facebookPageUrl: 'https://facebook.com/dhakamodernfurniture',
    destinationUrl: 'https://dhakamodern.com',
    destinationDomain: 'dhakamodern.com',
    bodyCopy: 'Custom luxury living room sofa and dining table. Call us at +880 1712-345678 or visit our Gulshan showroom.',
    ctaText: 'Call Now',
    observedKeyword: 'furniture'
  },
  // 2. LOCAL_PROBABLE: Mention of local cities & .bd domain, but no explicit phone/address
  {
    libraryId: '100000000000002',
    pageName: 'Chittagong Woodcraft & Furniture',
    facebookPageUrl: 'https://facebook.com/ctgcraft',
    destinationUrl: 'https://ctgcraft.com.bd',
    destinationDomain: 'ctgcraft.com.bd',
    bodyCopy: 'Solid Chittagong teak wood beds, chairs, and office desks with delivery across Dhaka and Sylhet.',
    ctaText: 'Shop Now',
    observedKeyword: 'furniture'
  },
  // 3. FOREIGN_VERIFIED: Indian phone (+91) and Jaipur mention advertising in BD
  {
    libraryId: '100000000000003',
    pageName: 'Jaipur Heritage Furniture',
    facebookPageUrl: 'https://facebook.com/jaipurheritage',
    destinationUrl: 'https://jaipurheritage.in',
    destinationDomain: 'jaipurheritage.in',
    bodyCopy: 'Handcrafted Sheesham wood furniture direct from our factory in Jaipur, India. WhatsApp +91 98290-12345.',
    ctaText: 'Contact Us',
    observedKeyword: 'furniture'
  },
  // 4. LOCATION_UNKNOWN: Relevant furniture copy but zero geographic evidence
  {
    libraryId: '100000000000004',
    pageName: 'Aesthetic Living Furniture',
    facebookPageUrl: 'https://facebook.com/aestheticliving',
    destinationUrl: 'https://aestheticliving.com',
    destinationDomain: 'aestheticliving.com',
    bodyCopy: 'Ergonomic office chairs, executive desks, and modern modular workstations for contemporary spaces.',
    ctaText: 'Learn More',
    observedKeyword: 'furniture'
  }
];

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

(async () => {
  // -----------------------------------------------------------------------------
  // TEST SUITE 1: General Discovery Mode (Default / Baseline)
  // -----------------------------------------------------------------------------
  console.log('--- SUITE 1: General Discovery Mode (AUTO_DISCOVERY) ---');

  await runTest('1.1: General discovery retains all 4 relevant entities with transparent classifications', () => {
    const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', { strictLocalMode: false });
    const result = aggregateCandidatesToLeads(candidateFixtures, 'BD', 'Bangladesh', 10, [], intent);

    assert.strictEqual(result.leads.length, 4, 'All 4 relevant candidates must be retained');
    
    const geoMap = Object.fromEntries(result.leads.map(l => [l.name, l.geographicClassification]));
    assert.strictEqual(geoMap['Dhaka Modern Furniture'], 'LOCAL_VERIFIED');
    assert.strictEqual(geoMap['Chittagong Woodcraft & Furniture'], 'LOCAL_PROBABLE');
    assert.strictEqual(geoMap['Jaipur Heritage Furniture'], 'FOREIGN_VERIFIED');
    assert.strictEqual(geoMap['Aesthetic Living Furniture'], 'LOCATION_UNKNOWN');
  });

  await runTest('1.2: General discovery CSV export contains exactly 4 rows with all geographic headers', () => {
    const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', { strictLocalMode: false });
    const result = aggregateCandidatesToLeads(candidateFixtures, 'BD', 'Bangladesh', 10, [], intent);
    const csv = exportLeadsToCsv(result.leads);
    
    const lines = csv.trim().split(/\r?\n/).filter(line => !line.startsWith('#'));
    const dataRows = lines.slice(1);
    assert.strictEqual(dataRows.length, 4, 'CSV must have exactly 4 data rows');
    
    assert.ok(csv.includes('"FOREIGN_VERIFIED"'));
    assert.ok(csv.includes('"LOCATION_UNKNOWN"'));
    assert.ok(csv.includes('"LOCAL_PROBABLE"'));
    assert.ok(csv.includes('"LOCAL_VERIFIED"'));
  });

  // -----------------------------------------------------------------------------
  // TEST SUITE 2: Strict Local Mode (Default: allowProbableLocal = true)
  // -----------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Strict Local Mode (strictLocalMode = true, allowProbableLocal = true) ---');

  await runTest('2.1: Strict local mode excludes FOREIGN_VERIFIED and holds LOCATION_UNKNOWN', () => {
    const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
      strictLocalMode: true,
      allowProbableLocal: true
    });
    const result = aggregateCandidatesToLeads(candidateFixtures, 'BD', 'Bangladesh', 10, [], intent);

    assert.strictEqual(result.leads.length, 2, 'Exactly 2 local entities (LOCAL_VERIFIED + LOCAL_PROBABLE) admitted');
    assert.strictEqual(result.rejectedCount, 1, 'Jaipur entity rejected as FOREIGN_BUSINESS');
    assert.strictEqual(result.uncertainCount, 1, 'Aesthetic Living held as LOCATION_UNKNOWN');

    const names = result.leads.map(l => l.name);
    assert.ok(names.includes('Dhaka Modern Furniture'), 'Must include LOCAL_VERIFIED entity');
    assert.ok(names.includes('Chittagong Woodcraft & Furniture'), 'Must include LOCAL_PROBABLE entity');
    assert.ok(!names.includes('Jaipur Heritage Furniture'), 'Must NOT include FOREIGN_VERIFIED entity');
    assert.ok(!names.includes('Aesthetic Living Furniture'), 'Must NOT include LOCATION_UNKNOWN entity');
  });

  await runTest('2.2: Strict local mode CSV export contains ONLY verified and probable local leads', () => {
    const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
      strictLocalMode: true,
      allowProbableLocal: true
    });
    const result = aggregateCandidatesToLeads(candidateFixtures, 'BD', 'Bangladesh', 10, [], intent);
    const csv = exportLeadsToCsv(result.leads);

    const lines = csv.trim().split(/\r?\n/).filter(line => !line.startsWith('#'));
    const dataRows = lines.slice(1);
    assert.strictEqual(dataRows.length, 2, 'CSV must have exactly 2 data rows');
    
    assert.ok(!csv.includes('"FOREIGN_VERIFIED"'), 'Zero foreign entities in strict local CSV');
    assert.ok(!csv.includes('"LOCATION_UNKNOWN"'), 'Zero unknown entities in strict local CSV');
  });

  // -----------------------------------------------------------------------------
  // TEST SUITE 3: Ultra-Strict Local Mode (allowProbableLocal = false)
  // -----------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Ultra-Strict Local Mode (allowProbableLocal = false) ---');

  await runTest('3.1: Ultra-strict local mode admits ONLY LOCAL_VERIFIED (holds probable and unknown)', () => {
    const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
      strictLocalMode: true,
      allowProbableLocal: false
    });
    const result = aggregateCandidatesToLeads(candidateFixtures, 'BD', 'Bangladesh', 10, [], intent);

    assert.strictEqual(result.leads.length, 1, 'Only LOCAL_VERIFIED admitted');
    assert.strictEqual(result.leads[0].name, 'Dhaka Modern Furniture');
    assert.strictEqual(result.leads[0].geographicClassification, 'LOCAL_VERIFIED');
    assert.strictEqual(result.rejectedCount, 1, 'Foreign entity rejected');
    assert.strictEqual(result.uncertainCount, 2, 'Probable and Unknown both held in uncertainCount');
  });

  // -----------------------------------------------------------------------------
  // TEST SUITE 4: Bulk Streaming Processor Parity
  // -----------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Bulk Processor Batch Streaming Parity ---');

  await runTest('4.1: processBatch strictly excludes foreign entities in strictLocalMode', async () => {
    const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
      strictLocalMode: true,
      allowProbableLocal: true
    });

    const existingEntitiesMap = new Map();
    const seenAdLibraryIds = new Set();
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
      finalUniqueRelevantLeads: 0,
      uniqueEntitiesObserved: 0,
      relevantEntities: 0,
      notRelevantEntities: 0,
      uncertainEntities: 0,
      reasonCodes: {}
    };

    const batchResult = await processBatch(
      candidateFixtures,
      existingEntitiesMap,
      seenAdLibraryIds,
      seenEntityKeys,
      currentCounters,
      {
        runId: 'test_run_1',
        countryCode: 'BD',
        locationName: 'Bangladesh',
        currentKeyword: 'furniture',
        intent,
        effectiveCeiling: 10,
        seenRejectedEntityKeys,
        seenUncertainEntityKeys
      }
    );

    assert.strictEqual(batchResult.updatedEntities.length, 2, 'Batch must produce exactly 2 local leads');
    assert.strictEqual(batchResult.counters.relevantEntities, 2, '2 relevant local entities');
    assert.strictEqual(batchResult.counters.notRelevantEntities, 1, '1 rejected foreign entity');
    assert.strictEqual(batchResult.counters.uncertainEntities, 1, '1 uncertain location entity');
    assert.strictEqual(batchResult.counters.uniqueEntitiesObserved, 4, 'Ledger parity: 2 + 1 + 1 = 4 total observed entities');
    assert.strictEqual(batchResult.counters.rawAds, 4, 'Raw ads count equals 4');
  });

  console.log('\n========================================================================');
  console.log(`ALL ${passedTests} / ${totalTests} STRICT LOCAL MODE CONTRACT TESTS PASSED!`);
  console.log('========================================================================\n');
})();
