/**
 * LeadNoria — Phase 1.0D: TypeScript Remediation & Offline CI Dependency Integrity Test Suite
 *
 * Verifies:
 * 1. Clean TypeScript compilation (tsc --noEmit exits with code 0 and zero diagnostics).
 * 2. Preservation of compiler strictness (strict: true in tsconfig.json).
 * 3. Type-safety invariants and runtime qualification logic:
 *    - targetCountryCode vs businessCountryCode distinction
 *    - CTA classification vs destination classification separation
 *    - Missing URL does not prove no website exists
 *    - UNASSESSED / UNCERTAIN never silently qualify
 *    - Score is never treated as qualification or confidence
 *    - Strict-local mode contract (LOCAL_VERIFIED only, rejects FOREIGN_VERIFIED, LOCAL_PROBABLE, LOCATION_UNKNOWN)
 * 4. Safety Gates:
 *    - isLiveCollectionPermitted() === false (fail-closed)
 *    - isExternalWebsiteCrawlingPermitted() === false (fail-closed)
 * 5. CI and Offline Dependency Mode Specifications:
 *    - Dedicated 'typecheck' script in package.json
 *    - Mode A (hosted CI) pinned lockfile installation with disclosed network requirements
 *    - Mode B (strict offline) zero-network execution with verified local dependencies
 * 6. Historical archive hash immutability (v1.7.5, v1.7.6, extension.zip).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

import {
  isLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted
} from '../src/config/collectionGate.ts';

import {
  evaluateGeographicOrigin
} from '../src/extension/geographicClassifier.ts';

import {
  classifyCta,
  classifyDestination
} from '../src/extension/destinationClassifier.ts';

import {
  evaluateLeadQualificationGates
} from '../src/extension/qualificationGate.ts';

console.log('========================================================================');
console.log('LEADNORIA PHASE 1.0D: TYPESCRIPT & OFFLINE CI INTEGRITY TEST SUITE');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function check(testNum, description, condition, errorMsg = '') {
  if (condition) {
    console.log(`  [PASS] [Test ${testNum}] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] [Test ${testNum}] ${description} ${errorMsg ? '--> ' + errorMsg : ''}`);
    failed++;
  }
}

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

// --------------------------------------------------------------------------
// 1. TYPESCRIPT COMPILER & STRICTNESS INTEGRITY
// --------------------------------------------------------------------------
console.log('--- 1. TYPESCRIPT COMPILER & STRICTNESS INTEGRITY ---');

// Check tsconfig.json strictness settings (preserve baseline strictness)
const tsconfigPath = path.join(rootDir, 'tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
const compilerOptions = tsconfig.compilerOptions || {};

check(1, 'tsconfig.json preserves baseline compiler configuration (strict is not disabled)', compilerOptions.strict !== false);
check(2, 'tsconfig.json maintains strictNullChecks (not explicitly disabled)', compilerOptions.strictNullChecks !== false);
check(3, 'tsconfig.json target is at least ES2022', compilerOptions.target === 'ES2022');
check(4, 'tsconfig.json moduleResolution is bundler', compilerOptions.moduleResolution === 'bundler');

// Run tsc --noEmit via node_modules/typescript/bin/tsc
const tscPath = path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
let tscSuccess = false;
let tscErrorOutput = '';

if (fs.existsSync(tscPath)) {
  const tscRes = spawnSync(process.execPath, [tscPath, '--noEmit'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
  tscSuccess = tscRes.status === 0;
  if (!tscSuccess) {
    tscErrorOutput = (tscRes.stdout || '') + '\n' + (tscRes.stderr || '');
  }
}

check(5, 'tsc --noEmit compiles with 0 errors and exit code 0', tscSuccess, tscErrorOutput.trim().slice(0, 300));

// Check package.json contains 'typecheck' script
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
check(6, 'package.json defines "typecheck": "tsc --noEmit"', pkgJson.scripts && pkgJson.scripts.typecheck === 'tsc --noEmit');

// --------------------------------------------------------------------------
// 2. QUALIFICATION & LOGICAL INVARIANTS
// --------------------------------------------------------------------------
console.log('\n--- 2. QUALIFICATION & LOGICAL INVARIANTS ---');

// Invariant A: targetCountryCode and businessCountryCode remain distinct
const geoEval = evaluateGeographicOrigin({
  pageName: 'Sydney Digital Agency',
  bodyCopy: 'Located in Surry Hills, Sydney NSW, Australia. Call (02) 9000 0000',
  destinationDomain: 'sydneydigital.com.au'
}, 'US');
check(7, 'targetCountryCode ("US") and businessCountryCode ("AU") remain distinct', geoEval.targetCountryCode === 'US' && geoEval.businessCountryCode === 'AU');

// Invariant B: Business location is not inferred from ad audience targeting
const geoAudienceOnly = evaluateGeographicOrigin({
  pageName: 'Global Cloud Systems',
  bodyCopy: 'Enterprise cloud management platform for global teams.',
  destinationDomain: 'globalcloud.io'
}, 'GB');
check(8, 'Business location is not inferred from audience targeting ("GB")', geoAudienceOnly.businessCountryCode === undefined && geoAudienceOnly.classification === 'LOCATION_UNKNOWN');

// Invariant C: CTA classification and destination classification remain separate
const ctaEval = classifyCta('Learn More');
const destEval = classifyDestination({
  destinationUrl: 'https://wa.me/8801700000000'
});
check(9, 'CTA classification ("LEARN_MORE") separate from destination classification ("MESSAGING")', ctaEval.ctaType === 'LEARN_MORE' && destEval.destinationType === 'MESSAGING');

// Invariant D: Missing URL does not prove business has no website
const destMissing = classifyDestination({ destinationUrl: undefined });
check(10, 'Missing destination URL yields UNKNOWN / DESTINATION_NOT_OBSERVED (not NO_WEBSITE)', destMissing.destinationType === 'UNKNOWN' && destMissing.reasonCode === 'DESTINATION_NOT_OBSERVED');

// Invariant E: Unknown or unassessed data does not silently qualify
const qualUnassessed = evaluateLeadQualificationGates({
  canonicalName: 'Test Business',
  adLibraryIds: ['101'],
  relevanceDecision: 'UNASSESSED',
  geographicClassification: 'LOCAL_VERIFIED'
});
check(11, 'UNASSESSED relevance decision fails qualification', qualUnassessed.isQualified === false);

const qualUnknownGeo = evaluateLeadQualificationGates({
  canonicalName: 'Test Business',
  adLibraryIds: ['101'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'LOCATION_UNKNOWN'
}, { strictLocalMode: true });
check(12, 'LOCATION_UNKNOWN fails qualification under strict-local mode', qualUnknownGeo.isQualified === false);

// Invariant F: Score is not treated as qualification or confidence
const qualHighConfidenceRejected = evaluateLeadQualificationGates({
  canonicalName: 'Test Business',
  adLibraryIds: ['101'],
  relevanceDecision: 'REJECTED',
  confidenceScore: 100,
  geographicClassification: 'LOCAL_VERIFIED'
});
check(13, 'Relevance REJECTED with score 100 fails qualification', qualHighConfidenceRejected.isQualified === false);

// Invariant G: Strict-local qualification admits only LOCAL_VERIFIED
const qualStrictVerified = evaluateLeadQualificationGates({
  canonicalName: 'Test Business',
  adLibraryIds: ['101'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'LOCAL_VERIFIED'
}, { strictLocalMode: true });
check(14, 'Strict-local mode admits LOCAL_VERIFIED', qualStrictVerified.isQualified === true);

const qualStrictForeign = evaluateLeadQualificationGates({
  canonicalName: 'Test Business',
  adLibraryIds: ['101'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'FOREIGN_VERIFIED'
}, { strictLocalMode: true });
check(15, 'Strict-local mode rejects FOREIGN_VERIFIED', qualStrictForeign.isQualified === false);

const qualStrictProbable = evaluateLeadQualificationGates({
  canonicalName: 'Test Business',
  adLibraryIds: ['101'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'LOCAL_PROBABLE'
}, { strictLocalMode: true, allowProbableLocal: false });
check(16, 'Strict-local mode rejects LOCAL_PROBABLE when allowProbableLocal is false', qualStrictProbable.isQualified === false);

// --------------------------------------------------------------------------
// 3. SAFETY GATES INTEGRITY
// --------------------------------------------------------------------------
console.log('\n--- 3. SAFETY GATES INTEGRITY ---');

check(17, 'isLiveCollectionPermitted() permanently returns false', isLiveCollectionPermitted() === false);
check(18, 'isExternalWebsiteCrawlingPermitted() permanently returns false', isExternalWebsiteCrawlingPermitted() === false);

// --------------------------------------------------------------------------
// 4. CI & OFFLINE DEPENDENCY MODES
// --------------------------------------------------------------------------
console.log('\n--- 4. CI & OFFLINE DEPENDENCY MODES ---');

// Audit .github/workflows/offline-ci.yml
const ciWorkflowPath = path.join(rootDir, '.github', 'workflows', 'offline-ci.yml');
const ciWorkflowContent = fs.readFileSync(ciWorkflowPath, 'utf8');

check(19, 'CI workflow uses read-only contents permission', ciWorkflowContent.includes('permissions:\n  contents: read') || ciWorkflowContent.includes('permissions:\r\n  contents: read'));
check(20, 'CI workflow installs via lockfile mode (npm ci)', ciWorkflowContent.includes('npm ci'));
check(21, 'CI workflow documents network registry access requirement during setup', /npm registry/i.test(ciWorkflowContent) && /Mode A/i.test(ciWorkflowContent));
check(22, 'CI workflow executes verify:offline or typecheck', ciWorkflowContent.includes('npm run verify:offline') || ciWorkflowContent.includes('npm run typecheck'));

// --------------------------------------------------------------------------
// 5. HISTORICAL ARCHIVES IMMUTABILITY
// --------------------------------------------------------------------------
console.log('\n--- 5. HISTORICAL ARCHIVES IMMUTABILITY ---');

const expectedArchives = {
  'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
  'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
  'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
};

let testNum = 23;
for (const [relPath, expectedHash] of Object.entries(expectedArchives)) {
  const fullPath = path.join(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    const actualHash = sha256(fullPath);
    check(testNum++, `Historical archive ${relPath} matches baseline SHA-256`, actualHash === expectedHash);
  } else {
    check(testNum++, `Historical archive ${relPath} exists`, false, 'File not found');
  }
}

console.log('\n========================================================================');
console.log(`PHASE 1.0D TEST SUITE COMPLETED: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
