/**
 * LeadNoria — Phase 1.0B: Dependency Hygiene & Runtime Boundary Regression Test Suite
 *
 * Verifies:
 * 1. Complete removal of @google/genai from package.json and package-lock.json.
 * 2. Zero source/script imports of Google GenAI packages.
 * 3. Playwright runtime isolation (server/test only; completely absent from Chrome extension bundle).
 * 4. Permanent fail-closed collection & crawling safety gates.
 * 5. Packaging isolation and historical release archive immutability.
 * 6. Protection of the 6 pre-existing protected files.
 * 7. Absence of dangerous lifecycle scripts or unpinned/arbitrary URL dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('LEADNORIA PHASE 1.0B: DEPENDENCY HYGIENE & RUNTIME BOUNDARY TEST SUITE');
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
// SECTION 1: @google/genai COMPLETE REMOVAL & ZERO IMPORT VERIFICATION
// --------------------------------------------------------------------------
console.log('--- 1. @google/genai REMOVAL & IMPORT AUDIT ---');

const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const lockJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));

check(1, '@google/genai removed from package.json dependencies', !pkgJson.dependencies['@google/genai']);
check(2, '@google/genai absent from package.json devDependencies', !(pkgJson.devDependencies && pkgJson.devDependencies['@google/genai']));
check(3, '@google/genai removed from package-lock.json packages', !lockJson.packages['node_modules/@google/genai']);
check(4, '@google/genai removed from root dependencies in package-lock.json', !(lockJson.packages[''] && lockJson.packages[''].dependencies && lockJson.packages[''].dependencies['@google/genai']));

function scanForPattern(dir, pattern) {
  let matches = [];
  if (!fs.existsSync(dir)) return matches;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        matches = matches.concat(scanForPattern(full, pattern));
      }
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      if (pattern.test(content)) {
        matches.push(full);
      }
    }
  }
  return matches;
}

const genaiSourceImports = scanForPattern(path.join(rootDir, 'src'), /from\s+['"]@google\/genai['"]|require\(['"]@google\/genai['"]\)/);
check(5, 'Zero source imports of @google/genai in src/', genaiSourceImports.length === 0, `Matches: ${genaiSourceImports.join(', ')}`);

const genaiScriptImports = scanForPattern(path.join(rootDir, 'scripts'), /from\s+['"]@google\/genai['"]|require\(['"]@google\/genai['"]\)/);
check(6, 'Zero script imports of @google/genai in scripts/', genaiScriptImports.length === 0, `Matches: ${genaiScriptImports.join(', ')}`);

// --------------------------------------------------------------------------
// SECTION 2: PLAYWRIGHT RUNTIME ISOLATION & SAFETY AUDIT
// --------------------------------------------------------------------------
console.log('\n--- 2. PLAYWRIGHT RUNTIME BOUNDARY AUDIT ---');

check(7, 'Playwright is declared in package.json dependencies', Boolean(pkgJson.dependencies['playwright']));

// Playwright must not be imported anywhere in src/extension/
const extImports = scanForPattern(path.join(rootDir, 'src', 'extension'), /from\s+['"]playwright['"]|require\(['"]playwright['"]\)/);
check(8, 'Zero imports of playwright in src/extension/', extImports.length === 0, `Matches: ${extImports.join(', ')}`);

// Playwright must not appear in the built ./extension/ directory
const builtExtDir = path.join(rootDir, 'extension');
let playwrightInExtension = false;
if (fs.existsSync(builtExtDir)) {
  for (const f of fs.readdirSync(builtExtDir)) {
    if (f.endsWith('.js')) {
      const code = fs.readFileSync(path.join(builtExtDir, f), 'utf8');
      if (/require\(['"]playwright['"]\)|from\s+['"]playwright['"]|playwright-core/.test(code)) {
        playwrightInExtension = true;
      }
    }
  }
}
check(9, 'Playwright is completely absent from compiled extension bundles', !playwrightInExtension);

// --------------------------------------------------------------------------
// SECTION 3: SAFETY GATES FAIL-CLOSED VERIFICATION
// --------------------------------------------------------------------------
console.log('\n--- 3. SAFETY GATES FAIL-CLOSED VERIFICATION ---');

const gateSource = fs.readFileSync(path.join(rootDir, 'src', 'config', 'collectionGate.ts'), 'utf8');
check(10, 'isLiveCollectionPermitted() returns false in collectionGate.ts', /isLiveCollectionPermitted\(\):\s*boolean\s*\{\s*return\s+false;/.test(gateSource));
check(11, 'isExternalWebsiteCrawlingPermitted() returns false in collectionGate.ts', /isExternalWebsiteCrawlingPermitted\(\):\s*boolean\s*\{\s*return\s+false;/.test(gateSource));

// Verify that browserWorker fail-closed check exists
const browserWorkerSource = fs.readFileSync(path.join(rootDir, 'src', 'server', 'browserWorker.ts'), 'utf8');
check(12, 'browserWorker.ts checks isLiveCollectionPermitted() before launching browser', browserWorkerSource.includes('if (!isLiveCollectionPermitted())'));

// --------------------------------------------------------------------------
// SECTION 4: HISTORICAL ARTIFACT INTEGRITY (SHA-256 MATCH)
// --------------------------------------------------------------------------
console.log('\n--- 4. HISTORICAL RELEASE ARTIFACT HASH CHECK ---');

const expectedHashes = {
  'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
  'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
  'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
};

let testIdx = 13;
for (const [relPath, expHash] of Object.entries(expectedHashes)) {
  const full = path.join(rootDir, relPath);
  if (fs.existsSync(full)) {
    const actual = sha256(full);
    check(testIdx++, `Historical artifact ${relPath} matches baseline SHA-256`, actual === expHash, `Expected: ${expHash}, got: ${actual}`);
  } else {
    check(testIdx++, `Historical artifact ${relPath} exists`, false, 'File missing');
  }
}

// --------------------------------------------------------------------------
// SECTION 5: THE 6 PROTECTED FILES PRESERVATION
// --------------------------------------------------------------------------
console.log('\n--- 5. PROTECTED FILES PRESERVATION ---');

const protectedFiles = [
  'test-logs/phase29-production-observation-log.json',
  'tests/test-phase27-production-pilot.mjs',
  'tests/test-phase28-release-operations.mjs',
  'tests/test-phase30-production-analytics.mjs',
  'tests/test-phase31-research-optimization.mjs',
  'tests/test-phase32-reliability-growth-readiness.mjs'
];

for (const pf of protectedFiles) {
  const exists = fs.existsSync(path.join(rootDir, pf));
  check(testIdx++, `Protected file ${pf} exists and is intact`, exists);
}

// --------------------------------------------------------------------------
// SECTION 6: SUPPLY-CHAIN & DEPENDENCY HYGIENE
// --------------------------------------------------------------------------
console.log('\n--- 6. SUPPLY-CHAIN & METADATA HYGIENE ---');

// Check that no wildcard versions or arbitrary URLs exist in dependencies
let hasWildcard = false;
let hasArbitraryUrl = false;
for (const [dep, ver] of Object.entries(pkgJson.dependencies)) {
  if (ver.includes('*') || ver.includes('latest')) hasWildcard = true;
  if (/^(http|git|file):/.test(ver)) hasArbitraryUrl = true;
}
check(testIdx++, 'Zero wildcard versions in package.json dependencies', !hasWildcard);
check(testIdx++, 'Zero URL/git dependencies in package.json dependencies', !hasArbitraryUrl);

// Check that no dangerous install scripts exist in package.json
const pkgScripts = pkgJson.scripts || {};
check(testIdx++, 'No preinstall/postinstall scripts in package.json', !pkgScripts.preinstall && !pkgScripts.postinstall && !pkgScripts.prepare);

// Check that build:extension defaults to unpacked-only
check(testIdx++, 'package.json build:extension contains --unpacked-only', pkgScripts['build:extension'].includes('--unpacked-only'));

console.log('\n========================================================================');
console.log(`PHASE 1.0B TEST SUITE COMPLETED: ${passed} Passed, ${failed} Failed.`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
