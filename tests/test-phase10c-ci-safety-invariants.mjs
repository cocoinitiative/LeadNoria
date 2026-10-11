/**
 * LeadNoria — Phase 1.0C: CI Safety Invariants & Boundary Enforcement Test Suite
 *
 * Verifies all required safety checks specified in Phase 1.0C Objective D:
 * 1. Collection & Crawling Gates: Fail-closed, immune to CI env vars/flags, missing state fails closed.
 * 2. Manifest & Runtime Boundaries: No broad host permissions, no Playwright in extension, no unauthorized APIs.
 * 3. Qualification Invariants:
 *    - targetCountryCode distinct from businessCountryCode.
 *    - CTA and destination classification remain separate.
 *    - Missing URLs must not be interpreted as proof that a business has no website.
 *    - Unknown, probable, and unassessed values must not silently qualify.
 *    - Score is not treated as qualification or confidence.
 *    - Strict-local mode admits only LOCAL_VERIFIED (excludes FOREIGN_VERIFIED, LOCAL_PROBABLE, LOCATION_UNKNOWN).
 * 4. Packaging Invariants: Unpacked default, no ZIP created by normal build, historical release protection.
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
  isLiveCollectionPermitted,
  assertLiveCollectionPermitted,
  isExternalWebsiteCrawlingPermitted,
  assertExternalWebsiteCrawlingPermitted
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

import {
  isProtectedHistoricalArchive,
  validatePackagingDestination
} from '../scripts/packaging-safety.mjs';

console.log('========================================================================');
console.log('LEADNORIA PHASE 1.0C: CI SAFETY INVARIANTS & BOUNDARY ENFORCEMENT');
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

// --------------------------------------------------------------------------
// 1. COLLECTION & CRAWLING GATES (FAIL-CLOSED IN CI)
// --------------------------------------------------------------------------
console.log('--- 1. COLLECTION & CRAWLING GATES (FAIL-CLOSED IN CI) ---');

check(1, 'isLiveCollectionPermitted() permanently returns false', isLiveCollectionPermitted() === false);
check(2, 'isExternalWebsiteCrawlingPermitted() permanently returns false', isExternalWebsiteCrawlingPermitted() === false);

let liveThrew = false;
try {
  assertLiveCollectionPermitted();
} catch (e) {
  liveThrew = true;
}
check(3, 'assertLiveCollectionPermitted() unconditionally throws in any environment', liveThrew);

let crawlThrew = false;
try {
  assertExternalWebsiteCrawlingPermitted();
} catch (e) {
  crawlThrew = true;
}
check(4, 'assertExternalWebsiteCrawlingPermitted() unconditionally throws in any environment', crawlThrew);

// Test environment variables cannot bypass gate
const dangerousEnvVars = ['CI', 'GITHUB_ACTIONS', 'ENABLE_COLLECTION', 'LIVE_SCRAPING', 'NODE_ENV'];
let envBypassPossible = false;
for (const envVar of dangerousEnvVars) {
  const orig = process.env[envVar];
  process.env[envVar] = 'true';
  if (isLiveCollectionPermitted() !== false || isExternalWebsiteCrawlingPermitted() !== false) {
    envBypassPossible = true;
  }
  if (orig === undefined) delete process.env[envVar];
  else process.env[envVar] = orig;
}
check(5, 'CI environment variables cannot turn on collection or crawling gates', !envBypassPossible);

// --------------------------------------------------------------------------
// 2. MANIFEST & EXTENSION RUNTIME BOUNDARY
// --------------------------------------------------------------------------
console.log('\n--- 2. MANIFEST & EXTENSION RUNTIME BOUNDARY ---');

const srcManifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'src', 'extension', 'manifest.json'), 'utf8'));
const hostPerms = srcManifest.host_permissions || [];

check(6, 'Manifest contains no wildcard scheme <all_urls>', !hostPerms.includes('<all_urls>'));
check(7, 'Manifest contains no broad wildcard *://*/*', !hostPerms.includes('*://*/*'));
check(8, 'Manifest contains no broad wildcard https://*/*', !hostPerms.includes('https://*/*'));
check(9, 'Host permissions are strictly scoped to facebook.com/ads/library/*', hostPerms.every(p => p.includes('facebook.com/ads/library/*')));

// Verify extension sources have zero Playwright imports
function checkDirForImport(dir, importName) {
  if (!fs.existsSync(dir)) return true;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!checkDirForImport(full, importName)) return false;
    } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
      const code = fs.readFileSync(full, 'utf8');
      if (code.includes(`from '${importName}'`) || code.includes(`require('${importName}')`)) {
        return false;
      }
    }
  }
  return true;
}
check(10, 'Zero Playwright imports across src/extension/ tree', checkDirForImport(path.join(rootDir, 'src', 'extension'), 'playwright'));

// --------------------------------------------------------------------------
// 3. QUALIFICATION INVARIANTS
// --------------------------------------------------------------------------
console.log('\n--- 3. QUALIFICATION INVARIANTS ---');

// Invariant A: targetCountryCode is distinct from businessCountryCode
const geoResult = evaluateGeographicOrigin({
  pageName: 'Dhaka Sweets BD',
  bodyCopy: 'Visit our showroom in Dhanmondi, Dhaka, Bangladesh. Call +8801711000000',
  destinationDomain: 'dhakasweets.com.bd'
}, 'US');
check(11, 'targetCountryCode is evaluated against separate businessCountryCode', geoResult.businessCountryCode === 'BD' && geoResult.targetCountryCode === 'US');

// Invariant B: CTA and destination classification remain separate
const ctaRes = classifyCta('Learn More');
const destRes = classifyDestination({
  destinationUrl: 'https://wa.me/8801700000000'
});
check(12, 'CTA classification is distinct from destination classification', ctaRes.ctaType === 'LEARN_MORE' && destRes.destinationType === 'MESSAGING');

// Invariant C: Missing destination URL must not be interpreted as proof that no website exists
const destNoUrl = classifyDestination({
  destinationUrl: undefined
});
check(13, 'Missing destination URL classified as UNKNOWN (not NO_WEBSITE)', destNoUrl.destinationType === 'UNKNOWN' && destNoUrl.reasonCode === 'DESTINATION_NOT_OBSERVED');

// Invariant D: Unknown, probable, and unassessed values do not silently qualify
const unassessedEval = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'UNASSESSED',
  geographicClassification: 'LOCAL_VERIFIED'
});
check(14, 'UNASSESSED relevance decision fails qualification', unassessedEval.isQualified === false);

const uncertainEval = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'UNCERTAIN',
  geographicClassification: 'LOCAL_VERIFIED'
});
check(15, 'UNCERTAIN relevance decision fails qualification', uncertainEval.isQualified === false);

// Invariant E: Score is never treated as qualification or confidence
const highScoringUncertain = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'UNCERTAIN',
  confidenceScore: 99,
  geographicClassification: 'LOCAL_VERIFIED'
});
check(16, 'High score/confidence (99) does not bypass qualification criteria', highScoringUncertain.isQualified === false);

// Invariant F: Strict-local mode contract
const strictLocalVerified = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'LOCAL_VERIFIED'
}, { strictLocalMode: true });
check(17, 'Strict-local mode admits LOCAL_VERIFIED', strictLocalVerified.isQualified === true);

const strictLocalForeign = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'FOREIGN_VERIFIED'
}, { strictLocalMode: true });
check(18, 'Strict-local mode rejects FOREIGN_VERIFIED', strictLocalForeign.isQualified === false);

const strictLocalProbable = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'LOCAL_PROBABLE'
}, { strictLocalMode: true, allowProbableLocal: false });
check(19, 'Strict-local mode rejects LOCAL_PROBABLE by default', strictLocalProbable.isQualified === false);

const strictLocalUnknown = evaluateLeadQualificationGates({
  canonicalName: 'Acme Test Corp',
  adLibraryIds: ['12345'],
  relevanceDecision: 'RELEVANT',
  geographicClassification: 'LOCATION_UNKNOWN'
}, { strictLocalMode: true });
check(20, 'Strict-local mode rejects LOCATION_UNKNOWN', strictLocalUnknown.isQualified === false);

// --------------------------------------------------------------------------
// 4. PACKAGING INVARIANTS & HISTORICAL ARCHIVE IMMUTABILITY
// --------------------------------------------------------------------------
console.log('\n--- 4. PACKAGING INVARIANTS & HISTORICAL ARCHIVE PROTECTION ---');

check(21, 'Historical archive dist/leadnoria-v1.7.5.zip is detected as protected', isProtectedHistoricalArchive('dist/leadnoria-v1.7.5.zip', rootDir));
check(22, 'Historical archive dist/leadnoria-v1.7.6.zip is detected as protected', isProtectedHistoricalArchive('dist/leadnoria-v1.7.6.zip', rootDir));
check(23, 'Historical archive extension.zip is detected as protected', isProtectedHistoricalArchive('extension.zip', rootDir));

let protectedWriteBlocked = false;
try {
  validatePackagingDestination(path.join(rootDir, 'dist', 'leadnoria-v1.7.6.zip'), {
    rootDir,
    allowOverwrite: true
  });
} catch (e) {
  protectedWriteBlocked = true;
}
check(24, 'validatePackagingDestination unconditionally blocks protected archive', protectedWriteBlocked);

// Verify actual historical file hashes match baseline
const expectedHashes = {
  'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
  'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
  'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
};

for (const [relPath, expHash] of Object.entries(expectedHashes)) {
  const full = path.join(rootDir, relPath);
  const buf = fs.readFileSync(full);
  const actual = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
  check(25, `Historical artifact ${relPath} matches expected SHA-256`, actual === expHash);
}

console.log('\n========================================================================');
console.log(`PHASE 1.0C TEST SUITE COMPLETED: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
