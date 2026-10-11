import assert from 'assert';
import {
  extractAdIdentifier,
  sanitizeAdLibraryIds,
  aggregateCandidatesToLeads
} from '../src/extension/metaAdapter.ts';
import { mergeCandidateIntoEntity } from '../src/extension/entityResolver.ts';
import { LeadRelevanceEngine, BOUNDED_TAXONOMY } from '../src/extension/relevanceEngine.ts';
import { evaluateStrictRelevanceV3 } from '../src/extension/evidenceWaterfall.ts';

console.log('================================================================');
console.log('LEADNORIA v1.7.5 QUALIFICATION ACCURACY & ID INTEGRITY TEST SUITE');
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

// ============================================================================
// 1. QUALIFICATION ACCURACY: FALSE POSITIVES, CONTRADICTIONS & ACCESSORIES
// ============================================================================
console.log('--- 1. QUALIFICATION ACCURACY: FALSE POSITIVES, CONTRADICTIONS & ACCESSORIES ---');

runTest('1.1 Psychic Sofa is strictly rejected as NOT_RELEVANT with REJECT_CONTRADICTION_IDENTITY', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'Psychic Sofa',
    adText: 'Download For Free & Connect Instantly with Top UK Psychics✨ Seeking clarity? With over 25 years of experience, Psychic Sofa offers trusted readings at your fingertips. Download our app now for free and gain real-time guidance. Get 15% Free Minutes In Our App Wallet. Install Now',
    destinationDomain: '',
    ctaText: 'Install Now',
    matchedKeyword: 'Sofa'
  };

  const v2Result = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.strictEqual(v2Result.decision, 'NOT_RELEVANT', 'v2 must reject Psychic Sofa');
  assert.ok(v2Result.conflicts.some(c => c.reasonCode.includes('REJECT_CONTRADICTION') || c.reasonCode.includes('CONFLICT')), 'Must register contradiction conflict');

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'NOT_RELEVANT', 'v3 must reject Psychic Sofa');
  assert.strictEqual(v3Result.confidence, 'HIGH');
  assert.ok(v3Result.reasonCode.includes('REJECT_CONTRADICTION'), `Expected contradiction reasonCode, got: ${v3Result.reasonCode}`);
  assert.ok(v3Result.reasons[0].includes('astrology_psychic_spiritual') || v3Result.reasons[0].includes('psychic'));
});

runTest('1.2 Isolated product name with commercial CTA but zero furniture catalog terms is UNCERTAIN', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'The Red Sofa',
    adText: 'Check out our latest lifestyle and productivity app. Sign up today for a 14-day free trial.',
    destinationDomain: 'redsofaapp.io',
    ctaText: 'Sign Up',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.notStrictEqual(v3Result.decision, 'RELEVANT', 'Must NOT qualify as RELEVANT solely due to "sofa" in name + CTA');
  assert.ok(v3Result.decision === 'UNCERTAIN' || v3Result.decision === 'NOT_RELEVANT');
});

runTest('1.3 Accessory-only slipcover business is classified as UNCERTAIN with UNCERTAIN_ACCESSORY_ONLY', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'Sofa Cover Tex Turkish',
    adText: 'Elastic stretchable sofa cover set for 3+2+1 seater couches. Protect your furniture with dust-proof covers. Free delivery nationwide.',
    destinationDomain: 'sofacovertex.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'UNCERTAIN', 'Accessory-only candidate must be UNCERTAIN, not RELEVANT');
  assert.strictEqual(v3Result.reasonCode, 'UNCERTAIN_ACCESSORY_ONLY');
  assert.ok(v3Result.reasons[0].includes('accessories'));
});

runTest('1.4 Legitimate retailer with root vertical descriptor in name is RELEVANT (GRID Furniture)', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'GRID Furniture',
    adText: 'Handcrafted solid wood sofa sets and living room furniture. Visit our showroom.',
    destinationDomain: 'gridfurniture.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'RELEVANT');
  assert.strictEqual(v3Result.confidence, 'HIGH');
  assert.strictEqual(v3Result.reasonCode, 'ACCEPT_STRONG_ENTITY_MATCH');
});

runTest('1.5 Legitimate retailer with non-literal brand and rich catalog ad copy is RELEVANT (Interio by Godrej)', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'Interio by Godrej',
    adText: 'Upgrade your home with our luxury sofa collections, dining tables, ergonomic chairs, and wardrobes. Special showroom discounts available.',
    destinationDomain: 'godrejinterio.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'Sofa'
  };

  const v3Result = evaluateStrictRelevanceV3(cand, intent);
  assert.strictEqual(v3Result.decision, 'RELEVANT');
  assert.strictEqual(v3Result.confidence, 'HIGH');
  assert.strictEqual(v3Result.reasonCode, 'ACCEPT_MULTI_SIGNAL_MATCH');
});

// ============================================================================
// 2. BOUNDED TAXONOMY RESOLUTION: FURNITURE, SOFA, OFFICE FURNITURE & UNRELATED
// ============================================================================
console.log('\n--- 2. BOUNDED TAXONOMY RESOLUTION ---');

runTest('2.1 "Furniture" cleanly activates furniture taxonomy', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Furniture']);
  const cand = {
    advertiserName: 'Otobi',
    adText: 'Office workstations, executive desks, and conference tables.',
    destinationDomain: 'otobi.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'Furniture'
  };
  const res = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.strictEqual(res.decision, 'RELEVANT');
});

runTest('2.2 "Sofa" cleanly activates furniture taxonomy with full catalog terms', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Sofa']);
  const cand = {
    advertiserName: 'Hatil Complex',
    adText: 'Sectional couch, recliner, center table, and dining set.',
    destinationDomain: 'hatil.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'Sofa'
  };
  const res = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.strictEqual(res.decision, 'RELEVANT');
});

runTest('2.3 "Office Furniture" cleanly activates furniture taxonomy', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Office Furniture']);
  const cand = {
    advertiserName: 'ErgoTech Office',
    adText: 'Ergonomic chairs, standing desks, conference tables, and office cubicles.',
    destinationDomain: 'ergotechoffice.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'Office Furniture'
  };
  const res = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.strictEqual(res.decision, 'RELEVANT');
});

runTest('2.4 Unrelated vertical (Dental Clinic) activates dental taxonomy, NOT furniture', () => {
  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Dental Clinic']);
  const cand = {
    advertiserName: 'Otobi Furniture',
    adText: 'Solid wood living room sofa and dining chairs.',
    matchedKeyword: 'Dental Clinic'
  };
  const res = LeadRelevanceEngine.evaluateCandidate(cand, intent);
  assert.notStrictEqual(res.decision, 'RELEVANT', 'Furniture business must not qualify for dental query');
});

// ============================================================================
// 3. AD LIBRARY ID INTEGRITY & MULTI-LOCALE BOUNDARY EXTRACTION
// ============================================================================
console.log('\n--- 3. AD LIBRARY ID INTEGRITY & MULTI-LOCALE BOUNDARY EXTRACTION ---');

runTest('3.1 Multi-locale month boundaries isolate ID accurately without digit truncation', () => {
  const testCases = [
    { text: 'Library ID: 1522103275955650 18 Jan 2025', expected: '1522103275955650' },
    { text: 'ID de la biblioteca: 947494491743533 11 Feb 2025', expected: '947494491743533' },
    { text: 'Identifiant de la bibliothèque: 1894613738612182 26 Mars 2025', expected: '1894613738612182' },
    { text: 'Bibliotheks-ID: 777666555444333 14 Apr 2025', expected: '777666555444333' },
    { text: 'ID della libreria: 666555444333222 22 Mag 2025', expected: '666555444333222' },
    { text: 'ID da biblioteca: 444555666777888 19 Ago 2025', expected: '444555666777888' }
  ];

  for (const tc of testCases) {
    const res = extractAdIdentifier(tc.text);
    assert.ok(res, `Failed on ${tc.text}`);
    assert.strictEqual(res.id, tc.expected, `Expected ${tc.expected}, got ${res.id}`);
    assert.strictEqual(res.isAmbiguous, undefined);
  }
});

runTest('3.2 Variable length clean IDs (15, 16, 17 digits) remain unaltered', () => {
  const ids = ['123456789012345', '1234567890123456', '12345678901234567'];
  for (const id of ids) {
    const res = extractAdIdentifier(`Library ID: ${id}`);
    assert.ok(res);
    assert.strictEqual(res.id, id);
  }
});

// ============================================================================
// 4. METRIC INTEGRITY: activeAdCount & DEDUPLICATION RECONCILIATION
// ============================================================================
console.log('\n--- 4. METRIC INTEGRITY: activeAdCount & DEDUPLICATION RECONCILIATION ---');

runTest('4.1 activeAdCount is strictly 0 when all candidate cards are inactive', () => {
  const cands = [
    {
      pageName: 'Heritage Furniture',
      libraryId: '100110021003100',
      isActive: false,
      bodyCopy: 'Antique oak dining tables and armchairs.',
      ctaText: 'Shop Now'
    }
  ];

  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Furniture']);
  const agg = aggregateCandidatesToLeads(cands, 'BD', 'Bangladesh', 10, [], intent);
  assert.strictEqual(agg.leads.length, 1);
  const lead = agg.leads[0];
  assert.strictEqual(lead.adCount, 1, 'adCount must equal 1');
  assert.strictEqual(lead.activeAdCount, 0, 'activeAdCount must be 0 for inactive ad');
  assert.strictEqual(lead.activeAdLibraryIds.length, 0);
  assert.strictEqual(lead.adLibraryIds.length, 1);
});

runTest('4.2 activeAdCount reflects exact count of active ads in mixed batch', () => {
  const cands = [
    {
      pageName: 'Modern Furniture Store',
      libraryId: '200120022003201',
      isActive: true,
      bodyCopy: 'Modern minimalist sofa and coffee tables.',
      ctaText: 'Shop Now'
    },
    {
      pageName: 'Modern Furniture Store',
      libraryId: '200120022003202',
      isActive: false,
      bodyCopy: 'Old catalog bed frames.',
      ctaText: 'Contact Us'
    }
  ];

  const intent = LeadRelevanceEngine.compileResearchIntent('CUSTOM', ['Furniture']);
  const agg = aggregateCandidatesToLeads(cands, 'BD', 'Bangladesh', 10, [], intent);
  assert.strictEqual(agg.leads.length, 1);
  const lead = agg.leads[0];
  assert.strictEqual(lead.adCount, 2, 'Total adCount must be 2');
  assert.strictEqual(lead.activeAdCount, 1, 'activeAdCount must be exactly 1');
  assert.deepStrictEqual(lead.activeAdLibraryIds, ['200120022003201']);
});

runTest('4.3 mergeCandidateIntoEntity preserves activeAdCount = 0 for inactive merge', () => {
  const entity = {
    name: 'Old Craft Store',
    adLibraryIds: ['300130023003301'],
    activeAdLibraryIds: [],
    adCount: 1,
    activeAdCount: 0,
    matchedKeywords: ['Furniture']
  };

  const candInactive = {
    pageName: 'Old Craft Store',
    libraryId: '300130023003302',
    isActive: false
  };

  mergeCandidateIntoEntity(entity, candInactive, { reason: 'Test', confidence: 'HIGH' });
  assert.strictEqual(entity.adCount, 2);
  assert.strictEqual(entity.activeAdCount, 0, 'Must remain 0 when merged ad is also inactive');
  assert.strictEqual(entity.activeAdLibraryIds.length, 0);
});

console.log('\n================================================================');
console.log(`ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================');
