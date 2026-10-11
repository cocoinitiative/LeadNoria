import assert from 'assert';
import {
  extractAdIdentifier,
  sanitizeAdLibraryIds,
  extractAdCardsWithDiagnostics,
  aggregateCandidatesToLeads
} from '../src/extension/metaAdapter.ts';
import { mergeCandidateIntoEntity } from '../src/extension/entityResolver.ts';
import { LeadRelevanceEngine } from '../src/extension/relevanceEngine.ts';
import { evaluateStrictRelevanceV3 } from '../src/extension/evidenceWaterfall.ts';

console.log('================================================================');
console.log('LEADNORIA v1.7.4 DATA-INTEGRITY HARDENING & QUALIFICATION SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

function makeMockElement(tag, text = '', attrs = {}, children = []) {
  const el = {
    tagName: tag.toUpperCase(),
    textContent: text,
    innerText: text,
    className: attrs.class || '',
    attributes: attrs,
    href: attrs.href || '',
    getAttribute(name) { return attrs[name] || null; },
    children: children,
    parentElement: null,
    querySelectorAll(selector) {
      const found = [];
      function walk(n) {
        for (const c of n.children) {
          if (selector === 'a' && c.tagName === 'A') found.push(c);
          else if (selector.includes('ads/library') && c.tagName === 'A' && (c.href || '').includes('ads/library')) found.push(c);
          else if (selector.includes('span') && c.tagName === 'SPAN') found.push(c);
          else if (selector.includes('div') && c.tagName === 'DIV') found.push(c);
          else if (selector.includes('input') && c.tagName === 'INPUT') found.push(c);
          walk(c);
        }
      }
      walk(el);
      return found;
    },
    querySelector(selector) {
      const all = el.querySelectorAll(selector);
      return all[0] || null;
    }
  };
  for (const c of children) {
    c.parentElement = el;
  }
  return el;
}

// ============================================================================
// 1. AD LIBRARY ID EXTRACTION AT SOURCE (NO BLIND 16-DIGIT SLICING)
// ============================================================================
console.log('--- 1. AD LIBRARY ID EXTRACTION & BOUNDARY ISOLATION ---');

runTest('1.1 Clean leaf element ID extraction with exact boundary', () => {
  const result = extractAdIdentifier('Library ID: 1522103275955650');
  assert.ok(result);
  assert.strictEqual(result.id, '1522103275955650');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.strictEqual(result.isAmbiguous, undefined);
});

runTest('1.2 Clean ID of length 15 (does not slice or alter)', () => {
  const result = extractAdIdentifier('Library ID: 947494491743533');
  assert.ok(result);
  assert.strictEqual(result.id, '947494491743533');
  assert.strictEqual(result.confidence, 'HIGH');
});

runTest('1.3 Clean ID of length 17 (does not slice or assume 16-digit limit)', () => {
  const result = extractAdIdentifier('Library ID: 18946137386121822');
  assert.ok(result);
  assert.strictEqual(result.id, '18946137386121822');
  assert.strictEqual(result.confidence, 'HIGH');
});

runTest('1.4 Directly fused non-digit text returns isAmbiguous rather than silently slicing', () => {
  const result = extractAdIdentifier('Library ID: 1522103275955650Nov2024');
  assert.ok(result);
  assert.strictEqual(result.isAmbiguous, true);
  assert.ok(result.ambiguityReason?.includes('Ambiguous boundary'));
});

runTest('1.5 DOM extraction prefers leaf element and avoids ancestor date concatenation', () => {
  const idSpan = makeMockElement('span', 'Library ID: 1522103275955650');
  const idContainer = makeMockElement('div', 'Library ID: 1522103275955650', {}, [idSpan]);
  const dateSpan = makeMockElement('span', '18 Nov 2024');
  const dateContainer = makeMockElement('div', '18 Nov 2024', {}, [dateSpan]);
  const infoHeader = makeMockElement('div', 'Library ID: 152210327595565018 Nov 2024', {}, [idContainer, dateContainer]);
  const brandLink = makeMockElement('a', 'HATIL', { href: 'https://facebook.com/hatilbd' });
  const cardBody = makeMockElement('div', 'Modern sofa set for living room', {}, [brandLink]);
  const cardRoot = makeMockElement('div', 'Library ID: 152210327595565018 Nov 2024 Modern sofa set for living room', { class: 'ad-card', role: 'article' }, [infoHeader, cardBody]);

  const allElements = [cardRoot, infoHeader, idContainer, idSpan, dateContainer, dateSpan, cardBody, brandLink];
  const doc = {
    body: { textContent: '' },
    documentElement: { textContent: '' },
    querySelectorAll(sel) {
      if (sel.includes('ads/library')) return [];
      return allElements;
    }
  };

  const result = extractAdCardsWithDiagnostics(doc, 'Sofa');
  assert.strictEqual(result.candidates.length, 1);
  assert.strictEqual(result.candidates[0].libraryId, '1522103275955650');
  assert.notStrictEqual(result.candidates[0].libraryId, '152210327595565018');
});

runTest('1.6 Verified Ad Library detail link takes precedence over ambiguous DOM text', () => {
  const detailLink = makeMockElement('a', 'Ad Details', { href: 'https://www.facebook.com/ads/library/?id=1522103275955650' });
  const brandLink = makeMockElement('a', 'HATIL', { href: 'https://facebook.com/hatilbd' });
  const idText = makeMockElement('span', 'Library ID: 1522103275955650');
  const cardRoot = makeMockElement('div', 'Library ID: 1522103275955650 Active', { class: 'ad-card', role: 'article' }, [brandLink, detailLink, idText]);

  const allElements = [cardRoot, brandLink, detailLink, idText];
  const doc = {
    body: { textContent: '' },
    documentElement: { textContent: '' },
    querySelectorAll(sel) {
      if (sel.includes('ads/library')) return [detailLink];
      return allElements;
    }
  };

  const result = extractAdCardsWithDiagnostics(doc, 'Sofa');
  assert.strictEqual(result.candidates.length, 1);
  assert.strictEqual(result.candidates[0].libraryId, '1522103275955650');
});

// ============================================================================
// 2. DEFENSIVE ID VALIDATION & DEDUPLICATION
// ============================================================================
console.log('\n--- 2. DEFENSIVE ID VALIDATION & DEDUPLICATION ---');

runTest('2.1 String-based comparison preserves distinct valid IDs with common prefixes', () => {
  const ids = ['1522103275955650', '15221032759556501'];
  const sanitized = sanitizeAdLibraryIds(ids);
  assert.strictEqual(sanitized.length, 2);
  assert.ok(sanitized.includes('1522103275955650'));
  assert.ok(sanitized.includes('15221032759556501'));
});

runTest('2.2 Deduplicates repeated observations of the same ID', () => {
  const ids = ['1522103275955650', '1522103275955650', ' 1522103275955650 '];
  const sanitized = sanitizeAdLibraryIds(ids);
  assert.strictEqual(sanitized.length, 1);
  assert.strictEqual(sanitized[0], '1522103275955650');
});

runTest('2.3 Multiple valid ads belonging to one advertiser remain represented', () => {
  const lead = {
    id: 'lead_1',
    name: 'HATIL',
    canonicalName: 'HATIL',
    facebookPageName: 'HATIL',
    facebookPageState: 'found',
    websiteState: 'found',
    activeAdCount: 1,
    adLibraryIds: ['1522103275955650'],
    matchedKeywords: ['Sofa'],
    locationCode: 'BD',
    locationName: 'Bangladesh',
    status: 'QUALIFIED',
    discoveredAt: new Date().toISOString()
  };

  const newCand = {
    libraryId: '947494491743533',
    pageName: 'HATIL',
    isActive: true,
    observedKeyword: 'Sofa'
  };

  mergeCandidateIntoEntity(lead, newCand, { shouldMerge: true, targetKey: 'hatil', confidence: 'STRONG', reason: 'MERGE', relationshipType: 'SAME_PAGE' });

  assert.strictEqual(lead.adLibraryIds.length, 2);
  assert.ok(lead.adLibraryIds.includes('1522103275955650'));
  assert.ok(lead.adLibraryIds.includes('947494491743533'));
  assert.strictEqual(lead.activeAdCount, 2);
  assert.strictEqual(lead.adCount, 2);
});

// ============================================================================
// 3. SEMANTIC COUNTS CORRECTNESS
// ============================================================================
console.log('\n--- 3. SEMANTIC COUNTS CORRECTNESS ---');

runTest('3.1 activeAdCount accurately counts validated active ads, not inactive ones', () => {
  const candidates = [
    { libraryId: '111111111111111', pageName: 'Otobi', isActive: true, observedKeyword: 'Sofa' },
    { libraryId: '222222222222222', pageName: 'Otobi', isActive: false, observedKeyword: 'Sofa' },
    { libraryId: '333333333333333', pageName: 'Otobi', isActive: true, observedKeyword: 'Sofa' },
    { libraryId: '111111111111111', pageName: 'Otobi', isActive: true, observedKeyword: 'Sofa' } // Duplicate
  ];

  const { leads } = aggregateCandidatesToLeads(candidates, 'BD', 'Bangladesh');
  assert.strictEqual(leads.length, 1);
  const otobiLead = leads[0];
  assert.strictEqual(otobiLead.adLibraryIds.length, 3, 'Unique total ads');
  assert.strictEqual(otobiLead.activeAdCount, 2, 'Unique active ads');
  assert.strictEqual(otobiLead.adCount, 3);
});

runTest('3.2 Repeated batches do not cause double counting', () => {
  const lead = {
    id: 'lead_test',
    name: 'Regal Furniture',
    canonicalName: 'Regal Furniture',
    facebookPageName: 'Regal Furniture',
    facebookPageState: 'found',
    websiteState: 'found',
    activeAdCount: 1,
    adCount: 1,
    adLibraryIds: ['555555555555555'],
    activeAdLibraryIds: ['555555555555555'],
    matchedKeywords: ['Furniture'],
    locationCode: 'BD',
    locationName: 'Bangladesh',
    status: 'QUALIFIED',
    discoveredAt: new Date().toISOString()
  };

  const sameCand = {
    libraryId: '555555555555555',
    pageName: 'Regal Furniture',
    isActive: true,
    observedKeyword: 'Furniture'
  };

  // Repeated merge of same candidate card
  mergeCandidateIntoEntity(lead, sameCand, { shouldMerge: true, targetKey: 'regal', confidence: 'STRONG', reason: 'MERGE', relationshipType: 'SAME_PAGE' });

  assert.strictEqual(lead.adLibraryIds.length, 1);
  assert.strictEqual(lead.activeAdCount, 1);
  assert.strictEqual(lead.adCount, 1);
});

// ============================================================================
// 4. QUALIFICATION REPAIR: SOFA & FURNITURE
// ============================================================================
console.log('\n--- 4. QUALIFICATION REPAIR: SOFA & FURNITURE ---');

runTest('4.1 Sofa query activates Furniture taxonomy in LeadRelevanceEngine', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    pageName: 'Hatil Furniture',
    bodyCopy: 'Modern 3 seater wooden sofa set with fabric upholstery and center table. Shop now at hatil.com',
    destinationUrl: 'https://hatil.com/living-room/sofas',
    destinationDomain: 'hatil.com',
    ctaText: 'Shop Now',
    observedKeyword: 'Sofa'
  };

  const result = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.strictEqual(result.decision, 'RELEVANT');
  assert.strictEqual(result.confidence, 'HIGH');
  assert.ok(result.score >= 0.60);
  assert.ok(result.matchedTerms.includes('sofa'));
  assert.ok(result.matchedTerms.includes('furniture'));
});

runTest('4.2 Sofa retailer without "furniture" in brand name qualifies via multi-signal catalog evidence', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    pageName: 'Otobi',
    bodyCopy: 'Modern 3 seater wooden sofa set with fabric upholstery and center table. Living room collection.',
    destinationUrl: 'https://otobi.com/living-room/sofas',
    destinationDomain: 'otobi.com',
    ctaText: 'Shop Now',
    observedKeyword: 'Sofa'
  };

  const result = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.strictEqual(result.decision, 'RELEVANT');
  assert.ok(result.score >= 0.50);
});

runTest('4.3 evaluateStrictRelevanceV3 qualifies Sofa retailer with high confidence', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'Brothers Furniture',
    adText: 'Premium genuine leather sofa set, corner couch, and coffee table. Visit showroom today.',
    destinationDomain: 'brothersfurniture.com.bd',
    destinationUrl: 'https://brothersfurniture.com.bd/sofa',
    ctaText: 'Shop Now',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'RELEVANT');
  assert.strictEqual(v3Result.confidence, 'HIGH');
  assert.strictEqual(v3Result.reasonCode, 'ACCEPT_STRONG_ENTITY_MATCH');
});

runTest('4.4 Hard contradiction gate strictly rejects sports team for Sofa query', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'Manchester United Official Fan Club',
    adText: 'Watch the Premier League match live on your sofa! Official club merchandise and tickets.',
    destinationDomain: 'manutd.com',
    ctaText: 'Join Now',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'NOT_RELEVANT');
  assert.strictEqual(v3Result.confidence, 'HIGH');
  assert.ok(v3Result.reasonCode.includes('REJECT_CONTRADICTION'));
});

runTest('4.5 Weak passing keyword mention without business identity remains UNCERTAIN', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'General Lifestyle Blog',
    adText: 'Here are 5 life hacks while reading a book on your sofa.',
    destinationDomain: 'lifestyleblog.com',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'UNCERTAIN');
  assert.strictEqual(v3Result.reasonCode, 'UNCERTAIN_KEYWORD_ONLY');
});

console.log('\n================================================================');
console.log(`ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================');
