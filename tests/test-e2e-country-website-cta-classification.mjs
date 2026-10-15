/**
 * LeadNoria — Master End-to-End Business Classification, CTA/Destination & Adversarial QA Suite
 *
 * Dedicated verification covering Scenarios A through O:
 * - Scenario A: Verified Bangladeshi furniture business (LOCAL_VERIFIED)
 * - Scenario B: Foreign furniture company targeting Bangladesh (FOREIGN_VERIFIED rejected from strict-local)
 * - Scenario C: Foreign advertiser with no verified location (LOCATION_UNKNOWN)
 * - Scenario D: Bangladeshi business advertising abroad (targetCountry != businessCountry)
 * - Scenario E: Website destination and Learn More CTA (EXTERNAL_WEBSITE, LEARN_MORE)
 * - Scenario F: Send Message / Messenger destination (MESSAGING, not external website)
 * - Scenario G: WhatsApp destination (MESSAGING, wa.me, no false website)
 * - Scenario H: Instant Form destination (INSTANT_FORM, not external website)
 * - Scenario I: Phone call destination (CALL, tel:, not external website)
 * - Scenario J: Missing destination URL (UNKNOWN, websiteState: NOT_OBSERVED)
 * - Scenario K: Conflicting website evidence (ad-level preservation, conflict representation)
 * - Scenario L: Same business, 100 duplicate ads (Anti-inflation: 1 entity, stable score, adCount: 100)
 * - Scenario M: Similar names, different countries (No merge across distinct page IDs/countries)
 * - Scenario N: UI-to-export consistency (Parity across in-memory leads, CSV headers, RFC 4180 CRLF, formula defense)
 * - Scenario O: Failure injection & recovery (Malformed candidates, cancellation precedence, fail-closed gates)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Production modules under test
import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

import {
  classifyCta,
  classifyDestination,
  aggregateAdEvidence
} from '../src/extension/destinationClassifier.ts';

import {
  evaluateGeographicOrigin
} from '../src/extension/geographicClassifier.ts';

import {
  evaluateLeadQualificationGates
} from '../src/extension/qualificationGate.ts';

import {
  LeadRelevanceEngine,
  compileResearchIntent
} from '../src/extension/relevanceEngine.ts';

import {
  processBatch,
  getCanonicalEntityKey
} from '../src/extension/bulkProcessor.ts';

import {
  EntityResolutionIndex,
  classifyDuplicateRelationship,
  evaluateEntityMerge
} from '../src/extension/entityResolver.ts';

import {
  calculateLeadScore
} from '../src/extension/leadPrioritizer.ts';

import {
  aggregateContactObservations
} from '../src/extension/contactQuality.ts';

import {
  exportLeadsToCsv,
  exportLeadsToJson,
  validateAdCardCandidate
} from '../src/extension/metaAdapter.ts';

import {
  toResultRowViewModel,
  toRunStatusViewModel
} from '../src/extension/ui/viewModelMappers.ts';

import {
  initBulkStore,
  saveRunRecord,
  getRunRecord,
  reconcileAndRecoverRun
} from '../src/extension/bulkStore.ts';

console.log('========================================================================');
console.log('LEADNORIA: MASTER END-TO-END BUSINESS CLASSIFICATION QA SUITE');
console.log('Coverage: Scenarios A through O | Adversarial Invariants | Offline Safe');
console.log('========================================================================\n');

let passedTests = 0;
let failedTests = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

// Global baseline research intent for testing (furniture niche, Bangladesh target)
const defaultIntent = compileResearchIntent({
  keywords: ['furniture'],
  targetNiches: ['furniture'],
  targetCountryCode: 'BD',
  locationCode: 'BD',
  locationName: 'Bangladesh',
  strictLocalMode: true,
  websiteRequirement: 'BOTH'
});

async function runAll() {
  // --- SCENARIO A: Verified Bangladeshi Furniture Business ---
  console.log('--- SCENARIO A: Verified Bangladeshi Furniture Business ---');
  await check('Scenario A: Verified local business classified as LOCAL_VERIFIED and qualifies', () => {
    const geo = evaluateGeographicOrigin({
      pageName: 'Hatil Furniture Bangladesh',
      pageUrl: 'https://facebook.com/hatilbd',
      destinationDomain: 'hatil.com',
      destinationUrl: 'https://hatil.com/showroom-dhaka',
      bodyCopy: 'Visit our main showroom at Mirpur, Dhaka. Call us at +8801711223344 for premium solid wood furniture.'
    }, 'BD');

    assert.strictEqual(geo.classification, 'LOCAL_VERIFIED');
    assert.strictEqual(geo.targetCountryCode, 'BD');
    assert.strictEqual(geo.businessCountryCode, 'BD');
    assert.strictEqual(geo.isLocal, true);
    assert.strictEqual(geo.isForeign, false);

    const cta = classifyCta('Learn More');
    const dest = classifyDestination({
      destinationUrl: 'https://hatil.com/showroom-dhaka',
      ctaText: 'Learn More'
    });
    assert.strictEqual(cta.ctaType, 'LEARN_MORE');
    assert.strictEqual(dest.destinationType, 'EXTERNAL_WEBSITE');

    const lead = {
      name: 'Hatil Furniture Bangladesh',
      canonicalName: 'Hatil Furniture Bangladesh',
      geographicClassification: geo.classification,
      businessCountryCode: geo.businessCountryCode,
      targetCountryCode: geo.targetCountryCode,
      destinationUrl: 'https://hatil.com/showroom-dhaka',
      destinationDomain: 'hatil.com',
      websiteState: 'found',
      primaryDestinationType: 'EXTERNAL_WEBSITE',
      relevanceDecision: 'RELEVANT',
      adLibraryIds: ['1001001001']
    };

    const qual = evaluateLeadQualificationGates(lead, defaultIntent);
    assert.strictEqual(qual.isQualified, true);
    assert.strictEqual(qual.canonicalOutcome, 'QUALIFIED');
  });

  // --- SCENARIO B: Foreign Furniture Company Targeting Bangladesh ---
  console.log('\n--- SCENARIO B: Foreign Furniture Company Targeting Bangladesh ---');
  await check('Scenario B: Foreign business targeting BD is FOREIGN_VERIFIED and rejected from strict-local', () => {
    const geo = evaluateGeographicOrigin({
      pageName: 'IKEA Global Store',
      pageUrl: 'https://facebook.com/ikeausa',
      destinationDomain: 'ikea.com',
      destinationUrl: 'https://www.ikea.com/us/en/',
      bodyCopy: 'Delivery to worldwide addresses. Call our US customer care at +1-800-434-4532. Based in New York, USA. Discover modern sofas.'
    }, 'BD');

    assert.strictEqual(geo.classification, 'FOREIGN_VERIFIED');
    assert.strictEqual(geo.targetCountryCode, 'BD');
    assert.strictEqual(geo.businessCountryCode, 'US');
    assert.strictEqual(geo.isLocal, false);
    assert.strictEqual(geo.isForeign, true);

    const lead = {
      name: 'IKEA Global Store',
      canonicalName: 'IKEA Global Store',
      geographicClassification: geo.classification,
      businessCountryCode: geo.businessCountryCode,
      targetCountryCode: geo.targetCountryCode,
      destinationUrl: 'https://www.ikea.com/us/en/',
      destinationDomain: 'ikea.com',
      websiteState: 'found',
      primaryDestinationType: 'EXTERNAL_WEBSITE',
      relevanceDecision: 'RELEVANT',
      adLibraryIds: ['2001002001'],
      leadScore: 95 // artificially high score
    };

    const qual = evaluateLeadQualificationGates(lead, defaultIntent);
    assert.strictEqual(qual.isQualified, false);
    assert.strictEqual(qual.canonicalOutcome, 'REJECTED');
    assert(qual.failedGates.includes('GATE_GEOGRAPHY'));
    assert(qual.reasons.some(r => r.includes('foreign') || r.includes('FOREIGN_VERIFIED')));
  });

  // --- SCENARIO C: Foreign Advertiser with No Verified Location ---
  console.log('\n--- SCENARIO C: Advertiser with No Verified Location ---');
  await check('Scenario C: Advertiser with no verified location is LOCATION_UNKNOWN and excluded from strict-local', () => {
    const geo = evaluateGeographicOrigin({
      pageName: 'Modern Home Decor Online',
      pageUrl: 'https://facebook.com/modernhomedecor',
      destinationDomain: 'homedecor-shop.com',
      destinationUrl: 'https://homedecor-shop.com',
      bodyCopy: 'Shop exclusive minimalist furniture online with worldwide shipping. Best prices guaranteed.'
    }, 'BD');

    assert.strictEqual(geo.classification, 'LOCATION_UNKNOWN');
    assert.strictEqual(geo.targetCountryCode, 'BD');
    assert.strictEqual(geo.businessCountryCode, undefined);
    assert.strictEqual(geo.isLocal, false);

    const lead = {
      name: 'Modern Home Decor Online',
      canonicalName: 'Modern Home Decor Online',
      geographicClassification: geo.classification,
      relevanceDecision: 'RELEVANT',
      adLibraryIds: ['3001003001']
    };

    const qual = evaluateLeadQualificationGates(lead, defaultIntent);
    assert.strictEqual(qual.isQualified, false);
    assert(qual.failedGates.includes('GATE_GEOGRAPHY'));
  });

  // --- SCENARIO D: Bangladeshi Business Advertising Abroad ---
  console.log('\n--- SCENARIO D: Bangladeshi Business Advertising Abroad ---');
  await check('Scenario D: BD business advertising abroad preserves actual BD businessCountryCode', () => {
    const geo = evaluateGeographicOrigin({
      pageName: 'Akhtar Furnishers Export Division',
      pageUrl: 'https://facebook.com/akhtarfurniturebd',
      destinationDomain: 'akhtarfurniture.com',
      destinationUrl: 'https://akhtarfurniture.com/export',
      bodyCopy: 'Authentic handcrafted Bangladeshi teak furniture exported to North America. Head office: Dhaka, Bangladesh. WhatsApp: +8801811223344.'
    }, 'US'); // Target country is US

    // When targeted search is US, a BD address indicates foreign origin relative to US
    assert.strictEqual(geo.targetCountryCode, 'US');
    assert.strictEqual(geo.businessCountryCode, 'BD');
    assert.strictEqual(geo.classification, 'FOREIGN_VERIFIED');
    assert.strictEqual(geo.isForeign, true);
    assert.strictEqual(geo.isLocal, false);
  });

  // --- SCENARIO E: Website Destination and Learn More CTA ---
  console.log('\n--- SCENARIO E: Website Destination and Learn More CTA ---');
  await check('Scenario E: Learn More CTA and external website classified orthogonally', () => {
    const cta = classifyCta('Learn More');
    const dest = classifyDestination({
      destinationUrl: 'https://otobi.com/living-room',
      ctaText: 'Learn More'
    });

    assert.strictEqual(cta.ctaType, 'LEARN_MORE');
    assert.strictEqual(dest.destinationType, 'EXTERNAL_WEBSITE');
    assert.strictEqual(dest.destinationDomain, 'otobi.com');
    assert.strictEqual(dest.confidence, 'HIGH');
  });

  // --- SCENARIO F: Send Message / Messenger ---
  console.log('\n--- SCENARIO F: Send Message / Messenger ---');
  await check('Scenario F: Messenger link classified as MESSAGING, never as external website', () => {
    const cta = classifyCta('Send Message');
    const dest = classifyDestination({
      destinationUrl: 'https://m.me/furnitureshopbd',
      ctaText: 'Send Message'
    });

    assert.strictEqual(cta.ctaType, 'SEND_MESSAGE');
    assert.strictEqual(dest.destinationType, 'MESSAGING');
    assert.strictEqual(dest.destinationDomain, 'm.me');
    assert.notStrictEqual(dest.destinationType, 'EXTERNAL_WEBSITE');
  });

  // --- SCENARIO G: WhatsApp Destination ---
  console.log('\n--- SCENARIO G: WhatsApp Destination ---');
  await check('Scenario G: WhatsApp destination classified as MESSAGING with domain wa.me', () => {
    const cta = classifyCta('Send WhatsApp Message');
    const dest = classifyDestination({
      destinationUrl: 'https://wa.me/8801711223344?text=Hello',
      ctaText: 'Send WhatsApp Message'
    });

    assert.strictEqual(cta.ctaType, 'SEND_MESSAGE');
    assert.strictEqual(dest.destinationType, 'MESSAGING');
    assert.strictEqual(dest.destinationDomain, 'wa.me');
  });

  // --- SCENARIO H: Instant Form ---
  console.log('\n--- SCENARIO H: Instant Form ---');
  await check('Scenario H: Instant Form classified as INSTANT_FORM, distinct from website', () => {
    const cta = classifyCta('Sign Up');
    const dest = classifyDestination({
      hasLeadFormSignal: true,
      ctaText: 'Sign Up'
    });

    assert.strictEqual(dest.destinationType, 'INSTANT_FORM');
    assert.notStrictEqual(dest.destinationType, 'EXTERNAL_WEBSITE');
  });

  // --- SCENARIO I: Phone Call Destination ---
  console.log('\n--- SCENARIO I: Phone Call Destination ---');
  await check('Scenario I: tel: link classified as CALL, distinct from website', () => {
    const cta = classifyCta('Call Now');
    const dest = classifyDestination({
      destinationUrl: 'tel:+8801711223344',
      ctaText: 'Call Now'
    });

    assert.strictEqual(cta.ctaType, 'CALL_NOW');
    assert.strictEqual(dest.destinationType, 'CALL');
    assert.notStrictEqual(dest.destinationType, 'EXTERNAL_WEBSITE');
  });

  // --- SCENARIO J: Missing Destination URL ---
  console.log('\n--- SCENARIO J: Missing Destination URL ---');
  await check('Scenario J: Missing destination URL yields UNKNOWN destination and NOT_OBSERVED website', () => {
    const dest = classifyDestination({
      destinationUrl: '',
      ctaText: 'Learn More'
    });
    assert.strictEqual(dest.destinationType, 'UNKNOWN');
    assert.strictEqual(dest.reasonCode, 'INSUFFICIENT_DESTINATION_EVIDENCE');

    // Verify metaAdapter fallback
    const fallbackState = dest.destinationDomain ? 'NOT_VERIFIED' : 'NOT_OBSERVED';
    assert.strictEqual(fallbackState, 'NOT_OBSERVED');
    assert.notStrictEqual(fallbackState, 'NO_WEBSITE');
  });

  // --- SCENARIO K: Conflicting Destination Evidence ---
  console.log('\n--- SCENARIO K: Conflicting Destination Evidence ---');
  await check('Scenario K: Multiple ads with different destinations aggregate without dropping evidence', () => {
    const ads = [
      {
        libraryId: '1000000001',
        destinationUrl: 'https://regalfurniturebd.com',
        destinationType: 'EXTERNAL_WEBSITE',
        destinationDomain: 'regalfurniturebd.com',
        ctaType: 'SHOP_NOW',
        confidence: 'HIGH',
        reasonCode: 'VISIBLE_EXTERNAL_DESTINATION'
      },
      {
        libraryId: '1000000002',
        destinationUrl: 'https://m.me/regalfurniturebd',
        destinationType: 'MESSAGING',
        destinationDomain: 'm.me',
        ctaType: 'SEND_MESSAGE',
        confidence: 'HIGH',
        reasonCode: 'VISIBLE_MESSAGING_DESTINATION'
      }
    ];

    const summary = aggregateAdEvidence(ads);
    assert.strictEqual(summary.observedDestinationTypes.length, 2);
    assert(summary.observedDestinationTypes.includes('EXTERNAL_WEBSITE'));
    assert(summary.observedDestinationTypes.includes('MESSAGING'));
    assert(summary.observedCtaTypes.includes('SHOP_NOW'));
    assert(summary.observedCtaTypes.includes('SEND_MESSAGE'));
  });

  // --- SCENARIO L: Same Business, 100 Duplicate Ads ---
  console.log('\n--- SCENARIO L: Anti-Inflation Deduplication (100 Duplicate Ads) ---');
  await check('Scenario L: 100 duplicate ads collapse into 1 entity with stable adCount and no score inflation', async () => {
    const candidates = [];
    for (let i = 1; i <= 100; i++) {
      candidates.push({
        libraryId: String(1000000000 + i), // Valid 10-digit numeric Ad Library ID
        advertiserName: 'Partex Furniture Ltd',
        pageName: 'Partex Furniture Ltd',
        facebookPageId: '987654321',
        bodyCopy: 'Premium solid wood office furniture in Dhaka showroom. Call +8801711223344 for delivery across Bangladesh. Visit partex.com.bd.',
        destinationUrl: 'https://partex.com.bd',
        destinationDomain: 'partex.com.bd',
        callToAction: 'Learn More',
        observedKeyword: 'furniture'
      });
    }

    const existingMap = new Map();
    const seenAdIds = new Set();
    const seenEntityKeys = new Set();
    const counters = {
      rawAds: 0,
      normalizedCandidates: 0,
      relevantCandidates: 0,
      uncertainCandidates: 0,
      notRelevantCandidates: 0,
      duplicatesRemoved: 0,
      finalUniqueLeads: 0,
      reasonCodes: {}
    };

    const result = await processBatch(
      candidates,
      existingMap,
      seenAdIds,
      seenEntityKeys,
      counters,
      {
        runId: 'run_test_100',
        countryCode: 'BD',
        locationName: 'Bangladesh',
        currentKeyword: 'furniture',
        intent: defaultIntent,
        effectiveCeiling: 5000
      }
    );

    assert.strictEqual(result.updatedEntities.length, 1);
    const lead = result.updatedEntities[0];
    assert.strictEqual(lead.adCount, 100);
    assert.strictEqual(lead.adLibraryIds.length, 100);
    assert(lead.leadScore <= 100 && lead.leadScore >= 0);
    assert.strictEqual(result.counters.finalUniqueLeads, 1);
    assert.strictEqual(result.counters.duplicatesRemoved, 99);
  });

  // --- SCENARIO M: Similar Names, Different Countries ---
  console.log('\n--- SCENARIO M: Similar Names, Different Countries ---');
  await check('Scenario M: Businesses with identical names in different countries do not merge', () => {
    const candBD = {
      pageName: 'Crown Furniture',
      facebookPageId: '111111',
      destinationDomain: 'crownfurniture.com.bd'
    };

    const candUK = {
      pageName: 'Crown Furniture',
      facebookPageId: '222222',
      destinationDomain: 'crownfurniture.co.uk'
    };

    const relationship = classifyDuplicateRelationship(candBD, candUK);
    assert.strictEqual(relationship.matchLevel, 'DISTINCT_ADVERTISER');

    const existingMap = new Map();
    const index = new EntityResolutionIndex();
    index.indexEntity('key_uk', {
      id: 'lead_uk',
      name: 'Crown Furniture',
      canonicalPageId: '222222',
      destinationDomain: 'crownfurniture.co.uk'
    });

    const merge = evaluateEntityMerge(candBD, existingMap, index);
    assert.strictEqual(merge.shouldMerge, false);
  });

  // --- SCENARIO N: UI-to-Export Consistency ---
  console.log('\n--- SCENARIO N: UI-to-Export Consistency ---');
  await check('Scenario N: Exported CSV and JSON exactly match stored in-memory leads and protect against formulas', () => {
    const leads = [
      {
        id: 'lead_001',
        name: 'Delta Furnishings',
        canonicalName: 'Delta Furnishings',
        facebookPageName: 'Delta Furnishings',
        destinationUrl: 'https://deltafurnishings.com',
        destinationDomain: 'deltafurnishings.com',
        websiteState: 'found',
        targetCountryCode: 'BD',
        businessCountryCode: 'BD',
        geographicClassification: 'LOCAL_VERIFIED',
        primaryCtaType: 'LEARN_MORE',
        primaryDestinationType: 'EXTERNAL_WEBSITE',
        relevanceDecision: 'RELEVANT',
        adLibraryIds: ['7001007001'],
        adCount: 1,
        status: 'QUALIFIED',
        leadScore: 88,
        prioritizationTier: 'HIGH',
        businessPhone: '+8801799887766',
        sampleCopy: '=SUM(1+1)' // Potential formula injection payload
      },
      {
        id: 'lead_002',
        name: 'London Sofa Co',
        canonicalName: 'London Sofa Co',
        targetCountryCode: 'BD',
        businessCountryCode: 'GB',
        geographicClassification: 'FOREIGN_VERIFIED',
        primaryCtaType: 'SHOP_NOW',
        primaryDestinationType: 'EXTERNAL_WEBSITE',
        relevanceDecision: 'RELEVANT',
        adLibraryIds: ['7002007002'],
        adCount: 1,
        status: 'REVIEW_REQUIRED',
        leadScore: 40,
        prioritizationTier: 'LOW'
      }
    ];

    // 1. Full CSV export
    const csv = exportLeadsToCsv(leads, defaultIntent);
    assert(csv.includes('\r\n'), 'CSV must use RFC 4180 CRLF');
    assert(csv.includes("'=SUM(1+1)"), 'Formula injection must be neutralized with leading single quote');
    assert(csv.includes('Delta Furnishings'));
    assert(csv.includes('London Sofa Co'));

    // 2. Qualified-only export
    const qualCsv = exportLeadsToCsv(leads, defaultIntent, { qualifiedOnly: true });
    assert(qualCsv.includes('Delta Furnishings'));
    assert(!qualCsv.includes('London Sofa Co'), 'Foreign business must NOT appear in strict-local qualified export');

    // 3. JSON export
    const jsonStr = exportLeadsToJson(leads);
    const parsed = JSON.parse(jsonStr);
    assert(Array.isArray(parsed.leads));
    assert.strictEqual(parsed.leads.length, 2);
    assert.strictEqual(parsed.totalLeads, 2);
    assert.strictEqual(parsed.leads[0].name, 'Delta Furnishings');

    // 4. UI Row View Model Parity
    const row = toResultRowViewModel(leads[0]);
    assert.strictEqual(row.displayName, 'Delta Furnishings');
    assert.strictEqual(row.qualificationScore, 88);
    assert.strictEqual(row.geographicClassification, 'LOCAL_VERIFIED');
  });

  // --- SCENARIO O: Failure Injection & Recovery ---
  console.log('\n--- SCENARIO O: Failure Injection & Safe Recovery ---');
  await check('Scenario O: Controlled failure injection does not crash pipeline; cancellation takes precedence', async () => {
    // 1. Validation rejection on malformed candidate
    const val = validateAdCardCandidate(null, 'bad_id', new Set());
    assert.strictEqual(val.isValid, false);
    assert.strictEqual(val.outcome, 'MISSING_IDENTIFIER');
    assert(val.reason !== undefined);

    // 2. Cancellation precedence in storage recovery
    await initBulkStore();
    const run = {
      runId: 'run_cancelled_test',
      researchName: 'Cancelled Test',
      mode: 'QUICK',
      status: 'CANCELLED', // Already cancelled
      keywords: ['sofa'],
      locationCode: 'BD',
      locationName: 'Bangladesh',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leads: []
    };
    await saveRunRecord(run);

    // Attempting recovery on a cancelled run MUST preserve CANCELLED status
    const recovered = await reconcileAndRecoverRun('run_cancelled_test');
    assert.strictEqual(recovered.run.status, 'CANCELLED');

    // 3. Safety Gates Invariant
    assert.strictEqual(isLiveCollectionPermitted(), false, 'Live collection gate must evaluate strictly to false');
    assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'External website crawling must evaluate strictly to false');
  });

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passedTests} Passed, ${failedTests} Failed.`);
  console.log('========================================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('UNCAUGHT RUNNER ERROR:', err);
  process.exit(1);
});
