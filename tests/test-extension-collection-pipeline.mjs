import assert from 'node:assert/strict';
const originalChrome = globalThis.chrome;
const originalTimeout = globalThis.setTimeout;
let snapshot = {};
let currentUrl = '';
let scans = 0;
let closed = 0;
let scenario = 'empty';
let pauseCurrentRun = () => {};
globalThis.chrome = {
  runtime: { id: 'offline-mock', sendMessage: async () => {} },
  storage: { local: {
    get: async () => structuredClone(snapshot),
    set: async values => { Object.assign(snapshot, structuredClone(values)); }
  } },
  tabs: {
    create: async ({url}) => { currentUrl = url; return {id: 7}; },
    update: async (_id, {url}) => { currentUrl = url; },
    get: async () => ({id: 7, status: 'complete', url: currentUrl}),
    remove: async () => { closed++; },
    sendMessage: async () => {
      scans++;
      if (scenario === 'pause') pauseCurrentRun();
      return scenario === 'challenge'
        ? {type: 'CHALLENGE_DETECTED', reason: 'Login required', code: 'CHALLENGED'}
        : {payload: {candidates: [], status: 'END_OF_RESULTS', atBottom: true}};
    }
  }
};
globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, ms >= 20000 ? 1000 : 0, ...args);
try {
  const {executeResearchPipeline, pausedRuns} = await import('../src/extension/service-worker.ts');
  const payload = {mode: 'CUSTOM', keywords: ['Furniture'], countryCode: 'BD', locationName: 'Bangladesh', maxResults: 1};
  const empty = await executeResearchPipeline(payload, 'offline-empty-pipeline');
  assert.notEqual(empty.stopReason, 'COLLECTION_NOT_AUTHORIZED');
  assert.equal(empty.stopReason, 'NO_NEW_RESULTS_OBSERVED');
  assert(scans > 0 && scans <= 12, 'Empty results terminate within the bounded query plan');
  assert.equal(snapshot.activeResearchRun.runId, empty.runId);
  assert(snapshot.researchHistory.some(run => run.runId === empty.runId));
  assert.equal(new URL(currentUrl).searchParams.get('country'), 'BD');
  assert.equal(new URL(currentUrl).searchParams.get('ad_type'), 'all');
  scenario = 'challenge'; scans = 0;
  const challenged = await executeResearchPipeline(payload, 'offline-challenge-pipeline');
  assert.equal(challenged.status, 'CHALLENGED');
  assert.equal(scans, 1, 'A challenge stops further scanning');
  assert.equal(closed, 2, 'Both owned test tabs are cleaned up');
  scenario = 'pause'; scans = 0;
  pauseCurrentRun = () => pausedRuns.add('offline-paused-pipeline');
  const paused = await executeResearchPipeline(payload, 'offline-paused-pipeline');
  assert.equal(paused.status, 'PAUSED');
  assert.equal(paused.stopReason, 'USER_PAUSED');
  assert.equal(scans, 1, 'Pause stops the current scanning loop');
  console.log('PASS mocked collection pipeline: search URL, start, empty termination, persistence, challenge stop, cleanup. No live browser used.');
} finally {
  globalThis.setTimeout = originalTimeout;
  if (originalChrome === undefined) delete globalThis.chrome;
  else globalThis.chrome = originalChrome;
}
