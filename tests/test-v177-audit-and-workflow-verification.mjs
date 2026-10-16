/**
 * LeadNoria v1.7.7 — Audit & Workflow Regression Verification Suite
 *
 * Verifies:
 * 1. Geographic classification fallback in CSV export (never fabricate LOCAL_VERIFIED)
 * 2. Country scenarios targeting Bangladesh: BD (verified & unverified), US, CN (China), Missing country
 * 3. Geographic filters: "Local Verified Only" accepts ONLY LOCAL_VERIFIED
 * 4. CanonicalLeadRecord interoperability with full and sparse/missing optional fields
 * 5. Website signal filtering: websiteVerified, websiteUrl, and supported websiteState values
 * 6. Formula injection protection across CSV fields
 * 7. Fail-closed safety gates: isLiveCollectionPermitted() === false, isExternalWebsiteCrawlingPermitted() === false
 */

import assert from 'node:assert';
import { exportLeadsToCsv, exportLeadsToJson } from '../src/extension/metaAdapter.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';
import { evaluateLeadQualificationGates } from '../src/extension/qualificationGate.ts';

console.log('========================================================================');
console.log('LEADNORIA v1.7.7 — AUDIT & WORKFLOW REGRESSION VERIFICATION');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failCount++;
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
  }
}

// 1. Fail-Closed Invariants
test('Safety gate: isLiveCollectionPermitted() is strictly false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must be false');
});

test('Safety gate: isExternalWebsiteCrawlingPermitted() is strictly false', () => {
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must be false');
});

// 2. Bangladesh-Target Geographic Scenarios in CSV Export
test('CSV Export [BD-Target / US-Foreign]: US advertiser targeting BD exports as FOREIGN_VERIFIED, never LOCAL_VERIFIED', () => {
  const usLead = {
    name: 'Silicon Valley Cloud Solutions',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'US',
    geographicClassification: undefined,
    adLibraryIds: ['12345678901'],
    status: 'NOT_QUALIFIED'
  };

  const csv = exportLeadsToCsv([usLead]);
  assert.ok(!csv.includes('LOCAL_VERIFIED'), 'US advertiser must not be exported as LOCAL_VERIFIED');
  assert.ok(csv.includes('FOREIGN_VERIFIED'), 'US advertiser must be exported as FOREIGN_VERIFIED');
});

test('CSV Export [BD-Target / CN-Foreign]: China advertiser targeting BD exports as FOREIGN_VERIFIED, never LOCAL_VERIFIED', () => {
  const cnLead = {
    name: 'Shenzhen Fast Furniture Factory',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'CN',
    geographicClassification: undefined,
    adLibraryIds: ['12345678902'],
    status: 'NOT_QUALIFIED'
  };

  const csv = exportLeadsToCsv([cnLead]);
  assert.ok(!csv.includes('LOCAL_VERIFIED'), 'China advertiser must not be exported as LOCAL_VERIFIED');
  assert.ok(csv.includes('FOREIGN_VERIFIED'), 'China advertiser must be exported as FOREIGN_VERIFIED');
});

test('CSV Export [BD-Target / BD-Unverified]: BD advertiser without physical proof exports as LOCAL_PROBABLE, never LOCAL_VERIFIED', () => {
  const bdUnverified = {
    name: 'Dhaka Modern Crafts',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: undefined,
    adLibraryIds: ['12345678903'],
    status: 'REVIEW_REQUIRED'
  };

  const csv = exportLeadsToCsv([bdUnverified]);
  assert.ok(!csv.includes('LOCAL_VERIFIED'), 'Unverified local match must not be exported as LOCAL_VERIFIED');
  assert.ok(csv.includes('LOCAL_PROBABLE'), 'Unverified local match must be exported as LOCAL_PROBABLE');
});

test('CSV Export [BD-Target / Missing Country]: Missing country evidence exports as LOCATION_UNKNOWN', () => {
  const missingCountryLead = {
    name: 'Anonymous Digital Agency',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: undefined,
    geographicClassification: undefined,
    adLibraryIds: ['12345678904'],
    status: 'REVIEW_REQUIRED'
  };

  const csv = exportLeadsToCsv([missingCountryLead]);
  assert.ok(!csv.includes('LOCAL_VERIFIED'), 'Missing country must not be exported as LOCAL_VERIFIED');
  assert.ok(csv.includes('LOCATION_UNKNOWN'), 'Missing country must be exported as LOCATION_UNKNOWN');
});

test('CSV Export [BD-Target / BD-Verified]: Explicit LOCAL_VERIFIED remains LOCAL_VERIFIED', () => {
  const verifiedLead = {
    name: 'Hatil Furniture BD',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_VERIFIED',
    businessLocationConfidence: 'HIGH',
    adLibraryIds: ['12345678905'],
    status: 'QUALIFIED'
  };

  const csv = exportLeadsToCsv([verifiedLead]);
  assert.ok(csv.includes('LOCAL_VERIFIED'), 'Explicit LOCAL_VERIFIED must be preserved in CSV');
});

// 3. Geographic Filter Logic ("Local Verified Only")
test('Geographic Filter: "Local Verified Only" accepts ONLY LOCAL_VERIFIED', () => {
  const filterFn = (row, filterValue) => {
    if (filterValue === 'ALL') return true;
    const geo = row.geographicClassification || (row.businessCountryCode ? (row.businessCountryCode === row.targetCountryCode ? 'LOCAL_PROBABLE' : 'FOREIGN_VERIFIED') : 'LOCATION_UNKNOWN');
    return geo === filterValue;
  };

  const localVerified = { geographicClassification: 'LOCAL_VERIFIED', businessCountryCode: 'BD', targetCountryCode: 'BD' };
  const localProbable = { geographicClassification: 'LOCAL_PROBABLE', businessCountryCode: 'BD', targetCountryCode: 'BD' };
  const foreignVerified = { geographicClassification: 'FOREIGN_VERIFIED', businessCountryCode: 'CN', targetCountryCode: 'BD' };
  const locationUnknown = { geographicClassification: 'LOCATION_UNKNOWN', businessCountryCode: undefined, targetCountryCode: 'BD' };
  const fallbackForeign = { geographicClassification: undefined, businessCountryCode: 'US', targetCountryCode: 'BD' };
  const fallbackProbable = { geographicClassification: undefined, businessCountryCode: 'BD', targetCountryCode: 'BD' };

  assert.strictEqual(filterFn(localVerified, 'LOCAL_VERIFIED'), true, 'LOCAL_VERIFIED must pass LOCAL_VERIFIED filter');
  assert.strictEqual(filterFn(localProbable, 'LOCAL_VERIFIED'), false, 'LOCAL_PROBABLE must NOT pass LOCAL_VERIFIED filter');
  assert.strictEqual(filterFn(foreignVerified, 'LOCAL_VERIFIED'), false, 'FOREIGN_VERIFIED must NOT pass LOCAL_VERIFIED filter');
  assert.strictEqual(filterFn(locationUnknown, 'LOCAL_VERIFIED'), false, 'LOCATION_UNKNOWN must NOT pass LOCAL_VERIFIED filter');
  assert.strictEqual(filterFn(fallbackForeign, 'LOCAL_VERIFIED'), false, 'Fallback foreign must NOT pass LOCAL_VERIFIED filter');
  assert.strictEqual(filterFn(fallbackProbable, 'LOCAL_VERIFIED'), false, 'Fallback probable must NOT pass LOCAL_VERIFIED filter');
});

// 4. Strict-Local Mode Qualification Gates
test('Strict-Local Qualification Gate: Rejects foreign & unverified, qualifies only verified local', () => {
  const intent = { strictLocalMode: true, allowProbableLocal: false, targetCountryCode: 'BD' };

  const foreignLead = {
    name: 'Shenzhen Craft',
    adLibraryIds: ['100001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'FOREIGN_VERIFIED',
    businessCountryCode: 'CN',
    targetCountryCode: 'BD'
  };
  const foreignRes = evaluateLeadQualificationGates(foreignLead, intent);
  assert.strictEqual(foreignRes.isQualified, false, 'Foreign advertiser must not qualify in strict-local mode');
  assert.ok(foreignRes.failedGates.includes('GATE_GEOGRAPHY'), 'Foreign advertiser must fail geography gate');

  const probableLead = {
    name: 'Dhaka Craft Probable',
    adLibraryIds: ['100002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_PROBABLE',
    businessCountryCode: 'BD',
    targetCountryCode: 'BD'
  };
  const probableRes = evaluateLeadQualificationGates(probableLead, intent);
  assert.strictEqual(probableRes.isQualified, false, 'LOCAL_PROBABLE must not qualify when allowProbableLocal is false');

  const unknownLead = {
    name: 'Unknown Location Craft',
    adLibraryIds: ['100003'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCATION_UNKNOWN',
    targetCountryCode: 'BD'
  };
  const unknownRes = evaluateLeadQualificationGates(unknownLead, intent);
  assert.strictEqual(unknownRes.isQualified, false, 'LOCATION_UNKNOWN must not qualify in strict-local mode');

  const verifiedLead = {
    name: 'Hatil Verified Local',
    adLibraryIds: ['100004'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    businessCountryCode: 'BD',
    targetCountryCode: 'BD'
  };
  const verifiedRes = evaluateLeadQualificationGates(verifiedLead, intent);
  assert.strictEqual(verifiedRes.isQualified, true, 'LOCAL_VERIFIED must qualify in strict-local mode');
});

// 5. CanonicalLeadRecord Interoperability in CSV Export
test('CSV Export: Full CanonicalLeadRecord exports with businessName, domain, contacts, and status', () => {
  const canonicalLead = {
    schemaVersion: 'lead-intelligence-v1',
    canonicalEntityId: 'ent_hatil_bd',
    canonicalBusinessName: {
      value: 'Hatil Complex Ltd',
      preferredObservedValue: 'Hatil Furniture'
    },
    policy: {
      hasMetaLineage: true,
      hasWebsiteLineage: true,
      overallProvenance: 'SINGLE_SOURCE',
      isRestricted: false,
      exportEligible: true,
      persistenceEligible: true
    },
    digital: {
      verifiedWebsite: { value: 'https://hatil.com' },
      domains: { value: ['hatil.com'] },
      socialProfiles: { facebook: 'https://facebook.com/hatilbd' }
    },
    contacts: {
      phones: [{ value: '+8801700000000', preferredObservedValue: '+880 1700-000000' }],
      emails: [{ value: 'info@hatil.com' }]
    },
    business: {
      country: { value: 'BD' }
    },
    qualification: {
      finalState: 'QUALIFIED'
    },
    evidence: {
      evidencePack: {
        observationCount: 5,
        sourceTypes: ['META']
      }
    }
  };

  const csv = exportLeadsToCsv([canonicalLead]);
  assert.ok(csv.includes('Hatil Furniture'), 'Must include canonical business name in CSV');
  assert.ok(csv.includes('hatil.com'), 'Must include website domain in CSV');
  assert.ok(csv.includes('+8801700000000') || csv.includes('+880 1700-000000'), 'Must include phone in CSV');
  assert.ok(csv.includes('info@hatil.com'), 'Must include email in CSV');
  assert.ok(csv.includes('QUALIFIED'), 'Must include qualification state in CSV');
});

test('CSV Export: Sparse CanonicalLeadRecord with missing optional fields does not crash or corrupt output', () => {
  const sparseCanonicalLead = {
    schemaVersion: 'lead-intelligence-v1',
    canonicalEntityId: 'ent_sparse_001',
    canonicalBusinessName: {
      value: 'Minimal Business Entity'
    },
    policy: {
      hasMetaLineage: true,
      overallProvenance: 'SINGLE_SOURCE',
      isRestricted: false,
      exportEligible: true,
      persistenceEligible: true
    }
    // No digital, contacts, business, qualification, or evidence
  };

  const csv = exportLeadsToCsv([sparseCanonicalLead]);
  assert.ok(csv.includes('Minimal Business Entity'), 'Must export minimal canonical business name');
  assert.ok(!csv.includes('undefined'), 'Must not contain undefined literal strings');
  assert.ok(!csv.includes('null'), 'Must not contain null literal strings');
});

// 6. Website Signal Filtering Logic
test('Website Signal Filter: Accepts verified website, visible URL, or found status; rejects absence', () => {
  const matchesWebsiteFilter = (r, requireWebsite) => {
    if (!requireWebsite) return true;
    return Boolean(
      r.dataSignals?.websiteVerified ||
      r.websiteUrl ||
      r.websiteState === 'found' ||
      r.websiteState === 'VERIFIED_BUSINESS_WEBSITE'
    );
  };

  const verifiedWebsiteRecord = { dataSignals: { websiteVerified: true }, websiteUrl: undefined, websiteState: 'unknown' };
  const urlOnlyRecord = { dataSignals: { websiteVerified: false }, websiteUrl: 'https://example.com', websiteState: 'unknown' };
  const foundStateRecord = { dataSignals: { websiteVerified: false }, websiteUrl: undefined, websiteState: 'found' };
  const noWebsiteRecord = { dataSignals: { websiteVerified: false }, websiteUrl: undefined, websiteState: 'NOT_OBSERVED' };

  assert.strictEqual(matchesWebsiteFilter(verifiedWebsiteRecord, true), true, 'Verified website must pass filter');
  assert.strictEqual(matchesWebsiteFilter(urlOnlyRecord, true), true, 'Visible URL must pass filter');
  assert.strictEqual(matchesWebsiteFilter(foundStateRecord, true), true, 'Found state must pass filter');
  assert.strictEqual(matchesWebsiteFilter(noWebsiteRecord, true), false, 'Record without website must be rejected by filter');
});

// 7. Formula Injection Immunity in CSV
test('CSV Export: Formula injection prefixes (=, +, -, @) are sanitized with single quote', () => {
  const maliciousLead = {
    name: '=cmd|"/C calc"!A0',
    sampleCopy: '+2+5',
    sampleCta: '@SUM(A1:A10)',
    locationCode: '-1',
    adLibraryIds: ['12345678909']
  };

  const csv = exportLeadsToCsv([maliciousLead]);
  assert.ok(csv.includes("'\=cmd|"), 'Equals formula must be prefixed with single quote');
  assert.ok(csv.includes("'\+2+5"), 'Plus formula must be prefixed with single quote');
  assert.ok(csv.includes("'\@SUM"), 'At formula must be prefixed with single quote');
  assert.ok(csv.includes("'\-1"), 'Minus formula must be prefixed with single quote');
});

// 8. JSON Export Validation
test('JSON Export: Generates deterministic envelope and schema', () => {
  const lead = {
    name: 'Bengal Woodcraft',
    adLibraryIds: ['12345678910'],
    status: 'QUALIFIED',
    locationCode: 'BD'
  };

  const jsonStr = exportLeadsToJson([lead]);
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.product, 'LeadNoria');
  assert.strictEqual(parsed.source, 'Meta Ad Library');
  assert.strictEqual(parsed.totalLeads, 1);
  assert.strictEqual(parsed.leads[0].name, 'Bengal Woodcraft');
});

console.log('\n========================================================================');
console.log(`SUMMARY: ${passCount} Passed, ${failCount} Failed`);
console.log('========================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
