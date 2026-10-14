/**
 * LeadNoria — Phase 3 Remediation Regression Test Suite
 * Niche Relevance & Qualification Rules (24 Required Verification Gates)
 *
 * Verifies all Phase 3 requirements:
 * 1. Country gate passes only with valid required evidence (LOCAL_VERIFIED).
 * 2. Foreign verified business fails a strict-local requirement.
 * 3. Probable (LOCAL_PROBABLE) and unknown (LOCATION_UNKNOWN) cannot pass strict-local.
 * 4. Target country and business country remain distinct.
 * 5. Matching niche with sufficient evidence behaves correctly.
 * 6. Keyword-only niche match cannot automatically establish qualification.
 * 7. Missing niche evidence does not silently qualify.
 * 8. WITH_WEBSITE rejects unknown or unobserved website status.
 * 9. WITHOUT_WEBSITE requires appropriate explicit evidence.
 * 10. Missing ad URL does not imply no website.
 * 11. CTA filters operate independently of destination filters.
 * 12. Destination filters operate independently of CTA labels.
 * 13. Unknown CTA/destination evidence fails closed when required.
 * 14. Failed mandatory gates cannot be overridden by score.
 * 15. Confidence and score remain separate from qualification status.
 * 16. Every outcome provides an appropriate reason code.
 * 17. Ambiguous evidence leads to review where appropriate.
 * 18. Filter changes recompute or invalidate stale qualification decisions correctly.
 * 19. Persistence and recovery preserve qualification evidence.
 * 20. Exports agree with current decision and reasons.
 * 21. Existing Phase 2 CTA/destination tests continue to pass.
 * 22. Existing geographic qualification tests continue to pass.
 * 23. Both safety gates remain permanently fail-closed.
 * 24. No prohibited external requests, APIs, or permissions are introduced.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  evaluateLeadQualificationGates
} from '../src/extension/qualificationGate.ts';

import {
  LeadRelevanceEngine,
  compileResearchIntent
} from '../src/extension/relevanceEngine.ts';

import {
  classifyCta,
  classifyDestination,
  aggregateAdEvidence
} from '../src/extension/destinationClassifier.ts';

import {
  evaluateGeographicOrigin
} from '../src/extension/geographicClassifier.ts';

import {
  normalizeStoredLead
} from '../src/extension/bulkStore.ts';

import {
  exportLeadsToCsv
} from '../src/extension/metaAdapter.ts';

import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

console.log('========================================================================');
console.log('LEADNORIA: PHASE 3 REMEDIATION REGRESSION TEST SUITE');
console.log('Niche Relevance & Qualification Rules — 24 Required Verification Gates');
console.log('========================================================================');

let passedTests = 0;
let totalTests = 0;

function runGate(num, title, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] Gate ${num}: ${title}`);
  } catch (err) {
    console.error(`  [FAIL] Gate ${num}: ${title}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

// --------------------------------------------------------------------------
// 1. Country Qualification Gate (Gates 1 - 4)
// --------------------------------------------------------------------------
console.log('\n--- 1. Country Qualification Gate Invariants ---');

runGate(1, 'Country gate passes only with valid required evidence (LOCAL_VERIFIED)', () => {
  const verifiedLead = {
    name: 'Bengal Timber & Craft',
    adLibraryIds: ['100001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD'
  };

  const res = evaluateLeadQualificationGates(verifiedLead, { strictLocalMode: true });
  assert.strictEqual(res.isQualified, true, 'Verified local business must pass strict-local');
  assert.strictEqual(res.status, 'QUALIFIED');
  assert.strictEqual(res.canonicalOutcome, 'QUALIFIED');
  assert.strictEqual(res.passedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(res.failedGates.includes('GATE_GEOGRAPHY'), false);
});

runGate(2, 'Foreign verified business fails strict-local requirement', () => {
  const foreignLead = {
    name: 'London Sofa Warehouse',
    adLibraryIds: ['100002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'FOREIGN_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'GB'
  };

  const res = evaluateLeadQualificationGates(foreignLead, { strictLocalMode: true });
  assert.strictEqual(res.isQualified, false, 'Foreign business must fail strict-local');
  assert.strictEqual(res.status, 'REVIEW_REQUIRED');
  assert.strictEqual(res.canonicalOutcome, 'REJECTED');
  assert.strictEqual(res.failedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(res.reasons.some(r => r.includes('FOREIGN_VERIFIED')), true);
});

runGate(3, 'Probable (LOCAL_PROBABLE) and unknown (LOCATION_UNKNOWN) cannot pass strict-local', () => {
  const probableLead = {
    name: 'Chittagong Furnishings',
    adLibraryIds: ['100003'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_PROBABLE',
    targetCountryCode: 'BD'
  };

  const unknownLead = {
    name: 'Global Decor Studio',
    adLibraryIds: ['100004'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCATION_UNKNOWN',
    targetCountryCode: 'BD'
  };

  const resProbable = evaluateLeadQualificationGates(probableLead, { strictLocalMode: true });
  assert.strictEqual(resProbable.isQualified, false, 'LOCAL_PROBABLE must not pass strict-local without allow flag');
  assert.strictEqual(resProbable.canonicalOutcome, 'REVIEW');
  assert.strictEqual(resProbable.failedGates.includes('GATE_GEOGRAPHY'), true);

  const resUnknown = evaluateLeadQualificationGates(unknownLead, { strictLocalMode: true });
  assert.strictEqual(resUnknown.isQualified, false, 'LOCATION_UNKNOWN must not pass strict-local');
  assert.strictEqual(resUnknown.canonicalOutcome, 'REVIEW');
  assert.strictEqual(resUnknown.failedGates.includes('GATE_GEOGRAPHY'), true);
});

runGate(4, 'Target country and business country remain distinct', () => {
  const intent = compileResearchIntent({
    mode: 'CUSTOM',
    keywords: ['furniture'],
    targetCountryCode: 'BD',
    strictLocalMode: true
  });

  assert.strictEqual(intent.locationCode, 'BD', 'Intent locationCode reflects research target country');

  // Candidate targeting users in Bangladesh but physically located in the United States
  const geoEval = evaluateGeographicOrigin(
    {
      pageName: 'Austin Sofa Co',
      bodyCopy: 'Showroom at 500 Congress Ave, Austin, Texas 78701. Phone: +1 512-555-0199. Worldwide shipping.',
      destinationUrl: 'https://austinsofa.com',
      destinationDomain: 'austinsofa.com'
    },
    'BD' // target country
  );

  assert.strictEqual(geoEval.targetCountryCode, 'BD');
  assert.strictEqual(geoEval.businessCountryCode, 'US');
  assert.strictEqual(geoEval.classification, 'FOREIGN_VERIFIED');
  assert.strictEqual(geoEval.isForeign, true);
  assert.strictEqual(geoEval.isLocal, false);
});

// --------------------------------------------------------------------------
// 2. Niche-Relevance Gate (Gates 5 - 7)
// --------------------------------------------------------------------------
console.log('\n--- 2. Niche-Relevance Gate Invariants ---');

runGate(5, 'Matching niche with sufficient evidence behaves correctly', () => {
  const intent = compileResearchIntent({
    mode: 'CUSTOM',
    keywords: ['furniture', 'office furniture', 'office chairs'],
    locationCode: 'BD'
  });

  const candidate = {
    pageName: 'Otobi Furniture Ltd',
    bodyCopy: 'Discover premium office chairs, executive desks, and modern living room furniture with 5 years warranty.',
    destinationUrl: 'https://otobi.com/office-furniture',
    destinationDomain: 'otobi.com',
    ctaText: 'Shop Now'
  };

  const evalRes = LeadRelevanceEngine.evaluateCandidate(candidate, intent);
  assert.strictEqual(evalRes.decision, 'RELEVANT', 'Corroborated entity + catalog evidence must be RELEVANT');
  assert.strictEqual(evalRes.confidence, 'HIGH');
  assert.ok(evalRes.score >= 0.40);

  const qualRes = evaluateLeadQualificationGates({
    name: candidate.pageName,
    adLibraryIds: ['200001'],
    relevanceDecision: evalRes.decision,
    geographicClassification: 'LOCAL_VERIFIED'
  });
  assert.strictEqual(qualRes.passedGates.includes('GATE_RELEVANCE'), true);
  assert.strictEqual(qualRes.isQualified, true);
});

runGate(6, 'Keyword-only niche match cannot automatically establish qualification', () => {
  const intent = compileResearchIntent({
    mode: 'CUSTOM',
    keywords: ['furniture', 'office furniture'],
    locationCode: 'BD'
  });

  // Candidate is a dental clinic that casually mentions furniture in passing copy
  const candidate = {
    pageName: 'Downtown Dental Clinic',
    bodyCopy: 'Relax in our comfortable waiting room furniture while waiting for your appointment. Free teeth cleaning checkup.',
    destinationUrl: 'https://downtowndental.example.com/appointment',
    destinationDomain: 'downtowndental.example.com',
    ctaText: 'Book Now'
  };

  const evalRes = LeadRelevanceEngine.evaluateCandidate(candidate, intent);
  assert.strictEqual(evalRes.decision, 'UNCERTAIN', 'Ad copy keyword match alone must remain UNCERTAIN');
  assert.strictEqual(evalRes.reasonCode, 'UNCERTAIN_KEYWORD_ONLY');

  // Qualification gate evaluation with UNCERTAIN must fail GATE_RELEVANCE fail-closed
  const qualRes = evaluateLeadQualificationGates({
    name: candidate.pageName,
    adLibraryIds: ['200002'],
    relevanceDecision: evalRes.decision,
    geographicClassification: 'LOCAL_VERIFIED'
  });
  assert.strictEqual(qualRes.isQualified, false, 'UNCERTAIN niche match must not qualify');
  assert.strictEqual(qualRes.failedGates.includes('GATE_RELEVANCE'), true);
  assert.strictEqual(qualRes.canonicalOutcome, 'REVIEW');
});

runGate(7, 'Missing niche evidence does not silently qualify', () => {
  const unassessedLead = {
    name: 'Unassessed Trader Co',
    adLibraryIds: ['200003'],
    geographicClassification: 'LOCAL_VERIFIED'
    // relevanceDecision is missing / undefined
  };

  const qualRes = evaluateLeadQualificationGates(unassessedLead);
  assert.strictEqual(qualRes.isQualified, false, 'Missing relevanceDecision must fail closed');
  assert.strictEqual(qualRes.failedGates.includes('GATE_RELEVANCE'), true);
  assert.strictEqual(qualRes.canonicalOutcome, 'REVIEW');
  assert.strictEqual(qualRes.reasons.some(r => r.includes('UNASSESSED')), true);
});

// --------------------------------------------------------------------------
// 3. Website Requirement Gate (Gates 8 - 10)
// --------------------------------------------------------------------------
console.log('\n--- 3. Website Requirement Gate Invariants ---');

runGate(8, 'WITH_WEBSITE rejects unknown or unobserved website status', () => {
  const criteria = {
    websiteRequirement: 'WITH_WEBSITE'
  };

  const unknownWebLead = {
    name: 'Artisan Carpentry',
    adLibraryIds: ['300001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'unknown'
  };

  const missingWebLead = {
    name: 'Boutique Crafts',
    adLibraryIds: ['300002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'not_found'
  };

  const resUnknown = evaluateLeadQualificationGates(unknownWebLead, criteria);
  assert.strictEqual(resUnknown.isQualified, false, 'WITH_WEBSITE must reject unknown websiteState');
  assert.strictEqual(resUnknown.failedGates.includes('GATE_WEBSITE'), true);

  const resMissing = evaluateLeadQualificationGates(missingWebLead, criteria);
  assert.strictEqual(resMissing.isQualified, false, 'WITH_WEBSITE must reject not_found websiteState');
  assert.strictEqual(resMissing.failedGates.includes('GATE_WEBSITE'), true);

  const validWebLead = {
    name: 'Living Spaces Online',
    adLibraryIds: ['300003'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'found',
    destinationUrl: 'https://livingspaces.example.com',
    destinationDomain: 'livingspaces.example.com'
  };
  const resValid = evaluateLeadQualificationGates(validWebLead, criteria);
  assert.strictEqual(resValid.isQualified, true, 'WITH_WEBSITE must accept found website with destination URL');
  assert.strictEqual(resValid.passedGates.includes('GATE_WEBSITE'), true);
});

runGate(9, 'WITHOUT_WEBSITE requires appropriate explicit evidence', () => {
  const criteria = {
    websiteRequirement: 'WITHOUT_WEBSITE'
  };

  // Lead with explicit absence evidence: NO_VISIBLE_DESTINATION observed and websiteState: 'not_found'
  const explicitNoWebLead = {
    name: 'Neighborhood Custom Woodwork',
    adLibraryIds: ['300004'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryDestinationType: 'NO_VISIBLE_DESTINATION',
    observedDestinationTypes: ['NO_VISIBLE_DESTINATION'],
    websiteState: 'not_found'
  };

  const res = evaluateLeadQualificationGates(explicitNoWebLead, criteria);
  assert.strictEqual(res.isQualified, true, 'WITHOUT_WEBSITE must pass when explicit NO_VISIBLE_DESTINATION evidence exists');
  assert.strictEqual(res.passedGates.includes('GATE_WEBSITE'), true);
});

runGate(10, 'Missing ad URL does not imply no website', () => {
  const criteria = {
    websiteRequirement: 'WITHOUT_WEBSITE'
  };

  // Candidate simply lacked a scraped URL, but did not have proven absence (websiteState: 'unknown')
  const unprovenAbsenceLead = {
    name: 'Dhaka Modern Furniture',
    adLibraryIds: ['300005'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'unknown'
  };

  const res = evaluateLeadQualificationGates(unprovenAbsenceLead, criteria);
  assert.strictEqual(res.isQualified, false, 'Missing URL alone does not satisfy WITHOUT_WEBSITE; explicit absence proof required');
  assert.strictEqual(res.failedGates.includes('GATE_WEBSITE'), true);
  assert.strictEqual(res.canonicalOutcome, 'REVIEW');
  assert.strictEqual(res.reasons.some(r => r.includes('missing ad destination URL alone does not prove no website')), true);
});

// --------------------------------------------------------------------------
// 4. CTA and Destination Integration (Gates 11 - 13)
// --------------------------------------------------------------------------
console.log('\n--- 4. CTA and Destination Integration Invariants ---');

runGate(11, 'CTA filters operate independently of destination filters', () => {
  const lead = {
    name: 'Form Lead Business',
    adLibraryIds: ['400001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SIGN_UP',
    observedCtaTypes: ['SIGN_UP'],
    primaryDestinationType: 'INSTANT_FORM',
    observedDestinationTypes: ['INSTANT_FORM']
  };

  // Matching CTA but mismatching Destination
  const criteria = {
    requiredCtaTypes: ['SIGN_UP'],
    requiredDestinationTypes: ['EXTERNAL_WEBSITE']
  };

  const res = evaluateLeadQualificationGates(lead, criteria);
  assert.strictEqual(res.passedGates.includes('GATE_CTA'), true, 'GATE_CTA must pass on matching CTA');
  assert.strictEqual(res.failedGates.includes('GATE_DESTINATION'), true, 'GATE_DESTINATION must fail on mismatching destination');
  assert.strictEqual(res.isQualified, false);
});

runGate(12, 'Destination filters operate independently of CTA labels', () => {
  const lead = {
    name: 'Web Store Business',
    adLibraryIds: ['400002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SEND_MESSAGE',
    observedCtaTypes: ['SEND_MESSAGE'],
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    observedDestinationTypes: ['EXTERNAL_WEBSITE'],
    destinationUrl: 'https://webstore.example.com',
    websiteState: 'found'
  };

  // Matching Destination but mismatching CTA
  const criteria = {
    requiredCtaTypes: ['CALL_NOW'],
    requiredDestinationTypes: ['EXTERNAL_WEBSITE']
  };

  const res = evaluateLeadQualificationGates(lead, criteria);
  assert.strictEqual(res.passedGates.includes('GATE_DESTINATION'), true, 'GATE_DESTINATION must pass on matching destination');
  assert.strictEqual(res.failedGates.includes('GATE_CTA'), true, 'GATE_CTA must fail on mismatching CTA');
  assert.strictEqual(res.isQualified, false);
});

runGate(13, 'Unknown CTA/destination evidence fails closed when required', () => {
  const blankEvidenceLead = {
    name: 'Unspecified Ad Lead',
    adLibraryIds: ['400003'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    observedCtaTypes: [],
    observedDestinationTypes: []
  };

  const ctaRes = evaluateLeadQualificationGates(blankEvidenceLead, { requiredCtaTypes: ['LEARN_MORE'] });
  assert.strictEqual(ctaRes.failedGates.includes('GATE_CTA'), true, 'Missing CTA evidence must fail closed when CTA is required');

  const destRes = evaluateLeadQualificationGates(blankEvidenceLead, { requiredDestinationTypes: ['EXTERNAL_WEBSITE'] });
  assert.strictEqual(destRes.failedGates.includes('GATE_DESTINATION'), true, 'Missing destination evidence must fail closed when destination is required');
});

// --------------------------------------------------------------------------
// 5. Qualification Status, Score, Confidence, and Reasons (Gates 14 - 17)
// --------------------------------------------------------------------------
console.log('\n--- 5. Qualification Decision Model Invariants ---');

runGate(14, 'Failed mandatory gates cannot be overridden by score', () => {
  const highScoringForeignLead = {
    name: 'High Score Global Enterprise',
    adLibraryIds: ['500001'],
    relevanceScore: 1.0,
    leadScore: 100,
    relevanceConfidence: 'HIGH',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'FOREIGN_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'US'
  };

  const res = evaluateLeadQualificationGates(highScoringForeignLead, { strictLocalMode: true });
  assert.strictEqual(res.isQualified, false, 'Score 1.0 must never override failed geographic gate');
  assert.strictEqual(res.canonicalOutcome, 'REJECTED');
  assert.strictEqual(res.failedGates.includes('GATE_GEOGRAPHY'), true);
});

runGate(15, 'Confidence and score remain separate from qualification status', () => {
  const highConfidenceUncertainLead = {
    name: 'High Confidence Ambiguous Lead',
    adLibraryIds: ['500002'],
    relevanceScore: 0.95,
    relevanceConfidence: 'HIGH',
    relevanceDecision: 'UNCERTAIN',
    geographicClassification: 'LOCAL_VERIFIED'
  };

  const res = evaluateLeadQualificationGates(highConfidenceUncertainLead);
  assert.strictEqual(res.isQualified, false, 'UNCERTAIN relevance must fail gate despite high confidence and high score');
  assert.strictEqual(res.canonicalOutcome, 'REVIEW');
  assert.strictEqual(res.status, 'REVIEW_REQUIRED');
  assert.strictEqual(res.failedGates.includes('GATE_RELEVANCE'), true);
});

runGate(16, 'Every outcome provides an appropriate reason code', () => {
  const failedLead = {
    name: '', // Integrity failure
    adLibraryIds: [], // Ads integrity failure
    relevanceDecision: 'NOT_RELEVANT', // Relevance rejection
    geographicClassification: 'LOCATION_UNKNOWN' // Geography unknown
  };

  const res = evaluateLeadQualificationGates(failedLead);
  assert.strictEqual(res.isQualified, false);
  assert.strictEqual(res.failedGates.includes('GATE_INTEGRITY_NAME'), true);
  assert.strictEqual(res.failedGates.includes('GATE_RELEVANCE'), true);
  assert.strictEqual(res.failedGates.includes('GATE_GEOGRAPHY'), true);
  assert.ok(res.reasons.length >= 3, 'Must provide detailed human-readable audit reasons for each failed gate');
  assert.strictEqual(res.canonicalOutcome, 'REJECTED');
});

runGate(17, 'Ambiguous evidence leads to review where appropriate', () => {
  const ambiguousLead = {
    name: 'Ambiguous Artisan',
    adLibraryIds: ['500003'],
    relevanceDecision: 'UNCERTAIN',
    geographicClassification: 'LOCAL_PROBABLE'
  };

  const res = evaluateLeadQualificationGates(ambiguousLead, { strictLocalMode: true });
  assert.strictEqual(res.isQualified, false);
  assert.strictEqual(res.canonicalOutcome, 'REVIEW', 'Inconclusive / ambiguous evidence must resolve to REVIEW');
  assert.strictEqual(res.status, 'REVIEW_REQUIRED');
});

// --------------------------------------------------------------------------
// 6. UI, Persistence, and Export Integration (Gates 18 - 20)
// --------------------------------------------------------------------------
console.log('\n--- 6. UI, Persistence, and Export Integration Invariants ---');

runGate(18, 'Filter changes recompute or invalidate stale qualification decisions correctly', () => {
  const lead = {
    name: 'Chittagong Soft Furnishings',
    adLibraryIds: ['600001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_PROBABLE'
  };

  // Under relaxed geography:
  const relaxedRes = evaluateLeadQualificationGates(lead, { strictLocalMode: false });
  assert.strictEqual(relaxedRes.isQualified, true, 'Probable location passes under relaxed geography');

  // Under strict geography:
  const strictRes = evaluateLeadQualificationGates(lead, { strictLocalMode: true, allowProbableLocal: false });
  assert.strictEqual(strictRes.isQualified, false, 'Probable location fails under strict-local geography');
  assert.strictEqual(strictRes.canonicalOutcome, 'REVIEW');
});

runGate(19, 'Persistence and recovery preserve qualification evidence', () => {
  const rawLead = {
    id: 'lead_persisted_01',
    name: 'Dhaka Modern Furniture',
    canonicalName: 'Dhaka Modern Furniture',
    adLibraryIds: ['700001', '700002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SHOP_NOW',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    destinationUrl: 'https://dhakamodern.example.com',
    destinationDomain: 'dhakamodern.example.com',
    websiteState: 'found',
    adEvidence: [
      {
        libraryId: '700001',
        ctaText: 'Shop Now',
        ctaType: 'SHOP_NOW',
        destinationType: 'EXTERNAL_WEBSITE',
        destinationUrl: 'https://dhakamodern.example.com',
        destinationDomain: 'dhakamodern.example.com',
        confidence: 'HIGH'
      }
    ]
  };

  const normalized = normalizeStoredLead(rawLead);
  assert.strictEqual(normalized.name, 'Dhaka Modern Furniture');
  assert.strictEqual(normalized.primaryCtaType, 'SHOP_NOW');
  assert.strictEqual(normalized.primaryDestinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(normalized.websiteState, 'found');
  assert.strictEqual(normalized.status, 'QUALIFIED');
  assert.strictEqual(normalized.adLibraryIds.length, 2);

  // Negative test: unassessed lead restored from storage must NOT be promoted to QUALIFIED
  const unassessedRaw = {
    id: 'lead_persisted_unassessed',
    name: 'Unassessed Restored Business',
    adLibraryIds: ['700003'],
    geographicClassification: 'LOCATION_UNKNOWN'
  };
  const normalizedUnassessed = normalizeStoredLead(unassessedRaw);
  assert.strictEqual(normalizedUnassessed.status, 'REVIEW_REQUIRED', 'Restored unassessed lead must remain REVIEW_REQUIRED');
  assert.strictEqual(normalizedUnassessed.qualificationFailedGates?.includes('GATE_RELEVANCE'), true);
});

runGate(20, 'Exports agree with current decision and reasons', () => {
  const qualifiedLead = {
    id: 'lead_exp_1',
    name: 'Qualified Artisan Furniture',
    canonicalName: 'Qualified Artisan Furniture',
    facebookPageName: 'Qualified Artisan Furniture',
    facebookPageState: 'found',
    adLibraryIds: ['800001'],
    relevanceDecision: 'RELEVANT',
    relevanceScore: 0.92,
    relevanceConfidence: 'HIGH',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SHOP_NOW',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    destinationUrl: 'https://artisan.example.com',
    destinationDomain: 'artisan.example.com',
    websiteState: 'found',
    status: 'QUALIFIED',
    activeAdCount: 1,
    locationCode: 'BD',
    locationName: 'Bangladesh'
  };

  const reviewLead = {
    id: 'lead_exp_2',
    name: 'Uncertain Global Furniture',
    canonicalName: 'Uncertain Global Furniture',
    facebookPageName: 'Uncertain Global Furniture',
    facebookPageState: 'found',
    adLibraryIds: ['800002'],
    relevanceDecision: 'UNCERTAIN',
    relevanceScore: 0.45,
    relevanceConfidence: 'LOW',
    geographicClassification: 'LOCATION_UNKNOWN',
    primaryCtaType: 'LEARN_MORE',
    primaryDestinationType: 'NO_VISIBLE_DESTINATION',
    websiteState: 'unknown',
    status: 'REVIEW_REQUIRED',
    activeAdCount: 1,
    locationCode: 'BD',
    locationName: 'Bangladesh'
  };

  // Qualified only export:
  const csvQualifiedOnly = exportLeadsToCsv([qualifiedLead, reviewLead], { qualifiedOnly: true });
  assert.strictEqual(csvQualifiedOnly.includes('Qualified Artisan Furniture'), true);
  assert.strictEqual(csvQualifiedOnly.includes('Uncertain Global Furniture'), false, 'Non-qualified leads must be excluded from qualifiedOnly export');

  // Full export:
  const csvFull = exportLeadsToCsv([qualifiedLead, reviewLead], { qualifiedOnly: false });
  assert.strictEqual(csvFull.includes('Qualified Artisan Furniture'), true);
  assert.strictEqual(csvFull.includes('Uncertain Global Furniture'), true);
  assert.strictEqual(csvFull.includes('QUALIFIED'), true);
  assert.strictEqual(csvFull.includes('REVIEW_REQUIRED'), true);
});

// --------------------------------------------------------------------------
// 7. Safety, Non-Regression, and Architecture Constraints (Gates 21 - 24)
// --------------------------------------------------------------------------
console.log('\n--- 7. Safety & Non-Regression Invariants ---');

runGate(21, 'Existing Phase 2 CTA/destination tests continue to pass', () => {
  const ctaRes = classifyCta('Shop Now');
  assert.strictEqual(ctaRes.ctaType, 'SHOP_NOW');
  assert.strictEqual(ctaRes.status, 'CLASSIFIED');

  const destRes = classifyDestination({
    destinationUrl: 'https://example.com/shop',
    destinationDomain: 'example.com',
    ctaText: 'Shop Now',
    ctaType: 'SHOP_NOW'
  });
  assert.strictEqual(destRes.destinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(destRes.confidence, 'HIGH');

  const summary = aggregateAdEvidence([
    {
      libraryId: '900001',
      ctaType: 'SHOP_NOW',
      destinationType: 'EXTERNAL_WEBSITE'
    }
  ]);
  assert.strictEqual(summary.primaryCtaType, 'SHOP_NOW');
  assert.strictEqual(summary.primaryDestinationType, 'EXTERNAL_WEBSITE');
});

runGate(22, 'Existing geographic qualification tests continue to pass', () => {
  const geoEval = evaluateGeographicOrigin(
    {
      pageName: 'Dhaka Furnishings',
      bodyCopy: 'Showroom: House 12, Road 5, Dhanmondi, Dhaka 1205. Call: +880 1711-000000. Leading brand in Dhaka, Bangladesh.',
      destinationUrl: 'https://dhakafurnishings.com.bd',
      destinationDomain: 'dhakafurnishings.com.bd'
    },
    'BD'
  );
  assert.strictEqual(geoEval.classification, 'LOCAL_VERIFIED');
  assert.strictEqual(geoEval.isLocal, true);
  assert.strictEqual(geoEval.confidence, 'HIGH');
});

runGate(23, 'Both safety gates remain permanently fail-closed', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must be false');
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must be false');
});

runGate(24, 'No prohibited external requests, APIs, or permissions are introduced', () => {
  const manifestPath = path.join(rootDir, 'src', 'extension', 'manifest.json');
  assert.strictEqual(fs.existsSync(manifestPath), true, 'manifest.json must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Ensure no wildcards, no Google APIs, and strict permissions
  const hostPermissions = manifest.host_permissions || [];
  for (const perm of hostPermissions) {
    assert.strictEqual(
      perm.includes('facebook.com') || perm.includes('meta.com'),
      true,
      `Host permission ${perm} must strictly belong to Meta Ad Library`
    );
  }

  const permissions = manifest.permissions || [];
  assert.strictEqual(permissions.includes('storage'), true);
  assert.strictEqual(permissions.includes('webRequest'), false, 'Prohibited network interception APIs must not be requested');
});

console.log('========================================================================');
console.log(`PHASE 3 VERIFICATION SUMMARY: ${passedTests}/${totalTests} GATES PASSED`);
console.log('========================================================================\n');
