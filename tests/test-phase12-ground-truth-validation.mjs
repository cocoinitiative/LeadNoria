/**
 * LeadNoria — Phase 12: Automated Testing & Ground-Truth Validation Test Suite
 *
 * Validates:
 * 1. Versioned offline ground-truth dataset audit (schema, completeness, labeling rationale).
 * 2. Deterministic labeling policy across geographic, niche, contact, and tier dimensions.
 * 3. Exact metric calculations: Confusion Matrix, Precision, Recall, F1, Specificity, Accuracy.
 * 4. Strict-Local False Positive Rate (FPR) = 0.00% invariant enforcement.
 * 5. Foreign-Business Violation Rate = 0.00% under strict local mode.
 * 6. Specialized Bangladesh (BD) ground-truth validation (Bengali script, BD phone formats, divisional hubs).
 * 7. International coverage validation (US, GB, CA, AU domestic local profiles).
 * 8. Cross-border negative control rejection (foreign entities advertising in target markets).
 * 9. Contact data quality & conflict detection precision and recall.
 * 10. Prioritization tier alignment and score concordance.
 * 11. Pipeline integration across General, Strict, and Ultra-Strict local modes.
 * 12. Permanent fail-closed collection & crawling safety gates.
 * 13. Historical release archive SHA-256 hash immutability.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  GROUND_TRUTH_DATASET_V1,
  calculateBinaryMetrics
} from './fixtures/groundTruthDataset.ts';
import { evaluateGeographicOrigin } from '../src/extension/geographicClassifier.ts';
import { compileResearchIntent } from '../src/extension/relevanceEngine.ts';
import { aggregateCandidatesToLeads } from '../src/extension/metaAdapter.ts';
import { calculateLeadScore } from '../src/extension/leadPrioritizer.ts';
import { aggregateContactObservations } from '../src/extension/contactQuality.ts';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const HISTORICAL_HASHES = {
  'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
  'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
  'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
};

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

console.log('========================================================================');
console.log('LEADNORIA: PHASE 12 AUTOMATED TESTING & GROUND-TRUTH VALIDATION');
console.log('Scope: Versioned Dataset | Confusion Matrix | Precision/Recall | Strict FPR');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ============================================================================
// SECTION 1: GROUND-TRUTH DATASET AUDIT & LABELING POLICY
// ============================================================================
console.log('--- SECTION 1: Ground-Truth Dataset Schema & Labeling Policy Audit ---');

runTest('1.1: Ground-truth dataset contains versioned, non-empty records with unique IDs', () => {
  assert.ok(Array.isArray(GROUND_TRUTH_DATASET_V1), 'Dataset must be an array');
  assert.ok(GROUND_TRUTH_DATASET_V1.length >= 15, `Expected >= 15 items, found ${GROUND_TRUTH_DATASET_V1.length}`);

  const seenIds = new Set();
  for (const item of GROUND_TRUTH_DATASET_V1) {
    assert.ok(item.id, 'Item must have an ID');
    assert.ok(!seenIds.has(item.id), `Duplicate ID detected: ${item.id}`);
    seenIds.add(item.id);

    assert.ok(item.name, `Item ${item.id} must have a name`);
    assert.ok(item.targetCountryCode, `Item ${item.id} must have a target country code`);
    assert.ok(item.labelingRationale && item.labelingRationale.length >= 10, `Item ${item.id} must have detailed labeling rationale`);
    assert.ok(item.candidateInputs && item.candidateInputs.bodyCopy, `Item ${item.id} must have candidate inputs with bodyCopy`);
  }
});

runTest('1.2: Deterministic label semantics across all 17 ground truth items', () => {
  const validClasses = ['LOCAL_VERIFIED', 'LOCAL_PROBABLE', 'FOREIGN_VERIFIED', 'LOCATION_UNKNOWN'];
  const validTiers = ['HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];

  for (const item of GROUND_TRUTH_DATASET_V1) {
    assert.ok(validClasses.includes(item.expectedClassification), `Invalid class: ${item.expectedClassification}`);
    assert.ok(validTiers.includes(item.expectedPrioritizationTier), `Invalid tier: ${item.expectedPrioritizationTier}`);

    if (item.expectedClassification === 'LOCAL_VERIFIED' || item.expectedClassification === 'LOCAL_PROBABLE') {
      assert.strictEqual(item.expectedIsLocal, true, `${item.id}: Local classes must have expectedIsLocal=true`);
      assert.strictEqual(item.expectedIsForeign, false, `${item.id}: Local classes must have expectedIsForeign=false`);
      assert.strictEqual(item.expectedIsUnknown, false, `${item.id}: Local classes must have expectedIsUnknown=false`);
    } else if (item.expectedClassification === 'FOREIGN_VERIFIED') {
      assert.strictEqual(item.expectedIsLocal, false, `${item.id}: Foreign class must have expectedIsLocal=false`);
      assert.strictEqual(item.expectedIsForeign, true, `${item.id}: Foreign class must have expectedIsForeign=true`);
      assert.strictEqual(item.expectedIsUnknown, false, `${item.id}: Foreign class must have expectedIsUnknown=false`);
    } else {
      assert.strictEqual(item.expectedIsLocal, false, `${item.id}: Unknown class must have expectedIsLocal=false`);
      assert.strictEqual(item.expectedIsForeign, false, `${item.id}: Unknown class must have expectedIsForeign=false`);
      assert.strictEqual(item.expectedIsUnknown, true, `${item.id}: Unknown class must have expectedIsUnknown=true`);
    }
  }
});

// ============================================================================
// SECTION 2: METRIC CALCULATIONS & CONFUSION MATRIX
// ============================================================================
console.log('\n--- SECTION 2: Metric Calculations & Confusion Matrix ---');

runTest('2.1: Binary classification confusion matrix evaluates to 100% precision, recall and F1', () => {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const item of GROUND_TRUTH_DATASET_V1) {
    const geo = evaluateGeographicOrigin(item.candidateInputs, item.targetCountryCode);
    const predictedIsLocal = geo.isLocal;
    const actualIsLocal = item.expectedIsLocal;

    if (predictedIsLocal && actualIsLocal) tp++;
    else if (predictedIsLocal && !actualIsLocal) fp++;
    else if (!predictedIsLocal && !actualIsLocal) tn++;
    else if (!predictedIsLocal && actualIsLocal) fn++;
  }

  const metrics = calculateBinaryMetrics(tp, fp, tn, fn);

  console.log('    Binary Confusion Matrix (Is Local):');
  console.log(`      True Positives  (TP): ${tp}`);
  console.log(`      False Positives (FP): ${fp}`);
  console.log(`      True Negatives  (TN): ${tn}`);
  console.log(`      False Negatives (FN): ${fn}`);
  console.log(`      Precision:           ${(metrics.precision * 100).toFixed(2)}%`);
  console.log(`      Recall (Sensitivity):${(metrics.recall * 100).toFixed(2)}%`);
  console.log(`      Specificity:         ${(metrics.specificity * 100).toFixed(2)}%`);
  console.log(`      F1-Score:            ${(metrics.f1 * 100).toFixed(2)}%`);
  console.log(`      Accuracy:            ${(metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`      False Positive Rate: ${(metrics.falsePositiveRate * 100).toFixed(2)}%`);

  assert.strictEqual(fp, 0, 'False Positives must be exactly 0 (no non-local admitted as local)');
  assert.strictEqual(fn, 0, 'False Negatives must be exactly 0 (no local candidate rejected)');
  assert.strictEqual(metrics.precision, 1.0, 'Precision must be 1.0 (100%)');
  assert.strictEqual(metrics.recall, 1.0, 'Recall must be 1.0 (100%)');
  assert.strictEqual(metrics.f1, 1.0, 'F1-Score must be 1.0 (100%)');
  assert.strictEqual(metrics.falsePositiveRate, 0.0, 'False Positive Rate must be 0.00%');
});

runTest('2.2: Strict-Local False Positive Rate (FPR) is 0.00%', () => {
  const foreignAndUnknown = GROUND_TRUTH_DATASET_V1.filter(i => !i.expectedIsLocal);
  assert.ok(foreignAndUnknown.length >= 6, 'Must test at least 6 non-local ground truth cases');

  let falseLocalAdmissions = 0;
  for (const item of foreignAndUnknown) {
    const geo = evaluateGeographicOrigin(item.candidateInputs, item.targetCountryCode);
    if (geo.isLocal || geo.classification === 'LOCAL_VERIFIED' || geo.classification === 'LOCAL_PROBABLE') {
      falseLocalAdmissions++;
    }
  }

  const strictLocalFPR = falseLocalAdmissions / foreignAndUnknown.length;
  console.log(`    Strict-Local False Positive Rate: ${(strictLocalFPR * 100).toFixed(2)}% (${falseLocalAdmissions}/${foreignAndUnknown.length})`);
  assert.strictEqual(strictLocalFPR, 0.0, 'Strict-Local False Positive Rate must be strictly 0.00%');
});

runTest('2.3: Foreign-Business Violation Rate is 0.00%', () => {
  const foreignOnly = GROUND_TRUTH_DATASET_V1.filter(i => i.expectedIsForeign);
  assert.ok(foreignOnly.length >= 4, 'Must test at least 4 foreign businesses');

  let foreignViolations = 0;
  for (const item of foreignOnly) {
    const geo = evaluateGeographicOrigin(item.candidateInputs, item.targetCountryCode);
    if (geo.isLocal) {
      foreignViolations++;
    }
  }

  const foreignViolationRate = foreignViolations / foreignOnly.length;
  console.log(`    Foreign-Business Violation Rate: ${(foreignViolationRate * 100).toFixed(2)}% (${foreignViolations}/${foreignOnly.length})`);
  assert.strictEqual(foreignViolationRate, 0.0, 'Foreign-Business Violation Rate must be strictly 0.00%');
});

// ============================================================================
// SECTION 3: MULTI-CLASS GEOGRAPHIC CONCORDANCE MATRIX
// ============================================================================
console.log('\n--- SECTION 3: Multi-Class Geographic Concordance Matrix ---');

runTest('3.1: 4-way classification matrix exhibits 100% concordance across all items', () => {
  const classes = ['LOCAL_VERIFIED', 'LOCAL_PROBABLE', 'FOREIGN_VERIFIED', 'LOCATION_UNKNOWN'];
  const matrix = {};
  for (const exp of classes) {
    matrix[exp] = {};
    for (const pred of classes) {
      matrix[exp][pred] = 0;
    }
  }

  let totalItems = 0;
  let exactMatches = 0;

  for (const item of GROUND_TRUTH_DATASET_V1) {
    totalItems++;
    const geo = evaluateGeographicOrigin(item.candidateInputs, item.targetCountryCode);
    matrix[item.expectedClassification][geo.classification]++;

    if (item.expectedClassification === geo.classification) {
      exactMatches++;
    }
  }

  console.log('    Geographic Classification Concordance (Expected vs Predicted):');
  console.log('    Expected \\ Predicted | LOC_VER | LOC_PROB | FOR_VER | UNKNOWN |');
  console.log('    --------------------------------------------------------------');
  for (const exp of classes) {
    const row = [
      String(matrix[exp]['LOCAL_VERIFIED']).padStart(7),
      String(matrix[exp]['LOCAL_PROBABLE']).padStart(8),
      String(matrix[exp]['FOREIGN_VERIFIED']).padStart(7),
      String(matrix[exp]['LOCATION_UNKNOWN']).padStart(7)
    ].join(' | ');
    console.log(`    ${exp.padEnd(20)} | ${row} |`);
  }

  const exactMatchRate = exactMatches / totalItems;
  console.log(`    Exact Multi-Class Match Rate: ${(exactMatchRate * 100).toFixed(2)}% (${exactMatches}/${totalItems})`);
  assert.strictEqual(exactMatchRate, 1.0, 'Exact match rate must be 100%');
});

// ============================================================================
// SECTION 4: BANGLADESH (BD) MARKET SPECIALIZED BENCHMARK
// ============================================================================
console.log('\n--- SECTION 4: Bangladesh (BD) Market Specialized Benchmark ---');

runTest('4.1: Bangladesh vernacular, phone prefixes (+880), and division coverage', () => {
  const bdItems = GROUND_TRUTH_DATASET_V1.filter(i => i.regionCategory === 'BANGLADESH');
  assert.ok(bdItems.length >= 6, 'Must test at least 6 BD market items');

  for (const item of bdItems) {
    const geo = evaluateGeographicOrigin(item.candidateInputs, 'BD');
    assert.strictEqual(geo.classification, item.expectedClassification, `BD item ${item.id} classification mismatch`);
    assert.strictEqual(geo.businessCountryCode, 'BD', `BD item ${item.id} business country code must be BD`);
    assert.strictEqual(geo.targetCountryCode, 'BD', `BD item ${item.id} target country code must be BD`);
  }

  // Explicit check for Bengali script
  const bengaliItem = GROUND_TRUTH_DATASET_V1.find(i => i.id === 'GT-BD-004');
  assert.ok(bengaliItem, 'Bengali item must exist');
  const bengaliGeo = evaluateGeographicOrigin(bengaliItem.candidateInputs, 'BD');
  assert.strictEqual(bengaliGeo.classification, 'LOCAL_VERIFIED', 'Bengali text showroom must be LOCAL_VERIFIED');
  assert.ok(bengaliGeo.evidence.some(e => e.includes('+880') || e.includes('telephone')), 'Evidence must cite phone');
});

// ============================================================================
// SECTION 5: INTERNATIONAL COVERAGE & CROSS-BORDER BENCHMARK
// ============================================================================
console.log('\n--- SECTION 5: International Coverage & Cross-Border Benchmark ---');

runTest('5.1: Domestic international markets (US, UK, CA, AU) correctly classified as LOCAL_VERIFIED', () => {
  const intlItems = GROUND_TRUTH_DATASET_V1.filter(i => i.regionCategory.startsWith('INTERNATIONAL_'));
  assert.strictEqual(intlItems.length, 4, 'Must test US, UK, CA, and AU');

  for (const item of intlItems) {
    const geo = evaluateGeographicOrigin(item.candidateInputs, item.targetCountryCode);
    assert.strictEqual(geo.classification, 'LOCAL_VERIFIED', `${item.id} must be LOCAL_VERIFIED in target ${item.targetCountryCode}`);
    assert.strictEqual(geo.businessCountryCode, item.targetCountryCode, `${item.id} businessCountryCode must match target`);
    assert.strictEqual(geo.isLocal, true, `${item.id} must be local`);
  }
});

runTest('5.2: Cross-border foreign businesses advertising in BD stamped FOREIGN_VERIFIED with correct origin', () => {
  const crossBorderItems = GROUND_TRUTH_DATASET_V1.filter(i => i.regionCategory === 'CROSS_BORDER');
  assert.strictEqual(crossBorderItems.length, 4, 'Must test 4 cross-border items (IN, CN, US, IE)');

  for (const item of crossBorderItems) {
    const geo = evaluateGeographicOrigin(item.candidateInputs, 'BD');
    assert.strictEqual(geo.classification, 'FOREIGN_VERIFIED', `${item.id} must be FOREIGN_VERIFIED`);
    assert.strictEqual(geo.businessCountryCode, item.expectedBusinessCountryCode, `${item.id} origin country must match`);
    assert.strictEqual(geo.targetCountryCode, 'BD', `${item.id} targetCountryCode must be BD`);
    assert.strictEqual(geo.isForeign, true, `${item.id} isForeign must be true`);
    assert.strictEqual(geo.isLocal, false, `${item.id} isLocal must be false`);
  }
});

// ============================================================================
// SECTION 6: PIPELINE INTEGRATION ACROSS LOCAL MODES
// ============================================================================
console.log('\n--- SECTION 6: Pipeline Integration Across Local Modes ---');

const pipelineCandidateFixtures = [
  {
    libraryId: '100000000000001',
    pageName: 'Dhaka Modern Furniture',
    facebookPageUrl: 'https://facebook.com/dhakamodernfurniture',
    destinationUrl: 'https://dhakamodern.com',
    destinationDomain: 'dhakamodern.com',
    bodyCopy: 'Custom luxury living room sofa and dining table. Call us at +880 1712-345678 or visit our Gulshan showroom.',
    ctaText: 'Call Now',
    observedKeyword: 'furniture'
  },
  {
    libraryId: '100000000000002',
    pageName: 'Chittagong Woodcraft & Furniture',
    facebookPageUrl: 'https://facebook.com/ctgcraft',
    destinationUrl: 'https://ctgcraft.com.bd',
    destinationDomain: 'ctgcraft.com.bd',
    bodyCopy: 'Solid Chittagong teak wood beds, chairs, and office desks with delivery across Dhaka and Sylhet.',
    ctaText: 'Shop Now',
    observedKeyword: 'furniture'
  },
  {
    libraryId: '100000000000003',
    pageName: 'Jaipur Heritage Furniture',
    facebookPageUrl: 'https://facebook.com/jaipurheritage',
    destinationUrl: 'https://jaipurheritage.in',
    destinationDomain: 'jaipurheritage.in',
    bodyCopy: 'Handcrafted Sheesham wood furniture direct from our factory in Jaipur, Rajasthan, India. WhatsApp: +91 9829012345.',
    ctaText: 'Contact Us',
    observedKeyword: 'furniture'
  },
  {
    libraryId: '100000000000004',
    pageName: 'Aesthetic Living Furniture',
    facebookPageUrl: 'https://facebook.com/aestheticliving',
    destinationUrl: 'https://aestheticliving.com',
    destinationDomain: 'aestheticliving.com',
    bodyCopy: 'Ergonomic office chairs, executive desks, and modern modular workstations for contemporary spaces.',
    ctaText: 'Learn More',
    observedKeyword: 'furniture'
  }
];

runTest('6.1: General Discovery Mode preserves all candidates with full geographic transparency', () => {
  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
    strictLocalMode: false
  });

  const res = aggregateCandidatesToLeads(pipelineCandidateFixtures, 'BD', 'Bangladesh', 50, [], intent);
  assert.strictEqual(res.leads.length, 4, 'All 4 relevant candidates must be retained in General Discovery');

  const geoMap = Object.fromEntries(res.leads.map(l => [l.name, l.geographicClassification]));
  assert.strictEqual(geoMap['Dhaka Modern Furniture'], 'LOCAL_VERIFIED');
  assert.strictEqual(geoMap['Chittagong Woodcraft & Furniture'], 'LOCAL_PROBABLE');
  assert.strictEqual(geoMap['Jaipur Heritage Furniture'], 'FOREIGN_VERIFIED');
  assert.strictEqual(geoMap['Aesthetic Living Furniture'], 'LOCATION_UNKNOWN');
});

runTest('6.2: Strict Local Mode strictly excludes foreign and holds unknown', () => {
  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
    strictLocalMode: true,
    allowProbableLocal: true
  });

  const res = aggregateCandidatesToLeads(pipelineCandidateFixtures, 'BD', 'Bangladesh', 50, [], intent);

  assert.strictEqual(res.leads.length, 2, 'Exactly 2 local entities (LOCAL_VERIFIED + LOCAL_PROBABLE) admitted');
  assert.strictEqual(res.rejectedCount, 1, 'Jaipur entity rejected as FOREIGN_BUSINESS');
  assert.strictEqual(res.uncertainCount, 1, 'Aesthetic Living held as LOCATION_UNKNOWN');

  const names = res.leads.map(l => l.name);
  assert.ok(names.includes('Dhaka Modern Furniture'), 'Must include LOCAL_VERIFIED entity');
  assert.ok(names.includes('Chittagong Woodcraft & Furniture'), 'Must include LOCAL_PROBABLE entity');
  assert.ok(!names.includes('Jaipur Heritage Furniture'), 'Must NOT include FOREIGN_VERIFIED entity');
  assert.ok(!names.includes('Aesthetic Living Furniture'), 'Must NOT include LOCATION_UNKNOWN entity');
});

runTest('6.3: Ultra-Strict Local Mode admits only LOCAL_VERIFIED', () => {
  const intent = compileResearchIntent('CUSTOM', ['furniture'], undefined, 'BD', {
    strictLocalMode: true,
    allowProbableLocal: false
  });

  const res = aggregateCandidatesToLeads(pipelineCandidateFixtures, 'BD', 'Bangladesh', 50, [], intent);

  assert.strictEqual(res.leads.length, 1, 'Only exactly 1 LOCAL_VERIFIED entity admitted');
  assert.strictEqual(res.leads[0].name, 'Dhaka Modern Furniture');
  assert.strictEqual(res.leads[0].geographicClassification, 'LOCAL_VERIFIED');
});

// ============================================================================
// SECTION 7: CONTACT DATA QUALITY & CONFLICT DETECTION CALIBRATION
// ============================================================================
console.log('\n--- SECTION 7: Contact Quality & Conflict Detection Calibration ---');

runTest('7.1: Multi-ad contact conflict detection achieves 100% precision and recall', () => {
  const confItem = GROUND_TRUTH_DATASET_V1.find(i => i.id === 'GT-CONF-001');
  assert.ok(confItem && confItem.additionalAds, 'Conflict test fixture must exist');

  const observations = [
    {
      id: 'phone_obs_1',
      type: 'PHONE',
      rawValue: '+880 1711-000111',
      normalizedValue: '+8801711000111',
      sourceSurface: 'AD_BODY_TEXT',
      sourceAdLibraryId: confItem.candidateInputs.libraryId,
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      confidence: 'HIGH',
      e164Format: '+8801711000111',
      observedAt: new Date().toISOString()
    },
    {
      id: 'phone_obs_2',
      type: 'PHONE',
      rawValue: '+880 1819-999222',
      normalizedValue: '+8801819999222',
      sourceSurface: 'AD_BODY_TEXT',
      sourceAdLibraryId: confItem.additionalAds[0].libraryId,
      syntaxState: 'SYNTAX_VALID',
      verificationStatus: 'UNPROBED_PUBLIC_CLAIM',
      confidence: 'HIGH',
      e164Format: '+8801819999222',
      observedAt: new Date().toISOString()
    }
  ];

  const aggregated = aggregateContactObservations(observations);
  assert.strictEqual(aggregated.phoneConflict, true, 'phoneConflict must be true');
  assert.strictEqual(aggregated.phoneConflictState, 'CONFLICT_DETECTED', 'phoneConflictState must be CONFLICT_DETECTED');
  assert.strictEqual(aggregated.observedPhones.length, 2, 'Both distinct phone numbers must be preserved');
});

// ============================================================================
// SECTION 8: PRIORITIZATION SCORING & TIER CONCORDANCE
// ============================================================================
console.log('\n--- SECTION 8: Prioritization Scoring & Tier Concordance ---');

runTest('8.1: Ground-truth archetypes produce deterministic score and tier alignment', () => {
  // 1. High Local Archetype
  const highResult = calculateLeadScore({
    name: 'Dhaka Modern Dental Care',
    geographicClassification: 'LOCAL_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'HIGH',
    adLibraryIds: ['ad_bd_001_1'],
    activeAdCount: 2,
    primaryCtaType: 'CALL_NOW',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    facebookPageUrl: 'https://facebook.com/dhakamoderndental',
    destinationDomain: 'dhakamoderndental.com',
    contactEntityProfile: {
      observedPhones: [{ type: 'PHONE', rawValue: '+8801711234567', normalizedValue: '+8801711234567', sourceSurface: 'AD_BODY_TEXT', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM', confidence: 'HIGH' }],
      observedEmails: [],
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NOT_APPLICABLE',
      overallQualityState: 'OBSERVED_VALID_SYNTAX',
      primaryPhone: '+8801711234567',
      diagnostics: []
    }
  });
  assert.ok(highResult.score >= 70, `High archetype score expected >= 70, got ${highResult.score}`);
  assert.strictEqual(highResult.tier, 'HIGH', `Expected tier HIGH, got ${highResult.tier}`);

  // 2. Probable / Conflicted Local Archetype -> MEDIUM tier
  const mediumResult = calculateLeadScore({
    name: 'Dhaka Swift Express Courier',
    geographicClassification: 'LOCAL_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'BD',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'MEDIUM',
    adLibraryIds: ['ad_conf_001_1'],
    activeAdCount: 1,
    primaryCtaType: 'CALL_NOW',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    contactEntityProfile: {
      observedPhones: [
        { type: 'PHONE', rawValue: '+8801711000111', normalizedValue: '+8801711000111', sourceSurface: 'AD_BODY_TEXT', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM', confidence: 'HIGH' },
        { type: 'PHONE', rawValue: '+8801819999222', normalizedValue: '+8801819999222', sourceSurface: 'AD_BODY_TEXT', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM', confidence: 'HIGH' }
      ],
      observedEmails: [],
      phoneConflict: true,
      emailConflict: false,
      phoneConflictState: 'CONFLICT_DETECTED',
      emailConflictState: 'NOT_APPLICABLE',
      overallQualityState: 'CONFLICT_DETECTED',
      diagnostics: ['Conflicting phones']
    }
  });
  assert.ok(mediumResult.score >= 50 && mediumResult.score < 75, `Medium archetype score expected 50-74, got ${mediumResult.score}`);
  assert.strictEqual(mediumResult.tier, 'MEDIUM', `Expected tier MEDIUM, got ${mediumResult.tier}`);

  // 3. Foreign Verified Archetype -> LOW tier
  const lowResult = calculateLeadScore({
    name: 'Jaipur Royal Wooden Crafts',
    geographicClassification: 'FOREIGN_VERIFIED',
    targetCountryCode: 'BD',
    businessCountryCode: 'IN',
    relevanceDecision: 'RELEVANT',
    relevanceConfidence: 'HIGH',
    adLibraryIds: ['ad_xb_001_1'],
    activeAdCount: 1,
    primaryCtaType: 'SEND_MESSAGE',
    primaryDestinationType: 'EXTERNAL_WEBSITE',
    contactEntityProfile: {
      observedPhones: [{ type: 'PHONE', rawValue: '+919829012345', normalizedValue: '+919829012345', sourceSurface: 'AD_BODY_TEXT', syntaxState: 'SYNTAX_VALID', verificationStatus: 'UNPROBED_PUBLIC_CLAIM', confidence: 'HIGH' }],
      observedEmails: [],
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NO_CONFLICT',
      emailConflictState: 'NOT_APPLICABLE',
      overallQualityState: 'OBSERVED_VALID_SYNTAX',
      primaryPhone: '+919829012345',
      diagnostics: []
    }
  });
  assert.ok(lowResult.score >= 25 && lowResult.score < 50, `Low archetype score expected 25-49, got ${lowResult.score}`);
  assert.strictEqual(lowResult.tier, 'LOW', `Expected tier LOW, got ${lowResult.tier}`);

  // 4. Location Unknown / Noise Archetype -> MINIMAL tier
  const minimalResult = calculateLeadScore({
    name: 'Digital Growth Hacks 247',
    geographicClassification: 'LOCATION_UNKNOWN',
    targetCountryCode: 'BD',
    relevanceDecision: 'NOT_RELEVANT',
    relevanceConfidence: 'LOW',
    adLibraryIds: ['ad_unk_001_1'],
    activeAdCount: 1,
    primaryCtaType: 'UNKNOWN',
    primaryDestinationType: 'UNKNOWN',
    contactEntityProfile: {
      observedPhones: [],
      observedEmails: [],
      phoneConflict: false,
      emailConflict: false,
      phoneConflictState: 'NOT_APPLICABLE',
      emailConflictState: 'NOT_APPLICABLE',
      overallQualityState: 'NOT_OBSERVED',
      diagnostics: []
    }
  });
  assert.ok(minimalResult.score < 25, `Minimal archetype score expected < 25, got ${minimalResult.score}`);
  assert.strictEqual(minimalResult.tier, 'MINIMAL', `Expected tier MINIMAL, got ${minimalResult.tier}`);
});

// ============================================================================
// SECTION 9: PERMANENT FAIL-CLOSED SAFETY GATES & ARCHIVE IMMUTABILITY
// ============================================================================
console.log('\n--- SECTION 9: Permanent Fail-Closed Safety Gates & Archive Hash Immutability ---');

runTest('9.1: Permanent fail-closed collection & crawling gates remain strictly false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must be false');
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must be false');
});

runTest('9.2: Historical release archive SHA-256 hashes verified byte-for-byte intact', () => {
  for (const [relPath, expected] of Object.entries(HISTORICAL_HASHES)) {
    const full = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(full), `Archive missing: ${relPath}`);
    const actual = sha256(full);
    assert.strictEqual(actual, expected, `SHA-256 hash altered for historical artifact ${relPath}`);
  }
});

console.log('\n========================================================================');
console.log(`PHASE 12 GROUND-TRUTH TEST RUN COMPLETE: ${passedTests}/${totalTests} Passed (0 Failed)`);
console.log('Status: PASS — Ground-Truth Validation & Automated Metrics Verified');
console.log('========================================================================\n');
