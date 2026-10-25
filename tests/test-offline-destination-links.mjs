import assert from 'node:assert/strict';
import { classifyDestination, observedWebsiteState, resolveObservedDestinationUrl } from '../src/extension/destinationClassifier.ts';
import { extensionLeadToResultRowViewModel } from '../src/extension/ui/viewModelMappers.ts';
import { parseManualAdText, parseMetaAdLibraryUrls } from '../src/extension/manualImport/importParsers.ts';
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Network must not be used'); };
try {
  const shop = 'https://shop.example/Products/Chair?code=A%2FB';
  const wrap = value => `https://l.facebook.com/l.php?u=${encodeURIComponent(value)}`;
  assert.equal(resolveObservedDestinationUrl(wrap(shop)), shop);
  assert.equal(resolveObservedDestinationUrl(wrap(wrap(shop))), shop);
  assert.equal(classifyDestination({ destinationUrl: wrap(shop), destinationDomain: 'facebook.com' }).destinationDomain, 'shop.example');
  assert.equal(observedWebsiteState('https://wa.me/8801700000000', 'shop.example'), 'unknown');
  assert.equal(classifyDestination({ destinationUrl: wrap('https://wa.me/8801700000000') }).destinationType, 'MESSAGING');
  assert.equal(classifyDestination({ destinationUrl: 'https://shop.example/lead_gen/instant_form' }).destinationType, 'EXTERNAL_WEBSITE');
  assert.equal(classifyDestination({ destinationUrl: 'https://shop.example/?q=facebook.com/messages' }).destinationType, 'EXTERNAL_WEBSITE');
  assert.equal(classifyDestination({ destinationUrl: 'https://business.facebook.com/example' }).destinationType, 'OTHER');
  assert.equal(classifyDestination({ destinationUrl: 'https://web.whatsapp.com/' }).destinationType, 'MESSAGING');
  assert.equal(classifyDestination({ destinationUrl: 'https://bit.ly/something' }).destinationType, 'UNKNOWN');
  for (const url of ['file:///tmp/a', 'ftp://shop.example/a', wrap('javascript:alert(1)'), 'https://user:password@shop.example/']) {
    assert.equal(observedWebsiteState(url, 'shop.example'), 'unknown');
  }
  const row = extensionLeadToResultRowViewModel({ id: 'link-test', name: 'Shop', destinationUrl: wrap(shop), destinationDomain: 'facebook.com' });
  assert.equal(row.websiteUrl, shop);
  const pasted = parseManualAdText(`Library ID: 885500000000099\nActive\nShop Furniture\nSponsored\nFurniture in Dhaka.\nShop Now\n${wrap(shop)}`).candidates[0];
  assert.equal(pasted.destinationUrl, shop);
  assert.equal(pasted.destinationDomain, 'shop.example');
  assert.equal(pasted.facebookPageUrl, undefined);
  assert.equal(parseMetaAdLibraryUrls('https://facebook.com.evil.example/ads/library/?id=885500000000099').candidates.length, 0);
  console.log('PASS: offline destination and paste-parser checks; no API, token, fetch, or paid service.');
} finally { globalThis.fetch = originalFetch; }
