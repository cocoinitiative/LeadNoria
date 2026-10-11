// tests/test-storage-recovery-integrity.mjs
// Phase 0.5: Storage Integrity, Checkpoint Recovery & Deduplication Safety Offline Test Suite

import assert from 'node:assert';
import {
  saveBatch,
  saveRunRecord,
  getAllRelevantLeads,
  getAllStoredLeads,
  getEntity,
  getSeenAdIds,
  getSeenEntityKeys,
  getLatestCheckpoint,
  getStorageStats,
  clearRunData,
  normalizeStoredLead,
  recoverInterruptedRun
} from '../src/extension/bulkStore.ts';
import {
  mergeCandidateIntoEntity
} from '../src/extension/entityResolver.ts';
import {
  exportLeadsToCsv
} from '../src/extension/metaAdapter.ts';
import { isLiveCollectionPermitted } from '../src/config/collectionGate.ts';

console.log('=== RUNNING PHASE 0.5 STORAGE & RECOVERY INTEGRITY TEST SUITE ===\n');

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

async function runAll() {
  // --------------------------------------------------------------------------
  // 1. Storage CRUD and Persistence Roundtrip
  // --------------------------------------------------------------------------
  console.log('1. Storage Persistence & Roundtrip:');

  await runTest('saveBatch and getEntity round trip preserves candidate data', async () => {
    const runId = 'test_run_persist_1';
    await clearRunData(runId);

    const testAd = {
      libraryId: '123456789012345',
      pageName: 'Acme Dental Care',
      pageId: 'page_acme_1',
      adText: 'Book your dental checkup today in Austin TX',
      ctaText: 'Book Now',
      destinationUrl: 'https://acmedental.com/book',
      destinationDomain: 'acmedental.com',
      snapshotUrl: 'https://facebook.com/ads/archive/render_ad/?id=123456789012345'
    };

    const testEntity = {
      name: 'Acme Dental Care',
      canonicalName: 'acme dental care',
      destinationUrl: 'https://acmedental.com/book',
      destinationDomain: 'acmedental.com',
      websiteState: 'found',
      adCount: 1,
      activeAdCount: 1,
      adLibraryIds: ['123456789012345'],
      activeAdLibraryIds: ['123456789012345'],
      targetCountryCode: 'US',
      businessCountryCode: 'US',
      geographicClassification: 'LOCAL_VERIFIED',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adEvidence: [{
        libraryId: '123456789012345',
        ctaType: 'BOOK_TRAVEL',
        destinationType: 'WEBSITE',
        confidence: 'HIGH'
      }]
    };

    const checkpoint = {
      runId,
      batchIndex: 1,
      timestamp: new Date().toISOString(),
      activeKeywordIndex: 0,
      currentKeyword: 'dentist',
      rawAdsCount: 1,
      normalizedCandidatesCount: 1,
      uniqueEntitiesCount: 1,
      relevantEntitiesCount: 1,
      uncertainEntitiesCount: 0,
      notRelevantEntitiesCount: 0,
      duplicatesRemovedCount: 0,
      finalUniqueRelevantLeads: 1,
      seenLibraryIdsCount: 1,
      seenEntityKeysCount: 1
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [testAd],
      entities: [testEntity],
      checkpoint
    });

    const retrieved = await getEntity(runId, 'acme dental care');
    assert.ok(retrieved, 'Entity should be retrievable');
    assert.strictEqual(retrieved.canonicalName, 'acme dental care');
    assert.strictEqual(retrieved.relevanceDecision, 'RELEVANT');
    assert.strictEqual(retrieved.geographicClassification, 'LOCAL_VERIFIED');
    assert.strictEqual(retrieved.adEvidence.length, 1);
  });

  await runTest('getAllRelevantLeads only returns RELEVANT leads and excludes unassessed/uncertain', async () => {
    const runId = 'test_run_relevance_gate';
    await clearRunData(runId);

    const relLead = {
      name: 'Relevant Business',
      canonicalName: 'relevant business',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      adLibraryIds: ['111111111111111']
    };

    const unassessedLead = {
      name: 'Unassessed Business',
      canonicalName: 'unassessed business',
      relevanceDecision: 'UNASSESSED',
      evaluationStatus: 'UNASSESSED',
      geographicClassification: 'LOCAL_VERIFIED',
      adLibraryIds: ['222222222222222']
    };

    const uncertainLead = {
      name: 'Uncertain Business',
      canonicalName: 'uncertain business',
      relevanceDecision: 'RELEVANT', // even if decision field has RELEVANT, evaluationStatus UNCERTAIN must block it
      evaluationStatus: 'UNCERTAIN',
      geographicClassification: 'LOCAL_VERIFIED',
      adLibraryIds: ['333333333333333']
    };

    const rejectedLead = {
      name: 'Rejected Business',
      canonicalName: 'rejected business',
      relevanceDecision: 'NOT_RELEVANT',
      evaluationStatus: 'REJECTED',
      geographicClassification: 'LOCAL_VERIFIED',
      adLibraryIds: ['444444444444444']
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [],
      entities: [relLead, unassessedLead, uncertainLead, rejectedLead],
      checkpoint: {
        runId, batchIndex: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'test', rawAdsCount: 4,
        normalizedCandidatesCount: 4, uniqueEntitiesCount: 4, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 1, notRelevantEntitiesCount: 1, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 4, seenEntityKeysCount: 4
      }
    });

    const relevant = await getAllRelevantLeads(runId);
    assert.strictEqual(relevant.length, 1, 'Only strictly relevant lead must be returned');
    assert.strictEqual(relevant[0].canonicalName, 'relevant business');

    const allStored = await getAllStoredLeads(runId);
    assert.strictEqual(allStored.length, 4, 'All stored leads must be returned for deduplication hydration');
  });

  await runTest('Repeated saves are idempotent and do not duplicate entities or inflate counts', async () => {
    const runId = 'test_run_idempotency_storage';
    await clearRunData(runId);

    const entity = {
      name: 'Stable Plumbing',
      canonicalName: 'stable plumbing',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adLibraryIds: ['999999999999999']
    };

    const payload = {
      batchIndex: 1,
      ads: [{ libraryId: '999999999999999', pageName: 'Stable Plumbing' }],
      entities: [entity],
      checkpoint: {
        runId, batchIndex: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'plumber', rawAdsCount: 1,
        normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1
      }
    };

    // Save batch once
    await saveBatch(runId, payload);
    const stats1 = await getStorageStats(runId);

    // Save identical batch again (re-try or repeated observation)
    await saveBatch(runId, payload);
    const stats2 = await getStorageStats(runId);

    assert.strictEqual(stats2.totalAds, stats1.totalAds, 'Ad count must remain identical');
    assert.strictEqual(stats2.totalEntities, stats1.totalEntities, 'Entity count must remain identical');
    assert.strictEqual(stats2.totalRelevantLeads, stats1.totalRelevantLeads, 'Relevant leads count must remain identical');
  });

  // --------------------------------------------------------------------------
  // 2. Deduplication and Entity Merging
  // --------------------------------------------------------------------------
  console.log('\n2. Deduplication & Entity Merging Invariants:');

  await runTest('Same ad observed twice is deduplicated without evidence inflation', async () => {
    const entity = {
      name: 'Metro Electric',
      canonicalName: 'metro electric',
      adCount: 1,
      activeAdCount: 1,
      adLibraryIds: ['100000000000001'],
      activeAdLibraryIds: ['100000000000001'],
      adEvidence: [{
        libraryId: '100000000000001',
        ctaType: 'CALL',
        destinationType: 'PHONE',
        confidence: 'HIGH'
      }]
    };

    const candidateDuplicate = {
      libraryId: '100000000000001',
      pageName: 'Metro Electric',
      ctaText: 'Call Now',
      destinationUrl: 'tel:+15551234567'
    };

    const decision = {
      shouldMerge: true,
      targetKey: 'metro electric',
      confidence: 'HIGH',
      reason: 'DIRECT_NAME_MATCH',
      relationshipType: 'DIRECT_MATCH'
    };

    mergeCandidateIntoEntity(entity, candidateDuplicate, decision);
    assert.strictEqual(entity.adCount, 1, 'adCount must not increase for duplicate ad observation');
    assert.strictEqual(entity.adEvidence.length, 1, 'adEvidence must not duplicate identical ad');
  });

  await runTest('Distinct ads from same advertiser remain distinct ad-level evidence records', async () => {
    const entity = {
      name: 'Apex Solar',
      canonicalName: 'apex solar',
      adCount: 1,
      activeAdCount: 1,
      adLibraryIds: ['200000000000001'],
      activeAdLibraryIds: ['200000000000001'],
      observedCtaTypes: ['GET_QUOTE'],
      observedDestinationTypes: ['INSTANT_FORM'],
      adEvidence: [{
        libraryId: '200000000000001',
        ctaType: 'GET_QUOTE',
        destinationType: 'INSTANT_FORM',
        confidence: 'HIGH'
      }]
    };

    const secondAdCandidate = {
      libraryId: '200000000000002',
      pageName: 'Apex Solar',
      ctaText: 'Learn More',
      destinationUrl: 'https://apexsolar.com/solutions',
      destinationDomain: 'apexsolar.com'
    };

    const decision = {
      shouldMerge: true,
      targetKey: 'apex solar',
      confidence: 'HIGH',
      reason: 'DIRECT_NAME_MATCH',
      relationshipType: 'DIRECT_MATCH'
    };

    mergeCandidateIntoEntity(entity, secondAdCandidate, decision);
    assert.strictEqual(entity.adCount, 2, 'adCount must increment to 2');
    assert.strictEqual(entity.adEvidence.length, 2, 'Must have distinct ad-level evidence for both ads');
    assert.ok(entity.observedDestinationTypes.includes('INSTANT_FORM'), 'Must preserve instant form');
    assert.ok(entity.observedDestinationTypes.includes('EXTERNAL_WEBSITE'), 'Must record new website destination');
  });

  await runTest('Entity merge preserves existing geographic evidence and does not discard it', async () => {
    const entity = {
      name: 'Global Tech Dhaka',
      canonicalName: 'global tech dhaka',
      targetCountryCode: 'BD',
      businessCountryCode: 'BD',
      geographicClassification: 'LOCAL_VERIFIED',
      businessLocationConfidence: 'HIGH',
      businessLocationEvidence: ['DHAKA_CITY_TOKEN', 'PHONE_BD_+880'],
      adCount: 1,
      activeAdCount: 1,
      adLibraryIds: ['300000000000001'],
      activeAdLibraryIds: ['300000000000001'],
      adEvidence: []
    };

    const newAdCandidate = {
      libraryId: '300000000000002',
      pageName: 'Global Tech Dhaka',
      bodyCopy: 'General software solutions for international enterprises.'
    };

    const decision = {
      shouldMerge: true,
      targetKey: 'global tech dhaka',
      confidence: 'HIGH',
      reason: 'DIRECT_NAME_MATCH',
      relationshipType: 'DIRECT_MATCH'
    };

    mergeCandidateIntoEntity(entity, newAdCandidate, decision);
    assert.strictEqual(entity.geographicClassification, 'LOCAL_VERIFIED', 'Classification must survive merge');
    assert.strictEqual(entity.businessLocationConfidence, 'HIGH', 'Confidence must survive merge');
    assert.ok(entity.businessLocationEvidence.includes('DHAKA_CITY_TOKEN'), 'Geo evidence tokens must survive');
  });

  // --------------------------------------------------------------------------
  // 3. Checkpoint & Interruption Recovery
  // --------------------------------------------------------------------------
  console.log('\n3. Checkpoints & Recovery Consistency:');

  await runTest('getLatestCheckpoint accurately resolves the highest batchIndex', async () => {
    const runId = 'test_run_checkpoints';
    await clearRunData(runId);

    const cp1 = { runId, batchIndex: 1, timestamp: '2026-10-12T01:00:00Z', activeKeywordIndex: 0, currentKeyword: 'kw1', rawAdsCount: 10, normalizedCandidatesCount: 10, uniqueEntitiesCount: 5, relevantEntitiesCount: 3, uncertainEntitiesCount: 1, notRelevantEntitiesCount: 1, duplicatesRemovedCount: 5, finalUniqueRelevantLeads: 3, seenLibraryIdsCount: 10, seenEntityKeysCount: 5 };
    const cp2 = { runId, batchIndex: 2, timestamp: '2026-10-12T01:05:00Z', activeKeywordIndex: 1, currentKeyword: 'kw2', rawAdsCount: 25, normalizedCandidatesCount: 25, uniqueEntitiesCount: 12, relevantEntitiesCount: 8, uncertainEntitiesCount: 2, notRelevantEntitiesCount: 2, duplicatesRemovedCount: 13, finalUniqueRelevantLeads: 8, seenLibraryIdsCount: 25, seenEntityKeysCount: 12 };

    await saveBatch(runId, { batchIndex: 1, ads: [], entities: [], checkpoint: cp1 });
    await saveBatch(runId, { batchIndex: 2, ads: [], entities: [], checkpoint: cp2 });

    const latest = await getLatestCheckpoint(runId);
    assert.ok(latest, 'Must retrieve latest checkpoint');
    assert.strictEqual(latest.batchIndex, 2, 'Latest checkpoint must be batch 2');
    assert.strictEqual(latest.relevantEntitiesCount, 8);
  });

  await runTest('recoverInterruptedRun detects state consistency and missing checkpoints', async () => {
    const runId = 'test_run_recovery_audit';
    await clearRunData(runId);

    const cp = { runId, batchIndex: 1, timestamp: new Date().toISOString(), activeKeywordIndex: 0, currentKeyword: 'roofing', rawAdsCount: 10, normalizedCandidatesCount: 10, uniqueEntitiesCount: 5, relevantEntitiesCount: 2, uncertainEntitiesCount: 0, notRelevantEntitiesCount: 3, duplicatesRemovedCount: 5, finalUniqueRelevantLeads: 2, seenLibraryIdsCount: 10, seenEntityKeysCount: 5 };
    
    // We store only 1 ad while checkpoint recorded 10
    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '400000000000001', pageName: 'Roof Co' }],
      entities: [{ name: 'Roof Co', canonicalName: 'roof co', relevanceDecision: 'RELEVANT', evaluationStatus: 'RELEVANT', adLibraryIds: ['400000000000001'] }],
      checkpoint: cp
    });

    const report = await recoverInterruptedRun(runId);
    assert.ok(report.hasCheckpoint, 'Report flags presence of checkpoint');
    assert.strictEqual(report.isConsistent, false, 'Report flags discrepancy between stored ads and recorded ads');
    assert.ok(report.discrepancies.length > 0, 'Discrepancy reason provided');
  });

  await runTest('Phase 0.1 Safety Gate remains active and fail-closed during resume check', () => {
    assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted must return false');
  });

  // --------------------------------------------------------------------------
  // 4. Schema Normalization & Legacy Compatibility
  // --------------------------------------------------------------------------
  console.log('\n4. Schema Normalization & Legacy Record Safety:');

  await runTest('normalizeStoredLead never converts unevaluated relevance to RELEVANT', () => {
    const legacyRecord = {
      name: 'Old Entity',
      adLibraryIds: ['500000000000001'],
      // relevanceDecision is missing
    };

    const normalized = normalizeStoredLead(legacyRecord);
    assert.strictEqual(normalized.relevanceDecision, 'UNASSESSED', 'Missing relevanceDecision must normalize to UNASSESSED');
  });

  await runTest('normalizeStoredLead never fabricates LOCAL_VERIFIED from missing geographic evidence', () => {
    const legacyRecord = {
      name: 'Mystery Business',
      targetCountryCode: 'US',
      // no businessCountryCode or geographicClassification
    };

    const normalized = normalizeStoredLead(legacyRecord);
    assert.strictEqual(normalized.geographicClassification, 'LOCATION_UNKNOWN');
    assert.notStrictEqual(normalized.geographicClassification, 'LOCAL_VERIFIED');
  });

  await runTest('normalizeStoredLead never converts missing destination URL into NO_VISIBLE_DESTINATION proof', () => {
    const legacyRecord = {
      name: 'Unclear Destination Lead',
      // destinationUrl missing
      websiteState: 'not_found'
    };

    const normalized = normalizeStoredLead(legacyRecord);
    assert.strictEqual(normalized.websiteState, 'unknown', 'Missing destination URL must normalize to unknown, not not_found');
  });

  await runTest('normalizeStoredLead is strictly idempotent', () => {
    const record = {
      name: 'Zenith Spa',
      canonicalName: 'zenith spa',
      adLibraryIds: ['600000000000001'],
      destinationUrl: 'https://zenithspa.com',
      destinationDomain: 'zenithspa.com',
      websiteState: 'found',
      targetCountryCode: 'GB',
      businessCountryCode: 'GB',
      geographicClassification: 'LOCAL_VERIFIED',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT'
    };

    const firstPass = normalizeStoredLead(record);
    const secondPass = normalizeStoredLead(firstPass);
    assert.deepStrictEqual(firstPass, secondPass, 'Second normalization pass must produce identical object');
  });

  // --------------------------------------------------------------------------
  // 5. Export Consistency & Qualification Guardrails
  // --------------------------------------------------------------------------
  console.log('\n5. Export Consistency & Qualification Guardrails:');

  await runTest('exportLeadsToCsv exports strict-local qualified leads safely and protects formulas', () => {
    const leads = [
      {
        name: '=cmd|"/c calc"!A0', // Formula injection attempt in name
        canonicalName: 'formula attack',
        facebookPageName: 'Attack Page',
        destinationUrl: 'https://legit.com',
        destinationDomain: 'legit.com',
        websiteState: 'found',
        geographicClassification: 'LOCAL_VERIFIED',
        relevanceDecision: 'RELEVANT',
        evaluationStatus: 'RELEVANT',
        status: 'QUALIFIED',
        adCount: 1,
        activeAdCount: 1,
        adLibraryIds: ['700000000000001'],
        primaryCtaType: 'LEARN_MORE',
        primaryDestinationType: 'WEBSITE'
      },
      {
        name: 'Foreign Co',
        canonicalName: 'foreign co',
        geographicClassification: 'FOREIGN_VERIFIED',
        relevanceDecision: 'RELEVANT',
        evaluationStatus: 'RELEVANT',
        status: 'REVIEW_REQUIRED',
        adLibraryIds: ['700000000000002']
      }
    ];

    const csvStrict = exportLeadsToCsv(leads, { qualifiedOnly: true });
    assert.ok(csvStrict.includes('\'=cmd'), 'CSV formula injection must be sanitized with prepended single quote');
    assert.strictEqual(csvStrict.includes('Foreign Co'), false, 'Strict-local export must exclude FOREIGN_VERIFIED records');

    // Repeated export produces identical string
    const csvStrictRepeat = exportLeadsToCsv(leads, { qualifiedOnly: true });
    assert.strictEqual(csvStrict, csvStrictRepeat, 'Repeated exports must be strictly deterministic');
  });

  console.log(`\n======================================================`);
  console.log(`Phase 0.5 Tests Completed: ${passed} Passed, ${failed} Failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
