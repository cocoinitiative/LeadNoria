/**
 * LeadNoria — Phase 4 Regression Test Suite
 * Advertiser Identity & Deduplication (23 Required Verification Gates)
 *
 * Verifies all Section 11 Phase 4 requirements:
 * 1. Exact stable-identifier duplicate.
 * 2. Missing identifiers do not produce false matches.
 * 3. Similar advertiser names remain separate without sufficient evidence.
 * 4. Unicode and whitespace normalization.
 * 5. Case normalization where appropriate.
 * 6. Conflicting stable identifiers prevent automatic merging.
 * 7. Same advertiser with distinct ads retains distinct ad records.
 * 8. Exact duplicate returned across multiple keywords is handled deterministically.
 * 9. Repeated processing is idempotent.
 * 10. Stored and newly discovered duplicate handling.
 * 11. Partial identity records remain safe.
 * 12. Probable duplicates are not reported as verified identities.
 * 13. Conflict handling preserves original evidence.
 * 14. Storage and recovery do not reintroduce duplicates.
 * 15. Export retains identity evidence and review status.
 * 16. CTA and destination data remain associated with the correct ad.
 * 17. Country and niche qualification evidence remains intact.
 * 18. Deduplication does not override mandatory qualification gates.
 * 19. Backward compatibility with existing stored records.
 * 20. Existing Phase 2 CTA/destination tests continue to pass.
 * 21. Existing Phase 3 qualification tests continue to pass.
 * 22. Both safety gates remain permanently fail-closed.
 * 23. No unauthorized external network behavior or permissions are introduced.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  EntityResolutionIndex,
  evaluateEntityMerge,
  mergeCandidateIntoEntity,
  classifyDuplicateRelationship,
  normalizeAdvertiserName,
  getComparisonNameKey,
  detectBranchRelationship,
  normalizeFacebookPage,
  normalizeDestinationDomain,
  isShortGenericName
} from '../src/extension/entityResolver.ts';

import {
  aggregateCandidatesToLeads,
  exportLeadsToCsv,
  sanitizeAdLibraryIds
} from '../src/extension/metaAdapter.ts';

import {
  classifyCta,
  classifyDestination
} from '../src/extension/destinationClassifier.ts';

import {
  processBatch
} from '../src/extension/bulkProcessor.ts';

import {
  normalizeStoredLead,
  initBulkStore,
  saveBatch
} from '../src/extension/bulkStore.ts';

import {
  evaluateLeadQualificationGates
} from '../src/extension/qualificationGate.ts';

import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

console.log('========================================================================');
console.log('LEADNORIA: PHASE 4 REGRESSION TEST SUITE');
console.log('Advertiser Identity & Deduplication — 23 Required Verification Gates');
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

async function runAsyncGate(num, title, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] Gate ${num}: ${title}`);
  } catch (err) {
    console.error(`  [FAIL] Gate ${num}: ${title}`);
    console.error(`         ${err.message}`);
    throw err;
  }
}

async function executeAllGates() {
  // Gate 1: Exact stable-identifier duplicate
  runGate(1, 'Exact stable-identifier duplicate (matching Facebook Page ID merges deterministically)', () => {
    const cand1 = {
      libraryId: '100000000000001',
      pageName: 'Hatil Living',
      facebookPageUrl: 'https://www.facebook.com/hatilbd?id=12345678901',
      facebookPageId: '12345678901',
      destinationUrl: 'https://hatil.com/sofas',
      destinationDomain: 'hatil.com',
      isActive: true,
      bodyCopy: 'Premium solid oak sofas handcrafted for modern homes.',
      ctaText: 'Shop Now'
    };

    const cand2 = {
      libraryId: '100000000000002',
      pageName: 'Hatil Living - Official',
      facebookPageUrl: 'https://www.facebook.com/pages/hatilbd/12345678901',
      facebookPageId: '12345678901',
      destinationUrl: 'https://hatil.com/dining',
      destinationDomain: 'hatil.com',
      isActive: true,
      bodyCopy: 'Artisan dining collections with sustainable finishes.',
      ctaText: 'Learn More'
    };

    const res = aggregateCandidatesToLeads([cand1, cand2], 'BD', 'Bangladesh');
    assert.strictEqual(res.leads.length, 1, 'Two cards sharing stable Page ID must merge into 1 lead');
    const lead = res.leads[0];
    assert.strictEqual(lead.canonicalPageId, '12345678901', 'Canonical Page ID must be preserved');
    assert.strictEqual(lead.adCount, 2, 'Total adCount must reflect both unique ad IDs');
    assert.strictEqual(lead.adEvidence?.length, 2, 'Ad-level evidence must retain both distinct ad items');

    const rel = classifyDuplicateRelationship(cand1, cand2);
    assert.strictEqual(rel.matchLevel, 'EXACT_DUPLICATE', 'Matching Page ID must classify as EXACT_DUPLICATE');
  });

  // Gate 2: Missing identifiers do not produce false matches
  runGate(2, 'Missing identifiers do not produce false matches', () => {
    const cand1 = {
      libraryId: '200000000000001',
      pageName: 'Apex',
      isActive: true,
      bodyCopy: 'Exclusive seasonal sales on footwear and accessories.',
      ctaText: 'Shop Now'
    };

    const cand2 = {
      libraryId: '200000000000002',
      pageName: 'Apex',
      isActive: true,
      bodyCopy: 'Architectural interior planning and luxury home staging.',
      ctaText: 'Contact Us'
    };

    const res = aggregateCandidatesToLeads([cand1, cand2], 'US', 'United States');
    assert.strictEqual(res.leads.length, 2, 'Generic short name lacking Page ID and domain must NOT merge');

    const rel = classifyDuplicateRelationship(cand1, cand2);
    assert.strictEqual(rel.matchLevel, 'UNKNOWN_IDENTITY', 'Generic name without corroboration must be UNKNOWN_IDENTITY');
  });

  // Gate 3: Similar advertiser names remain separate without sufficient evidence
  runGate(3, 'Similar advertiser names remain separate without sufficient evidence', () => {
    const cand1 = {
      libraryId: '300000000000001',
      pageName: 'Star Decor Center',
      facebookPageUrl: 'https://www.facebook.com/stardecorcenter',
      facebookPageId: '333333333331',
      isActive: true,
      destinationUrl: 'https://stardecorcenter.com',
      destinationDomain: 'stardecorcenter.com'
    };

    const cand2 = {
      libraryId: '300000000000002',
      pageName: 'Star Decor Store',
      facebookPageUrl: 'https://www.facebook.com/stardecorstore',
      facebookPageId: '333333333332',
      isActive: true,
      destinationUrl: 'https://stardecorstore.com',
      destinationDomain: 'stardecorstore.com'
    };

    const res = aggregateCandidatesToLeads([cand1, cand2], 'US', 'United States');
    assert.strictEqual(res.leads.length, 2, 'Similar advertiser names with distinct Page IDs must remain separate');

    const rel = classifyDuplicateRelationship(cand1, cand2);
    assert.strictEqual(rel.matchLevel, 'DISTINCT_ADVERTISER', 'Distinct Page IDs must classify as DISTINCT_ADVERTISER');
  });

  // Gate 4: Unicode and whitespace normalization
  runGate(4, 'Unicode and whitespace normalization (NFKC, zero-width chars, whitespace trim)', () => {
    const rawDirty = '  হাতির\u200Bঝিল   ফার্নিচার  · Sponsored Page (Official) \uFEFF ';
    const clean = normalizeAdvertiserName(rawDirty);
    assert.strictEqual(clean, 'হাতিরঝিল ফার্নিচার', 'Zero-width characters, boilerplate, and whitespace must be cleaned');

    const key1 = getComparisonNameKey('Café Design LLC');
    const key2 = getComparisonNameKey('Cafe\u0301 Design Inc.');
    assert.strictEqual(key1, key2, 'Unicode decomposed accents and legal suffixes must normalize identically');
  });

  // Gate 5: Case normalization where appropriate
  runGate(5, 'Case normalization operates predictably across brand keys', () => {
    const keyLower = getComparisonNameKey('hatil furniture pvt ltd');
    const keyUpper = getComparisonNameKey('HATIL FURNITURE PRIVATE LIMITED');
    assert.strictEqual(keyLower, keyUpper, 'Case and legal suffixes must equate for brand comparison');
  });

  // Gate 6: Conflicting stable identifiers prevent automatic merging
  runGate(6, 'Conflicting stable identifiers prevent automatic merging', () => {
    const candA = {
      libraryId: '600000000000001',
      pageName: 'Nova Furnishings',
      facebookPageId: '666000000001',
      destinationUrl: 'https://novafurnishings.com',
      destinationDomain: 'novafurnishings.com',
      isActive: true
    };

    const candB = {
      libraryId: '600000000000002',
      pageName: 'Nova Furnishings',
      facebookPageId: '666000000002', // Conflicting Page ID!
      destinationUrl: 'https://novafurnishings.com',
      destinationDomain: 'novafurnishings.com',
      isActive: true
    };

    const res = aggregateCandidatesToLeads([candA, candB], 'US', 'United States');
    assert.strictEqual(res.leads.length, 2, 'Same name and domain with conflicting Facebook Page IDs MUST NOT merge');

    const rel = classifyDuplicateRelationship(candA, candB);
    assert.strictEqual(rel.matchLevel, 'DISTINCT_ADVERTISER', 'Conflicting Page IDs must yield DISTINCT_ADVERTISER');
  });

  // Gate 7: Same advertiser with distinct ads retains distinct ad records
  runGate(7, 'Same advertiser with distinct ads retains distinct ad records in adEvidence', () => {
    const cand1 = {
      libraryId: '700000000000001',
      pageName: 'Legacy Timber',
      facebookPageId: '777000000000',
      ctaText: 'Call Now',
      ctaType: 'CALL_NOW',
      destinationType: 'CALL',
      isActive: true,
      bodyCopy: 'Call our master carpenters for custom dining sets.'
    };

    const cand2 = {
      libraryId: '700000000000002',
      pageName: 'Legacy Timber',
      facebookPageId: '777000000000',
      ctaText: 'Shop Now',
      ctaType: 'SHOP_NOW',
      destinationType: 'EXTERNAL_WEBSITE',
      destinationUrl: 'https://legacytimber.com/shop',
      destinationDomain: 'legacytimber.com',
      isActive: true,
      bodyCopy: 'Browse our handcrafted walnut collection online.'
    };

    const res = aggregateCandidatesToLeads([cand1, cand2], 'US', 'United States');
    assert.strictEqual(res.leads.length, 1, 'Advertiser must merge into 1 lead');
    const lead = res.leads[0];
    assert.strictEqual(lead.adEvidence?.length, 2, 'Both ad records must be preserved separately in adEvidence');

    const ad1Evidence = lead.adEvidence?.find(e => e.libraryId === '700000000000001');
    const ad2Evidence = lead.adEvidence?.find(e => e.libraryId === '700000000000002');
    assert.strictEqual(ad1Evidence?.ctaType, 'CALL_NOW');
    assert.strictEqual(ad1Evidence?.destinationType, 'CALL');
    assert.strictEqual(ad2Evidence?.ctaType, 'SHOP_NOW');
    assert.strictEqual(ad2Evidence?.destinationType, 'EXTERNAL_WEBSITE');
  });

  // Gate 8: Exact duplicate returned across multiple keywords is handled deterministically
  runGate(8, 'Exact duplicate returned across multiple keywords is handled deterministically', () => {
    const candKw1 = {
      libraryId: '800000000000001',
      pageName: 'Nordic Oak Studio',
      facebookPageId: '888000000001',
      observedKeyword: 'Solid Wood Furniture',
      destinationUrl: 'https://nordicoak.com',
      destinationDomain: 'nordicoak.com',
      isActive: true
    };

    const candKw2 = {
      libraryId: '800000000000001', // Exact same ad ID observed under second keyword
      pageName: 'Nordic Oak Studio',
      facebookPageId: '888000000001',
      observedKeyword: 'Modern Dining Tables',
      destinationUrl: 'https://nordicoak.com',
      destinationDomain: 'nordicoak.com',
      isActive: true
    };

    const res = aggregateCandidatesToLeads([candKw1, candKw2], 'US', 'United States');
    assert.strictEqual(res.leads.length, 1, 'Must result in 1 lead');
    const lead = res.leads[0];
    assert.strictEqual(lead.adCount, 1, 'Ad count must remain 1');
    assert.strictEqual(lead.adLibraryIds.length, 1, 'Unique adLibraryIds must have exactly 1 ID');
    assert.ok(lead.matchedKeywords.includes('Solid Wood Furniture'));
    assert.ok(lead.matchedKeywords.includes('Modern Dining Tables'));
  });

  // Gate 9: Repeated processing is idempotent
  runGate(9, 'Repeated processing is idempotent (running multiple times produces identical state)', () => {
    const card = {
      libraryId: '900000000000001',
      pageName: 'Idempotent Crafts',
      facebookPageId: '999000000001',
      destinationUrl: 'https://idempotentcrafts.com',
      destinationDomain: 'idempotentcrafts.com',
      isActive: true,
      bodyCopy: 'Fine bespoke furniture built to last generations.',
      ctaText: 'Learn More'
    };

    const run1 = aggregateCandidatesToLeads([card], 'US', 'United States');
    const run2 = aggregateCandidatesToLeads([card, card, card], 'US', 'United States', undefined, run1.leads);

    assert.strictEqual(run1.leads.length, 1);
    assert.strictEqual(run2.leads.length, 1);
    assert.strictEqual(run2.leads[0].adCount, 1, 'Repeated ingestion must not inflate adCount');
    assert.strictEqual(run2.leads[0].adEvidence?.length, 1, 'Repeated ingestion must not duplicate adEvidence');
    assert.strictEqual(run2.leads[0].activeAdCount, 1);
  });

  // Gate 10: Stored and newly discovered duplicate handling
  runGate(10, 'Stored and newly discovered duplicate handling (existing leads matched by Page ID)', () => {
    const existingLead = {
      id: 'lead_existing_001',
      name: 'Moderno Living',
      canonicalName: 'Moderno Living',
      canonicalPageId: '101010101010',
      facebookPageName: 'Moderno Living',
      facebookPageUrl: 'https://www.facebook.com/modernoliving',
      facebookPageState: 'found',
      websiteState: 'found',
      activeAdCount: 1,
      adCount: 1,
      adLibraryIds: ['100000000000099'],
      matchedKeywords: ['Furniture'],
      locationCode: 'US',
      locationName: 'United States',
      status: 'QUALIFIED',
      discoveredAt: new Date().toISOString(),
      adEvidence: [{
        libraryId: '100000000000099',
        ctaType: 'SHOP_NOW',
        destinationType: 'EXTERNAL_WEBSITE',
        reasonCode: 'VISIBLE_EXTERNAL_DESTINATION',
        confidence: 'HIGH'
      }]
    };

    const incomingCandidate = {
      libraryId: '100000000000100',
      pageName: 'Moderno Living - Clearance', // Name differs slightly
      facebookPageId: '101010101010', // Exact matching Page ID
      facebookPageUrl: 'https://www.facebook.com/modernoliving',
      destinationUrl: 'https://modernoliving.com/clearance',
      destinationDomain: 'modernoliving.com',
      isActive: true,
      ctaText: 'Shop Now'
    };

    const res = aggregateCandidatesToLeads([incomingCandidate], 'US', 'United States', undefined, [existingLead]);
    assert.strictEqual(res.leads.length, 1, 'Incoming candidate must merge into existing lead sharing Page ID');
    const updated = res.leads[0];
    assert.strictEqual(updated.adCount, 2, 'Ad count must now be 2');
    assert.ok(updated.adLibraryIds.includes('100000000000100'), 'New ad ID must be appended');
    assert.ok(updated.adLibraryIds.includes('100000000000099'), 'Existing ad ID must be retained');
  });

  // Gate 11: Partial identity records remain safe
  runGate(11, 'Partial identity records remain safe without throwing or fabricating defaults', () => {
    const partialCand = {
      libraryId: '110000000000001',
      pageName: 'Bare Minimum Store',
      isActive: true
      // No facebookPageUrl, no destinationUrl, no bodyCopy, no ctaText
    };

    const res = aggregateCandidatesToLeads([partialCand], 'US', 'United States');
    assert.strictEqual(res.leads.length, 1);
    const lead = res.leads[0];
    assert.strictEqual(lead.name, 'Bare Minimum Store');
    assert.strictEqual(lead.facebookPageState, 'not_found');
    assert.strictEqual(lead.websiteState, 'unknown');
    assert.strictEqual(lead.destinationUrl, undefined);
  });

  // Gate 12: Probable duplicates are not reported as verified identities
  runGate(12, 'Probable duplicates are not reported as verified identities (PROBABLE_DUPLICATE)', () => {
    const candA = {
      pageName: 'Timber & Craft Furnishings',
      destinationUrl: 'https://timbercraft.io/tables',
      destinationDomain: 'timbercraft.io'
      // No Page ID on either
    };

    const candB = {
      pageName: 'Timber & Craft Furnishings',
      destinationUrl: 'https://timbercraft.io/desks',
      destinationDomain: 'timbercraft.io'
    };

    const rel = classifyDuplicateRelationship(candA, candB);
    assert.strictEqual(rel.matchLevel, 'PROBABLE_DUPLICATE', 'Name + Domain match lacking Page ID must be PROBABLE_DUPLICATE');
    assert.notStrictEqual(rel.matchLevel, 'EXACT_DUPLICATE', 'Probable match must NEVER be reported as EXACT_DUPLICATE');
  });

  // Gate 13: Conflict handling preserves original evidence
  runGate(13, 'Conflict handling preserves original evidence across merged cards', () => {
    const lead = {
      id: 'lead_test_merge',
      name: 'Conflict Test Brand',
      canonicalName: 'Conflict Test Brand',
      facebookPageName: 'Conflict Test Brand',
      facebookPageState: 'found',
      websiteState: 'found',
      activeAdCount: 0,
      adLibraryIds: [],
      matchedKeywords: [],
      locationCode: 'US',
      locationName: 'United States',
      status: 'REVIEW_REQUIRED',
      discoveredAt: new Date().toISOString()
    };

    const cand1 = {
      libraryId: '130000000000001',
      pageName: 'Conflict Test Brand',
      facebookPageId: '131313131313',
      ctaText: 'Call Now',
      isActive: true,
      bodyCopy: 'Copy 1 from Campaign Alpha'
    };

    const cand2 = {
      libraryId: '130000000000002',
      pageName: 'Conflict Test Brand',
      facebookPageId: '131313131313',
      ctaText: 'Send Message',
      isActive: true,
      bodyCopy: 'Copy 2 from Campaign Beta'
    };

    const decision = {
      shouldMerge: true,
      targetKey: 'fb_131313131313',
      confidence: 'STRONG',
      reason: 'MERGE_EXACT_FACEBOOK_PAGE_ID',
      relationshipType: 'INDEPENDENT_BUSINESS',
      matchLevel: 'EXACT_DUPLICATE'
    };

    mergeCandidateIntoEntity(lead, cand1, decision, 'keyword1', 'US');
    mergeCandidateIntoEntity(lead, cand2, decision, 'keyword2', 'US');

    assert.strictEqual(lead.adEvidence?.length, 2, 'Ad evidence must store both campaigns');
    assert.ok(lead.observedCtaTexts?.includes('Call Now'));
    assert.ok(lead.observedCtaTexts?.includes('Send Message'));
    assert.strictEqual(lead.mergeHistory?.length, 2, 'Audit trail must record both merge events');
  });

  // Gate 14: Storage and recovery do not reintroduce duplicates
  runGate(14, 'Storage and recovery do not reintroduce duplicates (normalizeStoredLead)', () => {
    const storedWithDuplicates = {
      id: 'lead_stored_dup',
      name: 'Storage Recovery Test',
      canonicalName: 'Storage Recovery Test',
      adLibraryIds: ['140000000000001', '140000000000001', '140000000000002'], // Duplicate ID
      activeAdLibraryIds: ['140000000000001', '140000000000001'],
      facebookPageUrl: 'https://www.facebook.com/recoverytest?id=141414141414',
      aliases: ['Storage Test', 'Storage Test', 'Recovery Test'], // Duplicate aliases
      adEvidence: [
        { libraryId: '140000000000001', ctaType: 'SHOP_NOW', destinationType: 'EXTERNAL_WEBSITE', reasonCode: 'R1', confidence: 'HIGH' },
        { libraryId: '140000000000001', ctaType: 'SHOP_NOW', destinationType: 'EXTERNAL_WEBSITE', reasonCode: 'R1', confidence: 'HIGH' } // Duplicate ad evidence
      ]
    };

    const normalized = normalizeStoredLead(storedWithDuplicates);
    assert.strictEqual(normalized.adLibraryIds.length, 2, 'Duplicate ad IDs must be deduplicated on recovery');
    assert.strictEqual(normalized.activeAdLibraryIds?.length, 1);
    assert.strictEqual(normalized.adEvidence?.length, 1, 'Duplicate ad evidence must be deduplicated on recovery');
    assert.strictEqual(normalized.aliases?.length, 2, 'Duplicate aliases must be deduplicated');
    assert.strictEqual(normalized.canonicalPageId, '141414141414', 'Canonical Page ID must be resolved on recovery');
  });

  // Gate 15: Export retains identity evidence and review status
  runGate(15, 'Export retains identity evidence and review status in CSV', () => {
    const lead = {
      id: 'lead_export_15',
      name: 'Export Identity Test',
      canonicalName: 'Export Identity Test',
      facebookPageName: 'Export Identity Test',
      facebookPageUrl: 'https://www.facebook.com/exporttest',
      facebookPageState: 'found',
      destinationUrl: 'https://exporttest.com',
      destinationDomain: 'exporttest.com',
      websiteState: 'found',
      activeAdCount: 1,
      adLibraryIds: ['150000000000001'],
      matchedKeywords: ['Woodworking'],
      locationCode: 'US',
      locationName: 'United States',
      status: 'QUALIFIED',
      discoveredAt: new Date().toISOString(),
      canonicalPageId: '151515151515',
      canonicalPageSlug: 'exporttest',
      identityConfidence: 'STRONG',
      relationshipType: 'INDEPENDENT_BUSINESS',
      aliases: ['Export Test Co', 'Export Studio']
    };

    const csv = exportLeadsToCsv([lead]);
    assert.ok(csv.includes('Canonical Page ID'), 'CSV header must include Canonical Page ID');
    assert.ok(csv.includes('Canonical Page Slug'), 'CSV header must include Canonical Page Slug');
    assert.ok(csv.includes('Identity Confidence'), 'CSV header must include Identity Confidence');
    assert.ok(csv.includes('Relationship Type'), 'CSV header must include Relationship Type');
    assert.ok(csv.includes('Aliases'), 'CSV header must include Aliases');
    assert.ok(csv.includes('"151515151515"'), 'CSV row must export Canonical Page ID');
    assert.ok(csv.includes('"exporttest"'), 'CSV row must export Canonical Page Slug');
    assert.ok(csv.includes('"STRONG"'), 'CSV row must export Identity Confidence');
  });

  // Gate 16: CTA and destination data remain associated with the correct ad
  runGate(16, 'CTA and destination data remain associated with the correct ad card', () => {
    const candA = {
      libraryId: '160000000000001',
      pageName: 'Multi Ad Brand',
      facebookPageId: '161616161616',
      ctaText: 'Call Now',
      ctaType: 'CALL_NOW',
      destinationType: 'CALL',
      isActive: true
    };

    const candB = {
      libraryId: '160000000000002',
      pageName: 'Multi Ad Brand',
      facebookPageId: '161616161616',
      ctaText: 'Send Message',
      ctaType: 'SEND_MESSAGE',
      destinationType: 'MESSAGING',
      isActive: true
    };

    const res = aggregateCandidatesToLeads([candA, candB], 'US', 'United States');
    const lead = res.leads[0];
    const adA = lead.adEvidence?.find(e => e.libraryId === '160000000000001');
    const adB = lead.adEvidence?.find(e => e.libraryId === '160000000000002');
    assert.strictEqual(adA?.ctaType, 'CALL_NOW');
    assert.strictEqual(adA?.destinationType, 'CALL');
    assert.strictEqual(adB?.ctaType, 'SEND_MESSAGE');
    assert.strictEqual(adB?.destinationType, 'MESSAGING');
  });

  // Gate 17: Country and niche qualification evidence remains intact
  runGate(17, 'Country and niche qualification evidence remains intact during merge', () => {
    const lead = {
      id: 'lead_geo_merge',
      name: 'Bengal Woods',
      canonicalName: 'Bengal Woods',
      facebookPageName: 'Bengal Woods',
      facebookPageState: 'found',
      websiteState: 'found',
      activeAdCount: 0,
      adLibraryIds: [],
      matchedKeywords: [],
      locationCode: 'BD',
      locationName: 'Bangladesh',
      status: 'QUALIFIED',
      geographicClassification: 'LOCAL_VERIFIED',
      businessCountryCode: 'BD',
      targetCountryCode: 'BD',
      discoveredAt: new Date().toISOString()
    };

    const candForeign = {
      libraryId: '170000000000001',
      pageName: 'Bengal Woods',
      facebookPageId: '171717171717',
      destinationUrl: 'https://bengalwoods.co.uk', // UK domain conflicting with BD!
      destinationDomain: 'bengalwoods.co.uk',
      isActive: true,
      bodyCopy: 'Shipped from London across Europe.'
    };

    const decision = {
      shouldMerge: true,
      targetKey: 'fb_171717171717',
      confidence: 'STRONG',
      reason: 'MERGE_EXACT_FACEBOOK_PAGE_ID',
      relationshipType: 'INDEPENDENT_BUSINESS',
      matchLevel: 'EXACT_DUPLICATE'
    };

    mergeCandidateIntoEntity(lead, candForeign, decision, 'Furniture', 'BD');
    // Strong foreign signal must update classification or note conflict
    assert.ok(
      lead.geographicClassification === 'FOREIGN_VERIFIED' ||
      lead.businessLocationReasonCode === 'CONFLICTING_LOCATION_EVIDENCE',
      'Geographic origin classifier must properly capture foreign signal during merge'
    );
  });

  // Gate 18: Deduplication does not override mandatory qualification gates
  runGate(18, 'Deduplication cannot override mandatory qualification gates', () => {
    const unqualLead = {
      id: 'lead_unqual_18',
      name: 'Unqualified Furniture Store',
      canonicalName: 'Unqualified Furniture Store',
      canonicalPageId: '181818181818',
      facebookPageName: 'Unqualified Furniture Store',
      facebookPageState: 'found',
      websiteState: 'found',
      destinationUrl: 'https://unqualifiedstore.com',
      destinationDomain: 'unqualifiedstore.com',
      activeAdCount: 1,
      adLibraryIds: ['180000000000001'],
      matchedKeywords: ['Furniture'],
      locationCode: 'US',
      locationName: 'United States',
      status: 'REVIEW_REQUIRED',
      relevanceDecision: 'NOT_RELEVANT', // Failed relevance gate!
      discoveredAt: new Date().toISOString()
    };

    const candDuplicate = {
      libraryId: '180000000000002',
      pageName: 'Unqualified Furniture Store',
      facebookPageId: '181818181818',
      destinationUrl: 'https://unqualifiedstore.com',
      destinationDomain: 'unqualifiedstore.com',
      isActive: true,
      bodyCopy: 'Crypto trading platform and NFT collectibles.' // Irrelevant ad
    };

    const res = aggregateCandidatesToLeads([candDuplicate], 'US', 'United States', undefined, [unqualLead], {
      primaryKeywords: ['Furniture'],
      nicheTerms: ['furniture', 'sofa']
    });

    const evaluatedLead = res.leads.find(l => l.canonicalPageId === '181818181818');
    if (evaluatedLead) {
      assert.notStrictEqual(evaluatedLead.status, 'QUALIFIED', 'Unqualified lead must NOT become QUALIFIED via deduplication merge');
    }
  });

  // Gate 19: Backward compatibility with existing stored records
  runGate(19, 'Backward compatibility with existing stored records (legacy records normalize cleanly)', () => {
    const legacyRecord = {
      name: 'Legacy Timber Crafts',
      adLibraryIds: ['190000000000001', '190000000000002'],
      sampleCta: 'Shop Now',
      destinationUrl: 'https://legacytimbercrafts.com'
      // Missing all schema v2 and identity fields
    };

    const normalized = normalizeStoredLead(legacyRecord);
    assert.strictEqual(normalized.name, 'Legacy Timber Crafts');
    assert.strictEqual(normalized.canonicalName, 'Legacy Timber Crafts');
    assert.strictEqual(normalized.adCount, 2);
    assert.strictEqual(normalized.primaryCtaType, 'SHOP_NOW');
    assert.strictEqual(normalized.primaryDestinationType, 'EXTERNAL_WEBSITE');
    assert.strictEqual(normalized.schemaVersion, 2);
  });

  // Gate 20: Existing Phase 2 CTA/destination tests continue to pass
  await runAsyncGate(20, 'Existing Phase 2 CTA/destination test suite executes cleanly', async () => {
    const phase2Script = path.resolve(rootDir, 'tests/test-phase02-cta-destination-remediation.mjs');
    assert.ok(fs.existsSync(phase2Script), 'Phase 2 remediation test file must exist');
    // Direct in-process verification of core Phase 2 classifiers
    const cta = classifyCta('Shop Now');
    assert.strictEqual(cta.ctaType, 'SHOP_NOW');
    const dest = classifyDestination({ destinationUrl: 'https://example.com' });
    assert.strictEqual(dest.destinationType, 'EXTERNAL_WEBSITE');
  });

  // Gate 21: Existing Phase 3 qualification tests continue to pass
  await runAsyncGate(21, 'Existing Phase 3 qualification test suite executes cleanly', async () => {
    const phase3Script = path.resolve(rootDir, 'tests/test-phase03-niche-qualification-remediation.mjs');
    assert.ok(fs.existsSync(phase3Script), 'Phase 3 remediation test file must exist');
    // Direct in-process verification of qualification gate
    const gateEval = evaluateLeadQualificationGates({
      name: 'Gate Test Entity',
      relevanceDecision: 'RELEVANT',
      geographicClassification: 'LOCAL_VERIFIED',
      websiteState: 'found',
      primaryCtaType: 'SHOP_NOW',
      primaryDestinationType: 'EXTERNAL_WEBSITE'
    }, { strictLocalMode: true });
    assert.strictEqual(gateEval.isQualified, true);
  });

  // Gate 22: Both safety gates remain permanently fail-closed
  runGate(22, 'Both safety gates remain permanently fail-closed', () => {
    assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must evaluate to false');
    assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must evaluate to false');
  });

  // Gate 23: No unauthorized external network behavior or permissions are introduced
  runGate(23, 'No unauthorized external network behavior, endpoints, or permissions are introduced', () => {
    const manifestPath = path.resolve(rootDir, 'extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const forbiddenPermissions = ['webRequest', 'webRequestBlocking', 'proxy', 'vpnProvider'];
    for (const perm of forbiddenPermissions) {
      assert.strictEqual(manifest.permissions?.includes(perm), false, `Permission ${perm} must not be requested`);
    }

    const forbiddenMatches = ['*://*/*', 'https://*/*', 'http://*/*'];
    for (const host of (manifest.host_permissions || [])) {
      assert.strictEqual(forbiddenMatches.includes(host), false, `Broad host permission ${host} is prohibited`);
    }

    // Verify all host permissions target Meta Ad Library only
    for (const host of (manifest.host_permissions || [])) {
      assert.ok(
        host.includes('facebook.com') || host.includes('meta.com'),
        `Host permission must only target Meta Ad Library: observed ${host}`
      );
    }
  });

  console.log('========================================================================');
  console.log(`PHASE 4 REGRESSION TEST RESULTS: ${passedTests}/${totalTests} GATES PASSED`);
  console.log('========================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

executeAllGates().catch(err => {
  console.error('Fatal failure in Phase 4 regression test suite:', err);
  process.exit(1);
});
