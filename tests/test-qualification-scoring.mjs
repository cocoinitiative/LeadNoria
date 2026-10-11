// tests/test-qualification-scoring.mjs
// Phase 0.6: Qualification Engine & Lead Scoring Offline Audit & Hardening Test Suite

import assert from 'node:assert';
import {
  evaluateLeadQualificationGates
} from '../src/extension/qualificationGate.ts';
import {
  LeadRelevanceEngine,
  compileResearchIntent
} from '../src/extension/relevanceEngine.ts';
import {
  evaluateGeographicOrigin
} from '../src/extension/geographicClassifier.ts';
import {
  classifyCta,
  classifyDestination,
  aggregateAdEvidence
} from '../src/extension/destinationClassifier.ts';
import {
  aggregateCandidatesToLeads,
  exportLeadsToCsv
} from '../src/extension/metaAdapter.ts';
import {
  normalizeStoredLead
} from '../src/extension/bulkStore.ts';
import { isLiveCollectionPermitted } from '../src/config/collectionGate.ts';

console.log('=== RUNNING PHASE 0.6 QUALIFICATION & SCORING TEST SUITE ===\n');

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

// --------------------------------------------------------------------------
// 1. Niche Relevance Hardening
// --------------------------------------------------------------------------
console.log('1. Niche Relevance & Unicode Hardening:');

const dentalIntent = compileResearchIntent('CUSTOM', ['dentist', 'dental clinic'], undefined, 'US', {
  strictLocalMode: true
});

runTest('Strong niche match classifies as RELEVANT with high confidence', () => {
  const evalRes = LeadRelevanceEngine.evaluateCandidate({
    pageName: 'Austin Family Dental Care',
    bodyCopy: 'Comprehensive dental exams, cleanings, and emergency dental treatments in Austin.',
    ctaText: 'Book Now',
    destinationUrl: 'https://austinfamilydental.com/book'
  }, dentalIntent);

  assert.strictEqual(evalRes.decision, 'RELEVANT');
  assert.ok(evalRes.score >= 0.35, `Score (${evalRes.score}) must be >= 0.35`);
});

runTest('Generic advertisement without vertical evidence is rejected or uncertain', () => {
  const evalRes = LeadRelevanceEngine.evaluateCandidate({
    pageName: 'Super Deals Direct',
    bodyCopy: 'Special discounts on general household items and accessories today only.',
    ctaText: 'Shop Now',
    destinationUrl: 'https://superdeals.com'
  }, dentalIntent);

  assert.notStrictEqual(evalRes.decision, 'RELEVANT');
  assert.ok(evalRes.reasonCode.startsWith('REJECT_'), `Reason code (${evalRes.reasonCode}) must start with REJECT_`);
});

runTest('Hard category contradiction strictly rejects candidate regardless of incidental keywords', () => {
  const furnitureIntent = compileResearchIntent('CUSTOM', ['furniture', 'chair'], undefined, 'US');
  const evalRes = LeadRelevanceEngine.evaluateCandidate({
    pageName: 'Manchester United Football Club',
    bodyCopy: 'Sit in the best chair at Old Trafford and enjoy premier sports hospitality.',
    ctaText: 'Learn More',
    destinationUrl: 'https://manutd.com/hospitality'
  }, furnitureIntent);

  assert.strictEqual(evalRes.decision, 'NOT_RELEVANT');
  assert.strictEqual(evalRes.confidence, 'HIGH');
  assert.strictEqual(evalRes.reasonCode, 'REJECT_CONTRADICTION_IDENTITY');
});

runTest('Bengali text with combining marks matches canonically under NFC normalization', () => {
  const bengaliIntent = compileResearchIntent('CUSTOM', ['আসবাবপত্র', 'ফার্নিচার'], undefined, 'BD');
  // Decomposed NFD string vs precomposed NFC string
  const nfdAdvertiser = 'হাতিল ফার্নিচার'.normalize('NFD');
  const nfcCopy = 'সেরা মানের কাঠের আসবাবপত্র কিনুন'.normalize('NFC');

  const evalRes = LeadRelevanceEngine.evaluateCandidate({
    pageName: nfdAdvertiser,
    bodyCopy: nfcCopy,
    ctaText: 'অর্ডার করুন'
  }, bengaliIntent);

  assert.strictEqual(evalRes.decision, 'RELEVANT');
  assert.ok(evalRes.matchedTerms.length > 0, 'Must match Bengali terms under canonical NFC composition');
});

runTest('Relevance scoring is deterministic and identical across repeated evaluations', () => {
  const cand = {
    pageName: 'Premier Orthodontics',
    bodyCopy: 'Invisalign and braces for teens and adults. Free initial smile consultation.',
    ctaText: 'Get Quote',
    destinationUrl: 'https://premierortho.com'
  };

  const eval1 = LeadRelevanceEngine.evaluateCandidate(cand, dentalIntent);
  const eval2 = LeadRelevanceEngine.evaluateCandidate(cand, dentalIntent);

  assert.strictEqual(eval1.score, eval2.score, 'Repeated evaluation must produce byte-identical score');
  assert.strictEqual(eval1.decision, eval2.decision);
  assert.strictEqual(eval1.reasonCode, eval2.reasonCode);
});

// --------------------------------------------------------------------------
// 2. Geographic Qualification & Strict-Local Gate
// --------------------------------------------------------------------------
console.log('\n2. Geographic Qualification Invariants:');

runTest('Verified local business passes strict-local geographic gate', () => {
  const gateRes = evaluateLeadQualificationGates({
    name: 'Dallas Dental Care',
    adLibraryIds: ['10001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED'
  }, { strictLocalMode: true });

  assert.strictEqual(gateRes.passedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(gateRes.failedGates.includes('GATE_GEOGRAPHY'), false);
});

runTest('Verified foreign business strictly fails geographic gate', () => {
  const gateRes = evaluateLeadQualificationGates({
    name: 'London Teeth Care',
    adLibraryIds: ['10002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'FOREIGN_VERIFIED'
  }, { strictLocalMode: true });

  assert.strictEqual(gateRes.failedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(gateRes.isQualified, false);
});

runTest('Probable local business fails strict-local gate unless allowProbableLocal is explicitly true', () => {
  const lead = {
    name: 'Texas Smile Co',
    adLibraryIds: ['10003'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_PROBABLE'
  };

  // Strict-local default (allowProbableLocal: false) -> FAILS
  const strictRes = evaluateLeadQualificationGates(lead, { strictLocalMode: true, allowProbableLocal: false });
  assert.strictEqual(strictRes.failedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(strictRes.status, 'REVIEW_REQUIRED');

  // Explicit policy allowProbableLocal: true -> PASSES
  const relaxedRes = evaluateLeadQualificationGates(lead, { strictLocalMode: true, allowProbableLocal: true });
  assert.strictEqual(relaxedRes.passedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(relaxedRes.status, 'QUALIFIED');
});

runTest('Location unknown business fails geographic gate and remains review-required', () => {
  const gateRes = evaluateLeadQualificationGates({
    name: 'Anonymous Dental Clinic',
    adLibraryIds: ['10004'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCATION_UNKNOWN'
  }, { strictLocalMode: true });

  assert.strictEqual(gateRes.failedGates.includes('GATE_GEOGRAPHY'), true);
  assert.strictEqual(gateRes.status, 'REVIEW_REQUIRED');
});

// --------------------------------------------------------------------------
// 3. CTA and Destination Qualification
// --------------------------------------------------------------------------
console.log('\n3. CTA & Destination Qualification:');

runTest('Required CTA filter passes matching lead and rejects non-matching lead', () => {
  const matchingLead = {
    name: 'Emergency Dental Hub',
    adLibraryIds: ['20001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'CALL_NOW',
    observedCtaTypes: ['CALL_NOW']
  };

  const nonMatchingLead = {
    name: 'Online Toothpaste Shop',
    adLibraryIds: ['20002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SHOP_NOW',
    observedCtaTypes: ['SHOP_NOW']
  };

  const criteria = { requiredCtaTypes: ['CALL_NOW'] };

  const passRes = evaluateLeadQualificationGates(matchingLead, criteria);
  assert.strictEqual(passRes.isQualified, true);

  const failRes = evaluateLeadQualificationGates(nonMatchingLead, criteria);
  assert.strictEqual(failRes.isQualified, false);
  assert.strictEqual(failRes.failedGates.includes('GATE_CTA'), true);
});

runTest('Required Destination filter passes matching lead and rejects non-matching lead', () => {
  const instantFormLead = {
    name: 'Quick Lead Dental',
    adLibraryIds: ['30001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryDestinationType: 'INSTANT_FORM',
    observedDestinationTypes: ['INSTANT_FORM']
  };

  const websiteLead = {
    name: 'Website Only Dental',
    adLibraryIds: ['30002'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    observedDestinationTypes: ['EXTERNAL_WEBSITE'],
    websiteState: 'found'
  };

  const criteria = { requiredDestinationTypes: ['INSTANT_FORM'] };

  const formRes = evaluateLeadQualificationGates(instantFormLead, criteria);
  assert.strictEqual(formRes.isQualified, true);

  const webRes = evaluateLeadQualificationGates(websiteLead, criteria);
  assert.strictEqual(webRes.isQualified, false);
  assert.strictEqual(webRes.failedGates.includes('GATE_DESTINATION'), true);
});

runTest('Missing destination URL does not satisfy EXTERNAL_WEBSITE destination requirement', () => {
  const missingWebLead = {
    name: 'No Link Dental',
    adLibraryIds: ['30003'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    websiteState: 'unknown' // Missing URL
  };

  const gateRes = evaluateLeadQualificationGates(missingWebLead);
  assert.strictEqual(gateRes.isQualified, false);
  assert.strictEqual(gateRes.failedGates.includes('GATE_WEBSITE'), true);
});

// --------------------------------------------------------------------------
// 4. Qualification & Scoring Decoupling (Non-Collapsing Invariants)
// --------------------------------------------------------------------------
console.log('\n4. Qualification & Scoring Decoupling:');

runTest('High score (0.95) and HIGH confidence NEVER override failed geographic gate', () => {
  const highScoringForeignLead = {
    name: 'Berlin Dental World',
    adLibraryIds: ['40001'],
    relevanceDecision: 'RELEVANT',
    relevanceScore: 0.95,
    relevanceConfidence: 'HIGH',
    geographicClassification: 'FOREIGN_VERIFIED',
    websiteState: 'found'
  };

  const gateRes = evaluateLeadQualificationGates(highScoringForeignLead, { strictLocalMode: true });
  assert.strictEqual(gateRes.isQualified, false);
  assert.strictEqual(gateRes.status, 'REVIEW_REQUIRED');
  assert.strictEqual(gateRes.failedGates.includes('GATE_GEOGRAPHY'), true);
});

runTest('High score NEVER overrides unassessed or uncertain relevance decision', () => {
  const unassessedLead = {
    name: 'Unassessed Business',
    adLibraryIds: ['40002'],
    relevanceDecision: 'UNASSESSED',
    relevanceScore: 0.88,
    geographicClassification: 'LOCAL_VERIFIED',
    websiteState: 'found'
  };

  const gateRes = evaluateLeadQualificationGates(unassessedLead);
  assert.strictEqual(gateRes.isQualified, false);
  assert.strictEqual(gateRes.status, 'REVIEW_REQUIRED');
  assert.strictEqual(gateRes.failedGates.includes('GATE_RELEVANCE'), true);
});

runTest('Entity merge with foreign ad invalidates qualification status to REVIEW_REQUIRED in general discovery', () => {
  const generalIntent = compileResearchIntent('CUSTOM', ['dentist', 'dental clinic'], undefined, 'US', {
    strictLocalMode: false // general discovery mode admits leads while tagging classification
  });

  const candidates = [
    {
      libraryId: '50001',
      pageName: 'Global Dental Care',
      bodyCopy: 'Local Austin Texas dental office. Call +1-512-555-0199',
      ctaText: 'Call Now',
      destinationUrl: 'https://austindental.com'
    },
    {
      libraryId: '50002',
      pageName: 'Global Dental Care',
      bodyCopy: 'Headquarters: 45 Regent Street, London W1B 2EL, United Kingdom. Call +44 20 7946 0991',
      ctaText: 'Learn More',
      destinationUrl: 'https://austindental.com/uk'
    }
  ];

  const { leads } = aggregateCandidatesToLeads(candidates, 'US', 'United States', 10, [], generalIntent);
  assert.strictEqual(leads.length, 1);
  const lead = leads[0];

  // The second ad introduced conflicting/foreign headquarters evidence
  assert.notStrictEqual(lead.geographicClassification, 'LOCAL_VERIFIED');
  assert.strictEqual(lead.status, 'REVIEW_REQUIRED');
});

runTest('Duplicate candidate observations do not inflate relevance score or ad count', () => {
  const adCard = {
    libraryId: '60001',
    pageName: 'Cedar Park Dental Care',
    bodyCopy: 'Family dentistry in Austin Texas. Call (512) 555-0144 for appointments.',
    ctaText: 'Learn More',
    destinationUrl: 'https://cedarparkdental.com'
  };

  const { leads: singleLeads } = aggregateCandidatesToLeads([adCard], 'US', 'United States', 10, [], dentalIntent);
  const { leads: multiLeads } = aggregateCandidatesToLeads([adCard, adCard, adCard], 'US', 'United States', 10, [], dentalIntent);

  assert.strictEqual(singleLeads.length, 1);
  assert.strictEqual(multiLeads.length, 1);
  assert.strictEqual(singleLeads[0].adCount, 1);
  assert.strictEqual(multiLeads[0].adCount, 1);
  assert.strictEqual(singleLeads[0].relevanceScore, multiLeads[0].relevanceScore);
});

// --------------------------------------------------------------------------
// 5. Normalization, Fail-Closed Storage & Export Integrity
// --------------------------------------------------------------------------
console.log('\n5. Normalization, Fail-Closed Storage & Export Integrity:');

runTest('normalizeStoredLead sanitizes legacy records: unassessed or foreign leads cannot retain QUALIFIED status', () => {
  const legacyRecord = {
    name: 'Restored Foreign Entity',
    status: 'QUALIFIED', // Legacy record claimed QUALIFIED
    relevanceDecision: 'UNASSESSED', // But relevance was never assessed!
    geographicClassification: 'FOREIGN_VERIFIED', // And business is foreign!
    adLibraryIds: ['70001']
  };

  const normalized = normalizeStoredLead(legacyRecord);
  assert.strictEqual(normalized.status, 'REVIEW_REQUIRED', 'Status must be downgraded to REVIEW_REQUIRED');
  assert.strictEqual(normalized.relevanceDecision, 'UNASSESSED');
  assert.ok(normalized.qualificationFailedGates?.includes('GATE_RELEVANCE'));
  assert.ok(normalized.qualificationFailedGates?.includes('GATE_GEOGRAPHY'));
});

runTest('exportLeadsToCsv with qualifiedOnly rigorously excludes unassessed, foreign, and review-required leads', () => {
  const leads = [
    {
      id: 'lead_qual',
      name: 'Legit Local Dental',
      adLibraryIds: ['80001'],
      relevanceDecision: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      primaryCtaType: 'BOOK_TRAVEL',
      primaryDestinationType: 'EXTERNAL_WEBSITE',
      websiteState: 'found',
      status: 'QUALIFIED'
    },
    {
      id: 'lead_unassessed',
      name: 'Unassessed Clinic',
      adLibraryIds: ['80002'],
      relevanceDecision: 'UNASSESSED',
      geographicClassification: 'LOCAL_VERIFIED',
      status: 'REVIEW_REQUIRED'
    },
    {
      id: 'lead_foreign',
      name: 'Foreign Clinic Berlin',
      adLibraryIds: ['80003'],
      relevanceDecision: 'RELEVANT',
      geographicClassification: 'FOREIGN_VERIFIED',
      status: 'REVIEW_REQUIRED'
    }
  ];

  const csv = exportLeadsToCsv(leads, { qualifiedOnly: true });
  assert.strictEqual(csv.includes('Legit Local Dental'), true);
  assert.strictEqual(csv.includes('Unassessed Clinic'), false);
  assert.strictEqual(csv.includes('Foreign Clinic Berlin'), false);
});

runTest('exportLeadsToCsv enforces requiredCtaTypes when provided in research run or options', () => {
  const leads = [
    {
      id: 'lead_call',
      name: 'Call Only Dental',
      adLibraryIds: ['90001'],
      relevanceDecision: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      primaryCtaType: 'CALL_NOW',
      observedCtaTypes: ['CALL_NOW'],
      websiteState: 'found',
      status: 'QUALIFIED'
    },
    {
      id: 'lead_shop',
      name: 'Shop Only Dental',
      adLibraryIds: ['90002'],
      relevanceDecision: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      primaryCtaType: 'SHOP_NOW',
      observedCtaTypes: ['SHOP_NOW'],
      websiteState: 'found',
      status: 'QUALIFIED'
    }
  ];

  const csv = exportLeadsToCsv(leads, { qualifiedOnly: true, requiredCtaTypes: ['CALL_NOW'] });
  assert.strictEqual(csv.includes('Call Only Dental'), true);
  assert.strictEqual(csv.includes('Shop Only Dental'), false);
});

runTest('Phase 0.1 Collection Safety Gate remains active and fail-closed', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted must return false');
});

console.log(`\n======================================================`);
console.log(`Phase 0.6 Tests Completed: ${passed} Passed, ${failed} Failed.`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
