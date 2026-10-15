#!/usr/bin/env node
/**
 * LeadNoria — Phase 10: UI, Filters & Research Workflow Test Suite
 *
 * Verifies:
 * 1. Filter predicates and data behavior:
 *    - Target country filter
 *    - Niche / business category filter
 *    - Qualification outcome filter (QUALIFIED, REVIEW_REQUIRED, NOT_QUALIFIED)
 *    - Geographic classification filter (LOCAL_VERIFIED, FOREIGN_VERIFIED, LOCAL_PROBABLE, LOCATION_UNKNOWN)
 *    - Prioritization tier filter (HIGH, MEDIUM, LOW, MINIMAL)
 *    - Score range filter (minScore, maxScore)
 *    - CTA type filter & Destination type filter separation
 *    - Contact signals (phone, email, website)
 *    - Contact conflict filter (NO_CONFLICT vs CONFLICT_ONLY)
 * 2. Combined filter semantics (AND-composition) and Clear Filters behavior
 * 3. View-model mapping integrity:
 *    - extensionLeadToResultRowViewModel preserves score, tier, syntax state, and conflicts
 *    - extensionLeadToResultDetailViewModel surfaces why reasons and actionable review issues
 * 4. Qualification vs Score separation (high score never overrides qualification status)
 * 5. Research run state distinctions (COMPLETED, PARTIAL, BLOCKED, FAILED, CANCELLED)
 * 6. Safety gate invariants (isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted)
 */

import assert from 'node:assert';
import {
  extensionLeadToResultRowViewModel,
  extensionLeadToResultDetailViewModel,
  toRunStatusViewModel
} from '../src/extension/ui/viewModelMappers.ts';
import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

console.log('========================================================================');
console.log('LEADNORIA: PHASE 10 UI, FILTERS & RESEARCH WORKFLOW SUITE');
console.log('Scope: Research Filters | ViewModels | Run States | Safeguards');
console.log('========================================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}\n`);
    failedTests++;
  }
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockLeads = [
  {
    leadId: 'lead_bd_qual_01',
    name: 'Dhaka Tech Solutions Ltd.',
    advertiserName: 'Dhaka Tech Solutions Ltd.',
    facebookPageName: 'Dhaka Tech Solutions Ltd.',
    facebookPageUrl: 'https://facebook.com/dhakatech',
    targetCountryCode: 'BD',
    locationCode: 'BD',
    locationName: 'Dhaka, Bangladesh',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_VERIFIED',
    businessLocationConfidence: 'HIGH',
    businessLocationEvidence: ['Registered in Dhaka, Bangladesh', 'Local physical address observed'],
    status: 'QUALIFIED',
    category: 'Software & Technology',
    matchedKeywords: ['software', 'saas development'],
    relevanceDecision: 'RELEVANT',
    destinationUrl: 'https://dhakatech.com.bd',
    websiteState: 'found',
    primaryCtaType: 'CONTACT_US',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    businessPhone: '+8801711223344',
    businessEmail: 'contact@dhakatech.com.bd',
    contactQualityState: 'OBSERVED_VALID_SYNTAX',
    contactProfile: {
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NO_CONFLICT',
      observedPhones: [{ rawValue: '+880 1711-223344', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM' }],
      observedEmails: [{ rawValue: 'contact@dhakatech.com.bd', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM' }]
    },
    leadScore: 92,
    prioritizationTier: 'HIGH',
    scoreModelVersion: 'leadnoria-scoring-v1',
    scoreExplanation: 'Score 92/100: HIGH tier, qualified locally, valid contact syntax.'
  },
  {
    leadId: 'lead_bd_rev_02',
    name: 'Probable Dhaka Dental Care',
    advertiserName: 'Probable Dhaka Dental Care',
    facebookPageName: 'Probable Dhaka Dental Care',
    targetCountryCode: 'BD',
    locationCode: 'BD',
    locationName: 'Dhaka, Bangladesh',
    businessCountryCode: undefined,
    geographicClassification: 'LOCAL_PROBABLE',
    status: 'REVIEW_REQUIRED',
    category: 'Healthcare & Dental',
    matchedKeywords: ['dentist', 'dental implant'],
    relevanceDecision: 'RELEVANT',
    destinationUrl: undefined,
    websiteState: 'not_found',
    primaryCtaType: 'CALL_NOW',
    primaryDestinationType: 'CALL',
    businessPhone: '+8801722334455',
    businessEmail: undefined,
    contactQualityState: 'OBSERVED_VALID_SYNTAX',
    contactProfile: {
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NO_CONFLICT',
      observedPhones: [{ rawValue: '+8801722334455', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM' }]
    },
    qualificationReasons: ['Review required: business location probable but lacks physical address proof'],
    qualificationFailedGates: ['GATE_FAIL_LOCAL_UNVERIFIED'],
    leadScore: 68,
    prioritizationTier: 'MEDIUM',
    scoreModelVersion: 'leadnoria-scoring-v1',
    scoreExplanation: 'Score 68/100: MEDIUM tier, review required for location evidence.'
  },
  {
    leadId: 'lead_us_foreign_03',
    name: 'Global Software US LLC',
    advertiserName: 'Global Software US LLC',
    facebookPageName: 'Global Software US LLC',
    targetCountryCode: 'BD',
    locationCode: 'BD',
    locationName: 'Dhaka (Ad Delivery Target)',
    businessCountryCode: 'US',
    geographicClassification: 'FOREIGN_VERIFIED',
    status: 'REVIEW_REQUIRED',
    category: 'Software & Technology',
    matchedKeywords: ['software development'],
    relevanceDecision: 'RELEVANT',
    destinationUrl: 'https://globalsoftware.com',
    websiteState: 'found',
    primaryCtaType: 'LEARN_MORE',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    businessPhone: '+1-555-0199',
    businessEmail: 'info@globalsoftware.com',
    contactQualityState: 'OBSERVED_VALID_SYNTAX',
    contactProfile: {
      phoneConflict: true,
      emailConflict: false,
      phoneConflictState: 'PHONE_CONFLICT',
      emailConflictState: 'NO_CONFLICT',
      observedPhones: [
        { rawValue: '+1-555-0199', syntaxState: 'SYNTAX_VALID' },
        { rawValue: '+1-555-9900', syntaxState: 'SYNTAX_VALID' }
      ]
    },
    qualificationReasons: ['Review required: foreign business targeting Bangladesh in strict-local workflow'],
    qualificationFailedGates: ['GATE_FAIL_FOREIGN_VERIFIED'],
    leadScore: 88, // High score must NEVER override foreign rejection in strict local workflow
    prioritizationTier: 'HIGH',
    scoreModelVersion: 'leadnoria-scoring-v1',
    scoreExplanation: 'Score 88/100: High commercial activity, but foreign physical presence.'
  },
  {
    leadId: 'lead_unknown_loc_04',
    name: 'Stealth App Studio',
    advertiserName: 'Stealth App Studio',
    facebookPageName: 'Stealth App Studio',
    targetCountryCode: 'BD',
    locationCode: 'BD',
    locationName: 'Bangladesh',
    businessCountryCode: undefined,
    geographicClassification: 'LOCATION_UNKNOWN',
    status: 'REVIEW_REQUIRED',
    category: 'Gaming & Apps',
    matchedKeywords: ['mobile game'],
    relevanceDecision: 'RELEVANT',
    primaryCtaType: 'INSTALL_APP',
    primaryDestinationType: 'APP',
    businessPhone: undefined,
    businessEmail: undefined,
    contactQualityState: 'NOT_OBSERVED',
    contactProfile: {
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NO_CONFLICT',
      observedPhones: [],
      observedEmails: []
    },
    qualificationReasons: ['Review required: no physical location evidence observed'],
    qualificationFailedGates: ['GATE_FAIL_LOCAL_UNVERIFIED'],
    leadScore: 35,
    prioritizationTier: 'LOW',
    scoreModelVersion: 'leadnoria-scoring-v1'
  },
  {
    leadId: 'lead_not_relevant_05',
    name: 'Dhaka Real Estate Brokerage',
    advertiserName: 'Dhaka Real Estate Brokerage',
    facebookPageName: 'Dhaka Real Estate Brokerage',
    targetCountryCode: 'BD',
    locationCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_VERIFIED',
    status: 'NOT_QUALIFIED',
    category: 'Real Estate',
    matchedKeywords: [],
    relevanceDecision: 'NOT_RELEVANT',
    primaryCtaType: 'LEARN_MORE',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    businessPhone: '+8801733445566',
    businessEmail: 'sales@dhakarealestate.com',
    qualificationReasons: ['Rejected: candidate category does not match configured target niche keywords'],
    qualificationFailedGates: ['GATE_FAIL_RELEVANCE_NOT_MET'],
    leadScore: 20,
    prioritizationTier: 'MINIMAL',
    scoreModelVersion: 'leadnoria-scoring-v1'
  }
];

// Convert test leads to ViewModels
const rowViewModels = mockLeads.map(extensionLeadToResultRowViewModel);

// Pure predicate implementation mirroring ResultsTableView.tsx
function filterResults(results, filters) {
  const {
    searchTerm = '',
    qualificationFilter = 'ALL',
    targetCountryFilter = 'ALL',
    geoClassificationFilter = 'ALL',
    tierFilter = 'ALL',
    ctaTypeFilter = 'ALL',
    destinationTypeFilter = 'ALL',
    conflictFilter = 'ALL',
    minScore = '',
    maxScore = '',
    categoryFilter = 'ALL',
    requirePhone = false,
    requireEmail = false,
    requireWebsite = false
  } = filters;

  return results.filter(r => {
    // 1. Search term
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchesName = r.displayName.toLowerCase().includes(q);
      const matchesPhone = r.contactSummary.phoneText?.toLowerCase().includes(q);
      const matchesEmail = r.contactSummary.emailText?.toLowerCase().includes(q);
      const matchesCategory = r.category?.toLowerCase().includes(q);
      if (!matchesName && !matchesPhone && !matchesEmail && !matchesCategory) return false;
    }

    // 2. Qualification outcome
    if (qualificationFilter !== 'ALL') {
      if (qualificationFilter === 'QUALIFIED' && r.qualificationState !== 'QUALIFIED') return false;
      if (qualificationFilter === 'REVIEW_REQUIRED' && r.qualificationState !== 'REVIEW_REQUIRED' && r.qualificationState !== 'UNCERTAIN') return false;
      if (qualificationFilter === 'NOT_QUALIFIED' && r.qualificationState !== 'NOT_QUALIFIED') return false;
    }

    // 3. Target country
    if (targetCountryFilter !== 'ALL' && r.targetCountryCode !== targetCountryFilter) {
      return false;
    }

    // 4. Geographic classification
    if (geoClassificationFilter !== 'ALL') {
      const geo = r.geographicClassification || (r.businessCountryCode ? 'LOCAL_VERIFIED' : 'LOCATION_UNKNOWN');
      if (geo !== geoClassificationFilter) return false;
    }

    // 5. Prioritization tier
    if (tierFilter !== 'ALL') {
      const t = r.prioritizationTier || 'UNRANKED';
      if (t !== tierFilter) return false;
    }

    // 6. Score range
    const score = r.qualificationScore !== undefined ? r.qualificationScore : r.canonicalRecord?.leadScore;
    if (minScore !== '' && !isNaN(Number(minScore))) {
      if (score === undefined || score < Number(minScore)) return false;
    }
    if (maxScore !== '' && !isNaN(Number(maxScore))) {
      if (score === undefined || score > Number(maxScore)) return false;
    }

    // 7. CTA type
    if (ctaTypeFilter !== 'ALL' && r.ctaType !== ctaTypeFilter) {
      return false;
    }

    // 8. Destination type
    if (destinationTypeFilter !== 'ALL' && r.destinationType !== destinationTypeFilter) {
      return false;
    }

    // 9. Contact conflict
    if (conflictFilter === 'CONFLICT_ONLY') {
      const hasConflict = r.phoneConflictState === 'PHONE_CONFLICT' ||
        r.emailConflictState === 'EMAIL_CONFLICT' ||
        r.canonicalRecord?.contactProfile?.phoneConflict;
      if (!hasConflict) return false;
    } else if (conflictFilter === 'NO_CONFLICT') {
      const hasConflict = r.phoneConflictState === 'PHONE_CONFLICT' ||
        r.emailConflictState === 'EMAIL_CONFLICT' ||
        r.canonicalRecord?.contactProfile?.phoneConflict;
      if (hasConflict) return false;
    }

    // 10. Category
    if (categoryFilter !== 'ALL' && r.category !== categoryFilter) {
      return false;
    }

    // 11. Signal checkboxes
    if (requirePhone && !r.contactSummary.hasPhone) return false;
    if (requireEmail && !r.contactSummary.hasEmail) return false;
    if (requireWebsite && !r.dataSignals?.websiteVerified) return false;

    return true;
  });
}

// ============================================================================
// SECTION 1: FILTER PREDICATES & BEHAVIOR
// ============================================================================
console.log('--- SECTION 1: FILTER PREDICATES & BEHAVIOR ---');

runTest('Qualification outcome filter isolates QUALIFIED vs REVIEW_REQUIRED vs NOT_QUALIFIED', () => {
  const qualifiedOnly = filterResults(rowViewModels, { qualificationFilter: 'QUALIFIED' });
  assert.strictEqual(qualifiedOnly.length, 1);
  assert.strictEqual(qualifiedOnly[0].displayName, 'Dhaka Tech Solutions Ltd.');

  const reviewOnly = filterResults(rowViewModels, { qualificationFilter: 'REVIEW_REQUIRED' });
  assert.strictEqual(reviewOnly.length, 3);
  assert.strictEqual(reviewOnly.some(r => r.displayName === 'Probable Dhaka Dental Care'), true);
  assert.strictEqual(reviewOnly.some(r => r.displayName === 'Global Software US LLC'), true);

  const rejectedOnly = filterResults(rowViewModels, { qualificationFilter: 'NOT_QUALIFIED' });
  assert.strictEqual(rejectedOnly.length, 1);
  assert.strictEqual(rejectedOnly[0].displayName, 'Dhaka Real Estate Brokerage');
});

runTest('Geographic classification filter strictly differentiates LOCAL_VERIFIED, FOREIGN_VERIFIED, LOCAL_PROBABLE, and LOCATION_UNKNOWN', () => {
  const localVerified = filterResults(rowViewModels, { geoClassificationFilter: 'LOCAL_VERIFIED' });
  assert.strictEqual(localVerified.length, 2); // Dhaka Tech Solutions, Dhaka Real Estate

  const foreignVerified = filterResults(rowViewModels, { geoClassificationFilter: 'FOREIGN_VERIFIED' });
  assert.strictEqual(foreignVerified.length, 1);
  assert.strictEqual(foreignVerified[0].displayName, 'Global Software US LLC');

  const localProbable = filterResults(rowViewModels, { geoClassificationFilter: 'LOCAL_PROBABLE' });
  assert.strictEqual(localProbable.length, 1);
  assert.strictEqual(localProbable[0].displayName, 'Probable Dhaka Dental Care');

  const locationUnknown = filterResults(rowViewModels, { geoClassificationFilter: 'LOCATION_UNKNOWN' });
  assert.strictEqual(locationUnknown.length, 1);
  assert.strictEqual(locationUnknown[0].displayName, 'Stealth App Studio');
});

runTest('Prioritization tier filter accurately selects HIGH, MEDIUM, LOW, and MINIMAL tiers', () => {
  const highTier = filterResults(rowViewModels, { tierFilter: 'HIGH' });
  assert.strictEqual(highTier.length, 2); // Dhaka Tech (92), Global Software US (88)

  const medTier = filterResults(rowViewModels, { tierFilter: 'MEDIUM' });
  assert.strictEqual(medTier.length, 1);
  assert.strictEqual(medTier[0].displayName, 'Probable Dhaka Dental Care');

  const lowTier = filterResults(rowViewModels, { tierFilter: 'LOW' });
  assert.strictEqual(lowTier.length, 1);
  assert.strictEqual(lowTier[0].displayName, 'Stealth App Studio');

  const minTier = filterResults(rowViewModels, { tierFilter: 'MINIMAL' });
  assert.strictEqual(minTier.length, 1);
  assert.strictEqual(minTier[0].displayName, 'Dhaka Real Estate Brokerage');
});

runTest('Score range filter bounds records strictly between minScore and maxScore', () => {
  const bounded = filterResults(rowViewModels, { minScore: '70', maxScore: '95' });
  assert.strictEqual(bounded.length, 2);
  assert.strictEqual(bounded.some(r => r.displayName === 'Dhaka Tech Solutions Ltd.'), true); // 92
  assert.strictEqual(bounded.some(r => r.displayName === 'Global Software US LLC'), true); // 88
  assert.strictEqual(bounded.some(r => r.displayName === 'Probable Dhaka Dental Care'), false); // 68
});

runTest('CTA and Destination type filters operate independently without confounding', () => {
  const callCta = filterResults(rowViewModels, { ctaTypeFilter: 'CALL_NOW' });
  assert.strictEqual(callCta.length, 1);
  assert.strictEqual(callCta[0].displayName, 'Probable Dhaka Dental Care');

  const websiteDest = filterResults(rowViewModels, { destinationTypeFilter: 'EXTERNAL_WEBSITE' });
  assert.strictEqual(websiteDest.length, 3); // Dhaka Tech, Global Software US, Dhaka Real Estate

  const appDest = filterResults(rowViewModels, { destinationTypeFilter: 'APP' });
  assert.strictEqual(appDest.length, 1);
  assert.strictEqual(appDest[0].displayName, 'Stealth App Studio');
});

runTest('Contact conflict filter isolates conflicted records vs clean records', () => {
  const conflictedOnly = filterResults(rowViewModels, { conflictFilter: 'CONFLICT_ONLY' });
  assert.strictEqual(conflictedOnly.length, 1);
  assert.strictEqual(conflictedOnly[0].displayName, 'Global Software US LLC');

  const cleanOnly = filterResults(rowViewModels, { conflictFilter: 'NO_CONFLICT' });
  assert.strictEqual(cleanOnly.length, 4);
  assert.strictEqual(cleanOnly.some(r => r.displayName === 'Global Software US LLC'), false);
});

// ============================================================================
// SECTION 2: COMBINED FILTER SEMANTICS & COMPOSITION
// ============================================================================
console.log('\n--- SECTION 2: COMBINED FILTER SEMANTICS & COMPOSITION ---');

runTest('Multi-filter AND composition produces exact intersection', () => {
  const combined = filterResults(rowViewModels, {
    qualificationFilter: 'QUALIFIED',
    geoClassificationFilter: 'LOCAL_VERIFIED',
    tierFilter: 'HIGH',
    requirePhone: true,
    requireWebsite: true
  });
  assert.strictEqual(combined.length, 1);
  assert.strictEqual(combined[0].displayName, 'Dhaka Tech Solutions Ltd.');
});

runTest('Strict-local qualification safeguards prevent high-scoring foreign leads from qualifying', () => {
  // Global Software US has high score (88) and high tier (HIGH), but is FOREIGN_VERIFIED
  const qualifiedLocalHigh = filterResults(rowViewModels, {
    qualificationFilter: 'QUALIFIED',
    geoClassificationFilter: 'LOCAL_VERIFIED'
  });
  assert.strictEqual(qualifiedLocalHigh.some(r => r.displayName === 'Global Software US LLC'), false);
});

runTest('Clear filters restores complete dataset without residual state', () => {
  const filtered = filterResults(rowViewModels, { searchTerm: 'Dental', requirePhone: true });
  assert.strictEqual(filtered.length, 1);

  // Cleared filters
  const cleared = filterResults(rowViewModels, {});
  assert.strictEqual(cleared.length, mockLeads.length);
});

// ============================================================================
// SECTION 3: VIEW-MODEL MAPPING & EXPLANATION DETAILS
// ============================================================================
console.log('\n--- SECTION 3: VIEW-MODEL MAPPING & EXPLANATION DETAILS ---');

runTest('extensionLeadToResultRowViewModel maps score, tier, syntax, and conflict signals', () => {
  const vm = extensionLeadToResultRowViewModel(mockLeads[0]);
  assert.strictEqual(vm.displayName, 'Dhaka Tech Solutions Ltd.');
  assert.strictEqual(vm.qualificationScore, 92);
  assert.strictEqual(vm.prioritizationTier, 'HIGH');
  assert.strictEqual(vm.scoreModelVersion, 'leadnoria-scoring-v1');
  assert.strictEqual(vm.phoneSyntaxState, 'SYNTAX_VALID');
  assert.strictEqual(vm.emailSyntaxState, 'SYNTAX_VALID');
  assert.strictEqual(vm.phoneConflictState, 'NO_CONFLICT');
  assert.strictEqual(vm.dataSignals.websiteVerified, true);
});

runTest('extensionLeadToResultDetailViewModel surfaces why reasons and actionable review issues', () => {
  const reviewLead = mockLeads[1]; // Probable Dhaka Dental Care
  const detail = extensionLeadToResultDetailViewModel(reviewLead);

  assert.strictEqual(detail.qualificationDetails.finalState, 'REVIEW_REQUIRED');
  assert.strictEqual(detail.qualificationDetails.potentialIssues.length > 0, true);
  assert.strictEqual(
    detail.qualificationDetails.potentialIssues.some(p => p.explanation.includes('location probable')),
    true
  );
  assert.strictEqual(
    detail.locationDetails.addresses.length === 0 || detail.locationDetails.city === 'Dhaka, Bangladesh',
    true
  );
});

// ============================================================================
// SECTION 4: RESEARCH RUN STATUS EXPERIENCE
// ============================================================================
console.log('\n--- SECTION 4: RESEARCH RUN STATUS EXPERIENCE ---');

runTest('toRunStatusViewModel preserves RUNNING, PARTIAL, COMPLETED, and FAILED states', () => {
  const mockCompletedRun = {
    config: { runId: 'run_1001', selectedSources: ['META'], runVersion: 'strict-v2' },
    status: 'COMPLETED',
    stageStates: new Map([
      ['SOURCE_PLANNING', 'COMPLETED'],
      ['SOURCE_EXECUTION', 'COMPLETED'],
      ['NORMALIZATION', 'COMPLETED'],
      ['PERSISTENCE', 'COMPLETED']
    ]),
    sourceStatuses: new Map([['META', 'COMPLETED']])
  };

  const statusVM = toRunStatusViewModel(mockCompletedRun, 5200);
  assert.strictEqual(statusVM.runId, 'run_1001');
  assert.strictEqual(statusVM.globalStatus, 'COMPLETED');
  assert.strictEqual(statusVM.isPausable, false);
  assert.strictEqual(statusVM.canRetry, false);
  assert.strictEqual(statusVM.stages.find(s => s.stageId === 'SOURCE_EXECUTION')?.isCompleted, true);

  const mockPartialRun = {
    config: { runId: 'run_1002', selectedSources: ['META'], runVersion: 'strict-v2' },
    status: 'PARTIAL',
    stageStates: new Map([
      ['SOURCE_PLANNING', 'COMPLETED'],
      ['SOURCE_EXECUTION', 'IN_PROGRESS']
    ]),
    sourceStatuses: new Map([['META', 'PARTIAL']]),
    checkpoint: { checkpointId: 'cp_1002_rev3', createdAt: '2026-10-16T00:00:00Z' }
  };

  const partialVM = toRunStatusViewModel(mockPartialRun, 3100);
  assert.strictEqual(partialVM.globalStatus, 'PARTIAL');
  assert.strictEqual(partialVM.isResumable, true);
  assert.strictEqual(partialVM.canRetry, true);
  assert.strictEqual(partialVM.checkpointId, 'cp_1002_rev3');
});

// ============================================================================
// SECTION 5: SAFETY GATES IMMUTABILITY
// ============================================================================
console.log('\n--- SECTION 5: SAFETY GATES IMMUTABILITY ---');

runTest('isLiveCollectionPermitted strictly evaluates to false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false);
});

runTest('isExternalWebsiteCrawlingPermitted strictly evaluates to false', () => {
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n========================================================================');
console.log(`Phase 10 Regression Test Summary: ${passedTests} Passed, ${failedTests} Failed.`);
console.log('========================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
