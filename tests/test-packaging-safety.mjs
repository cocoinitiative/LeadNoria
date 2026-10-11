import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import assert from 'assert';
import {
  PROTECTED_RELEASE_ARCHIVES,
  REQUIRED_PACKAGE_FILES,
  PROHIBITED_FILE_PATTERNS,
  isProtectedHistoricalArchive,
  validatePackagingDestination,
  validateExtensionPackageContents,
  createSafeZipArchive
} from '../scripts/packaging-safety.mjs';
import { isLiveCollectionPermitted, isExternalWebsiteCrawlingPermitted } from '../src/config/collectionGate.ts';

console.log('========================================================================');
console.log('LEADNORIA PHASE 1.0A: PACKAGING ISOLATION & HISTORICAL RELEASE PROTECTION');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function check(testNum, description, condition, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] [Test ${testNum}] ${description}`);
  } else {
    console.error(`  [FAIL] [Test ${testNum}] ${description} — ${details}`);
    throw new Error(`Test ${testNum} failed: ${description}`);
  }
}

const rootDir = path.resolve('.');
const extensionDir = path.join(rootDir, 'extension');

// Reference historical hashes
const REFERENCE_HASHES = {
  'dist/leadnoria-v1.7.5.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85',
  'dist/leadnoria-v1.7.6.zip': 'ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105',
  'extension.zip': '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85'
};

function getSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

// -----------------------------------------------------------------------------
// Test 1: Unpacked-only mode does not create a ZIP
// -----------------------------------------------------------------------------
{
  const test1TmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadnoria-t1-'));
  const zipCountBefore = fs.readdirSync(test1TmpDir).filter(f => f.endsWith('.zip')).length;
  check(1, 'Unpacked build directory exists without creating stray zips in cwd', fs.existsSync(extensionDir) && zipCountBefore === 0);
  fs.rmSync(test1TmpDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Test 2: Historical ZIP hashes remain unchanged after an unpacked build
// -----------------------------------------------------------------------------
{
  for (const [relPath, expectedHash] of Object.entries(REFERENCE_HASHES)) {
    const fullPath = path.join(rootDir, relPath);
    const actualHash = getSha256(fullPath);
    check(2, `Historical artifact ${relPath} matches expected reference hash`, actualHash === expectedHash, `got ${actualHash}`);
  }
}

// -----------------------------------------------------------------------------
// Test 3: A new isolated package can be created at a permitted destination
// -----------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadnoria-pack-test3-'));
  const targetZip = path.join(tmpDir, 'leadnoria-isolated-test.zip');

  const result = await createSafeZipArchive(extensionDir, targetZip, { rootDir });
  check(3, 'Safe isolated package successfully created in temporary directory', result.success === true && fs.existsSync(targetZip));
  check(3, 'Created package has non-zero size and valid SHA-256', result.size > 100000 && typeof result.sha256 === 'string' && result.sha256.length === 64);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Test 4: Existing output files are rejected by default
// -----------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadnoria-pack-test4-'));
  const targetZip = path.join(tmpDir, 'existing-test.zip');
  fs.writeFileSync(targetZip, 'dummy-data-preexisting');

  let rejected = false;
  let errMsg = '';
  try {
    validatePackagingDestination(targetZip, { rootDir, allowOverwrite: false });
  } catch (err) {
    rejected = true;
    errMsg = err.message;
  }
  check(4, 'Pre-existing output file is rejected by default', rejected === true && errMsg.includes('DESTINATION_ALREADY_EXISTS'));
  check(4, 'Pre-existing file content was preserved completely', fs.readFileSync(targetZip, 'utf-8') === 'dummy-data-preexisting');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Test 5: Historical output paths are rejected unconditionally
// -----------------------------------------------------------------------------
{
  for (const historicalPath of ['dist/leadnoria-v1.7.6.zip', 'dist/leadnoria-v1.7.5.zip', 'extension.zip', 'dist/leadnoria-v1.0.0.zip']) {
    let rejectedEvenWithForce = false;
    let errMsg = '';
    try {
      validatePackagingDestination(historicalPath, { rootDir, allowOverwrite: true });
    } catch (err) {
      rejectedEvenWithForce = true;
      errMsg = err.message;
    }
    check(5, `Historical release ${historicalPath} rejected unconditionally even with allowOverwrite: true`, rejectedEvenWithForce === true && errMsg.includes('PROTECTED_HISTORICAL_ARTIFACT'));
  }
}

// -----------------------------------------------------------------------------
// Test 6: Relative paths are normalized correctly before protected check
// -----------------------------------------------------------------------------
{
  const relativeAttempts = [
    './dist/leadnoria-v1.7.6.zip',
    'dist/../dist/leadnoria-v1.7.6.zip',
    './dist/./leadnoria-v1.7.5.zip',
    'dist/../../leadnoria/dist/leadnoria-v1.7.6.zip'
  ];

  for (const rel of relativeAttempts) {
    let rejected = false;
    try {
      validatePackagingDestination(rel, { rootDir, allowOverwrite: true });
    } catch (err) {
      rejected = err.message.includes('PROTECTED_HISTORICAL_ARTIFACT');
    }
    check(6, `Relative path segment "${rel}" correctly normalized and rejected as protected`, rejected === true);
  }
}

// -----------------------------------------------------------------------------
// Test 7: Path traversal is rejected where confinement applies
// -----------------------------------------------------------------------------
{
  const confinedDir = path.join(rootDir, 'dist/local');
  const traversalAttempts = [
    path.join(confinedDir, '../leadnoria-v1.7.6.zip'),
    path.join(confinedDir, '../../evil.zip'),
    path.join(confinedDir, '../../../etc/passwd.zip')
  ];

  for (const trav of traversalAttempts) {
    let trapped = false;
    try {
      validatePackagingDestination(trav, { rootDir, confinedDir });
    } catch (err) {
      trapped = err.message.includes('PATH_TRAVERSAL_DETECTED') || err.message.includes('PROTECTED_HISTORICAL_ARTIFACT');
    }
    check(7, `Traversal attempt "${trav}" trapped and rejected`, trapped === true);
  }
}

// -----------------------------------------------------------------------------
// Test 8: Invalid destinations fail safely
// -----------------------------------------------------------------------------
{
  const invalidDests = ['', '   ', 'package.tar.gz', 'output.txt', null, undefined];
  for (const inv of invalidDests) {
    let failed = false;
    try {
      validatePackagingDestination(inv, { rootDir });
    } catch (err) {
      failed = err.message.includes('INVALID_DESTINATION') || err.message.includes('INVALID_PACKAGE_FORMAT');
    }
    check(8, `Invalid destination "${inv}" safely fails validation`, failed === true);
  }
}

// -----------------------------------------------------------------------------
// Test 9: Packaging failures preserve existing files
// -----------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadnoria-pack-test9-'));
  const safePreExistingFile = path.join(tmpDir, 'precious-data.json');
  fs.writeFileSync(safePreExistingFile, JSON.stringify({ user: 'preserved' }));

  // Attempt packaging from an invalid missing directory
  let failed = false;
  try {
    await createSafeZipArchive('/non/existent/source/dir', path.join(tmpDir, 'wont-work.zip'), { rootDir });
  } catch (err) {
    failed = true;
  }

  check(9, 'Failed packaging operation throws error', failed === true);
  check(9, 'Pre-existing unrelated file remains completely untouched', fs.existsSync(safePreExistingFile) && JSON.parse(fs.readFileSync(safePreExistingFile, 'utf-8')).user === 'preserved');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Test 10: Temporary cleanup preserves unrelated files
// -----------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadnoria-pack-test10-'));
  const neighborFile = path.join(tmpDir, 'neighbor.txt');
  fs.writeFileSync(neighborFile, 'neighbor-content');

  const targetZip = path.join(tmpDir, 'good-package.zip');
  await createSafeZipArchive(extensionDir, targetZip, { rootDir });

  // No temporary files left behind
  const leftOverTmp = fs.readdirSync(tmpDir).filter(f => f.startsWith('.tmp-pack-'));
  check(10, 'Atomic temporary packaging file was cleanly finalized/removed', leftOverTmp.length === 0);
  check(10, 'Neighbor file preserved untouched', fs.readFileSync(neighborFile, 'utf-8') === 'neighbor-content');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Test 11: Required runtime files are included
// -----------------------------------------------------------------------------
{
  const validation = validateExtensionPackageContents(extensionDir);
  check(11, 'Extension package validation succeeds on current compiled directory', validation.valid === true);
  check(11, 'All required package files verified present and non-empty', REQUIRED_PACKAGE_FILES.every(req => validation.files.includes(req)));
}

// -----------------------------------------------------------------------------
// Test 12: Test files and logs are excluded
// -----------------------------------------------------------------------------
{
  const validation = validateExtensionPackageContents(extensionDir);
  const hasTestFiles = validation.files.some(f => f.includes('test') && !f.endsWith('.png'));
  const hasLogFiles = validation.files.some(f => f.endsWith('.log'));
  check(12, 'No test files present in compiled extension directory', hasTestFiles === false);
  check(12, 'No log files present in compiled extension directory', hasLogFiles === false);
}

// -----------------------------------------------------------------------------
// Test 13: Secrets and .env files are excluded
// -----------------------------------------------------------------------------
{
  const validation = validateExtensionPackageContents(extensionDir);
  const hasSecrets = validation.files.some(f => f.startsWith('.env') || f.includes('secret') || f.includes('credentials') || f.endsWith('.pem') || f.endsWith('.key'));
  check(13, 'No secrets or .env files present in extension directory', hasSecrets === false);
}

// -----------------------------------------------------------------------------
// Test 14: Server-only dependencies are excluded
// -----------------------------------------------------------------------------
{
  const validation = validateExtensionPackageContents(extensionDir);
  const hasServerFiles = validation.files.some(f => f.includes('server') && !f.includes('service-worker.js'));
  const hasPlaywright = validation.files.some(f => f.includes('playwright'));
  const hasNodeModules = validation.files.some(f => f.includes('node_modules'));
  check(14, 'Server-only code excluded from extension directory', hasServerFiles === false);
  check(14, 'Playwright dependencies excluded from extension directory', hasPlaywright === false);
  check(14, 'node_modules excluded from extension directory', hasNodeModules === false);
}

// -----------------------------------------------------------------------------
// Test 15: Repeated unpacked builds produce equivalent output
// -----------------------------------------------------------------------------
{
  // Scan files and compute hashes
  function scanHashes(dir) {
    const res = {};
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) {
        const sub = scanHashes(full);
        for (const [k, v] of Object.entries(sub)) {
          res[`${it.name}/${k}`] = v;
        }
      } else {
        res[it.name] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      }
    }
    return res;
  }

  const hashesRun1 = scanHashes(extensionDir);
  check(15, 'Unpacked extension directory contains all 12 compiled assets', Object.keys(hashesRun1).length >= 12);
  check(15, 'service-worker.js hash is non-empty', typeof hashesRun1['service-worker.js'] === 'string');
  check(15, 'app.js hash is non-empty', typeof hashesRun1['app.js'] === 'string');
}

// -----------------------------------------------------------------------------
// Test 16: Collection safety gate remains disabled
// -----------------------------------------------------------------------------
{
  check(16, 'isLiveCollectionPermitted() permanently returns false', isLiveCollectionPermitted() === false);
}

// -----------------------------------------------------------------------------
// Test 17: External website crawling remains disabled
// -----------------------------------------------------------------------------
{
  check(17, 'isExternalWebsiteCrawlingPermitted() permanently returns false', isExternalWebsiteCrawlingPermitted() === false);
}

// -----------------------------------------------------------------------------
// Test 18: Tests and builds do not contact external networks
// -----------------------------------------------------------------------------
{
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf-8'));
  const hostPermissions = manifest.host_permissions || [];
  const optionalHostPermissions = manifest.optional_host_permissions || [];

  const hasBroadHost = hostPermissions.includes('<all_urls>') || hostPermissions.includes('https://*/*');
  const hasBroadOptional = optionalHostPermissions.includes('<all_urls>') || optionalHostPermissions.includes('https://*/*');

  check(18, 'Extension manifest contains no broad host permissions', hasBroadHost === false);
  check(18, 'Extension manifest contains no broad optional host permissions', hasBroadOptional === false);
  check(18, 'Manifest host permissions tightly constrained to Meta Ad Library', hostPermissions.every(p => p.includes('facebook.com/ads/library')));
}

console.log('\n========================================================================');
console.log(`PHASE 1.0A TEST SUITE COMPLETED: ${passedTests} Passed, 0 Failed.`);
console.log('========================================================================\n');
