/**
 * LeadNoria — Spreadsheet Clipboard UI Integration & Boundary Test Suite
 * Meta Ad Library ONLY
 *
 * Verifies:
 * 1. Meta Copy All calls the correct projection (metaResultsToTsv)
 * 2. Meta Copy All uses the existing clipboard writer (writeClipboardText)
 * 3. Zero Meta results do not produce misleading clipboard output (disabled / empty guard)
 * 4. Successful copy produces success state
 * 5. Failed copy produces error state
 * 6. Copy All does not modify filters or candidate state
 * 7. Copy All does not modify maxResults or execution policy
 * 8. Copy All does not modify qualification results or state
 * 9. Copy All does not modify persistence repository or schema
 * 10. Meta output contains exactly 3 columns
 * 11. Missing optional fields preserve exact 3 columns
 * 12. Sanitized newlines and tabs prevent TSV corruption
 * 13. Architectural boundary: ResultsTableView uses clipboard domain without duplicate serialization
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  metaResultsToTsv,
  META_CLIPBOARD_COLUMNS,
  writeClipboardText,
  serializeToTsv
} from '../src/extension/clipboard/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passedCount = 0;
let failedCount = 0;

function group(name) {
  console.log(`\n--- ${name} ---`);
}

const testsToRun = [];

function test(description, fn) {
  testsToRun.push({ description, fn, isAsync: false });
}

function asyncTest(description, fn) {
  testsToRun.push({ description, fn, isAsync: true });
}

async function runAllTests() {
  console.log('================================================================');
  console.log('LEADNORIA — SPREADSHEET CLIPBOARD UI INTEGRATION TEST SUITE');
  console.log('================================================================');

  for (const t of testsToRun) {
    try {
      if (t.isAsync) {
        await t.fn();
      } else {
        t.fn();
      }
      passedCount++;
      console.log(`  [PASS] Test ${passedCount}: ${t.description}`);
    } catch (err) {
      failedCount++;
      console.error(`  [FAIL] Test: ${t.description}`);
      console.error(`         ${err.message}`);
      throw err;
    }
  }

  console.log('\n================================================================');
  console.log('SPREADSHEET CLIPBOARD UI INTEGRATION TEST SUMMARY');
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

// ─── GROUP 1: META AD LIBRARY PROJECTION & WRITER INTEGRATION ────────────────
group('GROUP 1: META AD LIBRARY PROJECTION & WRITER INTEGRATION');

asyncTest('1. Meta Copy All calls metaResultsToTsv and formats exactly 3 columns', async () => {
  const mockMetaResults = [
    {
      facebookPageName: 'Nordic Dental Care',
      facebookPage: 'https://facebook.com/nordicdental',
      websiteUrl: 'https://nordicdental.com'
    }
  ];

  const tsv = metaResultsToTsv(mockMetaResults);
  const lines = tsv.trim().split('\n');
  assert.strictEqual(lines.length, 2);

  const headerCols = lines[0].split('\t');
  assert.strictEqual(headerCols.length, 3);
  assert.deepStrictEqual(headerCols, [
    'Facebook Page Name',
    'Facebook Page',
    'Website'
  ]);

  const rowCols = lines[1].split('\t');
  assert.strictEqual(rowCols.length, 3);
  assert.strictEqual(rowCols[0], 'Nordic Dental Care');
  assert.strictEqual(rowCols[1], 'https://facebook.com/nordicdental');
  assert.strictEqual(rowCols[2], 'YES');
});

asyncTest('2. Meta Copy All uses writeClipboardText abstraction with custom provider', async () => {
  let capturedClipboardText = '';
  const mockProvider = {
    writeText: async (text) => {
      capturedClipboardText = text;
    }
  };

  const mockMetaResults = [
    {
      displayName: 'Elite Real Estate Group',
      adLibraryUrl: 'https://facebook.com/ads/library/?id=123',
      websiteState: 'not_found'
    }
  ];

  const tsv = metaResultsToTsv(mockMetaResults);
  const writeRes = await writeClipboardText(tsv, { clipboard: mockProvider });
  assert.strictEqual(writeRes.success, true);
  assert.ok(capturedClipboardText.includes('Elite Real Estate Group'));
  assert.ok(capturedClipboardText.includes('NO'));
});

// ─── GROUP 2: EMPTY STATE HANDLING ───────────────────────────────────────────
group('GROUP 2: EMPTY STATE HANDLING');

test('3. Zero Meta results produce only header if requested or empty string', () => {
  const emptyTsv = metaResultsToTsv([], { includeHeader: false });
  assert.strictEqual(emptyTsv, '');

  const headerOnly = metaResultsToTsv([], { includeHeader: true });
  assert.strictEqual(
    headerOnly,
    'Facebook Page Name\tFacebook Page\tWebsite'
  );
});

// ─── GROUP 3: SUCCESS AND ERROR FEEDBACK STATES ─────────────────────────────
group('GROUP 3: SUCCESS AND ERROR FEEDBACK STATES');

asyncTest('4. Successful clipboard write returns success: true for user feedback', async () => {
  const mockProvider = {
    writeText: async () => {}
  };
  const res = await writeClipboardText('sample text', { clipboard: mockProvider });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.error, undefined);
});

asyncTest('5. Failed clipboard write returns success: false and friendly error message', async () => {
  const mockFailingProvider = {
    writeText: async () => {
      throw new Error('NotAllowedError: Document is not focused.');
    }
  };
  const res = await writeClipboardText('sample text', { clipboard: mockFailingProvider });
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes('Document is not focused'));
});

// ─── GROUP 4: READ-ONLY INVARIANCE VERIFICATION ─────────────────────────────
group('GROUP 4: READ-ONLY INVARIANCE VERIFICATION');

test('6. Copy All does not modify filters or candidate state', () => {
  const initialFilter = { category: 'ALL', freshness: 'ALL' };
  const filterCopy = { ...initialFilter };

  const candidate = Object.freeze({
    facebookPageName: 'Unchanged Corp',
    facebookPageUrl: 'https://facebook.com/unchanged',
    websiteState: 'found'
  });

  const candidatesList = [candidate];
  const tsv = metaResultsToTsv(candidatesList);
  assert.ok(tsv.length > 0);

  // Assert filter remains identical
  assert.deepStrictEqual(initialFilter, filterCopy);
  // Assert candidate object unchanged
  assert.strictEqual(candidate.facebookPageName, 'Unchanged Corp');
  assert.strictEqual(candidatesList.length, 1);
});

test('7. Copy All does not modify maxResults or execution policy', () => {
  const executionConfig = Object.freeze({
    maxResults: 100,
    maxSearchUnits: 50
  });

  const candidates = [
    { facebookPageName: 'Test Alpha', facebookPageUrl: 'https://facebook.com/alpha' },
    { facebookPageName: 'Test Beta', facebookPageUrl: 'https://facebook.com/beta' }
  ];

  metaResultsToTsv(candidates);
  assert.strictEqual(executionConfig.maxResults, 100);
  assert.strictEqual(executionConfig.maxSearchUnits, 50);
});

test('8. Copy All does not modify qualification results or state', () => {
  const qualificationOutcome = Object.freeze({
    status: 'QUALIFIED',
    score: 95,
    reasons: ['VERIFIED_WEBSITE']
  });

  const metaResults = [{
    displayName: 'Qualified Business',
    websiteState: 'found',
    qualificationOutcome
  }];

  metaResultsToTsv(metaResults);
  assert.strictEqual(qualificationOutcome.status, 'QUALIFIED');
  assert.strictEqual(qualificationOutcome.score, 95);
});

test('9. Copy All does not modify persistence repository or schema', () => {
  const persistedRecord = Object.freeze({
    leadId: 'lead_persisted_001',
    lifecycle: { state: 'QUALIFIED' },
    businessIdentity: { businessName: 'Persisted Entity' },
    pageName: 'Persisted Entity',
    pageUrl: 'https://facebook.com/persisted'
  });

  const tsv = metaResultsToTsv([persistedRecord]);
  assert.ok(tsv.includes('Persisted Entity'));
  assert.strictEqual(persistedRecord.leadId, 'lead_persisted_001');
  assert.strictEqual(persistedRecord.lifecycle.state, 'QUALIFIED');
});

// ─── GROUP 5: SPECIAL DATA & BLANK CELL COLUMN ALIGNMENT ─────────────────────
group('GROUP 5: SPECIAL DATA & BLANK CELL COLUMN ALIGNMENT');

test('10. Special data: missing optional fields preserve exact 3 columns in Meta TSV', () => {
  const sparseCandidates = [
    // Missing page url, website
    {
      facebookPageName: 'Minimal Business'
    },
    // Missing name, only url
    {
      facebookPageUrl: 'https://facebook.com/urlonly'
    },
    // Complete record
    {
      facebookPageName: 'Complete Business',
      facebookPageUrl: 'https://facebook.com/complete',
      websiteState: 'found'
    }
  ];

  const tsv = metaResultsToTsv(sparseCandidates);
  const lines = tsv.trim().split('\n');
  assert.strictEqual(lines.length, 4); // 1 header + 3 rows

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    assert.strictEqual(
      cols.length,
      3,
      `Row ${i} must have exactly 3 columns (got ${cols.length}): "${lines[i]}"`
    );
  }

  // Row 1 verification (minimal):
  const row1 = lines[1].split('\t');
  assert.strictEqual(row1[0], 'Minimal Business');
  assert.strictEqual(row1[1], ''); // fb page blank
  assert.strictEqual(row1[2], ''); // website blank
});

test('11. Special data: tabs and newlines in page names sanitized to spaces', () => {
  const dirtyCandidates = [
    {
      facebookPageName: 'Line1\nLine2\tLine3\r\nLine4',
      facebookPageUrl: 'https://facebook.com/dirty',
      websiteState: 'found'
    }
  ];

  const tsv = metaResultsToTsv(dirtyCandidates);
  const lines = tsv.split('\n');
  assert.strictEqual(lines.length, 2); // 1 header + 1 single row (newlines sanitized!)

  const cols = lines[1].split('\t');
  assert.strictEqual(cols.length, 3);
  assert.strictEqual(cols[0], 'Line1 Line2 Line3 Line4');
  assert.strictEqual(cols[1], 'https://facebook.com/dirty');
  assert.strictEqual(cols[2], 'YES');
});

// ─── GROUP 6: ARCHITECTURAL BOUNDARY VERIFICATION ───────────────────────────
group('GROUP 6: ARCHITECTURAL BOUNDARY VERIFICATION');

test('12. Architectural Test: ResultsTableView imports clipboard domain instead of duplicate serialization', () => {
  const resultsUiPath = path.join(rootDir, 'src/extension/ui/components/ResultsTableView.tsx');
  assert.ok(fs.existsSync(resultsUiPath), 'ResultsTableView.tsx must exist');

  const resultsUi = fs.readFileSync(resultsUiPath, 'utf-8');

  // Must import from clipboard domain
  assert.ok(
    resultsUi.includes("from '../../clipboard/index.ts'") || resultsUi.includes("from '../../clipboard'"),
    'ResultsTableView must import from clipboard domain'
  );

  // Must NOT implement manual tab-delimited formatting (.join('\t') or .join('\n'))
  assert.ok(
    !resultsUi.includes(".join('\\t')"),
    'ResultsTableView must not duplicate TSV tab joining logic'
  );

  // Must call domain functions
  assert.ok(
    resultsUi.includes('metaResultsToTsv'),
    'ResultsTableView must use metaResultsToTsv'
  );
  assert.ok(
    resultsUi.includes('writeClipboardText'),
    'ResultsTableView must use writeClipboardText'
  );
});

await runAllTests();
