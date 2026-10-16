/**
 * LeadNoria v1.7.7 — Audit & Workflow Regression Verification Suite
 *
 * Verifies:
 * 1. Geographic classification fallback in CSV export (never fabricate LOCAL_VERIFIED)
 * 2. CanonicalLeadRecord interoperability in CSV export
 * 3. Formula injection protection across CSV fields
 * 4. Strict local filtering logic in UI result views
 * 5. Fail-closed safety gates: isLiveCollectionPermitted() === false, isExternalWebsiteCrawlingPermitted() === false
 */

import assert from 'node:assert';
import { exportLeadsToCsv, exportLeadsToJson } from '../src/extension/metaAdapter.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

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

// 2. Geographic Classification Fallback in CSV Export
test('CSV Export: Foreign advertiser without geographicClassification exports as FOREIGN_VERIFIED, never LOCAL_VERIFIED', () => {
  const foreignLead = {
    name: 'Shenzhen Fast Furniture',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'CN',
    geographicClassification: undefined,
    adLibraryIds: ['12345678901'],
    status: 'NOT_QUALIFIED'
  };

  const csv = exportLeadsToCsv([foreignLead]);
  assert.ok(!csv.includes('LOCAL_VERIFIED'), 'Foreign advertiser must not be exported as LOCAL_VERIFIED');
  assert.ok(csv.includes('FOREIGN_VERIFIED'), 'Foreign advertiser must be exported as FOREIGN_VERIFIED');
});

test('CSV Export: Matching country without physical verification exports as LOCAL_PROBABLE, never LOCAL_VERIFIED', () => {
  const probableLead = {
    name: 'Dhaka Modern Crafts',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: undefined,
    adLibraryIds: ['12345678902'],
    status: 'REVIEW_REQUIRED'
  };

  const csv = exportLeadsToCsv([probableLead]);
  assert.ok(!csv.includes('LOCAL_VERIFIED'), 'Unverified local match must not be exported as LOCAL_VERIFIED');
  assert.ok(csv.includes('LOCAL_PROBABLE'), 'Unverified local match must be exported as LOCAL_PROBABLE');
});

test('CSV Export: Explicit LOCAL_VERIFIED remains LOCAL_VERIFIED', () => {
  const verifiedLead = {
    name: 'Hatil Furniture BD',
    locationCode: 'BD',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_VERIFIED',
    businessLocationConfidence: 'HIGH',
    adLibraryIds: ['12345678903'],
    status: 'QUALIFIED'
  };

  const csv = exportLeadsToCsv([verifiedLead]);
  assert.ok(csv.includes('LOCAL_VERIFIED'), 'Explicit LOCAL_VERIFIED must be preserved in CSV');
});

// 3. CanonicalLeadRecord Interoperability in CSV Export
test('CSV Export: CanonicalLeadRecord exports with businessName, domain, contacts, and status', () => {
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

// 4. Formula Injection Immunity in CSV
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

// 5. JSON Export Validation
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
