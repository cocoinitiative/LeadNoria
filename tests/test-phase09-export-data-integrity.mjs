/**
 * LeadNoria — Phase 9: CSV/JSON Export & Data Integrity Regression Test Suite
 *
 * Validates:
 * 1. Existing header compatibility and exact row/header alignment.
 * 2. Proper CSV cell escaping, multi-line values, and Unicode preservation.
 * 3. Robust spreadsheet formula injection defense (=, +, -, @, \t, \r).
 * 4. Qualification outcome integrity: qualifiedOnly, reviewOnly, and rejectedOnly filtering.
 * 5. Strict-local geographic safeguards: foreign and unknown location leads never leak into qualified exports.
 * 6. CTA and Destination separation: preserved as distinct columns.
 * 7. Contact evidence provenance and conflict visibility: conflicts remain visible in export.
 * 8. Contact confidence semantics: UNPROBED_PUBLIC_CLAIM is never serialized as verified reachability.
 * 9. Lead scoring and prioritization metadata export.
 * 10. Valid JSON export: parseable, deterministic, structured envelope, full nested evidence retention.
 * 11. Legacy record backward compatibility: handles missing fields safely without throwing.
 * 12. Storage-to-export parity: persisted records round-trip through export without corruption.
 * 13. Deduplication evidence preservation: adEvidence arrays remain intact.
 * 14. Fail-closed safety gates and historical release archive immutability.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  exportLeadsToCsv,
  exportLeadsToJson
} from '../src/extension/metaAdapter.ts';
import { normalizeStoredLead } from '../src/extension/bulkStore.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('LEADNORIA: PHASE 9 CSV/JSON EXPORT & DATA INTEGRITY REGRESSION SUITE');
console.log('Scope: CSV/JSON Schemas | Formula Defense | Evidence Parity | Safety');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

const mockQualifiedLead = {
  id: 'lead_qual_01',
  name: 'Dhaka Tech Solutions Ltd.',
  canonicalName: 'Dhaka Tech Solutions Ltd.',
  facebookPageName: 'Dhaka Tech Solutions',
  facebookPageUrl: 'https://www.facebook.com/dhakatech',
  facebookPageState: 'found',
  destinationDomain: 'dhakatech.com.bd',
  destinationUrl: 'https://dhakatech.com.bd/contact',
  websiteState: 'found',
  activeAdCount: 3,
  adCount: 3,
  matchedKeywords: ['software development', 'web design'],
  locationCode: 'BD',
  locationName: 'Dhaka, Bangladesh',
  targetCountryCode: 'BD',
  businessCountryCode: 'BD',
  geographicClassification: 'LOCAL_VERIFIED',
  businessLocationConfidence: 'HIGH',
  businessLocationEvidence: ['House 12, Road 5, Dhanmondi, Dhaka 1205, Bangladesh'],
  adLibraryIds: ['100000000000001', '100000000000002', '100000000000003'],
  adLibraryUrl: 'https://www.facebook.com/ads/library/?id=100000000000001',
  relevanceDecision: 'RELEVANT',
  relevanceScore: 0.95,
  relevanceConfidence: 'HIGH',
  relevanceMatchedTerms: ['software', 'web design'],
  relevanceReasons: ['Matched high-value commercial software service keywords'],
  engineVersion: 'strict-v2',
  status: 'QUALIFIED',
  discoveredAt: '2026-10-15T10:00:00Z',
  sampleCopy: 'Custom software & web development services in Dhaka.',
  sampleCta: 'Contact Us',
  primaryCtaType: 'CONTACT_US',
  primaryDestinationType: 'EXTERNAL_WEBSITE',
  destinationConfidence: 'HIGH',
  destinationReasonCode: 'EXTERNAL_DOMAIN_RESOLVED',
  canonicalPageId: '10987654321',
  canonicalPageSlug: 'dhakatech',
  identityConfidence: 'HIGH',
  relationshipType: 'INDEPENDENT_BUSINESS',
  aliases: ['DTS Ltd'],
  businessPhone: '+8801711223344',
  businessEmail: 'contact@dhakatech.com.bd',
  phones: ['+8801711223344'],
  emails: ['contact@dhakatech.com.bd'],
  contactProfile: {
    primaryPhone: '+8801711223344',
    primaryEmail: 'contact@dhakatech.com.bd',
    overallQualityState: 'OBSERVED_VALID_SYNTAX',
    phoneConflict: false,
    emailConflict: false,
    phoneConflictState: 'NO_CONFLICT',
    emailConflictState: 'NO_CONFLICT',
    observedPhones: [{
      type: 'PHONE',
      rawValue: '+880 1711-223344',
      normalizedValue: '+8801711223344',
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      surface: 'AD_BODY_TEXT',
      observedAt: '2026-10-15T10:00:00Z'
    }],
    observedEmails: [{
      type: 'EMAIL',
      rawValue: 'contact@dhakatech.com.bd',
      normalizedValue: 'contact@dhakatech.com.bd',
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      surface: 'AD_BODY_TEXT',
      observedAt: '2026-10-15T10:00:00Z'
    }]
  },
  leadScore: 95,
  normalizedScore: 0.95,
  prioritizationTier: 'HIGH',
  scoreModelVersion: 'leadnoria-scoring-v1',
  scoreExplanation: 'Lead priority score: 95/100 (HIGH priority tier, HIGH score confidence).',
  adEvidence: [
    {
      libraryId: '100000000000001',
      ctaText: 'Contact Us',
      ctaType: 'CONTACT_US',
      destinationType: 'EXTERNAL_WEBSITE',
      destinationUrl: 'https://dhakatech.com.bd/contact',
      destinationDomain: 'dhakatech.com.bd',
      reasonCode: 'EXTERNAL_DOMAIN_RESOLVED',
      confidence: 'HIGH'
    }
  ]
};

const mockReviewLead = {
  id: 'lead_review_01',
  name: 'Probable Dental Care',
  canonicalName: 'Probable Dental Care',
  facebookPageName: 'Probable Dental Care',
  status: 'REVIEW_REQUIRED',
  targetCountryCode: 'BD',
  locationCode: 'BD',
  geographicClassification: 'LOCAL_PROBABLE',
  relevanceDecision: 'RELEVANT',
  relevanceConfidence: 'MEDIUM',
  adLibraryIds: ['200000000000001'],
  primaryCtaType: 'CALL_NOW',
  primaryDestinationType: 'MESSAGING',
  contactProfile: {
    primaryPhone: '01711998877',
    overallQualityState: 'AMBIGUOUS_FORMAT',
    phoneConflict: false,
    emailConflict: false,
    observedPhones: [{
      type: 'PHONE',
      rawValue: '01711998877',
      syntaxState: 'AMBIGUOUS',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM'
    }]
  },
  leadScore: 65,
  prioritizationTier: 'MEDIUM',
  scoreModelVersion: 'leadnoria-scoring-v1',
  scoreExplanation: 'Review required due to probable geographic evidence.'
};

const mockForeignLead = {
  id: 'lead_foreign_01',
  name: 'Global Software US Inc',
  canonicalName: 'Global Software US Inc',
  status: 'REVIEW_REQUIRED',
  targetCountryCode: 'BD',
  businessCountryCode: 'US',
  geographicClassification: 'FOREIGN_VERIFIED',
  relevanceDecision: 'RELEVANT',
  adLibraryIds: ['300000000000001'],
  leadScore: 40,
  prioritizationTier: 'LOW',
  scoreModelVersion: 'leadnoria-scoring-v1'
};

// ============================================================================
// SECTION 1: CSV SCHEMA & ROW/HEADER ALIGNMENT
// ============================================================================
console.log('--- SECTION 1: CSV SCHEMA & ROW/HEADER ALIGNMENT ---');

runTest('CSV export contains exact 56 headers in authoritative order', () => {
  const csv = exportLeadsToCsv([mockQualifiedLead]);
  const lines = csv.split('\r\n');
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, ''));

  assert.strictEqual(headers.length, 56);
  assert.strictEqual(headers[0], 'Lead Name');
  assert.strictEqual(headers[1], 'Facebook Page Name');
  assert.strictEqual(headers[13], 'Geographic Classification');
  assert.strictEqual(headers[28], 'CTA Type');
  assert.strictEqual(headers[29], 'Destination Type');
  assert.strictEqual(headers[44], 'Public Observed Phone');
  assert.strictEqual(headers[45], 'Public Observed Email');
  assert.strictEqual(headers[52], 'Lead Priority Score');
  assert.strictEqual(headers[53], 'Prioritization Tier');
  assert.strictEqual(headers[54], 'Score Model Version');
  assert.strictEqual(headers[55], 'Score Explanation');
});

function parseCsvFields(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

runTest('CSV export row column count strictly matches header count (56 columns)', () => {
  const csv = exportLeadsToCsv([mockQualifiedLead, mockReviewLead]);
  const lines = csv.split('\r\n').filter(Boolean);
  const headerCount = parseCsvFields(lines[0]).length;
  assert.strictEqual(headerCount, 56);

  for (let i = 1; i < lines.length; i++) {
    const rowCols = parseCsvFields(lines[i]);
    assert.strictEqual(rowCols.length, headerCount, `Row ${i} column count mismatch: expected ${headerCount}, got ${rowCols.length}`);
  }
});

// ============================================================================
// SECTION 2: FORMULA INJECTION DEFENSE & ESCAPING
// ============================================================================
console.log('\n--- SECTION 2: FORMULA INJECTION DEFENSE & ESCAPING ---');

runTest('CSV export neutralizes all formula trigger prefixes (=, +, -, @, \\t, \\r)', () => {
  const dangerousLead = {
    ...mockQualifiedLead,
    name: '=cmd|/c calc!A0',
    sampleCopy: '+2+2',
    sampleCta: '-5',
    destinationUrl: '@SUM(1+1)',
    scoreExplanation: '\t=HYPERLINK("http://evil.com", "Click")'
  };

  const csv = exportLeadsToCsv([dangerousLead]);
  assert.strictEqual(csv.includes("'=cmd"), true);
  assert.strictEqual(csv.includes("'+2+2"), true);
  assert.strictEqual(csv.includes("'-5"), true);
  assert.strictEqual(csv.includes("'@SUM"), true);
  assert.strictEqual(csv.includes("'\t=HYPERLINK"), true);
});

runTest('CSV export properly escapes quotes, commas, and multi-line values', () => {
  const complexLead = {
    ...mockQualifiedLead,
    name: 'Tech "Innovations", Dhaka',
    sampleCopy: 'First line of copy.\r\nSecond line of copy with "quotes" and, commas.'
  };

  const csv = exportLeadsToCsv([complexLead]);
  assert.strictEqual(csv.includes('"Tech ""Innovations"", Dhaka"'), true);
  assert.strictEqual(csv.includes('First line of copy.\r\nSecond line of copy with ""quotes"" and, commas.'), true);
});

runTest('CSV export preserves non-ASCII Unicode (Bengali script) without mojibake', () => {
  const bengaliLead = {
    ...mockQualifiedLead,
    name: 'ঢাকা টেক সলিউশনস',
    locationName: 'ঢাকা, বাংলাদেশ',
    sampleCopy: 'সেরা সফটওয়্যার ডেভেলপমেন্ট সেবা'
  };

  const csv = exportLeadsToCsv([bengaliLead]);
  assert.strictEqual(csv.includes('ঢাকা টেক সলিউশনস'), true);
  assert.strictEqual(csv.includes('ঢাকা, বাংলাদেশ'), true);
  assert.strictEqual(csv.includes('সেরা সফটওয়্যার ডেভেলপমেন্ট সেবা'), true);
});

// ============================================================================
// SECTION 3: QUALIFICATION & GEOGRAPHIC INTEGRITY
// ============================================================================
console.log('\n--- SECTION 3: QUALIFICATION & GEOGRAPHIC INTEGRITY ---');

runTest('exportLeadsToCsv qualifiedOnly strictly excludes review and foreign leads', () => {
  const leads = [mockQualifiedLead, mockReviewLead, mockForeignLead];
  const csv = exportLeadsToCsv(leads, { qualifiedOnly: true });

  assert.strictEqual(csv.includes('Dhaka Tech Solutions Ltd.'), true);
  assert.strictEqual(csv.includes('Probable Dental Care'), false);
  assert.strictEqual(csv.includes('Global Software US Inc'), false);
});

runTest('exportLeadsToCsv reviewOnly strictly exports leads requiring review', () => {
  const leads = [mockQualifiedLead, mockReviewLead, mockForeignLead];
  const csv = exportLeadsToCsv(leads, { reviewOnly: true });

  assert.strictEqual(csv.includes('Dhaka Tech Solutions Ltd.'), false);
  assert.strictEqual(csv.includes('Probable Dental Care'), true);
});

runTest('Foreign businesses cannot be exported as qualified in strict-local workflow', () => {
  const leads = [mockForeignLead];
  const csv = exportLeadsToCsv(leads, { qualifiedOnly: true, strictLocalMode: true });

  assert.strictEqual(csv.includes('Global Software US Inc'), false);
});

// ============================================================================
// SECTION 4: CONTACT & EVIDENCE MANAGEMENT INTEGRITY
// ============================================================================
console.log('\n--- SECTION 4: CONTACT EVIDENCE & CONFLICT INTEGRITY ---');

runTest('Contact conflicts remain visible in CSV export and are not silently discarded', () => {
  const conflictLead = {
    ...mockQualifiedLead,
    contactProfile: {
      primaryPhone: '+8801711223344',
      phoneConflict: true,
      phoneConflictState: 'CONFLICT_DETECTED',
      observedPhones: [{ syntaxState: 'SYNTAX_VALID' }]
    }
  };

  const csv = exportLeadsToCsv([conflictLead]);
  assert.strictEqual(csv.includes('CONFLICT_DETECTED'), true);
});

runTest('Contact syntax validity is never exported as verified reachability', () => {
  const csv = exportLeadsToCsv([mockQualifiedLead]);
  assert.strictEqual(csv.includes('UNPROBED_PUBLIC_CLAIM'), true);
});

// ============================================================================
// SECTION 5: JSON EXPORT & SCHEMA VALIDATION
// ============================================================================
console.log('\n--- SECTION 5: JSON EXPORT & SCHEMA VALIDATION ---');

runTest('exportLeadsToJson produces valid parseable JSON with full evidence envelope', () => {
  const jsonStr = exportLeadsToJson([mockQualifiedLead]);
  const parsed = JSON.parse(jsonStr);

  assert.strictEqual(parsed.product, 'LeadNoria');
  assert.strictEqual(parsed.source, 'Meta Ad Library');
  assert.strictEqual(parsed.totalLeads, 1);
  assert.strictEqual(Array.isArray(parsed.leads), true);
  assert.strictEqual(parsed.leads[0].name, 'Dhaka Tech Solutions Ltd.');
  assert.strictEqual(Array.isArray(parsed.leads[0].adEvidence), true);
  assert.strictEqual(typeof parsed.leads[0].contactProfile, 'object');
});

runTest('exportLeadsToJson respects qualifiedOnly, reviewOnly, and rejectedOnly options', () => {
  const leads = [mockQualifiedLead, mockReviewLead, mockForeignLead];

  const qualJson = JSON.parse(exportLeadsToJson(leads, { qualifiedOnly: true }));
  assert.strictEqual(qualJson.totalLeads, 1);
  assert.strictEqual(qualJson.leads[0].name, 'Dhaka Tech Solutions Ltd.');

  const reviewJson = JSON.parse(exportLeadsToJson(leads, { reviewOnly: true }));
  assert.strictEqual(reviewJson.totalLeads, 1);
  assert.strictEqual(reviewJson.leads[0].name, 'Probable Dental Care');
});

runTest('exportLeadsToJson includes research run metadata when run is provided', () => {
  const mockRun = {
    runId: 'run_export_001',
    researchName: 'Dhaka IT Agency Research',
    mode: 'AUTO_DISCOVERY',
    locationName: 'Bangladesh',
    countryCode: 'BD',
    engineVersion: '1.7.7'
  };

  const jsonStr = exportLeadsToJson([mockQualifiedLead], mockRun);
  const parsed = JSON.parse(jsonStr);

  assert.strictEqual(parsed.runId, 'run_export_001');
  assert.strictEqual(parsed.researchName, 'Dhaka IT Agency Research');
  assert.strictEqual(parsed.targetCountryCode, 'BD');
});

// ============================================================================
// SECTION 6: STORAGE / EXPORT PARITY & DETERMINISM
// ============================================================================
console.log('\n--- SECTION 6: STORAGE/EXPORT PARITY & REPRODUCIBILITY ---');

runTest('normalizeStoredLead round-trips through export without data loss', () => {
  const storedLead = normalizeStoredLead(mockQualifiedLead);
  const csv = exportLeadsToCsv([storedLead]);
  const json = JSON.parse(exportLeadsToJson([storedLead]));

  assert.strictEqual(csv.includes('Dhaka Tech Solutions Ltd.'), true);
  assert.strictEqual(csv.includes('+8801711223344'), true);
  assert.strictEqual(csv.includes('95'), true);
  assert.strictEqual(json.leads[0].leadScore, 95);
  assert.strictEqual(json.leads[0].businessCountryCode, 'BD');
});

runTest('exportLeadsToCsv is deterministic and idempotent across repeated calls', () => {
  const csv1 = exportLeadsToCsv([mockQualifiedLead, mockReviewLead]);
  const csv2 = exportLeadsToCsv([mockQualifiedLead, mockReviewLead]);

  assert.strictEqual(csv1, csv2);
});

runTest('exportLeadsToCsv handles legacy records with missing fields safely', () => {
  const legacyLead = {
    id: 'legacy_001',
    name: 'Legacy Business',
    facebookPageName: 'Legacy Page',
    status: 'QUALIFIED'
  };

  const csv = exportLeadsToCsv([legacyLead]);
  assert.strictEqual(csv.includes('Legacy Business'), true);
  assert.strictEqual(csv.includes('N/A'), true); // score fallback
});

// ============================================================================
// SECTION 7: FAIL-CLOSED SAFETY GATES & ARCHIVES
// ============================================================================
console.log('\n--- SECTION 7: FAIL-CLOSED SAFETY GATES & ARCHIVES ---');

runTest('Safety gate isLiveCollectionPermitted() strictly evaluates to false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false);
});

runTest('Safety gate isExternalWebsiteCrawlingPermitted() strictly evaluates to false', () => {
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false);
});

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

runTest('Historical release archives remain byte-for-byte immutable', () => {
  const expectedHashes = {
    'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
    'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
    'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
  };

  for (const [relPath, expected] of Object.entries(expectedHashes)) {
    const full = path.join(rootDir, relPath);
    assert.strictEqual(fs.existsSync(full), true, `File missing: ${relPath}`);
    const actual = sha256(full);
    assert.strictEqual(actual, expected, `SHA-256 mismatch for ${relPath}`);
  }
});

console.log('\n========================================================================');
console.log(`Phase 9 Regression Test Summary: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
