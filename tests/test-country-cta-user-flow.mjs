import assert from 'node:assert/strict';
import { evaluateGeographicOrigin } from '../src/extension/geographicClassifier.ts';
import { classifyCta, classifyDestination, observedWebsiteState } from '../src/extension/destinationClassifier.ts';
import { buildMetaAdLibrarySearchUrl, exportLeadsToCsv } from '../src/extension/metaAdapter.ts';
import { parseManualAdText } from '../src/extension/manualImport/importParsers.ts';
import { executeManualImport } from '../src/extension/manualImport/importOrchestrator.ts';
import { getRunRecord, getAllStoredLeads } from '../src/extension/bulkStore.ts';
import { extensionLeadToResultRowViewModel } from '../src/extension/ui/viewModelMappers.ts';

// Public-page substitutes only: this tests the processing flow, not live scraping.
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Unexpected network request'); };
try {
  const url = new URL(buildMetaAdLibrarySearchUrl('bd', 'Furniture & Office'));
  assert.equal(url.searchParams.get('ad_type'), 'all');
  assert.equal(url.searchParams.get('active_status'), 'all');
  assert.equal(url.searchParams.get('country'), 'BD');
  assert.equal(url.searchParams.get('q'), 'Furniture & Office');
  const foreign = evaluateGeographicOrigin({ pageName: 'Mumbai Furniture',
    bodyCopy: 'Head office: 12 MG Road, Mumbai, India. Delivery to Dhaka, Bangladesh. Call +919876543210.',
    destinationDomain: 'mumbaifurniture.in' }, 'BD');
  assert.equal(foreign.classification, 'FOREIGN_VERIFIED');
  assert.equal(foreign.businessCountryCode, 'IN');
  assert.equal(foreign.targetCountryCode, 'BD');
  const local = evaluateGeographicOrigin({ pageName: 'Dhaka Furniture',
    bodyCopy: 'Visit our showroom: House 14, Road 7, Dhanmondi, Dhaka. Bangladesh. Call +8801712345678.' }, 'BD');
  assert.equal(local.classification, 'LOCAL_VERIFIED');
  assert.equal(local.businessCountryCode, 'BD');
  const unknown = evaluateGeographicOrigin({ pageName: 'Furniture Store', bodyCopy: 'Furniture delivery to Bangladesh.' }, 'BD');
  assert.notEqual(unknown.classification, 'LOCAL_VERIFIED');
  assert.equal(classifyCta('Shop Now').ctaType, 'SHOP_NOW');
  assert.equal(classifyDestination({ ctaText: 'Shop Now' }).destinationType, 'UNKNOWN');
  assert.equal(observedWebsiteState(), 'unknown');
  for (const destination of ['https://wa.me/8801712345678', 'https://m.me/furniture', 'tel:+8801712345678', 'https://www.facebook.com/furniture']) {
    assert.equal(observedWebsiteState(destination), 'unknown');
  }
  assert.equal(observedWebsiteState('https://furniture.example/shop'), 'found');
  const samples = [
    'Library ID: 104829104819201\nActive\nDhaka Artisan Furniture\nSponsored\nSolid wood furniture. Visit our showroom: House 14, Road 7, Dhanmondi, Dhaka, Bangladesh. Call +8801712345678.\nShop Now\nhttps://dhakaartisan.example/shop',
    'Library ID: 104829104819202\nActive\nMumbai Furniture\nSponsored\nSolid wood furniture. Head office: 12 MG Road, Mumbai, India. Delivery to Dhaka, Bangladesh. Call +919876543210.\nShop Now\nhttps://mumbaifurniture.in/shop',
    'Library ID: 104829104819203\nActive\nUnlocated Furniture\nSponsored\nSolid wood furniture.\nLearn More'
  ];
  const candidates = parseManualAdText(samples.join('\n---\n'), 'BD').candidates;
  assert.equal(candidates.length, 3);
  const runId = 'country_cta_acceptance';
  const result = await executeManualImport(candidates, { runId, countryCode: 'BD', keywords: ['Furniture'], strictLocalMode: true });
  assert.equal(result.leads.length, 3);
  const indian = result.leads.find(l => l.adLibraryIds.includes('104829104819202'));
  assert.equal(indian.businessCountryCode, 'IN');
  assert.notEqual(indian.status, 'QUALIFIED');
  assert.equal(indian.primaryCtaType, 'SHOP_NOW');
  assert.equal(indian.primaryDestinationType, 'EXTERNAL_WEBSITE');
  assert(indian.sampleCopy.includes('Mumbai'));
  assert.equal(indian.sampleCta, 'Shop Now');
  const unlocated = result.leads.find(l => l.adLibraryIds.includes('104829104819203'));
  assert.equal(unlocated.businessCountryCode, undefined);
  assert.equal(unlocated.websiteState, 'unknown');
  const rows = result.leads.map(extensionLeadToResultRowViewModel);
  assert.equal(new Set(rows.map(r => r.recordId)).size, 3);
  assert(rows.every(r => !r.dataSignals.websiteVerified));
  assert.equal((await getRunRecord(runId)).leads.length, 3);
  const stored = await getAllStoredLeads(runId);
  assert.equal(stored.length, 3);
  const csv = exportLeadsToCsv(stored, { qualifiedOnly: true });
  assert(!csv.includes('Mumbai Furniture'));
  assert(!csv.includes('Unlocated Furniture'));
  assert(csv.includes('Dhaka Artisan Furniture'));
  const allCsv = exportLeadsToCsv(stored, { qualifiedOnly: false });
  assert(allCsv.includes('Head office: 12 MG Road'));
  const repeated = await executeManualImport(candidates, { runId: 'repeated_country_cta', countryCode: 'BD', keywords: ['Furniture'], strictLocalMode: true });
  assert.equal(repeated.duplicateCount, 3);
  assert.equal(repeated.leads.length, 0);
  assert.equal(await getRunRecord('repeated_country_cta'), null);
  const mixed = await executeManualImport([candidates[0], { ...candidates[0], libraryId: '104829104819204' }],
    { runId: 'mixed_country_cta', countryCode: 'BD', keywords: ['Furniture'], strictLocalMode: true });
  assert.equal(mixed.duplicateCount, 1);
  assert.deepEqual(mixed.leads[0].adLibraryIds, ['104829104819204']);
  globalThis.chrome = { runtime: {}, storage: { local: {} } };
  try {
    await assert.rejects(executeManualImport([{ ...candidates[0], libraryId: '104829104819205' }],
      { runId: 'browser_storage_missing', keywords: ['Furniture'] }), /Durable storage is unavailable/);
    assert.equal(await getRunRecord('browser_storage_missing'), null);
  } finally { delete globalThis.chrome; }
  console.log('PASS: country/all-ads query → parse → business-origin/CTA/website classification → qualification → storage → UI identities → qualified export. Offline fixtures; no live browser claim.');
} finally { globalThis.fetch = originalFetch; }
