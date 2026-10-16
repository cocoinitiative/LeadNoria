/**
 * LeadNoria Phase 34 — Manual Import & Offline Qualification Regression Test Suite
 *
 * Verifies:
 * 1. Manual ad text parsing (IDs, names, copy, CTAs, destination, contacts)
 * 2. Meta Ad Library URL parsing with ZERO network calls
 * 3. User-supplied CSV parsing (column mapping, RFC 4180 quotes, formula injection protection)
 * 4. Empty and sparse records handled safely without inventing missing fields
 * 5. Deduplication and repeated-import idempotence
 * 6. Entity resolution & anti-inflation (multiple ads from same advertiser merge)
 * 7. Strict geographic classification (BD target: US advertiser rejected, BD local verified, unknown remains unknown)
 * 8. CTA and destination classification
 * 9. Quality scoring and qualification gates
 * 10. Persistence and provenance marking (USER_SUPPLIED_META_SIGNAL)
 * 11. Fail-closed safety invariants (isLiveCollectionPermitted() === false, isExternalWebsiteCrawlingPermitted() === false)
 */

import assert from 'node:assert';
import {
  parseManualAdText,
  parseMetaAdLibraryUrls,
  parseUserSuppliedCsv,
  sanitizeFormulaValue
} from '../src/extension/manualImport/importParsers.ts';
import { executeManualImport } from '../src/extension/manualImport/importOrchestrator.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';
import { exportLeadsToCsv } from '../src/extension/metaAdapter.ts';

console.log('========================================================================');
console.log('LEADNORIA PHASE 34 — MANUAL IMPORT & OFFLINE QUALIFICATION REGRESSION');
console.log('========================================================================\n');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failCount++;
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
  }
}

// Global network guard: Ensure no fetch or http calls occur during offline tests
const originalFetch = globalThis.fetch;
globalThis.fetch = () => {
  throw new Error('NETWORK_VIOLATION: Automated network request attempted during offline manual import!');
};

async function runAllTests() {
  // 1. Mandatory Fail-Closed Production Gates
  await test('Invariant 1.1: isLiveCollectionPermitted() strictly returns false', () => {
    assert.strictEqual(isLiveCollectionPermitted(), false);
  });

  await test('Invariant 1.2: isExternalWebsiteCrawlingPermitted() strictly returns false', () => {
    assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false);
  });

  // 2. Formula Injection Protection
  await test('Formula Security 2.1: sanitizeFormulaValue disarms =, +, -, @, \\t, \\r', () => {
    assert.strictEqual(sanitizeFormulaValue('=SUM(A1:A10)'), `'=SUM(A1:A10)`);
    assert.strictEqual(sanitizeFormulaValue('+cmd|/c calc'), `'+cmd|/c calc`);
    assert.strictEqual(sanitizeFormulaValue('-100+200'), `'-100+200`);
    assert.strictEqual(sanitizeFormulaValue('@HYPERLINK("http://evil.com")'), `'@HYPERLINK("http://evil.com")`);
    assert.strictEqual(sanitizeFormulaValue('\tDDE("cmd")'), `'\tDDE("cmd")`);
    assert.strictEqual(sanitizeFormulaValue('Clean Business Name'), 'Clean Business Name');
  });

  // 3. Mode A: Manual Ad Text Parsing
  await test('Mode A 3.1: Parses single ad text with ID, page name, copy, CTA, URL, and contacts', () => {
    const rawAd = `
Library ID: 104829104819201
Active
Started running on Oct 14, 2026
Dhaka Artisan Furniture
Sponsored
Looking for solid teak wood dining sets in Dhaka?
Visit our showroom at House 14, Road 7, Dhanmondi, Dhaka.
Call us at +8801712345678 or email contact@dhakaartisan.com
Shop Now
https://dhakaartisan.com/dining
`;
    const res = parseManualAdText(rawAd, 'BD');
    assert.strictEqual(res.candidates.length, 1);
    const cand = res.candidates[0];

    assert.strictEqual(cand.libraryId, '104829104819201');
    assert.strictEqual(cand.pageName, 'Dhaka Artisan Furniture');
    assert.strictEqual(cand.isActive, true);
    assert.strictEqual(cand.ctaText, 'Shop Now');
    assert.strictEqual(cand.ctaType, 'SHOP_NOW');
    assert.strictEqual(cand.destinationUrl, 'https://dhakaartisan.com/dining');
    assert.strictEqual(cand.destinationDomain, 'dhakaartisan.com');
    assert.strictEqual(cand.destinationType, 'EXTERNAL_WEBSITE');
    assert.ok(cand.bodyCopy.includes('solid teak wood dining sets'));

    // Contacts
    assert.ok(cand.observedPhones && cand.observedPhones.length > 0, 'Must extract phone');
    assert.ok(
      cand.observedPhones[0].normalizedValue?.includes('880') ||
      cand.observedPhones[0].rawValue.includes('8801712345678'),
      'Phone must include country code 880'
    );
    assert.ok(cand.observedEmails && cand.observedEmails.length > 0, 'Must extract email');
    assert.strictEqual(cand.observedEmails[0].normalizedValue, 'contact@dhakaartisan.com');
  });

  await test('Mode A 3.2: Parses multi-ad text separated by delimiters or repeated Library IDs', () => {
    const multiAd = `
Library ID: 111111111111111
Apex Crafts Ltd
Sponsored
Handcrafted leather goods in Dhaka. Call +8801700000001
Shop Now
https://apexcrafts.com.bd

---

Library ID: 222222222222222
Bengal Ceramics
Sponsored
Premium dinnerware in Gulshan, Dhaka. Call +8801700000002
Learn More
https://bengalceramics.bd
`;
    const res = parseManualAdText(multiAd, 'BD');
    assert.strictEqual(res.candidates.length, 2);
    assert.strictEqual(res.candidates[0].libraryId, '111111111111111');
    assert.strictEqual(res.candidates[0].pageName, 'Apex Crafts Ltd');
    assert.strictEqual(res.candidates[1].libraryId, '222222222222222');
    assert.strictEqual(res.candidates[1].pageName, 'Bengal Ceramics');
  });

  await test('Mode A 3.3: Sparse ad copy does NOT invent missing fields', () => {
    const sparseAd = `
Library ID: 333333333333333
Minimalist Studio
Sponsored
Just a short note without links or phone.
`;
    const res = parseManualAdText(sparseAd, 'BD');
    assert.strictEqual(res.candidates.length, 1);
    const cand = res.candidates[0];
    assert.strictEqual(cand.libraryId, '333333333333333');
    assert.strictEqual(cand.destinationUrl, undefined);
    assert.strictEqual(cand.destinationDomain, undefined);
    assert.strictEqual(cand.ctaText, undefined);
    assert.strictEqual(cand.observedPhones.length, 0);
    assert.strictEqual(cand.observedEmails.length, 0);
  });

  // 4. Mode B: Meta Ad Library URL Parsing
  await test('Mode B 4.1: Parses Meta Ad Library URLs locally with zero network requests', () => {
    const urls = `
https://www.facebook.com/ads/library/?id=104829104819201
https://facebook.com/ads/library/?active_status=all&ad_type=all&country=BD&id=987654321012345&view_all_page_id=55667788
`;
    const res = parseMetaAdLibraryUrls(urls, 'BD');
    assert.strictEqual(res.candidates.length, 2);
    assert.strictEqual(res.candidates[0].libraryId, '104829104819201');
    assert.strictEqual(res.candidates[1].libraryId, '987654321012345');
    assert.strictEqual(res.candidates[1].facebookPageId, '55667788');
    // Does not invent destination or contacts
    assert.strictEqual(res.candidates[0].destinationUrl, undefined);
    assert.strictEqual(res.candidates[0].destinationType, 'UNKNOWN');
    assert.strictEqual(res.candidates[0].observedPhones.length, 0);
  });

  await test('Mode B 4.2: Skips non-Meta URLs and malformed inputs with warnings', () => {
    const mixed = `
https://www.google.com/search?q=test
https://www.facebook.com/ads/library/?id=555555555555555
invalid_string_not_a_url
`;
    const res = parseMetaAdLibraryUrls(mixed, 'BD');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].libraryId, '555555555555555');
    assert.ok(res.warnings.length >= 2, 'Must record warnings for invalid URLs');
  });

  // 5. Mode C: User-Supplied CSV Import
  await test('Mode C 5.1: Parses valid CSV with standard columns and sanitizes formulas', () => {
    const csvData = `Library ID,Page Name,Ad Copy,CTA,Destination URL,Phone,Email
100000000000001,Dhaka Tech Store,"Best laptops in Banani, Dhaka. Visit store today.",Shop Now,https://dhakatech.com.bd,+8801811223344,sales@dhakatech.com.bd
100000000000002,=HYPERLINK("evil.com"),"Special promotional offer",Learn More,https://brand.com,+8801911223344,info@brand.com
`;
    const res = parseUserSuppliedCsv(csvData, 'BD');
    assert.strictEqual(res.candidates.length, 2);
    assert.strictEqual(res.candidates[0].libraryId, '100000000000001');
    assert.strictEqual(res.candidates[0].pageName, 'Dhaka Tech Store');
    assert.strictEqual(res.candidates[0].ctaText, 'Shop Now');
    assert.strictEqual(res.candidates[0].destinationDomain, 'dhakatech.com.bd');

    // Formula injection verification: =HYPERLINK must be sanitized to '=HYPERLINK
    assert.strictEqual(res.candidates[1].pageName, `'=HYPERLINK("evil.com")`);
  });

  await test('Mode C 5.2: Detects alternative delimiters (semicolon, tab) and column aliases', () => {
    const tsvData = `ad_id\tadvertiser\tdescription\tbutton\twebsite\ttelephone
200000000000001\tBangla Decor\tInterior design in Uttara Dhaka\tOrder Now\thttps://bangladecor.com\t+8801711000000
`;
    const res = parseUserSuppliedCsv(tsvData, 'BD');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].libraryId, '200000000000001');
    assert.strictEqual(res.candidates[0].pageName, 'Bangla Decor');
    assert.strictEqual(res.candidates[0].ctaText, 'Order Now');
  });

  await test('Mode C 5.3: Handles empty/sparse rows and duplicate IDs safely', () => {
    const sparseCsv = `Library ID,Page Name,Ad Copy
300000000000001,First Advertiser,Some text
300000000000001,First Advertiser,Duplicate row should be skipped
,Empty Row Advertiser,Missing ID
`;
    const res = parseUserSuppliedCsv(sparseCsv, 'BD');
    assert.strictEqual(res.candidates.length, 2, 'Should have 1 unique + 1 row with generated ID');
    assert.strictEqual(res.skippedCount, 1, 'Duplicate row skipped');
  });

  // 6. Pipeline Integration & Offline Qualification
  await test('Pipeline 6.1: Full offline import with strict geographic qualification (BD target)', async () => {
    const candidates = [
      // 1. Bangladeshi local business (with address and BD phone in Dhaka)
      {
        libraryId: '900000000000001',
        pageName: 'Otobi Furniture Ltd',
        isActive: true,
        bodyCopy: 'Modern home furniture made in Bangladesh. Visit our showroom at Mirpur 10, Dhaka. Call +8801711223344 for delivery.',
        ctaText: 'Shop Now',
        ctaType: 'SHOP_NOW',
        destinationUrl: 'https://otobi.com.bd/living',
        destinationDomain: 'otobi.com.bd',
        destinationType: 'EXTERNAL_WEBSITE',
        rawText: 'Otobi Furniture Ltd Mirpur 10, Dhaka'
      },
      // 2. Foreign US business targeting Bangladesh (e.g. US hosting / SaaS)
      {
        libraryId: '900000000000002',
        pageName: 'San Francisco Cloud Systems Inc',
        isActive: true,
        bodyCopy: 'Enterprise cloud servers. Headquartered at 100 Market St, San Francisco, CA 94105 USA. Call +1-415-555-0199.',
        ctaText: 'Sign Up',
        ctaType: 'SIGN_UP',
        destinationUrl: 'https://sfcloud.com',
        destinationDomain: 'sfcloud.com',
        destinationType: 'EXTERNAL_WEBSITE',
        rawText: 'San Francisco CA USA +1-415'
      },
      // 3. Incomplete URL-only candidate (no copy, no address)
      {
        libraryId: '900000000000003',
        pageName: 'Meta Ad Library Ref #900000000000003',
        isActive: true,
        destinationType: 'UNKNOWN',
        rawText: 'Meta Ad Library Reference URL'
      }
    ];

    const summary = await executeManualImport(candidates, {
      countryCode: 'BD',
      locationName: 'Bangladesh',
      strictLocalMode: true,
      keywords: ['Furniture', 'Business']
    });

    assert.strictEqual(summary.totalSupplied, 3);
    assert.strictEqual(summary.leads.length, 3);

    // Verify BD local business qualified
    const bdLead = summary.leads.find(l => l.name.includes('Otobi Furniture'));
    assert.ok(bdLead, 'BD lead must be present');
    assert.ok(
      bdLead.geographicClassification === 'LOCAL_VERIFIED' || bdLead.geographicClassification === 'LOCAL_PROBABLE',
      `BD business should be local, got ${bdLead.geographicClassification}`
    );
    assert.strictEqual(bdLead.provenance, 'USER_SUPPLIED_META_SIGNAL');

    // Verify US foreign business NOT qualified as local
    const usLead = summary.leads.find(l => l.name.includes('San Francisco'));
    assert.ok(usLead, 'US lead must be present');
    assert.strictEqual(usLead.geographicClassification, 'FOREIGN_VERIFIED');
    assert.strictEqual(usLead.businessCountryCode, 'US');

    // Verify URL-only candidate remains unverified / uncertain
    const urlLead = summary.leads.find(l => l.adLibraryIds.includes('900000000000003'));
    assert.ok(urlLead, 'URL lead must be present');
    assert.ok(
      urlLead.geographicClassification === 'LOCATION_UNKNOWN' || !urlLead.geographicClassification,
      'URL-only lead must not be verified'
    );
    assert.ok(!urlLead.isQualified, 'URL-only lead must remain unqualified');
  });

  await test('Pipeline 6.2: Entity resolution anti-inflation merges multiple ads for same advertiser', async () => {
    const multiAdsSameAdv = [
      {
        libraryId: '800000000000001',
        pageName: 'Hatil Furniture Ltd',
        isActive: true,
        bodyCopy: 'Ergonomic office chairs in Dhaka. Call +8801700112233.',
        ctaText: 'Shop Now',
        ctaType: 'SHOP_NOW',
        destinationUrl: 'https://hatil.com.bd/chairs',
        destinationDomain: 'hatil.com.bd'
      },
      {
        libraryId: '800000000000002',
        pageName: 'Hatil Furniture Ltd',
        isActive: true,
        bodyCopy: 'Solid wood dining tables in Dhaka. Call +8801700112233.',
        ctaText: 'Learn More',
        ctaType: 'LEARN_MORE',
        destinationUrl: 'https://hatil.com.bd/tables',
        destinationDomain: 'hatil.com.bd'
      }
    ];

    const summary = await executeManualImport(multiAdsSameAdv, {
      countryCode: 'BD',
      strictLocalMode: true,
      keywords: ['Furniture']
    });

    // 2 ads processed, but merged into 1 unique entity!
    assert.strictEqual(summary.totalSupplied, 2);
    assert.strictEqual(summary.leads.length, 1, 'Multiple ads for same advertiser must merge into 1 entity');
    const lead = summary.leads[0];
    assert.strictEqual(lead.name, 'Hatil Furniture Ltd');
    assert.strictEqual(lead.activeAdCount, 2);
    assert.strictEqual(lead.adLibraryIds.length, 2);
    assert.ok(lead.adLibraryIds.includes('800000000000001'));
    assert.ok(lead.adLibraryIds.includes('800000000000002'));
    assert.strictEqual(summary.duplicateCount, 1, 'Merged ad counted in duplicatesRemoved');
  });

  await test('Pipeline 6.3: CSV Export formatting of imported leads is formula-safe', () => {
    const lead = {
      id: 'lead_test_1',
      name: '=DDE("cmd";"calc")',
      canonicalName: 'DDE Calc',
      facebookPageName: 'DDE Calc',
      destinationUrl: 'https://example.com.bd',
      destinationDomain: 'example.com.bd',
      activeAdCount: 1,
      adLibraryIds: ['123456789012345'],
      targetCountryCode: 'BD',
      businessCountryCode: 'BD',
      geographicClassification: 'LOCAL_VERIFIED',
      locationCode: 'BD',
      relevanceDecision: 'RELEVANT',
      status: 'QUALIFIED',
      provenance: 'USER_SUPPLIED_META_SIGNAL'
    };

    const csv = exportLeadsToCsv([lead]);
    assert.ok(!csv.includes('"=DDE'), 'Must sanitize leading = formula');
    assert.ok(csv.includes(`"'=DDE`), 'Must prefix leading formula with single quote');
  });

  console.log('\n========================================================================');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log('========================================================================\n');

  // Restore fetch
  globalThis.fetch = originalFetch;

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
