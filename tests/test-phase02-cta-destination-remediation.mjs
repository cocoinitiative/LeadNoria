/**
 * LeadNoria — Phase 2 Remediation Regression Test Suite
 * Meta Ad CTA & Destination Classification (20 Required Verification Gates)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  classifyCta,
  classifyDestination,
  aggregateAdEvidence,
} from '../src/extension/destinationClassifier.ts';

import {
  compileResearchIntent
} from '../src/extension/relevanceEngine.ts';

import {
  evaluateLeadQualificationGates
} from '../src/extension/qualificationGate.ts';

import {
  normalizeStoredLead
} from '../src/extension/bulkStore.ts';

import {
  aggregateCandidatesToLeads,
  exportLeadsToCsv
} from '../src/extension/metaAdapter.ts';

import {
  evaluateGeographicOrigin
} from '../src/extension/geographicClassifier.ts';

import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

console.log('========================================================================');
console.log('LEADNORIA: PHASE 2 REMEDIATION REGRESSION TEST SUITE');
console.log('Meta Ad CTA & Destination Classification — 20 Verification Gates');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function runGate(num, title, fn) {
  try {
    fn();
    console.log(`  [PASS] [Gate ${num.toString().padStart(2, '0')}] ${title}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] [Gate ${num.toString().padStart(2, '0')}] ${title}`);
    console.error(`         Error: ${err.message}`);
    failed++;
  }
}

// --------------------------------------------------------------------------
// 1. Each supported destination class
// --------------------------------------------------------------------------
runGate(1, 'Each supported destination class is accurately identified', () => {
  // EXTERNAL_WEBSITE
  const dWeb = classifyDestination({ destinationUrl: 'https://www.example-store.com/shop' });
  assert.strictEqual(dWeb.destinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(dWeb.confidence, 'HIGH');
  assert.strictEqual(dWeb.reasonCode, 'VISIBLE_EXTERNAL_DESTINATION');

  // INSTANT_FORM
  const dForm = classifyDestination({ destinationUrl: 'https://fb.com/lead_gen/123456789' });
  assert.strictEqual(dForm.destinationType, 'INSTANT_FORM');
  assert.strictEqual(dForm.confidence, 'HIGH');
  assert.strictEqual(dForm.reasonCode, 'EXPLICIT_INSTANT_FORM_SIGNAL');

  // MESSAGING
  const dMsg = classifyDestination({ destinationUrl: 'https://wa.me/8801700000000' });
  assert.strictEqual(dMsg.destinationType, 'MESSAGING');
  assert.strictEqual(dMsg.confidence, 'HIGH');
  assert.strictEqual(dMsg.reasonCode, 'EXPLICIT_MESSAGING_SIGNAL');

  // CALL
  const dCall = classifyDestination({ destinationUrl: 'tel:+1234567890' });
  assert.strictEqual(dCall.destinationType, 'CALL');
  assert.strictEqual(dCall.confidence, 'HIGH');
  assert.strictEqual(dCall.reasonCode, 'EXPLICIT_CALL_SIGNAL');

  // APP
  const dApp = classifyDestination({ destinationUrl: 'https://play.google.com/store/apps/details?id=com.app' });
  assert.strictEqual(dApp.destinationType, 'APP');
  assert.strictEqual(dApp.confidence, 'HIGH');
  assert.strictEqual(dApp.reasonCode, 'EXPLICIT_APP_SIGNAL');

  // OTHER
  const dOther = classifyDestination({ destinationUrl: 'https://www.facebook.com/events/123456' });
  assert.strictEqual(dOther.destinationType, 'OTHER');
  assert.strictEqual(dOther.confidence, 'MEDIUM');
  assert.strictEqual(dOther.reasonCode, 'INTERNAL_PAGE_DESTINATION');

  // UNKNOWN
  const dUnknown = classifyDestination({ destinationUrl: '' });
  assert.strictEqual(dUnknown.destinationType, 'UNKNOWN');
  assert.strictEqual(dUnknown.confidence, 'NONE');
  assert.strictEqual(dUnknown.reasonCode, 'DESTINATION_NOT_OBSERVED');

  // NO_VISIBLE_DESTINATION
  const dNone = classifyDestination({ hasNoDestination: true });
  assert.strictEqual(dNone.destinationType, 'NO_VISIBLE_DESTINATION');
  assert.strictEqual(dNone.confidence, 'HIGH');
  assert.strictEqual(dNone.reasonCode, 'DESTINATION_NOT_OBSERVED');
});

// --------------------------------------------------------------------------
// 2. Missing CTA text
// --------------------------------------------------------------------------
runGate(2, 'Missing CTA text yields UNKNOWN with status MISSING and confidence NONE', () => {
  const resEmpty = classifyCta('');
  assert.strictEqual(resEmpty.ctaType, 'UNKNOWN');
  assert.strictEqual(resEmpty.status, 'MISSING');
  assert.strictEqual(resEmpty.confidence, 'NONE');
  assert.strictEqual(resEmpty.reasonCode, 'CTA_TEXT_MISSING');
  assert.strictEqual(resEmpty.rawCtaText, undefined);

  const resUndef = classifyCta(undefined);
  assert.strictEqual(resUndef.ctaType, 'UNKNOWN');
  assert.strictEqual(resUndef.status, 'MISSING');
  assert.strictEqual(resUndef.confidence, 'NONE');

  const resWhitespace = classifyCta('   \t\n  ');
  assert.strictEqual(resWhitespace.ctaType, 'UNKNOWN');
  assert.strictEqual(resWhitespace.status, 'MISSING');
  assert.strictEqual(resWhitespace.confidence, 'NONE');
});

// --------------------------------------------------------------------------
// 3. Unknown or unsupported CTA text
// --------------------------------------------------------------------------
runGate(3, 'Unknown or unsupported CTA text preserves raw text and maps to OTHER/UNSUPPORTED', () => {
  const res = classifyCta('Claim Your Scratch Card Bonus');
  assert.strictEqual(res.ctaType, 'OTHER');
  assert.strictEqual(res.status, 'UNSUPPORTED');
  assert.strictEqual(res.confidence, 'LOW');
  assert.strictEqual(res.rawCtaText, 'Claim Your Scratch Card Bonus');
  assert.strictEqual(res.originalCtaText, 'Claim Your Scratch Card Bonus');
  assert.strictEqual(res.normalizedText, 'Claim Your Scratch Card Bonus');
  assert.strictEqual(res.reasonCode, 'CTA_TEXT_OTHER');
});

// --------------------------------------------------------------------------
// 4. Missing destination URL
// --------------------------------------------------------------------------
runGate(4, 'Missing destination URL does not infer website absence or invent positive classification', () => {
  // SHOP_NOW without destination URL
  const resShop = classifyDestination({ ctaText: 'Shop Now' });
  assert.strictEqual(resShop.destinationType, 'UNKNOWN');
  assert.strictEqual(resShop.confidence, 'LOW');
  assert.strictEqual(resShop.reasonCode, 'INSUFFICIENT_DESTINATION_EVIDENCE');

  // LEARN_MORE without destination URL
  const resLearn = classifyDestination({ ctaText: 'Learn More' });
  assert.strictEqual(resLearn.destinationType, 'UNKNOWN');
  assert.strictEqual(resLearn.confidence, 'LOW');
  assert.strictEqual(resLearn.reasonCode, 'INSUFFICIENT_DESTINATION_EVIDENCE');

  // No CTA, no URL
  const resNone = classifyDestination({});
  assert.strictEqual(resNone.destinationType, 'UNKNOWN');
  assert.strictEqual(resNone.confidence, 'NONE');
  assert.strictEqual(resNone.reasonCode, 'DESTINATION_NOT_OBSERVED');
});

// --------------------------------------------------------------------------
// 5. Malformed URL
// --------------------------------------------------------------------------
runGate(5, 'Malformed destination URLs are safely handled without throwing and classified UNKNOWN', () => {
  const badUrls = [
    'ht tp://broken-domain',
    'javascript:void(0)',
    'data:text/html,<div>test</div>',
    'about:blank',
    'http://:::invalid-port',
    'https://',
    'not_a_valid_url_at_all',
    'https://.com'
  ];

  for (const url of badUrls) {
    const res = classifyDestination({ destinationUrl: url });
    assert.strictEqual(res.destinationType, 'UNKNOWN');
    assert.strictEqual(res.confidence, 'NONE');
    assert.strictEqual(res.reasonCode, 'MALFORMED_DESTINATION_URL');
  }
});

// --------------------------------------------------------------------------
// 6. External website versus Meta instant form
// --------------------------------------------------------------------------
runGate(6, 'External website versus Meta instant form are strictly separated', () => {
  const extRes = classifyDestination({
    ctaText: 'Sign Up',
    destinationUrl: 'https://mycrm.com/register?ref=meta'
  });
  assert.strictEqual(extRes.destinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(extRes.reasonCode, 'VISIBLE_EXTERNAL_DESTINATION');

  const formRes1 = classifyDestination({
    ctaText: 'Sign Up',
    destinationUrl: 'https://www.facebook.com/lead_gen/9988776655'
  });
  assert.strictEqual(formRes1.destinationType, 'INSTANT_FORM');
  assert.strictEqual(formRes1.reasonCode, 'EXPLICIT_INSTANT_FORM_SIGNAL');

  const formRes2 = classifyDestination({
    ctaText: 'Sign Up',
    hasLeadFormSignal: true
  });
  assert.strictEqual(formRes2.destinationType, 'INSTANT_FORM');
  assert.strictEqual(formRes2.reasonCode, 'EXPLICIT_INSTANT_FORM_SIGNAL');
});

// --------------------------------------------------------------------------
// 7. Messaging versus call versus app destinations
// --------------------------------------------------------------------------
runGate(7, 'Messaging, call, and app destinations are correctly resolved via protocols and domains', () => {
  // Messaging via WhatsApp domain
  const resWa = classifyDestination({ destinationUrl: 'https://wa.me/123456789' });
  assert.strictEqual(resWa.destinationType, 'MESSAGING');

  // Messaging via m.me Messenger domain
  const resMme = classifyDestination({ destinationUrl: 'https://m.me/supportpage' });
  assert.strictEqual(resMme.destinationType, 'MESSAGING');

  // Messaging via scheme protocol
  const resSms = classifyDestination({ destinationUrl: 'sms:+1234567890' });
  assert.strictEqual(resSms.destinationType, 'MESSAGING');

  // Call via scheme protocol
  const resTel = classifyDestination({ destinationUrl: 'tel:+19876543210' });
  assert.strictEqual(resTel.destinationType, 'CALL');

  // App via Google Play
  const resGPlay = classifyDestination({ destinationUrl: 'https://play.google.com/store/apps/details?id=com.test' });
  assert.strictEqual(resGPlay.destinationType, 'APP');

  // App via Apple App Store
  const resApple = classifyDestination({ destinationUrl: 'https://apps.apple.com/us/app/id9999999' });
  assert.strictEqual(resApple.destinationType, 'APP');

  // App via market: scheme
  const resMarket = classifyDestination({ destinationUrl: 'market://details?id=com.test' });
  assert.strictEqual(resMarket.destinationType, 'APP');
});

// --------------------------------------------------------------------------
// 8. CTA text that conflicts with observed destination evidence
// --------------------------------------------------------------------------
runGate(8, 'Conflicting CTA and destination signals are flagged and not assigned false certainty', () => {
  // App store link with CALL_NOW CTA
  const res1 = classifyDestination({
    ctaText: 'Call Now',
    destinationUrl: 'https://play.google.com/store/apps/details?id=com.app'
  });
  assert.strictEqual(res1.destinationType, 'OTHER');
  assert.strictEqual(res1.confidence, 'LOW');
  assert.strictEqual(res1.reasonCode, 'CONFLICTING_DESTINATION_SIGNALS');

  // Telephone URI with DOWNLOAD CTA
  const res2 = classifyDestination({
    ctaText: 'Install Now',
    destinationUrl: 'tel:+1234567890'
  });
  assert.strictEqual(res2.destinationType, 'OTHER');
  assert.strictEqual(res2.confidence, 'LOW');
  assert.strictEqual(res2.reasonCode, 'CONFLICTING_DESTINATION_SIGNALS');

  // Ad marked with no destination signal, yet URL is present
  const res3 = classifyDestination({
    hasNoDestination: true,
    destinationUrl: 'https://example.com'
  });
  assert.strictEqual(res3.destinationType, 'UNKNOWN');
  assert.strictEqual(res3.confidence, 'LOW');
  assert.strictEqual(res3.reasonCode, 'CONFLICTING_DESTINATION_SIGNALS');
});

// --------------------------------------------------------------------------
// 9. CTA and destination fields remaining independent
// --------------------------------------------------------------------------
runGate(9, 'CTA and destination classifications remain completely decoupled and independent', () => {
  // Test pair A: "Learn More" leading to WhatsApp
  const ctaA = classifyCta('Learn More');
  const destA = classifyDestination({ ctaText: 'Learn More', destinationUrl: 'https://wa.me/880190000000' });
  assert.strictEqual(ctaA.ctaType, 'LEARN_MORE');
  assert.strictEqual(destA.destinationType, 'MESSAGING');

  // Test pair B: "Send Message" leading to External Website
  const ctaB = classifyCta('Send Message');
  const destB = classifyDestination({ ctaText: 'Send Message', destinationUrl: 'https://www.support-hub.com' });
  assert.strictEqual(ctaB.ctaType, 'SEND_MESSAGE');
  assert.strictEqual(destB.destinationType, 'EXTERNAL_WEBSITE');

  // Test pair C: "Shop Now" leading to App Store
  const ctaC = classifyCta('Shop Now');
  const destC = classifyDestination({ ctaText: 'Shop Now', destinationUrl: 'https://apps.apple.com/app/123' });
  assert.strictEqual(ctaC.ctaType, 'SHOP_NOW');
  assert.strictEqual(destC.destinationType, 'APP');

  // Test pair D: Missing CTA but valid external website
  const ctaD = classifyCta('');
  const destD = classifyDestination({ destinationUrl: 'https://acme.org' });
  assert.strictEqual(ctaD.ctaType, 'UNKNOWN');
  assert.strictEqual(destD.destinationType, 'EXTERNAL_WEBSITE');
});

// --------------------------------------------------------------------------
// 10. URL-to-ad association integrity
// --------------------------------------------------------------------------
runGate(10, 'URL-to-ad association is strictly preserved per ad creative in aggregated leads', () => {
  const candidates = [
    {
      libraryId: '100001',
      pageName: 'Omni Retail Ltd',
      ctaText: 'Shop Now',
      destinationUrl: 'https://omniretail.com/products',
      destinationDomain: 'omniretail.com'
    },
    {
      libraryId: '100002',
      pageName: 'Omni Retail Ltd',
      ctaText: 'Call Now',
      destinationUrl: 'tel:+8801700000001',
      destinationDomain: undefined
    },
    {
      libraryId: '100003',
      pageName: 'Omni Retail Ltd',
      ctaText: 'Send Message',
      destinationUrl: 'https://wa.me/8801700000002',
      destinationDomain: 'wa.me'
    }
  ];

  const leads = aggregateCandidatesToLeads(candidates, 'BD').leads;
  assert.strictEqual(leads.length, 1);
  const lead = leads[0];

  assert.strictEqual(lead.adEvidence.length, 3);
  assert.strictEqual(lead.adEvidence[0].libraryId, '100001');
  assert.strictEqual(lead.adEvidence[0].destinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(lead.adEvidence[0].destinationUrl, 'https://omniretail.com/products');

  assert.strictEqual(lead.adEvidence[1].libraryId, '100002');
  assert.strictEqual(lead.adEvidence[1].destinationType, 'CALL');
  assert.strictEqual(lead.adEvidence[1].destinationUrl, 'tel:+8801700000001');

  assert.strictEqual(lead.adEvidence[2].libraryId, '100003');
  assert.strictEqual(lead.adEvidence[2].destinationType, 'MESSAGING');
  assert.strictEqual(lead.adEvidence[2].destinationUrl, 'https://wa.me/8801700000002');
});

// --------------------------------------------------------------------------
// 11. Configured CTA filter behavior
// --------------------------------------------------------------------------
runGate(11, 'Configured CTA requirements strictly gate qualification and aggregation', () => {
  const intentCallOnly = compileResearchIntent({
    targetNiches: ['plumbing'],
    targetCountryCode: 'BD',
    strictLocalMode: false,
    requiredCtaTypes: ['CALL_NOW']
  });

  const matchingCand = [
    {
      libraryId: '200001',
      pageName: 'Dhaka Emergency Plumbing',
      adText: 'Professional plumbing services in Dhaka',
      ctaText: 'Call Now',
      destinationUrl: 'tel:+8801700000000',
      phoneNumbers: ['+8801700000000']
    }
  ];
  const nonMatchingCand = [
    {
      libraryId: '200002',
      pageName: 'Dhaka Plumbing Supplies',
      adText: 'Order plumbing pipes online',
      ctaText: 'Shop Now',
      destinationUrl: 'https://dhakaplumbing.com',
      destinationDomain: 'dhakaplumbing.com',
      phoneNumbers: ['+8801700000000']
    }
  ];

  const leadsMatch = aggregateCandidatesToLeads(matchingCand, intentCallOnly).leads;
  assert.strictEqual(leadsMatch.length, 1);
  assert.strictEqual(leadsMatch[0].primaryCtaType, 'CALL_NOW');

  const leadsNonMatch = aggregateCandidatesToLeads(nonMatchingCand, intentCallOnly).leads;
  assert.strictEqual(leadsNonMatch.length, 0);
});

// --------------------------------------------------------------------------
// 12. Configured destination filter behavior
// --------------------------------------------------------------------------
runGate(12, 'Configured destination requirements strictly filter non-matching leads', () => {
  const intentWebOnly = compileResearchIntent({
    targetNiches: ['furniture'],
    targetCountryCode: 'BD',
    strictLocalMode: false,
    requiredDestinationTypes: ['EXTERNAL_WEBSITE']
  });

  const webCand = [
    {
      libraryId: '300001',
      pageName: 'Dhaka Furniture Hub',
      adText: 'Modern living room furniture collections',
      ctaText: 'Shop Now',
      destinationUrl: 'https://dhakafurniture.com',
      destinationDomain: 'dhakafurniture.com',
      phoneNumbers: ['+8801700000001']
    }
  ];
  const msgCand = [
    {
      libraryId: '300002',
      pageName: 'Dhaka Custom Furniture',
      adText: 'Custom wooden furniture catalog',
      ctaText: 'Send Message',
      destinationUrl: 'https://wa.me/8801700000002',
      destinationDomain: 'wa.me',
      phoneNumbers: ['+8801700000002']
    }
  ];

  const leadsWeb = aggregateCandidatesToLeads(webCand, intentWebOnly).leads;
  assert.strictEqual(leadsWeb.length, 1);
  assert.strictEqual(leadsWeb[0].primaryDestinationType, 'EXTERNAL_WEBSITE');

  const leadsMsg = aggregateCandidatesToLeads(msgCand, intentWebOnly).leads;
  assert.strictEqual(leadsMsg.length, 0);
});

// --------------------------------------------------------------------------
// 13. Unknown/unassessed evidence failing closed when a condition is required
// --------------------------------------------------------------------------
runGate(13, 'Unknown/unassessed CTA or destination evidence fails closed when required', () => {
  const uncertainLead = {
    name: 'Uncertain Advertiser',
    adLibraryIds: ['400001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'UNKNOWN',
    observedCtaTypes: ['UNKNOWN'],
    primaryDestinationType: 'UNKNOWN',
    observedDestinationTypes: ['UNKNOWN'],
    websiteState: 'unknown'
  };

  // Require specific CTA
  const resCtaReq = evaluateLeadQualificationGates(uncertainLead, {
    requiredCtaTypes: ['CONTACT_US']
  });
  assert.strictEqual(resCtaReq.isQualified, false);
  assert.ok(resCtaReq.failedGates.includes('GATE_CTA'));

  // Require specific Destination
  const resDestReq = evaluateLeadQualificationGates(uncertainLead, {
    requiredDestinationTypes: ['EXTERNAL_WEBSITE']
  });
  assert.strictEqual(resDestReq.isQualified, false);
  assert.ok(resDestReq.failedGates.includes('GATE_DESTINATION'));
});

// --------------------------------------------------------------------------
// 14. Qualification reason generation
// --------------------------------------------------------------------------
runGate(14, 'Qualification gates generate explicit, traceable reason messages', () => {
  const lead = {
    name: 'No Web Shop',
    adLibraryIds: ['500001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'SHOP_NOW',
    observedCtaTypes: ['SHOP_NOW'],
    primaryDestinationType: 'UNKNOWN',
    observedDestinationTypes: ['UNKNOWN'],
    websiteState: 'unknown'
  };

  const res = evaluateLeadQualificationGates(lead, {
    requiredDestinationTypes: ['EXTERNAL_WEBSITE']
  });
  assert.strictEqual(res.isQualified, false);
  assert.ok(res.failedGates.includes('GATE_DESTINATION'));
  const hasDestReason = res.reasons.some(r => r.includes('do not satisfy required destination types: EXTERNAL_WEBSITE'));
  assert.ok(hasDestReason, `Expected destination mismatch explanation, got: ${JSON.stringify(res.reasons)}`);
});

// --------------------------------------------------------------------------
// 15. Storage and recovery persistence
// --------------------------------------------------------------------------
runGate(15, 'Storage rehydration and normalization preserve full CTA and destination evidence', () => {
  const rawStored = {
    id: 'stored_001',
    name: 'Persisted Retailer',
    adLibraryIds: ['600001'],
    destinationUrl: 'https://persisted-retailer.com',
    destinationDomain: 'persisted-retailer.com',
    sampleCta: 'Shop Now',
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED'
  };

  const normalized = normalizeStoredLead(rawStored);
  assert.strictEqual(normalized.primaryCtaType, 'SHOP_NOW');
  assert.strictEqual(normalized.primaryDestinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(normalized.adEvidence.length, 1);
  assert.strictEqual(normalized.adEvidence[0].normalizedCtaText, 'Shop Now');
  assert.strictEqual(normalized.adEvidence[0].ctaStatus, 'CLASSIFIED');
  assert.strictEqual(normalized.adEvidence[0].ctaConfidence, 'HIGH');
  assert.strictEqual(normalized.adEvidence[0].destinationType, 'EXTERNAL_WEBSITE');
});

// --------------------------------------------------------------------------
// 16. Export field integrity
// --------------------------------------------------------------------------
runGate(16, 'CSV export preserves classification columns and protects against formula injection', () => {
  const lead = {
    id: 'lead_export_1',
    name: '=CMD() Injected Store',
    canonicalName: 'Injected Store',
    status: 'QUALIFIED',
    relevanceDecision: 'RELEVANT',
    relevanceScore: 0.95,
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'LEARN_MORE',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    destinationConfidence: 'HIGH',
    destinationReasonCode: 'VISIBLE_EXTERNAL_DESTINATION',
    destinationUrl: 'https://clean-dest.com',
    destinationDomain: 'clean-dest.com',
    websiteState: 'found',
    sampleCta: '+Special Offer CTA',
    adCount: 1,
    activeAdCount: 1,
    adLibraryIds: ['700001'],
    discoveredAt: new Date().toISOString()
  };

  const csv = exportLeadsToCsv([lead], { qualifiedOnly: true });
  const lines = csv.split('\r\n').filter(l => !l.startsWith('#') && l.trim().length > 0);
  assert.ok(lines.length >= 2, 'CSV must have header and at least one data row');

  const headerLine = lines[0];
  assert.ok(headerLine.includes('CTA Type'));
  assert.ok(headerLine.includes('Destination Type'));
  assert.ok(headerLine.includes('Destination Confidence'));
  assert.ok(headerLine.includes('Destination Reason'));

  const dataRow = lines[1];
  // Verify formula injection sanitization prefix (')
  assert.ok(dataRow.includes("''=CMD() Injected Store") || dataRow.includes("'=CMD()"), 'Formula = must be sanitized');
  assert.ok(dataRow.includes("''+Special Offer CTA") || dataRow.includes("'+Special"), 'Formula + must be sanitized');
  assert.ok(dataRow.includes('LEARN_MORE'));
  assert.ok(dataRow.includes('EXTERNAL_WEBSITE'));
});

// --------------------------------------------------------------------------
// 17. Backward compatibility with existing stored records
// --------------------------------------------------------------------------
runGate(17, 'Legacy records and legacy APP_STORE enum map cleanly to canonical schema', () => {
  // Legacy record with missing adEvidence
  const legacyRecord = {
    id: 'legacy_999',
    name: 'Old Format Lead',
    destinationUrl: 'https://oldstore.com',
    primaryCtaType: 'SIGN_UP',
    primaryDestinationType: 'EXTERNAL_WEBSITE'
  };

  const rehydrated = normalizeStoredLead(legacyRecord);
  assert.strictEqual(rehydrated.primaryCtaType, 'SIGN_UP');
  assert.strictEqual(rehydrated.primaryDestinationType, 'EXTERNAL_WEBSITE');
  assert.strictEqual(rehydrated.websiteState, 'found');

  // Legacy APP_STORE qualification mapping
  const appLead = {
    name: 'Mobile App Lead',
    adLibraryIds: ['800001'],
    relevanceDecision: 'RELEVANT',
    geographicClassification: 'LOCAL_VERIFIED',
    primaryCtaType: 'DOWNLOAD',
    observedCtaTypes: ['DOWNLOAD'],
    primaryDestinationType: 'APP',
    observedDestinationTypes: ['APP'],
    websiteState: 'unknown'
  };

  const resLegacy = evaluateLeadQualificationGates(appLead, {
    requiredDestinationTypes: ['APP_STORE']
  });
  assert.strictEqual(resLegacy.isQualified, true, 'Legacy APP_STORE filter must match canonical APP destination');
});

// --------------------------------------------------------------------------
// 18. No regression to geographic qualification
// --------------------------------------------------------------------------
runGate(18, 'targetCountryCode vs businessCountryCode distinction is preserved', () => {
  const geoResult = evaluateGeographicOrigin({
    pageName: 'Global Apparel Dhaka Outlet',
    destinationUrl: 'https://globalapparel.com.bd/contact',
    destinationDomain: 'globalapparel.com.bd',
    bodyCopy: 'Call +8801711223344 or visit our showroom at House 10, Road 4, Gulshan-2, Dhaka-1212, Bangladesh'
  }, 'BD');

  assert.strictEqual(geoResult.targetCountryCode, 'BD');
  assert.strictEqual(geoResult.businessCountryCode, 'BD');
  assert.strictEqual(geoResult.classification, 'LOCAL_VERIFIED');

  // Foreign advertiser targeting BD
  const foreignResult = evaluateGeographicOrigin({
    pageName: 'London Luxury Watches',
    destinationUrl: 'https://londonluxurywatches.co.uk',
    destinationDomain: 'londonluxurywatches.co.uk',
    bodyCopy: 'Shipping worldwide from London, UK'
  }, 'BD');

  assert.strictEqual(foreignResult.targetCountryCode, 'BD');
  assert.strictEqual(foreignResult.businessCountryCode, 'GB');
  assert.strictEqual(foreignResult.classification, 'FOREIGN_VERIFIED');
});

// --------------------------------------------------------------------------
// 19. No regression to safety gates
// --------------------------------------------------------------------------
runGate(19, 'Safety gates remain permanently fail-closed', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must be false');
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must be false');
});

// --------------------------------------------------------------------------
// 20. No new API, host permission, crawler, or unauthorized network dependency
// --------------------------------------------------------------------------
runGate(20, 'Zero external network dependencies, APIs, or invasive host permissions in manifest', () => {
  const manifestPath = path.join(rootDir, 'src', 'extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Verify only approved Meta Ad Library permissions
  const hostPermissions = manifest.host_permissions || [];
  for (const perm of hostPermissions) {
    assert.ok(
      perm.includes('facebook.com') || perm.includes('meta.com'),
      `Unauthorized host permission in manifest: ${perm}`
    );
  }

  // Ensure no generic <all_urls> or broad wildcard permissions
  assert.ok(!hostPermissions.includes('<all_urls>'), 'Manifest must not include <all_urls>');
  assert.ok(!hostPermissions.includes('http://*/*'), 'Manifest must not include http://*/*');
  assert.ok(!hostPermissions.includes('https://*/*'), 'Manifest must not include https://*/*');
});

// --------------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`PHASE 2 REMEDIATION REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
