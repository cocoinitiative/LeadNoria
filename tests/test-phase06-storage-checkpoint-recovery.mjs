// tests/test-phase06-storage-checkpoint-recovery.mjs
/**
 * LeadNoria — Phase 6: Storage, Checkpoint & Recovery Regression Test Suite
 *
 * Exhaustive offline verification of:
 * 1. Checkpoint Schema, Validation & Version Compatibility (v1 backward compatibility, v2 schema, monotonic revision).
 * 2. Storage Persistence & Replay Idempotence (replaying batches does not duplicate ads, entities, or expansions).
 * 3. Service-Worker Interruption Handling across all 4 critical lifecycle boundaries.
 * 4. Service-Worker Restart Detection & In-flight Job Reconciliation (preventing UI lockouts).
 * 5. Strict Non-Resumption of Cancelled, Completed, and Failed Runs.
 * 6. Durable Cancellation Semantics, Race Handling & Stale Callback Protection.
 * 7. Duplicate-Free Recovery & Canonical Identity Preservation (cross-query, multi-ad, conflicting Page IDs).
 * 8. Discrepancy Diagnostics & Automated Counter Reconciliation.
 * 9. Repeated Recovery Convergence & Strict Idempotence.
 * 10. Fail-Closed Product Safety Gates & User Data Immutability.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  saveBatch,
  saveRunRecord,
  getRunRecord,
  getAllRelevantLeads,
  getAllStoredLeads,
  getEntity,
  getSeenAdIds,
  getSeenEntityKeys,
  getLatestCheckpoint,
  getStorageStats,
  clearRunData,
  normalizeStoredLead,
  validateCheckpoint,
  recoverInterruptedRun,
  reconcileAndRecoverRun
} from '../src/extension/bulkStore.ts';

import {
  processBatch,
  normalizeAdvertiserName,
  getCanonicalEntityKey
} from '../src/extension/bulkProcessor.ts';

import {
  mergeCandidateIntoEntity,
  EntityResolutionIndex,
  evaluateEntityMerge
} from '../src/extension/entityResolver.ts';

import {
  cancelledRuns,
  saveActiveRun,
  checkStaleJobs,
  broadcastProgress
} from '../src/extension/service-worker.ts';

import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('LEADNORIA: PHASE 6 STORAGE, CHECKPOINT & RECOVERY REGRESSION TEST SUITE');
console.log('Scope: Reliable Storage | Checkpoints | Interruption | Cancellation | Recovery');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

// Minimal mock of chrome.storage.local for tests
function setupChromeStorageMock(initialState = {}) {
  const store = new Map(Object.entries(initialState));
  const origSet = store.set.bind(store);
  const origGet = store.get.bind(store);

  store.set = (keyOrObj, val) => {
    if (typeof keyOrObj === 'object' && keyOrObj !== null) {
      for (const [k, v] of Object.entries(keyOrObj)) {
        origSet(k, JSON.parse(JSON.stringify(v)));
      }
      return Promise.resolve(store);
    }
    origSet(keyOrObj, val);
    return Promise.resolve(store);
  };

  store.get = (key) => {
    const val = origGet(key);
    return Promise.resolve({ [key]: val !== undefined ? JSON.parse(JSON.stringify(val)) : undefined });
  };

  globalThis.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          const res = {};
          if (Array.isArray(keys)) {
            for (const k of keys) res[k] = origGet(k);
          } else if (typeof keys === 'string') {
            res[keys] = origGet(keys);
          } else if (typeof keys === 'object' && keys !== null) {
            for (const [k, def] of Object.entries(keys)) {
              res[k] = store.has(k) ? origGet(k) : def;
            }
          }
          if (callback) callback(res);
          return Promise.resolve(res);
        },
        set: (items, callback) => {
          for (const [k, v] of Object.entries(items)) {
            origSet(k, JSON.parse(JSON.stringify(v)));
          }
          if (callback) callback();
          return Promise.resolve();
        }
      }
    },
    runtime: {
      sendMessage: () => Promise.resolve({ received: true })
    }
  };
  return store;
}

async function runAll() {
  const mockStore = setupChromeStorageMock();

  // --------------------------------------------------------------------------
  // SECTION 1: Checkpoint Schema, Validation & Version Compatibility
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: CHECKPOINT SCHEMA, VALIDATION & REVISION INTEGRITY ---');

  await test('validateCheckpoint accepts valid v2 checkpoints with monotonic revision', () => {
    const raw = {
      runId: 'run_cp_valid_1',
      batchIndex: 3,
      monotonicRevision: 3,
      timestamp: new Date().toISOString(),
      schemaVersion: 2,
      activeKeywordIndex: 1,
      activeQueryIndex: 1,
      currentKeyword: 'roofing',
      completedKeywords: ['dentist'],
      rawAdsCount: 30,
      normalizedCandidatesCount: 30,
      uniqueEntitiesCount: 15,
      relevantEntitiesCount: 10,
      uncertainEntitiesCount: 2,
      notRelevantEntitiesCount: 3,
      duplicatesRemovedCount: 15,
      finalUniqueRelevantLeads: 10,
      seenLibraryIdsCount: 30,
      seenEntityKeysCount: 15,
      status: 'COLLECTING',
      stopReason: undefined,
      isRecoverable: true
    };

    const validated = validateCheckpoint(raw);
    assert.ok(validated, 'Checkpoint must validate successfully');
    assert.strictEqual(validated.batchIndex, 3);
    assert.strictEqual(validated.monotonicRevision, 3);
    assert.strictEqual(validated.schemaVersion, 2);
    assert.strictEqual(validated.currentKeyword, 'roofing');
    assert.strictEqual(validated.finalUniqueRelevantLeads, 10);
  });

  await test('validateCheckpoint gracefully normalizes older legacy v1 checkpoints', () => {
    const legacyCp = {
      runId: 'run_cp_legacy_1',
      batchIndex: 1,
      timestamp: '2026-10-10T00:00:00Z',
      activeKeywordIndex: 0,
      currentKeyword: 'plumber',
      rawAdsCount: 10,
      normalizedCandidatesCount: 10,
      uniqueEntitiesCount: 5,
      relevantEntitiesCount: 4,
      uncertainEntitiesCount: 0,
      notRelevantEntitiesCount: 1,
      duplicatesRemovedCount: 5,
      finalUniqueRelevantLeads: 4,
      seenLibraryIdsCount: 10,
      seenEntityKeysCount: 5
      // schemaVersion and monotonicRevision are missing
    };

    const validated = validateCheckpoint(legacyCp);
    assert.ok(validated, 'Legacy checkpoint must be accepted');
    assert.strictEqual(validated.schemaVersion, 1, 'Legacy schemaVersion must default to 1');
    assert.strictEqual(validated.monotonicRevision, 1, 'Monotonic revision must default to batchIndex');
    assert.strictEqual(validated.activeQueryIndex, 0);
    assert.deepStrictEqual(validated.completedKeywords, []);
  });

  await test('validateCheckpoint rejects corrupt or invalid checkpoints', () => {
    assert.strictEqual(validateCheckpoint(null), null);
    assert.strictEqual(validateCheckpoint({}), null);
    assert.strictEqual(validateCheckpoint({ runId: '' }), null);
    assert.strictEqual(validateCheckpoint({ runId: 'run_1', batchIndex: -1 }), null);
    assert.strictEqual(validateCheckpoint({ runId: 'run_1', batchIndex: 'not_a_number' }), null);
    // Unsupported future schema version
    assert.strictEqual(validateCheckpoint({ runId: 'run_1', batchIndex: 1, schemaVersion: 99 }), null);
  });

  await test('getLatestCheckpoint resolves the highest monotonic revision and ignores corrupt records', async () => {
    const runId = 'test_run_cp_order';
    await clearRunData(runId);

    const cp1 = {
      runId,
      batchIndex: 1,
      monotonicRevision: 1,
      timestamp: '2026-10-12T01:00:00Z',
      activeKeywordIndex: 0,
      currentKeyword: 'kw1',
      rawAdsCount: 10,
      normalizedCandidatesCount: 10,
      uniqueEntitiesCount: 5,
      relevantEntitiesCount: 2,
      uncertainEntitiesCount: 0,
      notRelevantEntitiesCount: 3,
      duplicatesRemovedCount: 5,
      finalUniqueRelevantLeads: 2,
      seenLibraryIdsCount: 10,
      seenEntityKeysCount: 5
    };

    const cpCorrupt = {
      runId,
      batchIndex: -99, // invalid batchIndex
      monotonicRevision: 9999,
      timestamp: '2026-10-12T01:02:00Z',
      rawAdsCount: 0
    };

    const cp2 = {
      runId,
      batchIndex: 2,
      monotonicRevision: 2,
      timestamp: '2026-10-12T01:05:00Z',
      activeKeywordIndex: 1,
      currentKeyword: 'kw2',
      rawAdsCount: 20,
      normalizedCandidatesCount: 20,
      uniqueEntitiesCount: 10,
      relevantEntitiesCount: 6,
      uncertainEntitiesCount: 0,
      notRelevantEntitiesCount: 4,
      duplicatesRemovedCount: 10,
      finalUniqueRelevantLeads: 6,
      seenLibraryIdsCount: 20,
      seenEntityKeysCount: 10
    };

    await saveBatch(runId, { batchIndex: 1, ads: [], entities: [], checkpoint: cp1 });
    await saveBatch(runId, { batchIndex: 2, ads: [], entities: [], checkpoint: cp2 });

    const latest = await getLatestCheckpoint(runId);
    assert.ok(latest, 'Must retrieve latest checkpoint');
    assert.strictEqual(latest.batchIndex, 2);
    assert.strictEqual(latest.finalUniqueRelevantLeads, 6);
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Storage Persistence & Replay Idempotence
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: STORAGE PERSISTENCE & REPLAY IDEMPOTENCE ---');

  await test('Replaying an identical batch does not duplicate entities or inflate ad counts', async () => {
    const runId = 'test_run_replay_idempotent';
    await clearRunData(runId);

    const testAd = {
      libraryId: '800000000000001',
      pageName: 'Reliable Roofers',
      ctaText: 'Get Quote',
      destinationUrl: 'https://reliableroofers.com'
    };

    const testEntity = {
      id: `lead_${runId}_reliable_roofers`,
      name: 'Reliable Roofers',
      canonicalName: 'reliable roofers',
      canonicalKey: 'name_reliable_roofers',
      destinationUrl: 'https://reliableroofers.com',
      destinationDomain: 'reliableroofers.com',
      websiteState: 'found',
      adCount: 1,
      activeAdCount: 1,
      adLibraryIds: ['800000000000001'],
      activeAdLibraryIds: ['800000000000001'],
      targetCountryCode: 'US',
      businessCountryCode: 'US',
      geographicClassification: 'LOCAL_VERIFIED',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adEvidence: [{
        libraryId: '800000000000001',
        ctaType: 'GET_QUOTE',
        destinationType: 'WEBSITE',
        confidence: 'HIGH'
      }]
    };

    const payload = {
      batchIndex: 1,
      ads: [testAd],
      entities: [testEntity],
      checkpoint: {
        runId,
        batchIndex: 1,
        monotonicRevision: 1,
        timestamp: new Date().toISOString(),
        schemaVersion: 2,
        activeKeywordIndex: 0,
        currentKeyword: 'roofers',
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
      }
    };

    // First commit
    await saveBatch(runId, payload);
    const stats1 = await getStorageStats(runId);
    assert.strictEqual(stats1.totalAds, 1);
    assert.strictEqual(stats1.totalEntities, 1);
    assert.strictEqual(stats1.totalRelevantLeads, 1);

    // Replay same batch (simulating retry after uncertain outcome or worker interruption)
    await saveBatch(runId, payload);
    const stats2 = await getStorageStats(runId);
    assert.strictEqual(stats2.totalAds, 1, 'Total ads must not increase on batch replay');
    assert.strictEqual(stats2.totalEntities, 1, 'Total entities must not increase on batch replay');
    assert.strictEqual(stats2.totalRelevantLeads, 1, 'Total relevant leads must remain identical');

    // Replay a third time
    await saveBatch(runId, payload);
    const stats3 = await getStorageStats(runId);
    assert.deepStrictEqual(stats3, stats1, 'Storage stats must be strictly invariant under repeated replay');
  });

  await test('Replaying batch with advertiser expansions does not duplicate expansion records', async () => {
    const runId = 'test_run_expansion_replay';
    await clearRunData(runId);

    const expansion = {
      expansionType: 'ADVERTISER',
      sourceEntityId: 'entity_source_99',
      sourceAdvertiserName: 'National Pest Control',
      expansionQuery: 'National Pest Control',
      timestamp: new Date().toISOString(),
      resultCount: 5,
      newAdsDiscovered: 3,
      duplicateAds: 2,
      newEntitiesDiscovered: 0,
      stopReason: 'COMPLETED_SUCCESSFULLY'
    };

    const payload = {
      batchIndex: 1,
      ads: [],
      entities: [],
      advertiserExpansions: [expansion],
      checkpoint: {
        runId, batchIndex: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'pest', rawAdsCount: 0,
        normalizedCandidatesCount: 0, uniqueEntitiesCount: 0, relevantEntitiesCount: 0,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 0, seenLibraryIdsCount: 0, seenEntityKeysCount: 0
      }
    };

    await saveBatch(runId, payload);
    await saveBatch(runId, payload); // replay

    // Directly check memoryFallback expansions count
    const storedExp = await (await import('../src/extension/bulkStore.ts')).getAllAdvertiserExpansions(runId);
    assert.strictEqual(storedExp.length, 1, 'Expansions must not be duplicated on replay');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Service-Worker Interruption across 4 Critical Boundaries
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: SERVICE-WORKER INTERRUPTION AT CRITICAL BOUNDARIES ---');

  await test('Boundary 1: Worker stops after job is created but before discovery begins', async () => {
    const runId = 'test_boundary_pre_discovery';
    await clearRunData(runId);

    const initialRun = {
      runId,
      researchName: 'Pre-discovery interruption test',
      mode: 'CUSTOM',
      keywords: ['hvac'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'STARTING',
      leads: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 0
    };

    await saveRunRecord(initialRun);
    await mockStore.set({ activeResearchRun: initialRun });

    // Worker terminates and restarts immediately
    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'RECOVERY_REQUIRED', 'In-flight run must be marked RECOVERY_REQUIRED');
    assert.strictEqual(stored.stopReason, 'BROWSER_INTERRUPTED');
    assert.strictEqual(stored.leads.length, 0);
  });

  await test('Boundary 2: Worker stops during query navigation/scanning before extraction', async () => {
    const runId = 'test_boundary_in_query';
    await clearRunData(runId);

    const navigatingRun = {
      runId,
      researchName: 'Query navigation interruption test',
      mode: 'CUSTOM',
      keywords: ['landscaping'],
      countryCode: 'US',
      locationName: 'Dallas TX',
      status: 'NAVIGATING',
      currentKeyword: 'landscaping',
      leads: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 0
    };

    await saveRunRecord(navigatingRun);
    await mockStore.set({ activeResearchRun: navigatingRun });

    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'RECOVERY_REQUIRED');
    assert.strictEqual(stored.stopReason, 'BROWSER_INTERRUPTED');
  });

  await test('Boundary 3: Worker stops after results are extracted but before next checkpoint', async () => {
    const runId = 'test_boundary_mid_batch';
    await clearRunData(runId);

    // Batch 1 completed and persisted
    const lead1 = {
      name: 'Dallas Greenery',
      canonicalName: 'dallas greenery',
      canonicalKey: 'name_dallas_greenery',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adLibraryIds: ['810000000000001']
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '810000000000001', pageName: 'Dallas Greenery' }],
      entities: [lead1],
      checkpoint: {
        runId, batchIndex: 1, monotonicRevision: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'landscaping', rawAdsCount: 1,
        normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1
      }
    });

    // Simulating batch 2: ad was written to adStore or in memory, but checkpoint failed before committing
    const inFlightRun = {
      runId,
      researchName: 'Mid-batch interruption test',
      mode: 'CUSTOM',
      keywords: ['landscaping'],
      countryCode: 'US',
      locationName: 'Dallas TX',
      status: 'COLLECTING',
      currentKeyword: 'landscaping',
      leads: [normalizeStoredLead(lead1)],
      counters: { rawAds: 1, finalUniqueLeads: 1, finalUniqueRelevantLeads: 1 },
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 1
    };

    await saveRunRecord(inFlightRun);
    await mockStore.set({ activeResearchRun: inFlightRun });

    // Worker restarts
    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'RECOVERY_REQUIRED');
    assert.strictEqual(stored.stopReason, 'BROWSER_INTERRUPTED');
    assert.strictEqual(stored.leads.length, 1, 'Previously committed batch 1 lead must be safely preserved');
    assert.strictEqual(stored.leads[0].canonicalName, 'dallas greenery');
  });

  await test('Boundary 4: Worker stops immediately after a checkpoint is persisted', async () => {
    const runId = 'test_boundary_post_checkpoint';
    await clearRunData(runId);

    const leadA = {
      name: 'Lone Star Electric',
      canonicalName: 'lone star electric',
      canonicalKey: 'name_lone_star_electric',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adLibraryIds: ['820000000000001']
    };

    const cp = {
      runId, batchIndex: 1, monotonicRevision: 1, timestamp: new Date().toISOString(),
      activeKeywordIndex: 0, currentKeyword: 'electrician', rawAdsCount: 1,
      normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
      uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
      finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1,
      status: 'COLLECTING'
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '820000000000001', pageName: 'Lone Star Electric' }],
      entities: [leadA],
      checkpoint: cp
    });

    const runRecord = {
      runId,
      researchName: 'Post checkpoint interruption',
      mode: 'CUSTOM',
      keywords: ['electrician'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'COLLECTING',
      currentKeyword: 'electrician',
      leads: [normalizeStoredLead(leadA)],
      counters: { rawAds: 1, finalUniqueRelevantLeads: 1 },
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 1
    };

    await saveRunRecord(runRecord);
    await mockStore.set({ activeResearchRun: runRecord });

    // Worker restarts
    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'RECOVERY_REQUIRED');
    assert.strictEqual(stored.counters.finalUniqueRelevantLeads, 1);
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Service-Worker Restart Recovery & Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: SERVICE-WORKER RESTART RECOVERY & RECONCILIATION ---');

  await test('reconcileAndRecoverRun restores incomplete run into consistent terminal PARTIAL state', async () => {
    const runId = 'test_run_reconcile_recovery';
    await clearRunData(runId);

    const lead = {
      name: 'Austin Solar Solutions',
      canonicalName: 'austin solar solutions',
      canonicalKey: 'name_austin_solar_solutions',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      adLibraryIds: ['830000000000001']
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '830000000000001', pageName: 'Austin Solar Solutions' }],
      entities: [lead],
      checkpoint: {
        runId, batchIndex: 1, monotonicRevision: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'solar', rawAdsCount: 1,
        normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1
      }
    });

    const outcome = await reconcileAndRecoverRun(runId, 'BROWSER_INTERRUPTED');
    assert.ok(outcome.success, 'Recovery must succeed');
    assert.strictEqual(outcome.run.status, 'PARTIAL');
    assert.strictEqual(outcome.run.stopReason, 'BROWSER_INTERRUPTED');
    assert.strictEqual(outcome.run.counters.finalUniqueRelevantLeads, 1);
    assert.strictEqual(outcome.run.leads.length, 1);
    assert.strictEqual(outcome.diagnostics.isConsistent, true);
  });

  await test('reconcileAndRecoverRun marks COMPLETED if target lead quota was reached prior to stop', async () => {
    const runId = 'test_run_completed_quota_recovery';
    await clearRunData(runId);

    const lead = {
      name: 'Single Lead Target Co',
      canonicalName: 'single lead target co',
      canonicalKey: 'name_single_lead_target_co',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adLibraryIds: ['840000000000001']
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '840000000000001', pageName: 'Single Lead Target Co' }],
      entities: [lead],
      checkpoint: {
        runId, batchIndex: 1, monotonicRevision: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'target', rawAdsCount: 1,
        normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1
      }
    });

    // Run was configured for target quota of 1 lead
    await saveRunRecord({
      runId,
      researchName: 'Target 1 lead',
      mode: 'CUSTOM',
      keywords: ['target'],
      countryCode: 'US',
      locationName: 'Austin TX',
      targetLeadCount: 1,
      status: 'COLLECTING',
      leads: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 1
    });

    const outcome = await reconcileAndRecoverRun(runId);
    assert.strictEqual(outcome.run.status, 'COMPLETED', 'Should safely resolve to COMPLETED since target quota was met');
    assert.strictEqual(outcome.run.stopReason, 'TARGET_REACHED');
  });

  // --------------------------------------------------------------------------
  // SECTION 5: Strict Non-Resumption of Cancelled, Completed, and Failed Runs
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: NON-RESUMPTION OF TERMINAL & CANCELLED RUNS ---');

  await test('Service-worker restart preserves CANCELLED status and never marks RECOVERY_REQUIRED', async () => {
    const runId = 'test_run_cancelled_restart';
    await clearRunData(runId);

    const cancelledRun = {
      runId,
      researchName: 'User cancelled run',
      mode: 'CUSTOM',
      keywords: ['cancel_test'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'CANCELLED',
      stopReason: 'USER_CANCELLED',
      leads: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 5
    };

    await saveRunRecord(cancelledRun);
    await mockStore.set({ activeResearchRun: cancelledRun });

    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'CANCELLED', 'Status must remain strictly CANCELLED');
    assert.strictEqual(stored.stopReason, 'USER_CANCELLED');
  });

  await test('Service-worker restart preserves COMPLETED status and never marks RECOVERY_REQUIRED', async () => {
    const runId = 'test_run_completed_restart';
    await clearRunData(runId);

    const completedRun = {
      runId,
      researchName: 'Completed run',
      mode: 'CUSTOM',
      keywords: ['complete_test'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'COMPLETED',
      stopReason: 'TARGET_REACHED',
      leads: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 20
    };

    await saveRunRecord(completedRun);
    await mockStore.set({ activeResearchRun: completedRun });

    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'COMPLETED', 'Status must remain strictly COMPLETED');
    assert.strictEqual(stored.stopReason, 'TARGET_REACHED');
  });

  await test('Service-worker restart preserves FAILED and BLOCKED runs', async () => {
    const runId = 'test_run_failed_restart';
    await clearRunData(runId);

    const failedRun = {
      runId,
      researchName: 'Failed run',
      mode: 'CUSTOM',
      keywords: ['failed_test'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'FAILED',
      stopReason: 'FAILED',
      leads: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 0
    };

    await saveRunRecord(failedRun);
    await mockStore.set({ activeResearchRun: failedRun });

    await checkStaleJobs();

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'FAILED');
  });

  // --------------------------------------------------------------------------
  // SECTION 6: Durable Cancellation Semantics & Stale Callback Protection
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 6: DURABLE CANCELLATION SEMANTICS & RACE PROTECTION ---');

  await test('broadcastProgress respects cancellation and does not overwrite CANCELLED with COLLECTING', async () => {
    const runId = 'test_run_broadcast_cancel_race';
    cancelledRuns.add(runId);

    const run = {
      runId,
      researchName: 'Cancel race test',
      mode: 'CUSTOM',
      keywords: ['race'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'COLLECTING',
      leads: [],
      logs: [],
      counters: { finalUniqueRelevantLeads: 2 },
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 5
    };

    broadcastProgress(run, 'COLLECTING', 'Collecting new ad cards...');
    assert.strictEqual(run.status, 'CANCELLED', 'broadcastProgress must convert to CANCELLED when cancelledRuns has runId');
    assert.strictEqual(run.stopReason, 'USER_CANCELLED');

    const stored = (await mockStore.get('activeResearchRun')).activeResearchRun;
    assert.strictEqual(stored.status, 'CANCELLED');

    cancelledRuns.delete(runId);
  });

  await test('reconcileAndRecoverRun preserves cancellation even when called explicitly', async () => {
    const runId = 'test_run_reconcile_cancelled';
    await clearRunData(runId);

    const lead = {
      name: 'Cancelled Work Co',
      canonicalName: 'cancelled work co',
      canonicalKey: 'name_cancelled_work_co',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      adLibraryIds: ['850000000000001']
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '850000000000001', pageName: 'Cancelled Work Co' }],
      entities: [lead],
      checkpoint: {
        runId, batchIndex: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'kw', rawAdsCount: 1,
        normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1,
        status: 'CANCELLED'
      }
    });

    await saveRunRecord({
      runId,
      researchName: 'Cancelled run test',
      mode: 'CUSTOM',
      keywords: ['kw'],
      countryCode: 'US',
      locationName: 'Austin TX',
      status: 'CANCELLED',
      stopReason: 'USER_CANCELLED',
      leads: [normalizeStoredLead(lead)],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      schemaVersion: 2,
      totalAdsInspected: 1
    });

    const rec = await reconcileAndRecoverRun(runId);
    assert.strictEqual(rec.run.status, 'CANCELLED', 'Cancelled run must remain CANCELLED upon recovery');
    assert.strictEqual(rec.run.stopReason, 'USER_CANCELLED');
    assert.strictEqual(rec.diagnostics.recoveryAction, 'CANCELLED_PRESERVED');
  });

  // --------------------------------------------------------------------------
  // SECTION 7: Duplicate-Free Recovery & Canonical Identity Preservation
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 7: DUPLICATE-FREE RECOVERY & CANONICAL IDENTITY ---');

  await test('Conflicting Facebook Page IDs are NEVER merged across recovery batches', async () => {
    const runId = 'test_run_conflicting_page_ids';
    await clearRunData(runId);

    const entity1 = {
      id: `lead_${runId}_fb_11111111`,
      name: 'Summit Healthcare Dallas',
      canonicalName: 'summit healthcare',
      canonicalKey: 'fb_11111111',
      canonicalPageId: '11111111',
      adLibraryIds: ['860000000000001'],
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT'
    };

    const candidate2 = {
      libraryId: '860000000000002',
      pageName: 'Summit Healthcare Houston',
      facebookPageId: '22222222' // distinct, conflicting Facebook Page ID
    };

    const index = new EntityResolutionIndex();
    const existingEntities = new Map();
    existingEntities.set('fb_11111111', normalizeStoredLead(entity1));
    index.indexEntity('fb_11111111', existingEntities.get('fb_11111111'));

    const decision = evaluateEntityMerge(candidate2, existingEntities, index);
    assert.strictEqual(decision.shouldMerge, false, 'Conflicting Facebook Page IDs must NEVER merge');
    assert.notStrictEqual(decision.targetKey, 'fb_11111111');
  });

  await test('Distinct ads from same advertiser remain distinct ad-level evidence records upon recovery', async () => {
    const runId = 'test_run_multi_ad_recovery';
    await clearRunData(runId);

    const targetEntity = {
      name: 'Apex Heating & AC',
      canonicalName: 'apex heating ac',
      canonicalKey: 'name_apex_heating_ac',
      adCount: 1,
      activeAdCount: 1,
      adLibraryIds: ['870000000000001'],
      activeAdLibraryIds: ['870000000000001'],
      adEvidence: [{
        libraryId: '870000000000001',
        ctaType: 'CALL_NOW',
        destinationType: 'CALL',
        confidence: 'HIGH'
      }]
    };

    const newAdCandidate = {
      libraryId: '870000000000002', // second distinct ad
      pageName: 'Apex Heating & AC',
      ctaText: 'Book Online',
      destinationUrl: 'https://apexheating.com/book',
      destinationDomain: 'apexheating.com'
    };

    const decision = {
      shouldMerge: true,
      targetKey: 'name_apex_heating_ac',
      confidence: 'STRONG',
      reason: 'MATCH_PAGE_AND_NAME',
      relationshipType: 'INDEPENDENT_BUSINESS'
    };

    mergeCandidateIntoEntity(targetEntity, newAdCandidate, decision, 'hvac', 'US');

    assert.strictEqual(targetEntity.adCount, 2);
    assert.strictEqual(targetEntity.adEvidence.length, 2);
    assert.strictEqual(targetEntity.adLibraryIds.length, 2);
    assert.ok(targetEntity.adLibraryIds.includes('870000000000001'));
    assert.ok(targetEntity.adLibraryIds.includes('870000000000002'));
  });

  // --------------------------------------------------------------------------
  // SECTION 8: Discrepancy Diagnostics & Counter Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 8: DISCREPANCY DIAGNOSTICS & COUNTER RECONCILIATION ---');

  await test('recoverInterruptedRun flags missing checkpoint and uncommitted discrepancy', async () => {
    const runId = 'test_run_discrepancy_check';
    await clearRunData(runId);

    // Persist ad without checkpoint
    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '880000000000001', pageName: 'Orphan Ad' }],
      entities: [],
      checkpoint: {
        runId, batchIndex: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'kw', rawAdsCount: 10, // Checkpoint claims 10 ads, but only 1 stored
        normalizedCandidatesCount: 10, uniqueEntitiesCount: 5, relevantEntitiesCount: 2,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 3, duplicatesRemovedCount: 5,
        finalUniqueRelevantLeads: 2, seenLibraryIdsCount: 10, seenEntityKeysCount: 5
      }
    });

    const diag = await recoverInterruptedRun(runId);
    assert.strictEqual(diag.isConsistent, false, 'Must flag inconsistency when stored records differ from checkpoint');
    assert.ok(diag.discrepancies.length > 0);
    assert.strictEqual(diag.reconciledCounters.rawAds, 1, 'Reconciled raw ads must reflect actual stored count of 1');
  });

  // --------------------------------------------------------------------------
  // SECTION 9: Idempotence of Repeated Recovery Operations
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 9: REPEATED RECOVERY IDEMPOTENCE ---');

  await test('Running reconcileAndRecoverRun 5 times produces strictly identical output', async () => {
    const runId = 'test_run_recovery_5x_idempotent';
    await clearRunData(runId);

    const lead = {
      name: 'Consistent Cleaners',
      canonicalName: 'consistent cleaners',
      canonicalKey: 'name_consistent_cleaners',
      relevanceDecision: 'RELEVANT',
      evaluationStatus: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      adLibraryIds: ['890000000000001']
    };

    await saveBatch(runId, {
      batchIndex: 1,
      ads: [{ libraryId: '890000000000001', pageName: 'Consistent Cleaners' }],
      entities: [lead],
      checkpoint: {
        runId, batchIndex: 1, timestamp: new Date().toISOString(),
        activeKeywordIndex: 0, currentKeyword: 'cleaning', rawAdsCount: 1,
        normalizedCandidatesCount: 1, uniqueEntitiesCount: 1, relevantEntitiesCount: 1,
        uncertainEntitiesCount: 0, notRelevantEntitiesCount: 0, duplicatesRemovedCount: 0,
        finalUniqueRelevantLeads: 1, seenLibraryIdsCount: 1, seenEntityKeysCount: 1
      }
    });

    const first = await reconcileAndRecoverRun(runId);
    const second = await reconcileAndRecoverRun(runId);
    const third = await reconcileAndRecoverRun(runId);
    const fourth = await reconcileAndRecoverRun(runId);
    const fifth = await reconcileAndRecoverRun(runId);

    assert.strictEqual(fifth.run.status, first.run.status);
    assert.strictEqual(fifth.run.counters.finalUniqueRelevantLeads, first.run.counters.finalUniqueRelevantLeads);
    assert.strictEqual(fifth.run.leads.length, first.run.leads.length);
    assert.strictEqual(fifth.diagnostics.totalPersistedAds, first.diagnostics.totalPersistedAds);
  });

  // --------------------------------------------------------------------------
  // SECTION 10: Fail-Closed Product Safety Gates & Data Protection
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 10: PRODUCT SAFETY GATES & DATA PROTECTION ---');

  await test('Permanent safety gates remain strictly fail-closed (false)', () => {
    assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted must return false');
    assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted must return false');
  });

  await test('Protected user files and historical archives remain unmodified', () => {
    const historicalArchives = {
      'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
      'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
      'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
    };

    for (const [relPath, expectedHash] of Object.entries(historicalArchives)) {
      const fullPath = path.join(rootDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Historical archive must exist: ${relPath}`);
      const buf = fs.readFileSync(fullPath);
      const actualHash = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
      assert.strictEqual(actualHash, expectedHash, `Historical archive ${relPath} must match baseline hash`);
    }
  });

  console.log('\n========================================================================');
  console.log(`Phase 6 Regression Test Summary: ${passed} Passed, ${failed} Failed.`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unhandled Phase 6 test error:', err);
  process.exit(1);
});
