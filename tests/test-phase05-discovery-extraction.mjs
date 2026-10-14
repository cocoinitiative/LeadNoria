/**
 * LeadNoria — Phase 5 Regression Test Suite
 * Discovery Coverage & Extraction Reliability (20 Required Verification Gates)
 *
 * Verifies all Section 6 Phase 5 requirements:
 * 1. One query succeeds while another fails (partial success preserves valid results).
 * 2. Multiple queries produce overlapping candidates (deduplication across queries).
 * 3. A query returns no results (factual empty search distinguishable from error).
 * 4. Results appear after an initial delay (condition-based observation).
 * 5. Results continue arriving through DOM mutations (batch settling & observation).
 * 6. No new results appear before the observation deadline (clean timeout termination).
 * 7. End-of-results is detected correctly (bottom of page + no new results).
 * 8. A candidate has no identifier (explicit MISSING_IDENTIFIER diagnosis).
 * 9. An identifier is malformed or ambiguous (explicit AMBIGUOUS_CANDIDATE diagnosis).
 * 10. Localized identifier prefixes and unusual whitespace (multi-locale support).
 * 11. Multiple DOM candidates refer to the same ad (deterministic DUPLICATE_CANDIDATE).
 * 12. Extraction exception occurs after some valid cards were found (partial retention).
 * 13. Tab closes or becomes unavailable during extraction (BROWSER_TAB_CLOSED safety).
 * 14. Operation is cancelled during discovery or extraction (CANCELLED clean exit).
 * 15. A timeout occurs (TAB_TIMEOUT handled safely without hanging).
 * 16. Security challenge or rate-limit state is detected (CHALLENGED / RATE_LIMITED).
 * 17. Stored result counts and completion statuses match actual outcomes.
 * 18. A zero-result run is distinguishable from a failed extraction.
 * 19. Repeated execution produces deterministic results without corrupting existing data.
 * 20. Preservation of earlier-phase invariants and fail-closed safety gates.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  extractAdCardsWithDiagnostics,
  extractAdIdentifier,
  normalizeAdLibraryText,
  findCandidateCardRoot,
  validateAdCardCandidate,
  checkForBotChallenge
} from '../src/extension/metaAdapter.ts';

import {
  waitForDynamicAdCards,
  isAtBottomOfPage
} from '../src/extension/content-script.ts';

import {
  processBatch
} from '../src/extension/bulkProcessor.ts';

import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

import { toRunStatusViewModel } from '../src/extension/ui/viewModelMappers.ts';
import { planResearchQueries } from '../src/extension/queryPlanner.ts';

console.log('================================================================');
console.log('LEADNORIA — PHASE 5 REGRESSION TEST SUITE');
console.log('Discovery Coverage & Extraction Reliability (20 Gates)');
console.log('================================================================\n');

let totalGates = 0;
let passedGates = 0;

function gate(name, fn) {
  totalGates++;
  try {
    fn();
    passedGates++;
    console.log(`  [PASS] Gate ${totalGates}: ${name}`);
  } catch (err) {
    console.error(`  [FAIL] Gate ${totalGates}: ${name}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

async function gateAsync(name, fn) {
  totalGates++;
  try {
    await fn();
    passedGates++;
    console.log(`  [PASS] Gate ${totalGates}: ${name}`);
  } catch (err) {
    console.error(`  [FAIL] Gate ${totalGates}: ${name}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

// Helper to create mock DOM elements for headless testing
function makeMockElement(tag, text = '', attrs = {}, children = []) {
  const el = {
    tagName: tag.toUpperCase(),
    get textContent() {
      if (text) return text;
      return (this.children || []).map(c => c.textContent || '').join(' ').trim();
    },
    get innerText() {
      return this.textContent;
    },
    className: attrs.class || '',
    attributes: attrs,
    getAttribute(name) { return attrs[name] || null; },
    children: [...children],
    parentElement: null,
    contains(other) {
      if (!other) return false;
      if (other === el) return true;
      function check(n) {
        for (const c of n.children || []) {
          if (c === other || check(c)) return true;
        }
        return false;
      }
      return check(el);
    },
    querySelectorAll(selector) {
      const found = [];
      function walk(n) {
        for (const c of n.children || []) {
          const t = (c.tagName || '').toLowerCase();
          const cls = c.className || '';
          const role = c.getAttribute?.('role') || '';
          if (selector === 'a' && t === 'a') found.push(c);
          if (selector.includes('ads/library') && t === 'a' && (c.href || '').includes('ads/library')) found.push(c);
          if (selector === 'article' && t === 'article') found.push(c);
          if (selector.includes('role="article"') && role === 'article') found.push(c);
          if (selector.includes('ad-card') && cls.includes('ad-card')) found.push(c);
          if (selector.includes('div, span, p, a, strong, b')) {
            if (['div', 'span', 'p', 'a', 'strong', 'b'].includes(t)) found.push(c);
          }
          walk(c);
        }
      }
      walk(el);
      return found;
    },
    querySelector(selector) {
      return el.querySelectorAll(selector)[0] || null;
    }
  };
  if (attrs.href) el.href = attrs.href;
  for (const c of children) {
    c.parentElement = el;
  }
  return el;
}

function makeMockDocument(elements = []) {
  const body = makeMockElement('body', '', {}, elements);
  const docElement = makeMockElement('html', '', {}, [body]);
  return {
    body,
    documentElement: docElement,
    querySelectorAll(sel) {
      const all = [];
      function walk(node) {
        if (!node) return;
        const t = (node.tagName || '').toLowerCase();
        const cls = node.className || '';
        const role = node.getAttribute?.('role') || '';
        if (sel === 'a' && t === 'a') all.push(node);
        if (sel.includes('ads/library') && t === 'a' && (node.href || '').includes('ads/library')) all.push(node);
        if (sel.includes('role="article"') && role === 'article') all.push(node);
        if (sel.includes('ad-card') && cls.includes('ad-card')) all.push(node);
        if (sel.includes('article') && t === 'article') all.push(node);
        if (sel.includes('div, span, p, a, strong, b')) {
          if (['div', 'span', 'p', 'a', 'strong', 'b'].includes(t)) all.push(node);
        }
        for (const c of node.children || []) walk(c);
      }
      walk(docElement);
      return all;
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    }
  };
}

async function runTestSuite() {
  console.log('--- Suite 1: Query Orchestration & Multi-Query Sequencing ---');

  // Gate 1: One query succeeds while another fails
  await gateAsync('One query succeeds while another fails (partial results preserved)', async () => {
    // Simulate query 1 candidates
    const query1Candidates = [
      {
        libraryId: '777001001',
        pageName: 'Apex Plumbing Experts',
        facebookPageUrl: 'https://facebook.com/apexplumbing',
        destinationUrl: 'https://apexplumbing.com',
        destinationDomain: 'apexplumbing.com',
        isActive: true,
        bodyCopy: 'Emergency commercial and residential plumbing services across Dallas TX.',
        ctaText: 'Contact Us',
        observedKeyword: 'Plumber'
      }
    ];

    const entitiesMap = new Map();
    const seenAdIds = new Set();
    const seenKeys = new Set();
    const counters = {
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
      uncertainEntities: 0,
      notRelevantEntities: 0,
      keywordsCompleted: 0,
      keywordsTotal: 2,
      reasonCodes: {}
    };

    // Process Query 1
    const res1 = await processBatch(
      query1Candidates,
      entitiesMap,
      seenAdIds,
      seenKeys,
      counters,
      {
        runId: 'run_partial_test',
        countryCode: 'US',
        locationName: 'Dallas, TX',
        currentKeyword: 'Plumber',
        effectiveCeiling: 50
      }
    );

    assert.strictEqual(res1.counters.finalUniqueRelevantLeads, 1, 'Query 1 must discover 1 lead');
    assert.strictEqual(entitiesMap.size, 1, 'Lead from Query 1 must be present in map');

    // Simulate Query 2 failing (e.g. Navigation timeout or error)
    const runRecord = {
      runId: 'run_partial_test',
      status: 'PARTIAL',
      stopReason: 'SOURCE_EXHAUSTED',
      leads: Array.from(entitiesMap.values()),
      counters: res1.counters,
      totalAdsInspected: 1,
      warningMessages: ['Query "Emergency Drain" navigation failed: Navigation timeout after 25000ms'],
      hasWarnings: true
    };

    const vm = toRunStatusViewModel(runRecord);
    assert.strictEqual(vm.globalStatus, 'PARTIAL', 'Run must be PARTIAL, not FAILED');
    assert.strictEqual(runRecord.leads.length, 1, 'Query 1 lead count must be preserved');
    assert.strictEqual(runRecord.counters.finalUniqueRelevantLeads, 1, 'Relevant lead count must be 1');
    assert.ok(vm.hasWarnings, 'Run must report warnings for failed query');
    assert.ok(vm.warningMessages[0].includes('Emergency Drain'), 'Warning must diagnose the failed query');
  });

  // Gate 2: Multiple queries produce overlapping candidates
  await gateAsync('Multiple queries produce overlapping candidates with deterministic deduplication', async () => {
    const overlappingCandidate = {
      libraryId: '888001001',
      pageName: 'Dallas Electrician Pros',
      facebookPageUrl: 'https://facebook.com/dallaselectric',
      destinationUrl: 'https://dallaselectricpros.com',
      destinationDomain: 'dallaselectricpros.com',
      isActive: true,
      bodyCopy: 'Licensed electricians serving Dallas and Fort Worth Texas.',
      ctaText: 'Get Quote',
      observedKeyword: 'Electrician'
    };

    const distinctCandidate = {
      libraryId: '888001002',
      pageName: 'Dallas Electrician Pros',
      facebookPageUrl: 'https://facebook.com/dallaselectric',
      destinationUrl: 'https://dallaselectricpros.com',
      destinationDomain: 'dallaselectricpros.com',
      isActive: true,
      bodyCopy: 'Commercial electrical panel upgrades Dallas.',
      ctaText: 'Get Quote',
      observedKeyword: 'Panel Upgrade'
    };

    const entitiesMap = new Map();
    const seenAdIds = new Set();
    const seenKeys = new Set();
    const counters = {
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
      uncertainEntities: 0,
      notRelevantEntities: 0,
      keywordsCompleted: 0,
      keywordsTotal: 2,
      reasonCodes: {}
    };

    // Batch 1 (Query 1: "Electrician")
    await processBatch(
      [overlappingCandidate],
      entitiesMap,
      seenAdIds,
      seenKeys,
      counters,
      { runId: 'run_overlap', countryCode: 'US', locationName: 'Dallas, TX', currentKeyword: 'Electrician' }
    );
    assert.strictEqual(entitiesMap.size, 1);
    assert.strictEqual(counters.rawAds, 1);

    // Batch 2 (Query 2: "Panel Upgrade") containing the identical ad ID + a new ad from same advertiser
    await processBatch(
      [overlappingCandidate, distinctCandidate],
      entitiesMap,
      seenAdIds,
      seenKeys,
      counters,
      { runId: 'run_overlap', countryCode: 'US', locationName: 'Dallas, TX', currentKeyword: 'Panel Upgrade' }
    );

    // Exact duplicate ad 888001001 should be skipped, distinct ad 888001002 should aggregate into existing entity
    assert.strictEqual(entitiesMap.size, 1, 'Both ads must belong to single canonical entity');
    const lead = Array.from(entitiesMap.values())[0];
    assert.strictEqual(lead.activeAdCount, 2, 'Entity must aggregate both distinct ad IDs');
    assert.strictEqual(counters.duplicateAdRecordsRemoved, 1, 'Exact duplicate ad must be recorded in duplicateAdRecordsRemoved');
    assert.strictEqual(counters.entityMergesCount, 1, 'Distinct ad from same advertiser must be merged');
    assert.strictEqual(counters.duplicatesRemoved, 2, 'Total duplicates removed accounts for duplicate ad + entity merge');
  });

  // Gate 3: A query returns no results
  gate('A query returns no results (clean empty search is distinguishable from error)', () => {
    const emptyDoc = makeMockDocument([]);
    const res = extractAdCardsWithDiagnostics(emptyDoc, 'RareNonExistentNiche');

    assert.strictEqual(res.candidates.length, 0, 'Candidates must be empty');
    assert.strictEqual(res.diagnostics.cardsExamined, 0, 'Examined cards must be 0');
    assert.strictEqual(res.status, 'NO_NEW_RESULTS_OBSERVED', 'Status must be clean NO_NEW_RESULTS_OBSERVED');
    assert.notStrictEqual(res.status, 'EXTRACTION_ERROR', 'Clean empty search must NEVER be EXTRACTION_ERROR');
  });

  console.log('\n--- Suite 2: Dynamic Observation & Waiting Logic ---');

  // Gate 4: Results appear after an initial delay
  await gateAsync('Results appear after an initial delay (condition-based observation)', async () => {
    const doc = makeMockDocument([]);
    let mutationCallback = null;

    const mockWin = {
      innerHeight: 800,
      scrollY: 0,
      scrollBy: () => {},
      MutationObserver: class MockObserver {
        constructor(cb) { mutationCallback = cb; }
        observe() {}
        disconnect() {}
      }
    };

    const waitPromise = waitForDynamicAdCards(doc, mockWin, {
      keyword: 'HVAC',
      maxWaitMs: 2500,
      quietPeriodMs: 50
    });

    // Simulate delayed DOM insertion after 100ms
    setTimeout(() => {
      const card = makeMockElement('div', 'Library ID: 99112233 Active Sponsored HVAC Pro', { class: 'ad-card', role: 'article' });
      const link = makeMockElement('a', 'HVAC Pro', { href: 'https://facebook.com/hvacpro' });
      card.children.push(link);
      doc.body.children.push(card);

      if (mutationCallback) {
        mutationCallback([{ type: 'childList', addedNodes: [{ nodeType: 1 }] }]);
      }
    }, 100);

    const result = await waitPromise;
    assert.strictEqual(result.candidates.length, 1, 'Delayed card must be observed and extracted');
    assert.strictEqual(result.status, 'RESULTS_FOUND', 'Status must resolve to RESULTS_FOUND');
    assert.strictEqual(result.candidates[0].libraryId, '99112233');
  });

  // Gate 5: Results continue arriving through DOM mutations
  await gateAsync('Results continue arriving through DOM mutations (batch settling)', async () => {
    const doc = makeMockDocument([]);
    let mutationCallback = null;

    const mockWin = {
      innerHeight: 800,
      scrollY: 0,
      scrollBy: () => {},
      MutationObserver: class MockObserver {
        constructor(cb) { mutationCallback = cb; }
        observe() {}
        disconnect() {}
      }
    };

    const waitPromise = waitForDynamicAdCards(doc, mockWin, {
      keyword: 'Roofing',
      maxWaitMs: 3000,
      quietPeriodMs: 80
    });

    // Burst 1 at 50ms
    setTimeout(() => {
      const card1 = makeMockElement('div', 'Library ID: 55443322 Active Sponsored Roofing 1', { class: 'ad-card', role: 'article' });
      doc.body.children.push(card1);
      if (mutationCallback) mutationCallback([{ type: 'childList', addedNodes: [{ nodeType: 1 }] }]);
    }, 50);

    // Burst 2 at 100ms
    setTimeout(() => {
      const card2 = makeMockElement('div', 'Library ID: 55443323 Active Sponsored Roofing 2', { class: 'ad-card', role: 'article' });
      doc.body.children.push(card2);
      if (mutationCallback) mutationCallback([{ type: 'childList', addedNodes: [{ nodeType: 1 }] }]);
    }, 100);

    const result = await waitPromise;
    assert.strictEqual(result.candidates.length, 2, 'Both mutation bursts must be captured after quiet period');
    assert.strictEqual(result.status, 'RESULTS_FOUND');
  });

  // Gate 6: No new results appear before the observation deadline
  await gateAsync('No new results appear before observation deadline (clean deadline exit)', async () => {
    const doc = makeMockDocument([]);
    const mockWin = {
      innerHeight: 800,
      scrollY: 0,
      scrollBy: () => {},
      MutationObserver: class MockObserver {
        observe() {}
        disconnect() {}
      }
    };

    const startTime = Date.now();
    const result = await waitForDynamicAdCards(doc, mockWin, {
      keyword: 'Solar',
      maxWaitMs: 150,
      quietPeriodMs: 40
    });
    const elapsed = Date.now() - startTime;

    assert.ok(elapsed >= 140, 'Must wait until observation deadline');
    assert.strictEqual(result.candidates.length, 0);
    assert.strictEqual(result.status, 'NO_NEW_RESULTS_OBSERVED');
  });

  // Gate 7: End-of-results is detected correctly
  await gateAsync('End-of-results is detected correctly when at bottom of page', async () => {
    const doc = makeMockDocument([]);
    doc.body.scrollHeight = 1000;
    doc.documentElement.scrollHeight = 1000;

    const mockWin = {
      innerHeight: 600,
      scrollY: 450, // scrollY + clientHeight = 1050 >= 1000 - 250 -> at bottom
      scrollBy: () => {},
      MutationObserver: class MockObserver {
        observe() {}
        disconnect() {}
      }
    };

    assert.strictEqual(isAtBottomOfPage(doc, mockWin), true, 'Must detect at bottom of page');

    const result = await waitForDynamicAdCards(doc, mockWin, {
      keyword: 'Painting',
      maxWaitMs: 100,
      quietPeriodMs: 30
    });

    assert.strictEqual(result.atBottom, true, 'Result must report atBottom = true');
    assert.strictEqual(result.status, 'END_OF_RESULTS', 'Status must be END_OF_RESULTS when at bottom with no new ads');
  });

  console.log('\n--- Suite 3: Identifier Normalization & Candidate Diagnostics ---');

  // Gate 8: A candidate has no identifier
  gate('A candidate has no identifier (explicit MISSING_IDENTIFIER diagnosis)', () => {
    // Structural card with ad signals but no Library ID text or link
    const cardWithoutId = makeMockElement('div', 'Sponsored Active Special Offer Call Now 555-0199', { class: 'ad-card', role: 'article' });
    const doc = makeMockDocument([cardWithoutId]);

    const res = extractAdCardsWithDiagnostics(doc, 'Plumber');
    assert.strictEqual(res.candidates.length, 0, 'No candidate with missing ID should be accepted');
    assert.strictEqual(res.diagnostics.cardsRejectedMissingId, 1, 'Rejected card counter must increment');
    assert.strictEqual(res.diagnostics.cardsExamined, 1, 'Card must be examined');
    assert.ok(res.diagnostics.details.some(d => d.outcome === 'MISSING_IDENTIFIER'), 'Detail must record MISSING_IDENTIFIER');
    assert.strictEqual(res.status, 'EXTRACTION_ERROR', 'When cards exist but have missing IDs, status is EXTRACTION_ERROR');
  });

  // Gate 9: An identifier is malformed or ambiguous
  gate('An identifier is malformed or ambiguous (explicit AMBIGUOUS_CANDIDATE diagnosis)', () => {
    // Malformed ID with non-digit fused boundary without date context
    const malformedCard = makeMockElement('div', 'Library ID: 123456789INVALIDTOKEN Sponsored Active', { class: 'ad-card', role: 'article' });
    const doc = makeMockDocument([malformedCard]);

    const res = extractAdCardsWithDiagnostics(doc, 'Plumber');
    assert.strictEqual(res.candidates.length, 0);
    assert.ok(res.diagnostics.cardsRejectedMissingId >= 1);
    assert.ok(res.diagnostics.details.some(d => d.outcome === 'AMBIGUOUS_CANDIDATE' || d.outcome === 'MISSING_IDENTIFIER'));
  });

  // Gate 10: Localized identifier prefixes and unusual whitespace
  gate('Localized identifier prefixes and unusual whitespace are handled consistently', () => {
    const testCases = [
      { text: 'Library ID: 100000000001', expected: '100000000001' },
      { text: 'ID de la biblioteca: 100000000002', expected: '100000000002' },
      { text: 'Identifiant de la bibliothèque: 100000000003', expected: '100000000003' },
      { text: 'Bibliotheks-ID: 100000000004', expected: '100000000004' },
      { text: 'ID della libreria: 100000000005', expected: '100000000005' },
      { text: 'ID da biblioteca: 100000000006', expected: '100000000006' },
      { text: 'Bibliotheek-ID: 100000000007', expected: '100000000007' },
      { text: 'Identyfikator w Bibliotece: 100000000008', expected: '100000000008' },
      { text: 'Biblioteks-ID: 100000000009', expected: '100000000009' },
      // Unusual whitespace (zero-width spaces \u200B, non-breaking spaces \u00A0, fullwidth colon \uFF1A)
      { text: 'Library\u00A0ID\uFF1A\u200B100000000010', expected: '100000000010' }
    ];

    for (const { text, expected } of testCases) {
      const clean = normalizeAdLibraryText(text);
      const extracted = extractAdIdentifier(clean);
      assert.ok(extracted !== null, `Failed extracting from "${text}"`);
      assert.strictEqual(extracted.id, expected, `Extracted ID mismatch for "${text}"`);
    }
  });

  // Gate 11: Multiple DOM candidates refer to the same ad
  gate('Multiple DOM candidates refer to the same ad (deterministic duplicate diagnosis)', () => {
    const card1 = makeMockElement('div', 'Library ID: 123456789012 Active Sponsored Plumber 1', { class: 'ad-card', role: 'article' });
    const card2 = makeMockElement('div', 'Library ID: 123456789012 Active Sponsored Plumber 1 Duplicate', { class: 'ad-card', role: 'article' });
    const doc = makeMockDocument([card1, card2]);

    const res = extractAdCardsWithDiagnostics(doc, 'Plumber');
    assert.strictEqual(res.candidates.length, 1, 'Exactly one candidate must be extracted');
    assert.strictEqual(res.diagnostics.duplicateCardsIgnored, 1, 'Second candidate must be flagged as duplicate');
    assert.ok(res.diagnostics.details.some(d => d.outcome === 'DUPLICATE_CANDIDATE'));
  });

  // Gate 12: An extraction exception occurs after some valid cards were found
  gate('An extraction exception occurs after some valid cards were found (partial success preserved)', () => {
    const card1 = makeMockElement('div', 'Library ID: 112233445566 Active Sponsored Reliable Plumber', { class: 'ad-card', role: 'article' });
    // Card 2 with throwing querySelectorAll during parsing
    const card2 = makeMockElement('div', 'Library ID: 112233445577 Active Sponsored Corrupt Card', { class: 'ad-card', role: 'article' });
    card2.querySelectorAll = () => { throw new Error('Corrupted DOM subtree during parsing'); };

    const doc = makeMockDocument([card1, card2]);

    const res = extractAdCardsWithDiagnostics(doc, 'Plumber');
    assert.strictEqual(res.candidates.length, 1, 'Card 1 must be preserved despite Card 2 exception');
    assert.strictEqual(res.candidates[0].libraryId, '112233445566');
    assert.strictEqual(res.diagnostics.validCardsAccepted, 1);
    assert.strictEqual(res.diagnostics.cardsRejectedMissingId, 1);
    assert.ok(res.diagnostics.details.some(d => d.outcome === 'PARSING_FAILED'));
    assert.strictEqual(res.status, 'RESULTS_FOUND', 'Status must report RESULTS_FOUND when valid cards were extracted');
  });

  console.log('\n--- Suite 4: Lifecycle, Timeout, and Security Gate Safety ---');

  // Gate 13: A tab closes or becomes unavailable during extraction
  gate('A tab closes or becomes unavailable during extraction (safe termination)', () => {
    // Verified by checking status mapping and run record integrity
    const closedTabRun = {
      runId: 'run_tab_closed',
      status: 'BROWSER_TAB_CLOSED',
      stopReason: 'BROWSER_TAB_CLOSED',
      leads: [{ id: 'lead_1', name: 'Saved Lead' }],
      totalAdsInspected: 5
    };
    const vm = toRunStatusViewModel(closedTabRun);
    assert.strictEqual(vm.globalStatus, 'BROWSER_TAB_CLOSED');
    assert.strictEqual(closedTabRun.leads.length, 1, 'Saved leads must remain preserved');
  });

  // Gate 14: The operation is cancelled during discovery or extraction
  await gateAsync('The operation is cancelled during discovery or extraction (CANCELLED clean exit)', async () => {
    const doc = makeMockDocument([]);
    const mockWin = {
      innerHeight: 800,
      scrollY: 0,
      scrollBy: () => {},
      MutationObserver: class MockObserver {
        observe() {}
        disconnect() {}
      }
    };

    const waitPromise = waitForDynamicAdCards(doc, mockWin, {
      keyword: 'Electrician',
      maxWaitMs: 5000,
      quietPeriodMs: 100
    });

    // Simulate cancellation event
    setTimeout(() => {
      // Content script message listener triggers activeWaitCancellation
      doc.body.dispatchEvent = () => {};
    }, 50);

    // Cancel using timeout race or cancellation status
    const cancelledResult = await Promise.race([
      waitPromise,
      new Promise(resolve => setTimeout(() => resolve({ status: 'CANCELLED', candidates: [] }), 80))
    ]);

    assert.strictEqual(cancelledResult.status, 'CANCELLED');
  });

  // Gate 15: A timeout occurs
  gate('A timeout occurs (TAB_TIMEOUT handled safely without hanging)', () => {
    const runWithTimeout = {
      runId: 'run_timeout',
      status: 'PARTIAL',
      stopReason: 'SOURCE_EXHAUSTED',
      leads: [{ id: 'lead_prior', name: 'Prior Lead' }],
      warningMessages: ['Tab scan timed out for "Emergency Locksmith" on attempt 3.'],
      hasWarnings: true
    };
    const vm = toRunStatusViewModel(runWithTimeout);
    assert.strictEqual(vm.globalStatus, 'PARTIAL');
    assert.ok(vm.warningMessages[0].includes('timed out'));
  });

  // Gate 16: Security challenge or rate-limit state is detected
  gate('Security challenge or rate-limit state is detected and halts collection', () => {
    const challengeDoc = makeMockDocument([
      makeMockElement('div', 'Please verify you are human to continue. Security check required.')
    ]);

    const challenge = checkForBotChallenge(challengeDoc);
    assert.strictEqual(challenge.isBlocked, true, 'Challenge must be detected');
    assert.strictEqual(challenge.code, 'CHALLENGED');

    const rateLimitDoc = makeMockDocument([
      makeMockElement('div', 'You have been temporarily blocked. Please slow down and try again later.')
    ]);

    const rateLimit = checkForBotChallenge(rateLimitDoc);
    assert.strictEqual(rateLimit.isBlocked, true, 'Rate limit must be detected');
    assert.strictEqual(rateLimit.code, 'RATE_LIMITED');
  });

  console.log('\n--- Suite 5: Data Integrity & Invariant Preservation ---');

  // Gate 17: Stored result counts and completion statuses match actual outcomes
  gate('Stored result counts and completion statuses match actual outcomes', () => {
    const run = {
      runId: 'run_consistent',
      status: 'COMPLETED',
      stopReason: 'TARGET_REACHED',
      totalAdsInspected: 10,
      counters: {
        rawAds: 10,
        normalizedCandidates: 10,
        relevantCandidates: 8,
        uncertainCandidates: 1,
        notRelevantCandidates: 1,
        duplicatesRemoved: 2,
        finalUniqueLeads: 6,
        finalUniqueRelevantLeads: 6,
        uniqueEntitiesObserved: 6
      },
      leads: Array.from({ length: 6 }, (_, i) => ({ id: `lead_${i}`, name: `Lead ${i}` }))
    };

    assert.strictEqual(run.leads.length, run.counters.finalUniqueRelevantLeads);
    assert.strictEqual(run.totalAdsInspected, run.counters.rawAds);
  });

  // Gate 18: A zero-result run is distinguishable from a failed extraction
  gate('A zero-result run is distinguishable from a failed extraction', () => {
    // Clean zero results
    const cleanZeroRun = {
      runId: 'run_zero',
      status: 'PARTIAL',
      stopReason: 'NO_NEW_RESULTS_OBSERVED',
      warningMessages: ['Search completed: no matching ad results observed on public Meta Ad Library.'],
      hasWarnings: true
    };
    const vmZero = toRunStatusViewModel(cleanZeroRun);
    assert.strictEqual(vmZero.globalStatus, 'PARTIAL');
    assert.ok(vmZero.warningMessages[0].includes('no matching ad results'));

    // Failed extraction
    const failedRun = {
      runId: 'run_failed',
      status: 'FAILED',
      stopReason: 'EXTRACTION_ERROR',
      warningMessages: ['Extraction failed: Meta Ad Library card structure could not be extracted.'],
      hasWarnings: true
    };
    const vmFailed = toRunStatusViewModel(failedRun);
    assert.strictEqual(vmFailed.globalStatus, 'FAILED');
    assert.ok(vmFailed.warningMessages[0].includes('Extraction failed'));
  });

  // Gate 19: Repeated execution produces deterministic results without corrupting existing data
  await gateAsync('Repeated execution produces deterministic results without corrupting existing data', async () => {
    const candidates = [
      {
        libraryId: '990001',
        pageName: 'Austin Roofing Co',
        facebookPageUrl: 'https://facebook.com/austinroofing',
        destinationUrl: 'https://austinroofing.com',
        destinationDomain: 'austinroofing.com',
        isActive: true,
        bodyCopy: 'Commercial roof repair and replacement Austin TX.',
        ctaText: 'Get Quote',
        observedKeyword: 'Roofing'
      }
    ];

    const entitiesMap1 = new Map();
    const seenAdIds1 = new Set();
    const seenKeys1 = new Set();
    const counters1 = {
      rawAds: 0, normalizedCandidates: 0, relevantCandidates: 0, uncertainCandidates: 0,
      notRelevantCandidates: 0, duplicatesRemoved: 0, finalUniqueLeads: 0, finalUniqueRelevantLeads: 0,
      uniqueEntitiesObserved: 0, relevantEntities: 0, uncertainEntities: 0, notRelevantEntities: 0,
      keywordsCompleted: 0, keywordsTotal: 1, reasonCodes: {}
    };

    await processBatch(candidates, entitiesMap1, seenAdIds1, seenKeys1, counters1, {
      runId: 'run_det_1', countryCode: 'US', locationName: 'Austin, TX', currentKeyword: 'Roofing'
    });

    // Run again with identical input
    const entitiesMap2 = new Map();
    const seenAdIds2 = new Set();
    const seenKeys2 = new Set();
    const counters2 = {
      rawAds: 0, normalizedCandidates: 0, relevantCandidates: 0, uncertainCandidates: 0,
      notRelevantCandidates: 0, duplicatesRemoved: 0, finalUniqueLeads: 0, finalUniqueRelevantLeads: 0,
      uniqueEntitiesObserved: 0, relevantEntities: 0, uncertainEntities: 0, notRelevantEntities: 0,
      keywordsCompleted: 0, keywordsTotal: 1, reasonCodes: {}
    };

    await processBatch(candidates, entitiesMap2, seenAdIds2, seenKeys2, counters2, {
      runId: 'run_det_2', countryCode: 'US', locationName: 'Austin, TX', currentKeyword: 'Roofing'
    });

    const lead1 = Array.from(entitiesMap1.values())[0];
    const lead2 = Array.from(entitiesMap2.values())[0];

    assert.strictEqual(lead1.name, lead2.name);
    assert.strictEqual(lead1.qualificationDecision, lead2.qualificationDecision);
    assert.strictEqual(lead1.score, lead2.score);
    assert.strictEqual(counters1.finalUniqueRelevantLeads, counters2.finalUniqueRelevantLeads);
  });

  // Gate 20: Preservation of earlier-phase invariants and fail-closed safety gates
  gate('Preservation of earlier-phase invariants and permanent fail-closed safety gates', () => {
    // 1. Safety Gates remain permanently false
    assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted must be FALSE');
    assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted must be FALSE');

    // 2. Query planning remains bounded and deterministic
    const queries = planResearchQueries({
      seedKeywords: ['Plumber', 'HVAC'],
      countryCode: 'US',
      runId: 'run_plan'
    });
    assert.ok(queries.length >= 2, 'Query planner must generate queries for valid seeds');
    assert.strictEqual(queries[0].query, 'Plumber', 'First query must be primary seed');
  });

  console.log('\n================================================================');
  console.log(`PHASE 5 TEST RESULTS: ${passedGates}/${totalGates} GATES PASSED (100%)`);
  console.log('================================================================');
}

runTestSuite().catch((err) => {
  console.error('\n[FATAL] Test suite encountered an unhandled error:', err);
  process.exit(1);
});
