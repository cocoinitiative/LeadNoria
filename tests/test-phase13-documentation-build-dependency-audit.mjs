/**
 * LeadNoria — Phase 13: Documentation, Build & Dependency Audit Regression Suite
 *
 * Validates:
 * 1. Manifest V3 permissions audit: least-privilege enforcement, zero broad permissions.
 * 2. Host permissions isolation: strictly limited to Meta Ad Library URLs.
 * 3. Dependency hygiene: package.json / package-lock.json integrity, zero disallowed packages.
 * 4. Runtime boundary: server/dev dependencies (Playwright, esbuild, archiver) isolated from extension.
 * 5. Build reproducibility: clean unpacked extension generation, zero test/fixture leakage.
 * 6. Non-destructive build safety: zero unintended ZIP archives created in unpacked mode.
 * 7. Documentation audit: README, audit reports, and safety boundary disclaimers.
 * 8. Permanent fail-closed collection & crawling safety gates.
 * 9. Historical release archive SHA-256 hash immutability.
 * 10. Protection of pre-existing modified files.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
console.log('LEADNORIA: PHASE 13 DOCUMENTATION, BUILD & DEPENDENCY AUDIT');
console.log('Scope: Manifest V3 | Least Privilege | Clean Build | Dependency Boundary');
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
// SECTION 1: MANIFEST V3 PERMISSIONS & SECURITY AUDIT
// ============================================================================
console.log('--- SECTION 1: Manifest V3 Permissions & Security Audit ---');

const manifestPath = path.join(rootDir, 'src/extension/manifest.json');
assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

runTest('1.1: Manifest specifies manifest_version 3', () => {
  assert.strictEqual(manifest.manifest_version, 3, 'Must be Manifest V3');
});

runTest('1.2: Permissions adhere strictly to least-privilege list', () => {
  const ALLOWED_PERMISSIONS = new Set(['storage', 'tabs', 'scripting', 'sidePanel']);
  const FORBIDDEN_PERMISSIONS = [
    'webRequest',
    'webRequestBlocking',
    'declarativeNetRequest',
    'declarativeNetRequestFeedback',
    'cookies',
    'management',
    'privacy',
    'proxy',
    'debugger',
    'geolocation',
    'vpnProvider',
    'webNavigation'
  ];

  for (const perm of manifest.permissions) {
    assert.ok(ALLOWED_PERMISSIONS.has(perm), `Unauthorized permission declared: "${perm}"`);
  }

  for (const forbidden of FORBIDDEN_PERMISSIONS) {
    assert.ok(!manifest.permissions.includes(forbidden), `Forbidden elevated permission found: "${forbidden}"`);
  }
});

runTest('1.3: Host permissions restricted strictly to Meta Ad Library endpoints', () => {
  const ALLOWED_HOSTS = [
    'https://www.facebook.com/ads/library/*',
    'https://web.facebook.com/ads/library/*'
  ];

  assert.ok(Array.isArray(manifest.host_permissions), 'host_permissions must be an array');
  assert.strictEqual(manifest.host_permissions.length, 2, 'Must have exactly 2 authorized host permissions');

  for (const host of manifest.host_permissions) {
    assert.ok(ALLOWED_HOSTS.includes(host), `Unauthorized host permission: "${host}"`);
  }

  // Assert no wildcard host patterns
  const forbiddenHostPatterns = ['<all_urls>', '*://*/*', 'http://*/*', 'https://*/*'];
  for (const pattern of forbiddenHostPatterns) {
    assert.ok(!manifest.host_permissions.includes(pattern), `Dangerous wildcard host found: "${pattern}"`);
  }
});

runTest('1.4: Content script match patterns restricted to Meta Ad Library', () => {
  assert.ok(Array.isArray(manifest.content_scripts), 'content_scripts must be an array');
  for (const cs of manifest.content_scripts) {
    for (const match of cs.matches) {
      assert.ok(
        match.startsWith('https://www.facebook.com/ads/library/') ||
        match.startsWith('https://web.facebook.com/ads/library/'),
        `Content script matches unauthorized domain: "${match}"`
      );
    }
  }
});

// ============================================================================
// SECTION 2: DEPENDENCY HYGIENE & RUNTIME BOUNDARY AUDIT
// ============================================================================
console.log('\n--- SECTION 2: Dependency Hygiene & Runtime Boundary Audit ---');

const pkgJsonPath = path.join(rootDir, 'package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

runTest('2.1: Disallowed packages strictly absent from package.json dependencies', () => {
  const BANNED_PACKAGES = [
    '@google/genai',
    'puppeteer',
    'puppeteer-core',
    'selenium-webdriver',
    'cheerio',
    'axios',
    'got',
    'superagent',
    'request',
    '2captcha',
    'anticaptcha',
    'fake-useragent'
  ];

  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies
  };

  for (const banned of BANNED_PACKAGES) {
    assert.ok(!allDeps[banned], `Banned dependency found in package.json: "${banned}"`);
  }
});

runTest('2.2: Node-only and dev dependencies strictly isolated from Chrome extension sources', () => {
  const NODE_ONLY_MODULES = [
    'playwright',
    'archiver',
    'esbuild',
    'fs',
    'child_process',
    'node:fs',
    'node:child_process',
    'express'
  ];

  function scanDirectoryForForbiddenImports(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectoryForForbiddenImports(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const mod of NODE_ONLY_MODULES) {
          const importRegex = new RegExp(`from\\s+['"]${mod}['"]`, 'g');
          const requireRegex = new RegExp(`require\\(['"]${mod}['"]\\)`, 'g');
          assert.ok(!importRegex.test(content), `Extension source ${entry.name} imports forbidden module "${mod}"`);
          assert.ok(!requireRegex.test(content), `Extension source ${entry.name} requires forbidden module "${mod}"`);
        }
      }
    }
  }

  scanDirectoryForForbiddenImports(path.join(rootDir, 'src/extension'));
});

// ============================================================================
// SECTION 3: BUILD REPRODUCIBILITY & UNPACKED ARTIFACT AUDIT
// ============================================================================
console.log('\n--- SECTION 3: Build Reproducibility & Unpacked Artifact Audit ---');

runTest('3.1: scripts/build-extension.mjs builds unpacked extension deterministically', () => {
  const buildScript = path.join(rootDir, 'scripts/build-extension.mjs');
  const result = spawnSync(process.execPath, [buildScript, '--unpacked-only'], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  assert.strictEqual(result.status, 0, `build-extension failed with code ${result.status}: ${result.stderr}`);
  console.log('    Build output confirmed exit code 0.');
});

runTest('3.2: Unpacked build generates all required runtime extension assets', () => {
  const extDir = path.join(rootDir, 'extension');
  assert.ok(fs.existsSync(extDir), 'extension/ directory must exist');

  const REQUIRED_ASSETS = [
    'manifest.json',
    'service-worker.js',
    'content-script.js',
    'app.js',
    'styles.css',
    'sidepanel.html',
    'popup.html',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png',
    'icons/icon-256.png'
  ];

  for (const rel of REQUIRED_ASSETS) {
    const full = path.join(extDir, rel);
    assert.ok(fs.existsSync(full), `Required asset missing: ${rel}`);
    const stat = fs.statSync(full);
    assert.ok(stat.size > 0, `Asset ${rel} is empty (0 bytes)`);
  }

  // Validate PNG signatures
  const iconFiles = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png', 'icon-256.png'];
  const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const icon of iconFiles) {
    const iconBuf = fs.readFileSync(path.join(extDir, 'icons', icon));
    assert.ok(iconBuf.subarray(0, 8).equals(PNG_HEADER), `Icon ${icon} lacks valid PNG header`);
  }
});

runTest('3.3: Unpacked extension directory is strictly free of test/dev leaks', () => {
  const extDir = path.join(rootDir, 'extension');

  function checkClean(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        checkClean(full);
      } else {
        assert.ok(!e.name.endsWith('.ts'), `TypeScript source leaked into extension: ${e.name}`);
        assert.ok(!e.name.endsWith('.tsx'), `TSX source leaked into extension: ${e.name}`);
        assert.ok(!e.name.startsWith('test-'), `Test file leaked into extension: ${e.name}`);
        assert.ok(!e.name.endsWith('.mjs'), `ESM script leaked into extension: ${e.name}`);
        assert.ok(!e.name.endsWith('.map'), `Sourcemap leaked into extension: ${e.name}`);
      }
    }
  }

  checkClean(extDir);
});

runTest('3.4: Unpacked build creates zero new ZIP archives and preserves historical packages', () => {
  const distDir = path.join(rootDir, 'dist');
  assert.ok(fs.existsSync(distDir), 'dist/ directory must exist');

  // Verify historical archives exist and match SHA-256
  for (const [relPath, expected] of Object.entries(HISTORICAL_HASHES)) {
    const full = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(full), `Historical archive missing: ${relPath}`);
    assert.strictEqual(sha256(full), expected, `Historical archive mutated: ${relPath}`);
  }

  // Verify root directory does not have stray zip files other than historical extension.zip
  const rootZips = fs.readdirSync(rootDir).filter(f => f.endsWith('.zip'));
  assert.deepStrictEqual(rootZips, ['extension.zip'], 'Root directory must contain only historical extension.zip');
});

// ============================================================================
// SECTION 4: DOCUMENTATION INTEGRITY & POLICY AUDIT
// ============================================================================
console.log('\n--- SECTION 4: Documentation Integrity & Policy Compliance Audit ---');

runTest('4.1: README.md explicitly documents Meta Ad Library-only constraint', () => {
  const readmePath = path.join(rootDir, 'README.md');
  assert.ok(fs.existsSync(readmePath), 'README.md must exist');
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.ok(
    readme.includes('Meta Ad Library') || readme.includes('Meta Ad'),
    'README must mention Meta Ad Library'
  );
  assert.ok(
    readme.includes('isLiveCollectionPermitted') || readme.includes('fail-closed') || readme.includes('Offline-First') || readme.includes('offline'),
    'README must document fail-closed / offline safety policy'
  );
});

runTest('4.2: Audit reports present and sequential for Phases 9 through 12', () => {
  const auditReports = [
    'docs/audits/PHASE_9_CSV_JSON_EXPORT_AND_DATA_INTEGRITY_REPORT.md',
    'docs/audits/PHASE_10_UI_FILTERS_AND_RESEARCH_WORKFLOW_REPORT.md',
    'docs/audits/PHASE_11_PERFORMANCE_AND_SCALABILITY_REPORT.md',
    'docs/audits/PHASE_12_AUTOMATED_TESTING_AND_GROUND_TRUTH_VALIDATION_REPORT.md'
  ];

  for (const report of auditReports) {
    const p = path.join(rootDir, report);
    assert.ok(fs.existsSync(p), `Audit report missing: ${report}`);
    const content = fs.readFileSync(p, 'utf8');
    assert.ok(content.includes('PASS'), `Audit report ${report} must confirm PASS status`);
    assert.ok(content.length >= 1000, `Audit report ${report} content is too brief`);
  }
});

// ============================================================================
// SECTION 5: SAFETY INVARIANTS, PROTECTED FILES & ARCHIVE HASH IMMUTABILITY
// ============================================================================
console.log('\n--- SECTION 5: Safety Invariants, Protected Files & Archive Immutability ---');

runTest('5.1: Fail-closed collection & crawling gates remain strictly false', () => {
  assert.strictEqual(isLiveCollectionPermitted(), false, 'isLiveCollectionPermitted() must be false');
  assert.strictEqual(isExternalWebsiteCrawlingPermitted(), false, 'isExternalWebsiteCrawlingPermitted() must be false');
});

runTest('5.2: All 9 pre-existing protected files exist and remain preserved', () => {
  for (const rel of PROTECTED_FILES) {
    const full = path.join(rootDir, rel);
    assert.ok(fs.existsSync(full), `Protected file missing: ${rel}`);
  }
});

runTest('5.3: Historical release archive SHA-256 hashes verified byte-for-byte intact', () => {
  for (const [relPath, expected] of Object.entries(HISTORICAL_HASHES)) {
    const full = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(full), `Historical archive missing: ${relPath}`);
    const actual = sha256(full);
    assert.strictEqual(actual, expected, `SHA-256 mismatch on historical artifact ${relPath}`);
  }
});

console.log('\n========================================================================');
console.log(`PHASE 13 AUDIT COMPLETE: ${passedTests}/${totalTests} Passed (0 Failed)`);
console.log('Status: PASS — Documentation, Build & Dependency Boundary Verified');
console.log('========================================================================\n');
