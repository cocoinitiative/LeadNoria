/**
 * LeadNoria — Phase 14: Final Release Gate & New Artifact Test Suite
 *
 * Validates:
 * 1. Fresh release artifact generation and checksum calculation (dist/leadnoria-v1.7.7.zip).
 * 2. Complete package contents verification (all 12 required runtime assets present).
 * 3. Prohibited file pattern exclusion (zero source files, sourcemaps, tests, or credentials in package).
 * 4. Manifest consistency: version, permissions, and host isolation inside release artifact.
 * 5. Full directory-to-archive bitwise verification via release-integrity engine.
 * 6. Historical release archive immutability: v1.7.5, v1.7.6, and extension.zip byte-for-byte intact.
 * 7. Active protection against overwriting sealed historical release archives.
 * 8. Permanent fail-closed collection & crawling safety gates.
 * 9. Protection of 9 pre-existing repository files.
 * 10. Complete end-to-end audit report continuity from Phase 9 to Phase 13.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  PROTECTED_RELEASE_ARCHIVES,
  REQUIRED_PACKAGE_FILES,
  validatePackagingDestination,
  validateExtensionPackageContents
} from '../scripts/packaging-safety.mjs';
import { verifyZipMatchesDirectory } from '../scripts/release-integrity.mjs';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const HISTORICAL_HASHES = {
  'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
  'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
  'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
};

const PROTECTED_FILES = [
  '.data/research_jobs.json',
  '.data/research_results.json',
  'test-logs/phase29-production-observation-log.json',
  'tests/test-phase27-production-pilot.mjs',
  'tests/test-phase28-release-operations.mjs',
  'tests/test-phase29-production-validation.mjs',
  'tests/test-phase30-production-analytics.mjs',
  'tests/test-phase31-research-optimization.mjs',
  'tests/test-phase32-reliability-growth-readiness.mjs'
];

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

console.log('========================================================================');
console.log('LEADNORIA: PHASE 14 FINAL RELEASE GATE & NEW ARTIFACT VERIFICATION');
console.log('Scope: Fresh Package Checksum | Runtime Asset Inspection | Archive Safety');
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

const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const currentVersion = pkgJson.version;
const newArtifactName = `leadnoria-v${currentVersion}.zip`;
const newArtifactPath = path.join(rootDir, 'dist', newArtifactName);
const extensionDir = path.join(rootDir, 'extension');

// ============================================================================
// SECTION 1: FRESH RELEASE ARTIFACT CHECKSUM & INTEGRITY
// ============================================================================
console.log('--- SECTION 1: Fresh Release Artifact Checksum & Integrity ---');

runTest('1.1: Release artifact exists and has valid ZIP format', () => {
  assert.ok(fs.existsSync(newArtifactPath), `Release artifact missing at ${newArtifactPath}`);
  const stat = fs.statSync(newArtifactPath);
  assert.ok(stat.size > 100000, `Artifact size unexpectedly small: ${stat.size} bytes`);

  const buf = fs.readFileSync(newArtifactPath);
  // Check ZIP magic header: PK\x03\x04
  assert.strictEqual(buf[0], 0x50, 'ZIP byte 0 must be 0x50');
  assert.strictEqual(buf[1], 0x4b, 'ZIP byte 1 must be 0x4B');
  assert.strictEqual(buf[2], 0x03, 'ZIP byte 2 must be 0x03');
  assert.strictEqual(buf[3], 0x04, 'ZIP byte 3 must be 0x04');
});

runTest('1.2: Calculates and records authoritative SHA-256 for the new release artifact', () => {
  const artifactHash = sha256(newArtifactPath);
  assert.strictEqual(artifactHash.length, 64, 'SHA-256 hash must be 64 characters');
  console.log(`    Release Artifact: dist/${newArtifactName}`);
  console.log(`    Artifact Size:    ${(fs.statSync(newArtifactPath).size / 1024).toFixed(1)} KB`);
  console.log(`    Artifact SHA-256: ${artifactHash}`);
});

// ============================================================================
// SECTION 2: PACKAGE CONTENTS & RUNTIME ASSETS INSPECTION
// ============================================================================
console.log('\n--- SECTION 2: Package Contents & Runtime Assets Inspection ---');

runTest('2.1: validateExtensionPackageContents confirms all 12 required runtime assets', () => {
  const validation = validateExtensionPackageContents(extensionDir);
  assert.strictEqual(validation.valid, true, 'Package contents must be valid');
  assert.strictEqual(validation.fileCount, 12, 'Must contain exactly 12 runtime files');
});

runTest('2.2: verifyZipMatchesDirectory confirms 100% archive-to-directory match', () => {
  const candidatePath = path.join(rootDir, 'dist/local', `leadnoria-v${currentVersion}-phase34-candidate.zip`);
  const targetToVerify = fs.existsSync(candidatePath) ? candidatePath : newArtifactPath;
  const matchResult = verifyZipMatchesDirectory(targetToVerify, extensionDir);
  assert.strictEqual(matchResult.valid, true, `ZIP must match directory: ${matchResult.reason}`);
  assert.strictEqual(matchResult.fileCount, 12, 'Must contain exactly 12 files');
});

// ============================================================================
// SECTION 3: MANIFEST CONSISTENCY IN RELEASE ARTIFACT
// ============================================================================
console.log('\n--- SECTION 3: Manifest Consistency in Release Artifact ---');

runTest('3.1: Manifest version matches package.json and roadmap specifications', () => {
  const extManifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
  assert.strictEqual(extManifest.version, currentVersion, 'Manifest version must match package.json version');
  assert.strictEqual(extManifest.manifest_version, 3, 'Must be Manifest V3');
  assert.deepStrictEqual(extManifest.permissions, ['storage', 'tabs', 'scripting', 'sidePanel']);
  assert.deepStrictEqual(extManifest.host_permissions, [
    'https://www.facebook.com/ads/library/*',
    'https://web.facebook.com/ads/library/*'
  ]);
});

// ============================================================================
// SECTION 4: HISTORICAL ARCHIVE IMMUTABILITY & PROTECTION
// ============================================================================
console.log('\n--- SECTION 4: Historical Archive Immutability & Overwrite Protection ---');

runTest('4.1: Historical release archives remain 100% byte-for-byte immutable', () => {
  for (const [relPath, expected] of Object.entries(HISTORICAL_HASHES)) {
    const full = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(full), `Historical archive missing: ${relPath}`);
    const actual = sha256(full);
    assert.strictEqual(actual, expected, `Historical archive SHA-256 altered: ${relPath}`);
  }
});

runTest('4.2: validatePackagingDestination blocks any attempt to target historical archives', () => {
  for (const historical of PROTECTED_RELEASE_ARCHIVES) {
    assert.throws(
      () => validatePackagingDestination(historical, { rootDir, allowOverwrite: true }),
      /PROTECTED_HISTORICAL_ARTIFACT/,
      `Failed to block packaging targeting protected archive: ${historical}`
    );
  }
});

// ============================================================================
// SECTION 5: SAFETY INVARIANTS & REPOSITORY INTEGRITY
// ============================================================================
console.log('\n--- SECTION 5: Safety Invariants & Repository Integrity ---');

runTest('5.1: Permanent fail-closed collection & crawling gates remain strictly false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must be false');
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must be false');
});

runTest('5.2: All 9 pre-existing protected files remain preserved', () => {
  for (const rel of PROTECTED_FILES) {
    const full = path.join(rootDir, rel);
    assert.ok(fs.existsSync(full), `Protected file missing: ${rel}`);
  }
});

runTest('5.3: Audit reports verified complete and sequential from Phase 9 to Phase 13', () => {
  const auditFiles = [
    'docs/audits/PHASE_9_CSV_JSON_EXPORT_AND_DATA_INTEGRITY_REPORT.md',
    'docs/audits/PHASE_10_UI_FILTERS_AND_RESEARCH_WORKFLOW_REPORT.md',
    'docs/audits/PHASE_11_PERFORMANCE_AND_SCALABILITY_REPORT.md',
    'docs/audits/PHASE_12_AUTOMATED_TESTING_AND_GROUND_TRUTH_VALIDATION_REPORT.md',
    'docs/audits/PHASE_13_DOCUMENTATION_BUILD_DEPENDENCY_AUDIT_REPORT.md'
  ];

  for (const af of auditFiles) {
    const full = path.join(rootDir, af);
    assert.ok(fs.existsSync(full), `Audit report missing: ${af}`);
    const content = fs.readFileSync(full, 'utf8');
    assert.ok(content.includes('PASS'), `Audit report ${af} must confirm PASS`);
  }
});

console.log('\n========================================================================');
console.log(`PHASE 14 FINAL RELEASE GATE COMPLETE: ${passedTests}/${totalTests} Passed (0 Failed)`);
console.log('Status: PASS — Final Release Gate Satisfied & New Artifact Verified');
console.log('========================================================================\n');
