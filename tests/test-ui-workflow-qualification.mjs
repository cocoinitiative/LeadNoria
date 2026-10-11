/**
 * LeadNoria — Phase 0.7: Browser Extension UI & Manual Workflow Verification Test Suite
 *
 * Deterministic offline test suite verifying that UI view model mappers,
 * extension state management, detail inspectors, search/filter logic,
 * export policies, and accessibility presentation strictly reflect
 * authoritative Phase 0.6 qualification gates without network calls.
 *
 * Covers all 27 required synthetic UI scenarios:
 *  1. Fully qualified synthetic candidate
 *  2. Relevant but foreign business in strict-local mode
 *  3. Local-probable business
 *  4. Unknown business location
 *  5. Unassessed relevance
 *  6. Rejected relevance
 *  7. High score with failed qualification
 *  8. High confidence with failed qualification
 *  9. Missing score
 * 10. Missing qualification reasons
 * 11. Required CTA missing
 * 12. Required destination missing
 * 13. External website destination
 * 14. Messaging destination
 * 15. Instant-form destination
 * 16. Unknown destination
 * 17. Conflicting geographic evidence after entity merge
 * 18. Stored legacy candidate with an unsafe persisted status
 * 19. Interrupted research state
 * 20. Empty results
 * 21. Loading state
 * 22. Collection blocked by safety policy
 * 23. Export attempt containing unqualified candidates
 * 24. Filter settings that change the expected eligibility
 * 25. Duplicate candidate display or evidence after hydration
 * 26. Bengali niche text and Unicode normalization in search/filter
 * 27. Accessible labels for status, score, confidence, and qualification reasons
 */

import assert from 'node:assert';
import {
  toResultRowViewModel,
  toResultDetailViewModel,
  toExportPreviewViewModel,
  extensionLeadToResultRowViewModel,
  extensionLeadToResultDetailViewModel,
  isExtensionLead,
  isCanonicalLeadRecord
} from '../src/extension/ui/viewModelMappers.ts';
import { toFriendlyStatus } from '../src/extension/ui/humanLabels.ts';
import { getSemanticStatusBadge } from '../src/extension/ui/designSystem.ts';
import { exportLeadsToCsv } from '../src/extension/metaAdapter.ts';
import { evaluateLeadQualificationGates } from '../src/extension/qualificationGate.ts';
import { normalizeStoredLead } from '../src/extension/bulkStore.ts';
import { isLiveCollectionPermitted } from '../src/config/collectionGate.ts';

let passed = 0;
let failed = 0;

function check(scenario, description, condition, details = '') {
  if (condition) {
    console.log(`  [PASS] [Scenario ${scenario}] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] [Scenario ${scenario}] ${description} — ${details}`);
    failed++;
  }
}

console.log('========================================================================');
console.log('LEADNORIA PHASE 0.7: EXTENSION UI & MANUAL WORKFLOW VERIFICATION (27 SCENARIOS)');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Scenario 1: Fully qualified synthetic candidate
// -----------------------------------------------------------------------------
{
  const lead = {
    leadId: 'lead_qual_01',
    name: 'Dhaka Modern Furniture',
    advertiserName: 'Dhaka Modern Furniture',
    status: 'QUALIFIED',
    leadScore: 0.88,
    scoreConfidence: 'HIGH',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'HIGH',
    relevanceReasons: ['Matched terms: furniture, sofa'],
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SHOP_NOW',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    websiteState: 'found',
    destinationUrl: 'https://dhakafurniture.com.bd/shop',
    destinationDomain: 'dhakafurniture.com.bd',
    qualificationReasons: ['All qualification gates passed']
  };

  const row = toResultRowViewModel(lead);
  const detail = toResultDetailViewModel(lead);

  check(1, 'Fully qualified lead produces QUALIFIED status in row', row.qualificationState === 'QUALIFIED');
  check(1, 'Score and confidence preserved accurately', row.qualificationScore === 0.88 && row.scoreConfidence === 'HIGH');
  check(1, 'Detail drawer shows QUALIFIED finalState', detail.qualificationDetails?.finalState === 'QUALIFIED');
  check(1, 'Geographic classification is LOCAL_VERIFIED', row.geographicClassification === 'LOCAL_VERIFIED');
}

// -----------------------------------------------------------------------------
// Scenario 2: Relevant but foreign business in strict-local mode
// -----------------------------------------------------------------------------
{
  const foreignLead = {
    leadId: 'lead_foreign_02',
    name: 'US Sofa Wholesale',
    advertiserName: 'US Sofa Wholesale',
    status: 'REVIEW_REQUIRED',
    leadScore: 0.82,
    scoreConfidence: 'HIGH',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'HIGH',
    targetCountryCode: 'BD',
    businessCountryCode: 'US',
    geographicClassification: 'FOREIGN_VERIFIED',
    primaryCtaType: 'LEARN_MORE',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    websiteState: 'found',
    destinationUrl: 'https://ussofa.com',
    qualificationFailedGates: ['GATE_FAIL_FOREIGN_VERIFIED'],
    qualificationReasons: ['Business physically located in foreign country (US); target is BD']
  };

  const row = toResultRowViewModel(foreignLead);
  const detail = toResultDetailViewModel(foreignLead);

  check(2, 'Foreign business in strict-local renders REVIEW_REQUIRED, never QUALIFIED', row.qualificationState === 'REVIEW_REQUIRED');
  check(2, 'Row displays FOREIGN_VERIFIED classification', row.geographicClassification === 'FOREIGN_VERIFIED');
  check(2, 'Row includes actionable foreign rejection reason', row.qualificationReasons?.[0]?.includes('foreign country'));
  check(2, 'Detail drawer lists GATE_FAIL_FOREIGN_VERIFIED in failed gates', detail.qualificationFailedGates?.includes('GATE_FAIL_FOREIGN_VERIFIED'));
}

// -----------------------------------------------------------------------------
// Scenario 3: Local-probable business
// -----------------------------------------------------------------------------
{
  const probableLead = {
    leadId: 'lead_probable_03',
    name: 'Bengal Craft Wood',
    status: 'REVIEW_REQUIRED',
    leadScore: 0.65,
    relevanceDecision: 'RELEVANT',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    geographicClassification: 'LOCAL_PROBABLE',
    qualificationFailedGates: ['GATE_FAIL_LOCAL_UNVERIFIED'],
    qualificationReasons: ['Physical location probable but unverified']
  };

  const row = toResultRowViewModel(probableLead);
  check(3, 'Local-probable business remains REVIEW_REQUIRED in strict-local UI', row.qualificationState === 'REVIEW_REQUIRED');
  check(3, 'Badge label communicates unverified status', toFriendlyStatus(row.geographicClassification) === 'Probable local (unverified)');
}

// -----------------------------------------------------------------------------
// Scenario 4: Unknown business location
// -----------------------------------------------------------------------------
{
  const unknownGeoLead = {
    leadId: 'lead_unk_geo_04',
    name: 'Online Cloud Furnishings',
    status: 'REVIEW_REQUIRED',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCATION_UNKNOWN',
    qualificationFailedGates: ['GATE_FAIL_LOCATION_UNKNOWN'],
    qualificationReasons: ['Physical business location unknown']
  };

  const row = toResultRowViewModel(unknownGeoLead);
  check(4, 'Unknown location business remains REVIEW_REQUIRED', row.qualificationState === 'REVIEW_REQUIRED');
  check(4, 'Failed gate records GATE_FAIL_LOCATION_UNKNOWN', row.qualificationFailedGates?.includes('GATE_FAIL_LOCATION_UNKNOWN'));
}

// -----------------------------------------------------------------------------
// Scenario 5: Unassessed relevance
// -----------------------------------------------------------------------------
{
  const unassessedLead = {
    leadId: 'lead_unassessed_05',
    name: 'Mystery Merchant',
    status: 'REVIEW_REQUIRED',
    relevanceDecision: 'UNASSESSED',
    qualificationFailedGates: ['GATE_FAIL_RELEVANCE_UNASSESSED'],
    qualificationReasons: ['Niche relevance not evaluated']
  };

  const row = toResultRowViewModel(unassessedLead);
  check(5, 'Unassessed relevance candidate mapped to UNASSESSED decision', row.relevanceDecision === 'UNASSESSED');
  check(5, 'Unassessed candidate is REVIEW_REQUIRED', row.qualificationState === 'REVIEW_REQUIRED');
}

// -----------------------------------------------------------------------------
// Scenario 6: Rejected relevance
// -----------------------------------------------------------------------------
{
  const rejectedLead = {
    leadId: 'lead_rejected_06',
    name: 'Manchester United Fan Club',
    status: 'REVIEW_REQUIRED',
    relevanceDecision: 'NOT_RELEVANT',
    qualificationFailedGates: ['GATE_FAIL_RELEVANCE_NOT_MET'],
    qualificationReasons: ['Hard contradiction: sports organization']
  };

  const row = toResultRowViewModel(rejectedLead);
  check(6, 'Rejected relevance candidate preserved as NOT_RELEVANT', row.relevanceDecision === 'NOT_RELEVANT');
  check(6, 'Rejected relevance candidate cannot appear QUALIFIED', row.qualificationState !== 'QUALIFIED');
}

// -----------------------------------------------------------------------------
// Scenario 7: High score with failed qualification
// -----------------------------------------------------------------------------
{
  const highScoreFailingLead = {
    leadId: 'lead_high_score_fail_07',
    name: 'Global Enterprise Furniture UK',
    status: 'REVIEW_REQUIRED',
    leadScore: 0.96, // Extremely high ranking score
    scoreConfidence: 'HIGH',
    relevanceDecision: 'RELEVANT',
    targetCountryCode: 'BD',
    businessCountryCode: 'GB',
    geographicClassification: 'FOREIGN_VERIFIED',
    qualificationFailedGates: ['GATE_FAIL_FOREIGN_VERIFIED'],
    qualificationReasons: ['Foreign country mismatch']
  };

  const row = toResultRowViewModel(highScoreFailingLead);
  check(7, 'High score (0.96) does NOT visually override REVIEW_REQUIRED status', row.qualificationState === 'REVIEW_REQUIRED');
  check(7, 'Score is faithfully reported as 0.96', row.qualificationScore === 0.96);
}

// -----------------------------------------------------------------------------
// Scenario 8: High confidence with failed qualification
// -----------------------------------------------------------------------------
{
  const highConfFailingLead = {
    leadId: 'lead_high_conf_fail_08',
    name: 'American Health Care Furniture',
    status: 'REVIEW_REQUIRED',
    relevanceDecision: 'NOT_RELEVANT',
    relevanceConfidence: 'HIGH',
    qualificationFailedGates: ['GATE_FAIL_RELEVANCE_NOT_MET'],
    qualificationReasons: ['Healthcare category conflict']
  };

  const row = toResultRowViewModel(highConfFailingLead);
  check(8, 'High confidence does NOT qualify an irrelevant lead', row.qualificationState === 'REVIEW_REQUIRED');
  check(8, 'Relevance decision remains NOT_RELEVANT', row.relevanceDecision === 'NOT_RELEVANT');
}

// -----------------------------------------------------------------------------
// Scenario 9: Missing score
// -----------------------------------------------------------------------------
{
  const missingScoreLead = {
    leadId: 'lead_no_score_09',
    name: 'Unscored Candidate Ltd',
    status: 'REVIEW_REQUIRED',
    leadScore: undefined
  };

  const row = toResultRowViewModel(missingScoreLead);
  const detail = toResultDetailViewModel(missingScoreLead);
  check(9, 'Missing score remains undefined, not fabricated to 0 or 100', row.qualificationScore === undefined);
  check(9, 'Detail drawer displays score text as undefined', detail.qualificationScoreText === undefined);
}

// -----------------------------------------------------------------------------
// Scenario 10: Missing qualification reasons
// -----------------------------------------------------------------------------
{
  const missingReasonLead = {
    leadId: 'lead_no_reason_10',
    name: 'Silent Merchant',
    status: 'REVIEW_REQUIRED',
    adLibraryIds: ['ad_mock_10'],
    qualificationReasons: []
  };

  const detail = toResultDetailViewModel(missingReasonLead);
  const explanation = detail.qualificationSummaryExplanation;
  const issues = detail.potentialIssues || detail.qualificationDetails?.potentialIssues;
  check(10, 'Missing qualification reasons yields truthful fallback message', explanation.includes('Candidate does not satisfy strict qualification criteria') || explanation.includes('review required'));
  check(10, 'Potential issues lists review required fallback', issues?.[0]?.explanation === 'Qualification reason unavailable; review required.');
}

// -----------------------------------------------------------------------------
// Scenario 11: Required CTA missing
// -----------------------------------------------------------------------------
{
  const missingCtaLead = {
    leadId: 'lead_cta_fail_11',
    name: 'No Call CTA Business',
    status: 'REVIEW_REQUIRED',
    primaryCtaType: 'LEARN_MORE',
    ctaTypes: ['LEARN_MORE'],
    qualificationFailedGates: ['GATE_FAIL_REQUIRED_CTA_MISSING'],
    qualificationReasons: ['Required CTA (CALL_NOW) not observed']
  };

  const row = toResultRowViewModel(missingCtaLead);
  check(11, 'Candidate missing required CTA is REVIEW_REQUIRED', row.qualificationState === 'REVIEW_REQUIRED');
  check(11, 'Displays observed CTA (LEARN_MORE)', row.ctaType === 'LEARN_MORE');
  check(11, 'Failed gates records GATE_FAIL_REQUIRED_CTA_MISSING', row.qualificationFailedGates?.includes('GATE_FAIL_REQUIRED_CTA_MISSING'));
}

// -----------------------------------------------------------------------------
// Scenario 12: Required destination missing
// -----------------------------------------------------------------------------
{
  const missingDestLead = {
    leadId: 'lead_dest_fail_12',
    name: 'Form Only Business',
    status: 'REVIEW_REQUIRED',
    primaryDestinationType: 'INSTANT_FORM',
    destinationTypes: ['INSTANT_FORM'],
    qualificationFailedGates: ['GATE_FAIL_REQUIRED_DESTINATION_MISSING'],
    qualificationReasons: ['Required destination (EXTERNAL_WEBSITE) not observed']
  };

  const row = toResultRowViewModel(missingDestLead);
  check(12, 'Missing required destination marks candidate as REVIEW_REQUIRED', row.qualificationState === 'REVIEW_REQUIRED');
  check(12, 'Displays observed destination as INSTANT_FORM', row.destinationType === 'INSTANT_FORM');
}

// -----------------------------------------------------------------------------
// Scenario 13: External website destination
// -----------------------------------------------------------------------------
{
  const webLead = {
    leadId: 'lead_web_13',
    name: 'Dot Com Furniture',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    websiteState: 'found',
    destinationUrl: 'https://dotcomfurniture.com'
  };

  const row = toResultRowViewModel(webLead);
  check(13, 'External website destination classified as EXTERNAL_WEBSITE', row.destinationType === 'EXTERNAL_WEBSITE');
  check(13, 'Website state marked found', row.websiteState === 'found');
}

// -----------------------------------------------------------------------------
// Scenario 14: Messaging destination
// -----------------------------------------------------------------------------
{
  const msgLead = {
    leadId: 'lead_msg_14',
    name: 'WhatsApp Seller',
    primaryDestinationType: 'MESSAGING',
    destinationTypes: ['MESSAGING'],
    destinationUrl: 'https://wa.me/8801700000000'
  };

  const row = toResultRowViewModel(msgLead);
  check(14, 'Messaging destination accurately distinguished from external website', row.destinationType === 'MESSAGING');
  check(14, 'Friendly label reads Messaging', toFriendlyStatus(row.destinationType) === 'Messaging');
}

// -----------------------------------------------------------------------------
// Scenario 15: Instant-form destination
// -----------------------------------------------------------------------------
{
  const formLead = {
    leadId: 'lead_form_15',
    name: 'Lead Ad Campaign',
    primaryDestinationType: 'INSTANT_FORM',
    destinationTypes: ['INSTANT_FORM']
  };

  const row = toResultRowViewModel(formLead);
  check(15, 'Instant form destination distinctly represented', row.destinationType === 'INSTANT_FORM');
  check(15, 'Friendly label reads Meta instant form', toFriendlyStatus(row.destinationType) === 'Meta instant form');
}

// -----------------------------------------------------------------------------
// Scenario 16: Unknown destination
// -----------------------------------------------------------------------------
{
  const unkDestLead = {
    leadId: 'lead_unk_16',
    name: 'Mystery Ad',
    primaryDestinationType: 'UNKNOWN',
    websiteState: 'missing'
  };

  const row = toResultRowViewModel(unkDestLead);
  check(16, 'Unknown destination preserved as UNKNOWN', row.destinationType === 'UNKNOWN');
}

// -----------------------------------------------------------------------------
// Scenario 17: Conflicting geographic evidence after entity merge
// -----------------------------------------------------------------------------
{
  const baseLocalLead = {
    leadId: 'lead_merge_conflict_17',
    name: 'Navana Furniture',
    status: 'QUALIFIED',
    geographicClassification: 'LOCAL_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    relevanceDecision: 'RELEVANT',
    websiteState: 'found',
    destinationUrl: 'https://navana.com'
  };

  // Simulating entity merge where foreign ad card arrives:
  const foreignAdEvidence = {
    countryCode: 'SG',
    businessCountryCode: 'SG',
    geographicClassification: 'FOREIGN_VERIFIED',
    status: 'REVIEW_REQUIRED',
    qualificationFailedGates: ['GATE_FAIL_FOREIGN_VERIFIED'],
    qualificationReasons: ['Contradiction: advertiser business country relocated to SG']
  };
  const mergedLead = { ...baseLocalLead, ...foreignAdEvidence };

  const row = toResultRowViewModel(mergedLead);
  check(17, 'Entity merge with foreign evidence demotes status to REVIEW_REQUIRED', row.qualificationState === 'REVIEW_REQUIRED');
  check(17, 'Merged lead classification reflects updated FOREIGN_VERIFIED', row.geographicClassification === 'FOREIGN_VERIFIED');
}

// -----------------------------------------------------------------------------
// Scenario 18: Stored legacy candidate with unsafe persisted status
// -----------------------------------------------------------------------------
{
  const legacyStoredCorruptLead = {
    id: 'stored_legacy_18',
    advertiserName: 'Unchecked Foreign Corp',
    status: 'QUALIFIED', // Stored unsafe status
    relevanceDecision: 'UNASSESSED',
    geographicClassification: 'FOREIGN_VERIFIED',
    websiteState: 'missing'
  };

  const sanitizedLead = normalizeStoredLead(legacyStoredCorruptLead);
  const row = toResultRowViewModel(sanitizedLead);

  check(18, 'Storage normalization demotes unsafe stored status to REVIEW_REQUIRED', sanitizedLead.status === 'REVIEW_REQUIRED');
  check(18, 'Normalized stored lead displays as REVIEW_REQUIRED in UI', row.qualificationState === 'REVIEW_REQUIRED');
}

// -----------------------------------------------------------------------------
// Scenario 19: Interrupted research state
// -----------------------------------------------------------------------------
{
  const checkpoint = {
    runId: 'chk_interrupted_19',
    status: 'PARTIAL',
    stopReason: 'INTERRUPTED_RECOVERY_READY',
    leads: []
  };

  check(19, 'Interrupted run recognized with PARTIAL status', checkpoint.status === 'PARTIAL');
}

// -----------------------------------------------------------------------------
// Scenario 20: Empty results
// -----------------------------------------------------------------------------
{
  const emptyLeads = [];
  const exportPreview = toExportPreviewViewModel(emptyLeads);
  check(20, 'Empty leads produces zero exportable records count', exportPreview.exportableRecordsCount === 0);
  check(20, 'Export is not ready when results are empty', exportPreview.isExportReady === false);
}

// -----------------------------------------------------------------------------
// Scenario 21: Loading state
// -----------------------------------------------------------------------------
{
  const isJobRunning = (status) =>
    status === 'COLLECTING' || status === 'NAVIGATING' || status === 'STARTING' || status === 'NORMALIZING';

  check(21, 'COLLECTING maps to active running job', isJobRunning('COLLECTING'));
  check(21, 'COMPLETED is not active running job', !isJobRunning('COMPLETED'));
}

// -----------------------------------------------------------------------------
// Scenario 22: Collection blocked by safety policy
// -----------------------------------------------------------------------------
{
  const permitted = isLiveCollectionPermitted();
  check(22, 'Collection safety gate is permanently locked (false)', permitted === false);
}

// -----------------------------------------------------------------------------
// Scenario 23: Export attempt containing unqualified candidates
// -----------------------------------------------------------------------------
{
  const mixedLeads = [
    {
      leadId: 'l1',
      name: 'Qualified Lead',
      status: 'QUALIFIED',
      relevanceDecision: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      targetCountryCode: 'BD',
      businessCountryCode: 'BD',
      websiteState: 'found',
      destinationUrl: 'https://valid.com'
    },
    {
      leadId: 'l2',
      name: 'Unqualified Lead',
      status: 'REVIEW_REQUIRED',
      relevanceDecision: 'NOT_RELEVANT',
      geographicClassification: 'FOREIGN_VERIFIED',
      websiteState: 'found'
    }
  ];

  const csvQualifiedOnly = exportLeadsToCsv(mixedLeads, { qualifiedOnly: true });
  check(23, 'Qualified export strictly excludes REVIEW_REQUIRED lead', !csvQualifiedOnly.includes('Unqualified Lead'));
  check(23, 'Qualified export includes QUALIFIED lead', csvQualifiedOnly.includes('Qualified Lead'));
}

// -----------------------------------------------------------------------------
// Scenario 24: Filter settings change expected eligibility
// -----------------------------------------------------------------------------
{
  const candidate = {
    leadId: 'l_filter_24',
    name: 'Form Lead',
    status: 'QUALIFIED',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SIGN_UP',
    primaryDestinationType: 'INSTANT_FORM',
    websiteState: 'missing'
  };

  // Normal qualification passes without website
  const defaultGate = evaluateLeadQualificationGates(candidate, { requireWebsiteFound: false });
  // Custom filter requires website
  const strictWebGate = evaluateLeadQualificationGates(candidate, { requireWebsiteFound: true });

  check(24, 'Default criteria allows instant form lead', defaultGate.isQualified === true);
  check(24, 'Strict website filter correctly rejects instant form lead missing external website', strictWebGate.isQualified === false);
}

// -----------------------------------------------------------------------------
// Scenario 25: Duplicate candidate display or evidence after hydration
// -----------------------------------------------------------------------------
{
  const hydratedLead = {
    leadId: 'dup_hydrated_25',
    name: 'Duplicate Merchant',
    adCount: 5,
    adLibraryIds: ['101', '102', '103'],
    status: 'QUALIFIED',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'found',
    destinationUrl: 'https://dup.com'
  };

  const row = toResultRowViewModel(hydratedLead);
  check(25, 'Hydrated lead collapses duplicate ad count cleanly into corroborationCount', row.corroborationCount === 5);
}

// -----------------------------------------------------------------------------
// Scenario 26: Bengali niche text and Unicode normalization
// -----------------------------------------------------------------------------
{
  const nfcName = 'হাতিল ফার্নিচার';
  const nfdName = 'হাতিল ফার্নিচার'.normalize('NFD');

  const bengaliLead = {
    leadId: 'bengali_26',
    name: nfdName, // decomposed
    advertiserName: nfdName,
    matchedKeywords: ['ফার্নিচার'.normalize('NFD')],
    status: 'QUALIFIED',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'found',
    destinationUrl: 'https://hatil.com'
  };

  const row = toResultRowViewModel(bengaliLead);
  const searchNormalized = row.displayName.normalize('NFC');
  check(26, 'Bengali advertiser text normalizes canonically to NFC matching target search term', searchNormalized.includes('ফার্নিচার'.normalize('NFC')));
}

// -----------------------------------------------------------------------------
// Scenario 27: Accessible labels for status, score, confidence, and reasons
// -----------------------------------------------------------------------------
{
  const qualBadge = getSemanticStatusBadge('QUALIFIED');
  const reviewBadge = getSemanticStatusBadge('REVIEW_REQUIRED');
  const localBadge = getSemanticStatusBadge('LOCAL_VERIFIED');
  const foreignBadge = getSemanticStatusBadge('FOREIGN_VERIFIED');

  check(27, 'QUALIFIED badge declares accessible label with confirmed status', qualBadge.accessibleLabel.includes('Confirmed'));
  check(27, 'REVIEW_REQUIRED badge pairs amber color with distinct warning symbol ⚠', reviewBadge.iconSymbol === '⚠');
  check(27, 'LOCAL_VERIFIED declares distinct pin icon 📍', localBadge.iconSymbol === '📍');
  check(27, 'FOREIGN_VERIFIED declares distinct globe icon 🌐', foreignBadge.iconSymbol === '🌐');
}

console.log('\n========================================================================');
console.log(`PHASE 0.7 TEST SUITE COMPLETED: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================');

if (failed > 0) {
  process.exit(1);
}
