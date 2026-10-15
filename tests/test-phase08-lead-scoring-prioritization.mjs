/**
 * LeadNoria — Phase 8: Lead Scoring & Prioritization Regression Test Suite
 *
 * Validates:
 * 1. Deterministic scoring and idempotent evaluation across all 6 dimensions.
 * 2. Proper component breakdown, score bounds (0 to 100), and weight allocations.
 * 3. Fail-closed handling: missing/unknown evidence receives 0 points, never positive credit.
 * 4. Strict separation: high scores never override failed qualification gates.
 * 5. Geographic invariants: FOREIGN_VERIFIED, LOCATION_UNKNOWN, and LOCAL_PROBABLE cannot bypass gates.
 * 6. Target country vs actual business location separation.
 * 7. Niche relevance isolation: affects only its dedicated component.
 * 8. CTA and destination requirements evaluated independently and accurately.
 * 9. Anti-inflation invariants: duplicate ads and repeat observations do not inflate score.
 * 10. Contact conflict visibility: conflicts penalize score and are never silently resolved.
 * 11. Contact syntax confidence semantics: valid syntax is an unprobed data-quality signal, never verified reachability.
 * 12. Entity resolution and candidate merging: preserves score breakdown and recalculates idempotently.
 * 13. Persistent storage round-trip: normalizeStoredLead preserves score metadata.
 * 14. CSV export integrity: emits 4 Phase 8 scoring headers with formula injection protection.
 * 15. Legacy record compatibility: leads without prior score metadata normalize safely.
 * 16. Permanent fail-closed collection & crawling safety gates.
 * 17. Historical release archive hash invariance.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  calculateLeadScore,
  SCORING_MODEL_VERSION
} from '../src/extension/leadPrioritizer.ts';
import { evaluateLeadQualificationGates } from '../src/extension/qualificationGate.ts';
import {
  aggregateCandidatesToLeads,
  exportLeadsToCsv
} from '../src/extension/metaAdapter.ts';
import {
  EntityResolutionIndex,
  mergeCandidateIntoEntity
} from '../src/extension/entityResolver.ts';
import { normalizeStoredLead } from '../src/extension/bulkStore.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('LEADNORIA: PHASE 8 LEAD SCORING & PRIORITIZATION REGRESSION TEST SUITE');
console.log('Scope: Explainable Scoring | Component Bounds | Invariant Enforcement');
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

// ============================================================================
// SECTION 1: DETERMINISM & REPRODUCIBILITY
// ============================================================================
console.log('--- SECTION 1: DETERMINISTIC SCORING & COMPONENT BREAKDOWN ---');

const sampleLead = {
  id: 'lead_test_01',
  name: 'Apex Orthodontics London',
  canonicalName: 'Apex Orthodontics London',
  targetCountryCode: 'GB',
  businessCountryCode: 'GB',
  geographicClassification: 'LOCAL_VERIFIED',
  businessLocationEvidence: ['14 Harley Street, London, W1G 9PQ, United Kingdom'],
  relevanceDecision: 'RELEVANT',
  relevanceConfidence: 'HIGH',
  relevanceMatchedTerms: ['orthodontist', 'braces', 'invisalign'],
  adLibraryIds: ['100000000000001', '100000000000002'],
  activeAdCount: 2,
  sampleCopy: 'Transform your smile with invisible braces in central London. Book consultation today.',
  sampleCta: 'Book Now',
  primaryCtaType: 'BOOK_TRAVEL',
  primaryDestinationType: 'EXTERNAL_WEBSITE',
  destinationDomain: 'apexortho.co.uk',
  canonicalPageId: 'page_apex_london',
  contactProfile: {
    primaryPhone: '+442079460991',
    primaryEmail: 'info@apexortho.co.uk',
    overallQualityState: 'OBSERVED_VALID_SYNTAX',
    phoneConflict: false,
    emailConflict: false,
    phoneConflictState: 'NO_CONFLICT',
    emailConflictState: 'NO_CONFLICT',
    observedPhones: [{
      type: 'PHONE',
      rawValue: '+44 20 7946 0991',
      normalizedValue: '+442079460991',
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      surface: 'AD_BODY_TEXT',
      observedAt: '2026-10-15T12:00:00Z'
    }],
    observedEmails: [{
      type: 'EMAIL',
      rawValue: 'info@apexortho.co.uk',
      normalizedValue: 'info@apexortho.co.uk',
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      surface: 'AD_BODY_TEXT',
      observedAt: '2026-10-15T12:00:00Z'
    }]
  }
};

runTest('Determinism: Identical inputs produce identical scores and breakdowns', () => {
  const res1 = calculateLeadScore(sampleLead);
  const res2 = calculateLeadScore(sampleLead);

  assert.strictEqual(res1.score, res2.score);
  assert.strictEqual(res1.tier, res2.tier);
  assert.strictEqual(res1.confidence, res2.confidence);
  assert.strictEqual(res1.breakdown.overallScore, res2.breakdown.overallScore);
  assert.strictEqual(res1.breakdown.modelVersion, SCORING_MODEL_VERSION);
  assert.strictEqual(res1.breakdown.components.geography.score, res2.breakdown.components.geography.score);
  assert.strictEqual(res1.breakdown.components.relevance.score, res2.breakdown.components.relevance.score);
  assert.strictEqual(res1.breakdown.components.adEvidence.score, res2.breakdown.components.adEvidence.score);
  assert.strictEqual(res1.breakdown.components.ctaDestination.score, res2.breakdown.components.ctaDestination.score);
  assert.strictEqual(res1.breakdown.components.contactQuality.score, res2.breakdown.components.contactQuality.score);
  assert.strictEqual(res1.breakdown.components.identityConsistency.score, res2.breakdown.components.identityConsistency.score);
});

runTest('Score bounds: Overall score is strictly bounded between 0 and 100', () => {
  const highRes = calculateLeadScore(sampleLead);
  assert.strictEqual(highRes.score <= 100 && highRes.score >= 0, true);
  assert.strictEqual(highRes.normalizedScore <= 1.0 && highRes.normalizedScore >= 0.0, true);

  const emptyRes = calculateLeadScore({});
  assert.strictEqual(emptyRes.score, 0);
  assert.strictEqual(emptyRes.tier, 'MINIMAL');
});

runTest('Component breakdown: All 6 dimensions report exact weights and sums', () => {
  const res = calculateLeadScore(sampleLead);
  const comps = res.breakdown.components;

  assert.strictEqual(comps.geography.maxScore, 25);
  assert.strictEqual(comps.relevance.maxScore, 25);
  assert.strictEqual(comps.adEvidence.maxScore, 15);
  assert.strictEqual(comps.ctaDestination.maxScore, 15);
  assert.strictEqual(comps.contactQuality.maxScore, 10);
  assert.strictEqual(comps.identityConsistency.maxScore, 10);

  const totalMax = comps.geography.maxScore +
    comps.relevance.maxScore +
    comps.adEvidence.maxScore +
    comps.ctaDestination.maxScore +
    comps.contactQuality.maxScore +
    comps.identityConsistency.maxScore;
  assert.strictEqual(totalMax, 100);
});

// ============================================================================
// SECTION 2: FAIL-CLOSED EVIDENCE & MISSING DATA
// ============================================================================
console.log('\n--- SECTION 2: FAIL-CLOSED MISSING EVIDENCE INVARIANTS ---');

runTest('Missing evidence does not receive positive credit', () => {
  const minimalLead = {
    name: 'Minimal Store',
    relevanceDecision: 'UNASSESSED',
    geographicClassification: 'LOCATION_UNKNOWN'
  };

  const res = calculateLeadScore(minimalLead);
  assert.strictEqual(res.breakdown.components.geography.score, 0);
  assert.strictEqual(res.breakdown.components.geography.status, 'MISSING');
  assert.strictEqual(res.breakdown.components.relevance.score, 0);
  assert.strictEqual(res.breakdown.components.relevance.status, 'MISSING');
  assert.strictEqual(res.breakdown.components.adEvidence.score, 0);
  assert.strictEqual(res.breakdown.components.contactQuality.score, 0);
  assert.strictEqual(res.breakdown.missingComponents.length >= 3, true);
});

runTest('Probable local and unknown location remain reviewable', () => {
  const probableLead = {
    ...sampleLead,
    geographicClassification: 'LOCAL_PROBABLE'
  };
  const probRes = calculateLeadScore(probableLead);
  assert.strictEqual(probRes.breakdown.components.geography.score, 12);
  assert.strictEqual(probRes.breakdown.components.geography.status, 'WARNING');
  assert.strictEqual(probRes.breakdown.warnings.some(w => w.includes('GEOGRAPHIC_PROBABLE_REVIEW')), true);

  const unknownLead = {
    ...sampleLead,
    geographicClassification: 'LOCATION_UNKNOWN'
  };
  const unkRes = calculateLeadScore(unknownLead);
  assert.strictEqual(unkRes.breakdown.components.geography.score, 0);
  assert.strictEqual(unkRes.breakdown.components.geography.status, 'MISSING');
});

runTest('Ad-target country cannot substitute for actual business location', () => {
  // Target country is US, but business location is unknown
  const targetOnlyLead = {
    name: 'Target Only Brand',
    targetCountryCode: 'US',
    locationCode: 'US',
    businessCountryCode: undefined,
    geographicClassification: 'LOCATION_UNKNOWN',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'HIGH'
  };

  const res = calculateLeadScore(targetOnlyLead);
  // Geography must be 0 because actual business location evidence is absent
  assert.strictEqual(res.breakdown.components.geography.score, 0);
  assert.strictEqual(res.breakdown.components.geography.status, 'MISSING');
});

runTest('Foreign business receives 0 geographic points and is penalized', () => {
  const foreignLead = {
    ...sampleLead,
    targetCountryCode: 'US',
    businessCountryCode: 'CN',
    geographicClassification: 'FOREIGN_VERIFIED'
  };

  const res = calculateLeadScore(foreignLead);
  assert.strictEqual(res.breakdown.components.geography.score, 0);
  assert.strictEqual(res.breakdown.components.geography.status, 'PENALIZED');
  assert.strictEqual(res.breakdown.penalties.some(p => p.includes('FOREIGN_VERIFIED_OUT_OF_MARKET')), true);
});

// ============================================================================
// SECTION 3: QUALIFICATION / SCORING SEPARATION
// ============================================================================
console.log('\n--- SECTION 3: QUALIFICATION VS SCORING SEPARATION ---');

runTest('High score cannot override failed geographic qualification gate', () => {
  // A lead with high relevance, great ads, valid contact, but FOREIGN_VERIFIED
  const foreignLead = {
    ...sampleLead,
    geographicClassification: 'FOREIGN_VERIFIED',
    businessCountryCode: 'DE'
  };

  const scoreRes = calculateLeadScore(foreignLead);
  const qualRes = evaluateLeadQualificationGates(foreignLead, { strictLocalMode: true });

  // Score may have points from relevance and ads, but qualification MUST reject
  assert.strictEqual(qualRes.isQualified, false);
  assert.strictEqual(qualRes.canonicalOutcome, 'REJECTED');
  assert.strictEqual(qualRes.failedGates.includes('GATE_GEOGRAPHY'), true);
  // Scoring disclaimer must explicitly assert this invariant
  assert.strictEqual(scoreRes.breakdown.qualificationDisclaimer.includes('does not constitute lead qualification'), true);
});

runTest('High score cannot override missing niche relevance gate', () => {
  const nonRelevantLead = {
    ...sampleLead,
    relevanceDecision: 'NOT_RELEVANT',
    relevanceConfidence: 'HIGH'
  };

  const qualRes = evaluateLeadQualificationGates(nonRelevantLead);
  assert.strictEqual(qualRes.isQualified, false);
  assert.strictEqual(qualRes.canonicalOutcome, 'REJECTED');
  assert.strictEqual(qualRes.failedGates.includes('GATE_RELEVANCE'), true);

  const scoreRes = calculateLeadScore(nonRelevantLead);
  assert.strictEqual(scoreRes.breakdown.components.relevance.score, 0);
  assert.strictEqual(scoreRes.breakdown.components.relevance.status, 'PENALIZED');
});

runTest('Niche relevance affects only its intended component', () => {
  const relevantLead = { ...sampleLead, relevanceDecision: 'RELEVANT', relevanceConfidence: 'HIGH' };
  const uncertainLead = { ...sampleLead, relevanceDecision: 'UNCERTAIN', relevanceConfidence: 'LOW' };

  const resRel = calculateLeadScore(relevantLead);
  const resUnc = calculateLeadScore(uncertainLead);

  // Geography, ads, contact, and identity scores must remain 100% IDENTICAL
  assert.strictEqual(resRel.breakdown.components.geography.score, resUnc.breakdown.components.geography.score);
  assert.strictEqual(resRel.breakdown.components.adEvidence.score, resUnc.breakdown.components.adEvidence.score);
  assert.strictEqual(resRel.breakdown.components.contactQuality.score, resUnc.breakdown.components.contactQuality.score);
  assert.strictEqual(resRel.breakdown.components.identityConsistency.score, resUnc.breakdown.components.identityConsistency.score);

  // Only relevance differs
  assert.strictEqual(resRel.breakdown.components.relevance.score, 25);
  assert.strictEqual(resUnc.breakdown.components.relevance.score, 8);
});

// ============================================================================
// SECTION 4: ANTI-INFLATION & CONTACT DATA QUALITY
// ============================================================================
console.log('\n--- SECTION 4: ANTI-INFLATION & CONTACT QUALITY INVARIANTS ---');

runTest('Duplicate ad observations do not inflate ad evidence score', () => {
  const oneAd = {
    ...sampleLead,
    adLibraryIds: ['999990000000001']
  };
  const duplicatedAd = {
    ...sampleLead,
    adLibraryIds: ['999990000000001', '999990000000001', '999990000000001']
  };

  const resOne = calculateLeadScore(oneAd);
  const resDup = calculateLeadScore(duplicatedAd);

  assert.strictEqual(resOne.breakdown.components.adEvidence.score, resDup.breakdown.components.adEvidence.score);
});

runTest('Multi-ad cap prevents unlimited score inflation', () => {
  const threeAds = {
    ...sampleLead,
    adLibraryIds: ['100000000000001', '100000000000002', '100000000000003']
  };
  const twentyAds = {
    ...sampleLead,
    adLibraryIds: Array.from({ length: 20 }, (_, i) => `1000000000000${10 + i}`)
  };

  const res3 = calculateLeadScore(threeAds);
  const res20 = calculateLeadScore(twentyAds);

  // Both should be capped at the same maximum ad points (15 max)
  assert.strictEqual(res3.breakdown.components.adEvidence.score, 15);
  assert.strictEqual(res20.breakdown.components.adEvidence.score, 15);
});

runTest('Contact conflicts penalize score and remain visible', () => {
  const cleanLead = {
    ...sampleLead,
    contactProfile: {
      primaryPhone: '+442079460991',
      primaryEmail: 'info@test.co.uk',
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      observedPhones: [{ syntaxState: 'SYNTAX_VALID' }],
      observedEmails: [{ syntaxState: 'SYNTAX_VALID' }]
    }
  };

  const conflictingLead = {
    ...sampleLead,
    contactProfile: {
      primaryPhone: '+442079460991',
      primaryEmail: 'info@test.co.uk',
      phoneConflict: true,
      emailConflict: false,
      phoneConflictState: 'CONFLICT_DETECTED',
      observedPhones: [{ syntaxState: 'SYNTAX_VALID' }, { syntaxState: 'SYNTAX_VALID' }],
      observedEmails: [{ syntaxState: 'SYNTAX_VALID' }]
    }
  };

  const resClean = calculateLeadScore(cleanLead);
  const resConflict = calculateLeadScore(conflictingLead);

  assert.strictEqual(resClean.breakdown.components.contactQuality.score, 10);
  assert.strictEqual(resConflict.breakdown.components.contactQuality.score, 6); // 10 - 4 penalty = 6
  assert.strictEqual(resConflict.breakdown.warnings.some(w => w.includes('CONTACT_CONFLICT_DETECTED')), true);
});

runTest('Contact syntax validity is never interpreted as verified reachability', () => {
  const res = calculateLeadScore(sampleLead);
  const contactComp = res.breakdown.components.contactQuality;

  assert.strictEqual(contactComp.reason.includes('reachability is unverified'), true);
  assert.strictEqual(sampleLead.contactProfile.observedPhones[0].verificationStatus, 'UNPROBED_PUBLIC_CLAIM');
});

// ============================================================================
// SECTION 5: PIPELINE & EXPORT INTEGRATION
// ============================================================================
console.log('\n--- SECTION 5: PIPELINE, ENTITY MERGING & STORAGE ---');

runTest('aggregateCandidatesToLeads calculates and attaches Phase 8 prioritization score', () => {
  const cand = {
    libraryId: '777000000000001',
    pageName: 'Smile Clinic London',
    pageId: 'page_777',
    adText: 'Quality dental implants in London. Book today.',
    ctaText: 'Book Now',
    destinationUrl: 'https://smilelondon.co.uk',
    contactObservations: [{
      type: 'PHONE',
      rawValue: '+44 20 7946 0999',
      normalizedValue: '+442079460999',
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      surface: 'AD_BODY_TEXT',
      observedAt: '2026-10-15T10:00:00Z'
    }]
  };

  const { leads } = aggregateCandidatesToLeads([cand]);
  assert.strictEqual(leads.length, 1);
  const lead = leads[0];

  assert.strictEqual(typeof lead.leadScore, 'number');
  assert.strictEqual(lead.leadScore > 0, true);
  assert.strictEqual(typeof lead.normalizedScore, 'number');
  assert.strictEqual(typeof lead.prioritizationTier, 'string');
  assert.strictEqual(typeof lead.scoreModelVersion, 'string');
  assert.strictEqual(typeof lead.scoreExplanation, 'string');
  assert.strictEqual(Boolean(lead.scoreBreakdown), true);
});

runTest('mergeCandidateIntoEntity recalculates lead score upon entity merge', () => {
  const target = {
    id: 'lead_merge_test',
    name: 'Dental Care Ltd',
    canonicalName: 'Dental Care Ltd',
    canonicalKey: 'fb_1234567',
    canonicalPageId: '1234567',
    facebookPageUrl: 'https://www.facebook.com/dentalcare',
    facebookPageState: 'found',
    adLibraryIds: ['555000000000001'],
    activeAdLibraryIds: ['555000000000001'],
    adCount: 1,
    activeAdCount: 1,
    sampleCopy: 'Dental checkups in Manchester',
    sampleCta: 'Learn More',
    primaryCtaType: 'LEARN_MORE',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    targetCountryCode: 'GB',
    locationCode: 'GB',
    geographicClassification: 'LOCAL_PROBABLE',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'HIGH'
  };

  const initialScore = calculateLeadScore(target).score;

  const newCand = {
    libraryId: '555000000000002',
    pageName: 'Dental Care Ltd',
    facebookPageId: '1234567',
    bodyCopy: 'Emergency dentist open now in Manchester city centre',
    ctaText: 'Call Now',
    ctaType: 'CALL_NOW',
    destinationUrl: 'https://dentalcare.co.uk',
    contactObservations: [{
      type: 'PHONE',
      rawValue: '+44 161 996 0001',
      normalizedValue: '+441619960001',
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      surface: 'AD_BODY_TEXT',
      observedAt: '2026-10-15T10:00:00Z'
    }]
  };

  mergeCandidateIntoEntity(
    target,
    newCand,
    { shouldMerge: true, targetKey: 'fb_1234567', confidence: 'HIGH', reason: 'Same Page ID', matchLevel: 'SHARED_PAGE_ID' },
    'GB',
    'dentist manchester'
  );

  // After merging ad with contact info and direct CTA, score must update deterministically
  assert.strictEqual(target.adLibraryIds.length, 2);
  assert.strictEqual(typeof target.leadScore, 'number');
  assert.strictEqual(target.leadScore > initialScore, true);
  assert.strictEqual(Boolean(target.scoreBreakdown), true);
});

runTest('normalizeStoredLead round-trips Phase 8 score fields without data loss', () => {
  const scoredLead = {
    ...sampleLead,
    leadScore: 99,
    normalizedScore: 0.99,
    prioritizationTier: 'HIGH',
    scoreConfidence: 'HIGH',
    scoreModelVersion: SCORING_MODEL_VERSION,
    scoreExplanation: 'Lead priority score: 99/100 (HIGH priority tier, HIGH score confidence).',
    scoreBreakdown: calculateLeadScore(sampleLead).breakdown
  };

  const restored = normalizeStoredLead(scoredLead);

  assert.strictEqual(restored.leadScore, 99);
  assert.strictEqual(restored.normalizedScore, 0.99);
  assert.strictEqual(restored.prioritizationTier, 'HIGH');
  assert.strictEqual(restored.scoreConfidence, 'HIGH');
  assert.strictEqual(restored.scoreModelVersion, SCORING_MODEL_VERSION);
  assert.strictEqual(typeof restored.scoreBreakdown, 'object');
  assert.strictEqual(restored.scoreBreakdown.overallScore, 99);
});

runTest('exportLeadsToCsv emits all 4 Phase 8 scoring headers alongside existing columns', () => {
  const scoredLead = {
    ...sampleLead,
    leadScore: 82,
    prioritizationTier: 'HIGH',
    scoreModelVersion: SCORING_MODEL_VERSION,
    scoreExplanation: 'High-quality local verified business with verified contact details.'
  };

  const csv = exportLeadsToCsv([scoredLead]);
  const lines = csv.split('\r\n');
  const headerLine = lines[0]; // Line 0 is header row when run metadata is omitted

  assert.strictEqual(headerLine.includes('Lead Priority Score'), true);
  assert.strictEqual(headerLine.includes('Prioritization Tier'), true);
  assert.strictEqual(headerLine.includes('Score Model Version'), true);
  assert.strictEqual(headerLine.includes('Score Explanation'), true);

  const dataRow = lines[1];
  assert.strictEqual(dataRow.includes('82'), true);
  assert.strictEqual(dataRow.includes('HIGH'), true);
  assert.strictEqual(dataRow.includes(SCORING_MODEL_VERSION), true);
});

runTest('exportLeadsToCsv neutralizes formula injection in score explanation', () => {
  const dangerLead = {
    ...sampleLead,
    leadScore: 90,
    prioritizationTier: 'HIGH',
    scoreModelVersion: SCORING_MODEL_VERSION,
    scoreExplanation: '=HYPERLINK("http://attacker.com", "Exploit")'
  };

  const csv = exportLeadsToCsv([dangerLead]);
  assert.strictEqual(csv.includes("'=HYPERLINK"), true);
});

runTest('Legacy records without score metadata normalize safely without errors', () => {
  const legacyLead = {
    id: 'legacy_001',
    name: 'Old Record Dental',
    adLibraryIds: ['10001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED'
  };

  const restored = normalizeStoredLead(legacyLead);
  assert.strictEqual(restored.name, 'Old Record Dental');
  assert.strictEqual(restored.leadScore, undefined);
  assert.strictEqual(restored.prioritizationTier, undefined);
});

// ============================================================================
// SECTION 6: FAIL-CLOSED SAFETY GATES & ARCHIVES
// ============================================================================
console.log('\n--- SECTION 6: FAIL-CLOSED SAFETY GATES & ARCHIVE INTEGRITY ---');

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
console.log(`Phase 8 Regression Test Summary: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
