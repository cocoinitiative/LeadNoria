// tests/test-cta-destination-export.mjs
// Phase 0.4: CTA, Destination Classification & Export Integrity Offline Test Suite

import assert from 'node:assert';
import {
  classifyCta,
  classifyDestination,
  aggregateAdEvidence,
} from '../src/extension/destinationClassifier.ts';
import {
  compileResearchIntent,
} from '../src/extension/relevanceEngine.ts';
import {
  mergeCandidateIntoEntity,
} from '../src/extension/entityResolver.ts';
import {
  aggregateCandidatesToLeads,
  exportLeadsToCsv,
} from '../src/extension/metaAdapter.ts';

console.log('=== RUNNING PHASE 0.4 TEST SUITE ===\n');

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
// 1. CTA Classification
// --------------------------------------------------------------------------
console.log('1. CTA Classification:');

runTest('Shop Now maps to SHOP_NOW with original text preserved', () => {
  const res = classifyCta('  Shop Now!  ');
  assert.strictEqual(res.ctaType, 'SHOP_NOW');
  assert.strictEqual(res.rawCtaText, 'Shop Now!');
  assert.strictEqual(res.reasonCode, 'CTA_TEXT_MATCH');
});

runTest('Learn More maps to LEARN_MORE', () => {
  const res = classifyCta('Learn More');
  assert.strictEqual(res.ctaType, 'LEARN_MORE');
  assert.strictEqual(res.reasonCode, 'CTA_TEXT_MATCH');
});

runTest('Sign Up maps to SIGN_UP', () => {
  const res = classifyCta('Sign Up');
  assert.strictEqual(res.ctaType, 'SIGN_UP');
});

runTest('Contact Us maps to CONTACT_US', () => {
  const res = classifyCta('Contact Us');
  assert.strictEqual(res.ctaType, 'CONTACT_US');
});

runTest('Send Message maps to SEND_MESSAGE', () => {
  const res = classifyCta('Send WhatsApp Message');
  assert.strictEqual(res.ctaType, 'SEND_MESSAGE');
});

runTest('Call Now maps to CALL_NOW', () => {
  const res = classifyCta('Call Now');
  assert.strictEqual(res.ctaType, 'CALL_NOW');
});

runTest('Download maps to DOWNLOAD', () => {
  const res = classifyCta('Install Now');
  assert.strictEqual(res.ctaType, 'DOWNLOAD');
});

runTest('Get Quote maps to GET_QUOTE', () => {
  const res = classifyCta('Get Quote');
  assert.strictEqual(res.ctaType, 'GET_QUOTE');
});

runTest('Unrecognized CTA text maps to OTHER without error', () => {
  const res = classifyCta('Spin the Wheel to Win');
  assert.strictEqual(res.ctaType, 'OTHER');
  assert.strictEqual(res.rawCtaText, 'Spin the Wheel to Win');
  assert.strictEqual(res.reasonCode, 'CTA_TEXT_OTHER');
});

runTest('Missing or empty CTA text maps to UNKNOWN with CTA_TEXT_MISSING', () => {
  const res1 = classifyCta('');
  assert.strictEqual(res1.ctaType, 'UNKNOWN');
  assert.strictEqual(res1.rawCtaText, undefined);
  assert.strictEqual(res1.reasonCode, 'CTA_TEXT_MISSING');

  const res2 = classifyCta(undefined);
  assert.strictEqual(res2.ctaType, 'UNKNOWN');
  assert.strictEqual(res2.rawCtaText, undefined);
  assert.strictEqual(res2.reasonCode, 'CTA_TEXT_MISSING');
});

// --------------------------------------------------------------------------
// 2. Destination Classification
// --------------------------------------------------------------------------
console.log('\n2. Destination Classification:');

runTest('Valid external website URL maps to EXTERNAL_WEBSITE', () => {
  const res = classifyDestination({
    ctaText: 'Shop Now',
    destinationUrl: 'https://example-shop.com/collections/summer',
  });
  assert.strictEqual(res.destinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(res.destinationDomain, 'example-shop.com');
  assert.strictEqual(res.reasonCode, 'VISIBLE_EXTERNAL_DESTINATION');
  assert.strictEqual(res.confidence, 'HIGH');
});

runTest('WhatsApp link maps to MESSAGING', () => {
  const res = classifyDestination({
    ctaText: 'Shop Now',
    destinationUrl: 'https://wa.me/8801711223344?text=Hello',
  });
  assert.strictEqual(res.destinationType, 'MESSAGING');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_MESSAGING_SIGNAL');
  assert.strictEqual(res.confidence, 'HIGH');
});

runTest('Messenger link maps to MESSAGING', () => {
  const res = classifyDestination({
    ctaText: 'Send Message',
    destinationUrl: 'https://m.me/mybusiness',
  });
  assert.strictEqual(res.destinationType, 'MESSAGING');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_MESSAGING_SIGNAL');
});

runTest('Google Play store link maps to APP', () => {
  const res = classifyDestination({
    ctaText: 'Download',
    destinationUrl: 'https://play.google.com/store/apps/details?id=com.app.example',
  });
  assert.strictEqual(res.destinationType, 'APP');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_APP_SIGNAL');
  assert.strictEqual(res.confidence, 'HIGH');
});

runTest('Apple App Store link maps to APP', () => {
  const res = classifyDestination({
    ctaText: 'Install Now',
    destinationUrl: 'https://apps.apple.com/us/app/example/id123456789',
  });
  assert.strictEqual(res.destinationType, 'APP');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_APP_SIGNAL');
});

runTest('Lead Gen Form URL maps to INSTANT_FORM', () => {
  const res = classifyDestination({
    ctaText: 'Sign Up',
    destinationUrl: 'https://www.facebook.com/lead_gen/form/1234567890/',
  });
  assert.strictEqual(res.destinationType, 'INSTANT_FORM');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_INSTANT_FORM_SIGNAL');
  assert.strictEqual(res.confidence, 'HIGH');
});

runTest('Explicit form signal flag maps to INSTANT_FORM even without URL', () => {
  const res = classifyDestination({
    ctaText: 'Sign Up',
    hasLeadFormSignal: true,
  });
  assert.strictEqual(res.destinationType, 'INSTANT_FORM');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_INSTANT_FORM_SIGNAL');
  assert.strictEqual(res.confidence, 'HIGH');
});

runTest('Direct CALL_NOW CTA without URL maps to CALL', () => {
  const res = classifyDestination({
    ctaText: 'Call Now',
  });
  assert.strictEqual(res.destinationType, 'CALL');
  assert.strictEqual(res.reasonCode, 'EXPLICIT_CALL_SIGNAL');
  assert.strictEqual(res.confidence, 'MEDIUM');
});

runTest('SHOP_NOW without destination URL does NOT become EXTERNAL_WEBSITE (remains UNKNOWN)', () => {
  const res = classifyDestination({
    ctaText: 'Shop Now',
    destinationUrl: undefined,
  });
  assert.strictEqual(res.destinationType, 'UNKNOWN');
  assert.strictEqual(res.reasonCode, 'INSUFFICIENT_DESTINATION_EVIDENCE');
  assert.strictEqual(res.confidence, 'LOW');
});

runTest('LEARN_MORE without destination URL remains UNKNOWN', () => {
  const res = classifyDestination({
    ctaText: 'Learn More',
    destinationUrl: '',
  });
  assert.strictEqual(res.destinationType, 'UNKNOWN');
  assert.strictEqual(res.reasonCode, 'INSUFFICIENT_DESTINATION_EVIDENCE');
  assert.strictEqual(res.confidence, 'LOW');
});

runTest('Explicit absence of destination maps to NO_VISIBLE_DESTINATION', () => {
  const res = classifyDestination({
    hasNoDestinationSignal: true,
  });
  assert.strictEqual(res.destinationType, 'NO_VISIBLE_DESTINATION');
  assert.strictEqual(res.reasonCode, 'DESTINATION_NOT_OBSERVED');
  assert.strictEqual(res.confidence, 'HIGH');
});

runTest('Conflicting signals map to UNKNOWN with CONFLICTING_DESTINATION_SIGNALS', () => {
  const res = classifyDestination({
    hasNoDestinationSignal: true,
    destinationUrl: 'https://example.com/checkout',
  });
  assert.strictEqual(res.destinationType, 'UNKNOWN');
  assert.strictEqual(res.reasonCode, 'CONFLICTING_DESTINATION_SIGNALS');
  assert.strictEqual(res.confidence, 'LOW');
});

// --------------------------------------------------------------------------
// 3. Ad-Level Evidence Preservation & Entity Merging
// --------------------------------------------------------------------------
console.log('\n3. Ad-Level Evidence Preservation & Entity Merging:');

runTest('Two ads from one advertiser retain distinct CTAs and destinations', () => {
  const ad1 = {
    libraryId: '100000000000001',
    pageId: 'page_12345',
    pageName: 'Tech Brand',
    adText: 'Get our new app now',
    ctaText: 'Download',
    ctaType: 'DOWNLOAD',
    destinationUrl: 'https://play.google.com/store/apps/details?id=com.techbrand',
    destinationType: 'APP',
    destinationReasonCode: 'EXPLICIT_APP_SIGNAL',
    destinationConfidence: 'HIGH',
    phoneNumbers: [],
    emails: [],
  };

  const ad2 = {
    libraryId: '100000000000002',
    pageId: 'page_12345',
    pageName: 'Tech Brand',
    adText: 'Chat with our sales team on WhatsApp',
    ctaText: 'Send Message',
    ctaType: 'SEND_MESSAGE',
    destinationUrl: 'https://wa.me/1234567890',
    destinationType: 'MESSAGING',
    destinationReasonCode: 'EXPLICIT_MESSAGING_SIGNAL',
    destinationConfidence: 'HIGH',
    phoneNumbers: [],
    emails: [],
  };

  const { leads } = aggregateCandidatesToLeads([ad1, ad2]);
  assert.strictEqual(leads.length, 1);
  const lead = leads[0];

  assert.strictEqual(lead.adEvidence?.length, 2);
  assert.deepStrictEqual(lead.observedCtaTypes?.sort(), ['DOWNLOAD', 'SEND_MESSAGE'].sort());
  assert.deepStrictEqual(lead.observedDestinationTypes?.sort(), ['APP', 'MESSAGING'].sort());

  // Confirm distinct items in adEvidence
  const ev1 = lead.adEvidence.find(e => e.libraryId === '100000000000001');
  const ev2 = lead.adEvidence.find(e => e.libraryId === '100000000000002');
  assert.strictEqual(ev1.ctaType, 'DOWNLOAD');
  assert.strictEqual(ev1.destinationType, 'APP');
  assert.strictEqual(ev2.ctaType, 'SEND_MESSAGE');
  assert.strictEqual(ev2.destinationType, 'MESSAGING');
});

runTest('Repeated observation of same ad does not create duplicate evidence', () => {
  const ad1 = {
    libraryId: '100000000000001',
    pageId: 'page_12345',
    pageName: 'Tech Brand',
    adText: 'Ad 1',
    ctaText: 'Shop Now',
    destinationUrl: 'https://techbrand.com',
  };

  const { leads } = aggregateCandidatesToLeads([ad1, ad1]);
  assert.strictEqual(leads.length, 1);
  assert.strictEqual(leads[0].adEvidence?.length, 1);
});

runTest('Missing CTA or destination on one ad does not erase another ad evidence', () => {
  const ad1 = {
    libraryId: '100000000000001',
    pageId: 'page_99999',
    pageName: 'Store',
    ctaText: 'Shop Now',
    destinationUrl: 'https://store.com',
  };

  const ad2 = {
    libraryId: '100000000000002',
    pageId: 'page_99999',
    pageName: 'Store',
    ctaText: '', // missing CTA
    destinationUrl: '', // missing URL
  };

  const { leads } = aggregateCandidatesToLeads([ad1, ad2]);
  assert.strictEqual(leads.length, 1);
  const lead = leads[0];

  assert.strictEqual(lead.adEvidence?.length, 2);
  assert.strictEqual(lead.observedCtaTypes?.includes('SHOP_NOW'), true);
  assert.strictEqual(lead.observedDestinationTypes?.includes('EXTERNAL_WEBSITE'), true);
  assert.strictEqual(lead.primaryDestinationType, 'EXTERNAL_WEBSITE');
});

// --------------------------------------------------------------------------
// 4. Qualification & Filtering
// --------------------------------------------------------------------------
console.log('\n4. Qualification & Filtering:');

runTest('Research intent with requiredCtaTypes filters out non-matching candidates', () => {
  const intent = compileResearchIntent({
    targetNiches: ['clothing'],
    targetCountryCode: 'BD',
    requiredCtaTypes: ['SHOP_NOW'],
  });

  const candShop = {
    libraryId: '111111111111111',
    pageId: 'page_001',
    pageName: 'Fashion BD',
    adText: 'Buy trendy clothing online in Dhaka',
    ctaText: 'Shop Now',
    destinationUrl: 'https://fashionbd.com',
    phoneNumbers: ['+8801711223344'],
  };

  const candCall = {
    libraryId: '222222222222222',
    pageId: 'page_002',
    pageName: 'Fashion BD 2',
    adText: 'Buy trendy clothing online in Dhaka',
    ctaText: 'Call Now',
    destinationUrl: '',
    phoneNumbers: ['+8801711223344'],
  };

  const { leads } = aggregateCandidatesToLeads([candShop, candCall], intent);
  assert.strictEqual(leads.length, 1);
  assert.strictEqual(leads[0].name, 'Fashion BD');
});

runTest('Research intent with requiredDestinationTypes filters out non-matching candidates', () => {
  const intent = compileResearchIntent({
    targetNiches: ['clothing'],
    targetCountryCode: 'BD',
    requiredDestinationTypes: ['EXTERNAL_WEBSITE'],
  });

  const candWeb = {
    libraryId: '111111111111111',
    pageId: 'page_001',
    pageName: 'Fashion BD',
    adText: 'Buy clothing in Dhaka',
    ctaText: 'Shop Now',
    destinationUrl: 'https://fashionbd.com',
    phoneNumbers: ['+8801711223344'],
  };

  const candMsg = {
    libraryId: '222222222222222',
    pageId: 'page_002',
    pageName: 'Fashion BD 2',
    adText: 'Buy clothing in Dhaka',
    ctaText: 'Send Message',
    destinationUrl: 'https://wa.me/8801711223344',
    phoneNumbers: ['+8801711223344'],
  };

  const { leads } = aggregateCandidatesToLeads([candWeb, candMsg], intent);
  assert.strictEqual(leads.length, 1);
  assert.strictEqual(leads[0].name, 'Fashion BD');
  assert.strictEqual(leads[0].primaryDestinationType, 'EXTERNAL_WEBSITE');
});

runTest('Missing destination URL does not silently satisfy EXTERNAL_WEBSITE filter', () => {
  const intent = compileResearchIntent({
    targetNiches: ['clothing'],
    targetCountryCode: 'BD',
    requiredDestinationTypes: ['EXTERNAL_WEBSITE'],
  });

  const candNoUrl = {
    libraryId: '333333333333333',
    pageId: 'page_003',
    pageName: 'Store Without URL',
    adText: 'Buy clothing in Dhaka',
    ctaText: 'Shop Now',
    destinationUrl: '',
    phoneNumbers: ['+8801711223344'],
  };

  const { leads } = aggregateCandidatesToLeads([candNoUrl], intent);
  assert.strictEqual(leads.length, 0);
});

// --------------------------------------------------------------------------
// 5. Export Integrity
// --------------------------------------------------------------------------
console.log('\n5. Export Integrity:');

runTest('Unassessed relevance decision exports as UNASSESSED (never RELEVANT)', () => {
  const lead = {
    pageId: 'page_unassessed',
    pageName: 'Unassessed Store',
    relevanceDecision: undefined, // Unevaluated!
    geographicStatus: 'LOCATION_UNKNOWN',
    libraryId: '555555555555555',
    adText: 'Some ad text',
    ctaText: 'Learn More',
    ctaType: 'LEARN_MORE',
    primaryDestinationType: 'UNKNOWN',
    destinationConfidence: 'LOW',
    destinationReasonCode: 'INSUFFICIENT_DESTINATION_EVIDENCE',
  };

  const csv = exportLeadsToCsv([lead]);
  // CSV header must contain CTA and Destination columns
  assert.strictEqual(csv.includes('CTA Type'), true);
  assert.strictEqual(csv.includes('Destination Type'), true);
  assert.strictEqual(csv.includes('Destination Reason'), true);

  // Must NOT contain RELEVANT
  assert.strictEqual(csv.includes('UNASSESSED'), true);
  assert.strictEqual(csv.includes('RELEVANT'), false);
  assert.strictEqual(csv.includes('N/A'), true); // default score
});

runTest('CSV export protects against formula injection (=, +, -, @, \\t, \\r)', () => {
  const dangerousLead = {
    id: 'lead_danger',
    name: '=cmd|/c calc!A0',
    facebookPageName: '=cmd|/c calc!A0',
    sampleCopy: '+2+2',
    sampleCta: '@malicious',
    primaryCtaType: 'OTHER',
    primaryDestinationType: 'UNKNOWN',
    destinationConfidence: 'LOW',
    destinationReasonCode: 'CTA_TEXT_OTHER',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
  };

  const csv = exportLeadsToCsv([dangerousLead]);
  // Formula prefixes should be escaped with leading single quote: '=cmd... inside quoted CSV cell
  assert.strictEqual(csv.includes("''=cmd|/c calc!A0") || csv.includes("''=") || csv.includes("'=cmd|/c calc!A0"), true);
  assert.strictEqual(csv.includes("''+2+2") || csv.includes("''+") || csv.includes("'+2+2"), true);
  assert.strictEqual(csv.includes("''@malicious") || csv.includes("''@") || csv.includes("'@malicious"), true);
});

runTest('Qualified-only export option enforces strict geographic & relevance gates', () => {
  const foreignLead = {
    id: 'lead_foreign',
    name: 'Foreign Store',
    facebookPageName: 'Foreign Store',
    geographicClassification: 'FOREIGN_VERIFIED',
    relevanceDecision: 'RELEVANT',
  };

  const localProbableLead = {
    id: 'lead_prob',
    name: 'Probable Store',
    facebookPageName: 'Probable Store',
    geographicClassification: 'LOCAL_PROBABLE',
    relevanceDecision: 'RELEVANT',
  };

  const verifiedLead = {
    id: 'lead_verified',
    name: 'Verified Store',
    facebookPageName: 'Verified Store',
    geographicClassification: 'LOCAL_VERIFIED',
    relevanceDecision: 'RELEVANT',
  };

  const unqualifiedCsv = exportLeadsToCsv([foreignLead, localProbableLead, verifiedLead], { qualifiedOnly: true });
  // Only verifiedLead should be exported
  assert.strictEqual(unqualifiedCsv.includes('Verified Store'), true);
  assert.strictEqual(unqualifiedCsv.includes('Foreign Store'), false);
  assert.strictEqual(unqualifiedCsv.includes('Probable Store'), false);
});

// --------------------------------------------------------------------------
// 6. Summary
// --------------------------------------------------------------------------
console.log(`\n========================================`);
console.log(`Phase 0.4 Suite Finished: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
