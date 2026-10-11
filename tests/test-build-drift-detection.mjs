import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { verifyZipMatchesDirectory, verifyMirrorIntegrity } from '../scripts/release-integrity.mjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const rootDir = process.cwd();
const sandboxDir = path.join(rootDir, 'temp-drift-test-sandbox');

function createZipFromDir(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const parentDir = path.dirname(zipPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    const output = fs.createWriteStream(zipPath);
    const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function runDriftTestSuite() {
  console.log('================================================================');
  console.log('LEADNORIA — BUILD DRIFT DETECTION & INTEGRITY TEST SUITE');
  console.log('================================================================');

  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  let passed = 0;
  let total = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: UNCHANGED SOURCES
    // -------------------------------------------------------------------------
    console.log('\n--- 1. UNCHANGED SOURCES (PARITY VERIFICATION) ---');
    const mockDir1 = path.join(sandboxDir, 'case1-source');
    fs.mkdirSync(mockDir1, { recursive: true });
    fs.writeFileSync(path.join(mockDir1, 'manifest.json'), JSON.stringify({ version: '1.7.5' }));
    fs.writeFileSync(path.join(mockDir1, 'app.js'), 'console.log("LeadNoria app v1.7.5");');
    fs.writeFileSync(path.join(mockDir1, 'styles.css'), 'body { background: #0f172a; }');

    const mockZip1 = path.join(sandboxDir, 'case1.zip');
    await createZipFromDir(mockDir1, mockZip1);

    const res1 = verifyZipMatchesDirectory(mockZip1, mockDir1);
    assert(res1.valid === true, 'Matching directory and archive returns valid: true');
    assert(res1.fileCount === 3, 'Correctly reports 3 verified files in archive');

    // Also verify against the real production release
    const targetReleaseZip = fs.existsSync('dist/leadnoria-v1.7.6.zip') ? 'dist/leadnoria-v1.7.6.zip' : 'dist/leadnoria-v1.7.5.zip';
    const prodRes = verifyZipMatchesDirectory(targetReleaseZip, 'extension');
    assert(prodRes.valid === true, `Production ${targetReleaseZip} exactly matches ./extension/ output`);
    assert(prodRes.fileCount === 12, 'Production archive contains exactly 12 verified files');

    // -------------------------------------------------------------------------
    // TEST 2: MODIFIED SOURCES (DRIFT DETECTION)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. MODIFIED SOURCES (DRIFT DETECTION) ---');
    const mockDir2 = path.join(sandboxDir, 'case2-source');
    fs.mkdirSync(mockDir2, { recursive: true });
    fs.writeFileSync(path.join(mockDir2, 'manifest.json'), JSON.stringify({ version: '1.7.5' }));
    fs.writeFileSync(path.join(mockDir2, 'app.js'), 'console.log("Original content");');

    const mockZip2 = path.join(sandboxDir, 'case2.zip');
    await createZipFromDir(mockDir2, mockZip2);

    // Subcase 2A: Content modified in directory
    fs.writeFileSync(path.join(mockDir2, 'app.js'), 'console.log("Modified mutated content!");');
    const res2A = verifyZipMatchesDirectory(mockZip2, mockDir2);
    assert(res2A.valid === false, 'Detects modified file content in directory');
    assert(res2A.drifted && res2A.drifted.some(d => d.file === 'app.js'), 'Identifies app.js as drifted file');

    // Subcase 2B: New extra file added to directory
    fs.writeFileSync(path.join(mockDir2, 'extra.js'), 'console.log("unexpected");');
    const res2B = verifyZipMatchesDirectory(mockZip2, mockDir2);
    assert(res2B.valid === false, 'Detects newly added file missing from archive');
    assert(res2B.drifted && res2B.drifted.some(d => d.file === 'extra.js'), 'Identifies extra.js as missing from archive');

    // Subcase 2C: File removed from directory
    fs.unlinkSync(path.join(mockDir2, 'extra.js'));
    fs.unlinkSync(path.join(mockDir2, 'app.js'));
    const res2C = verifyZipMatchesDirectory(mockZip2, mockDir2);
    assert(res2C.valid === false, 'Detects file deleted from directory but present in archive');
    assert(res2C.drifted && res2C.drifted.some(d => d.file === 'app.js'), 'Identifies app.js as missing from directory');

    // -------------------------------------------------------------------------
    // TEST 3: MISSING ARCHIVES
    // -------------------------------------------------------------------------
    console.log('\n--- 3. MISSING ARCHIVES ---');
    const res3A = verifyZipMatchesDirectory(path.join(sandboxDir, 'nonexistent.zip'), mockDir1);
    assert(res3A.valid === false, 'Non-existent archive path returns valid: false');
    assert(res3A.reason.includes('Archive file missing'), 'Reports descriptive error for missing archive');

    const res3B = verifyZipMatchesDirectory(mockZip1, path.join(sandboxDir, 'nonexistent-dir'));
    assert(res3B.valid === false, 'Non-existent directory path returns valid: false');

    // -------------------------------------------------------------------------
    // TEST 4: CORRUPTED ARCHIVES
    // -------------------------------------------------------------------------
    console.log('\n--- 4. CORRUPTED ARCHIVES ---');
    // Subcase 4A: Truncated file (< 22 bytes)
    const truncatedZip = path.join(sandboxDir, 'truncated.zip');
    fs.writeFileSync(truncatedZip, Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    const res4A = verifyZipMatchesDirectory(truncatedZip, mockDir1);
    assert(res4A.valid === false, 'Detects truncated zip archive');

    // Subcase 4B: Corrupted EOCD signature
    const corruptEocdZip = path.join(sandboxDir, 'corrupt-eocd.zip');
    const goodZipBuf = Buffer.from(fs.readFileSync(mockZip1));
    goodZipBuf.fill(0x00, goodZipBuf.length - 22, goodZipBuf.length);
    fs.writeFileSync(corruptEocdZip, goodZipBuf);
    const res4B = verifyZipMatchesDirectory(corruptEocdZip, mockDir1);
    assert(res4B.valid === false, 'Detects missing EOCD signature in corrupted archive');

    // Subcase 4C: CRC32 bit flip in file data
    const corruptCrcZip = path.join(sandboxDir, 'corrupt-crc.zip');
    const crcCorruptBuf = Buffer.from(fs.readFileSync(mockZip1));
    // Flip bytes in the compressed payload of first entry
    crcCorruptBuf[40] ^= 0xFF;
    crcCorruptBuf[41] ^= 0xAA;
    fs.writeFileSync(corruptCrcZip, crcCorruptBuf);
    const res4C = verifyZipMatchesDirectory(corruptCrcZip, mockDir1);
    assert(res4C.valid === false, 'Detects CRC32 or decompression corruption');

    // -------------------------------------------------------------------------
    // TEST 5: MIRROR INTEGRITY & MISMATCHES
    // -------------------------------------------------------------------------
    console.log('\n--- 5. MIRROR INTEGRITY & MISMATCHES ---');
    const mirrorGood = path.join(sandboxDir, 'mirror-good.zip');
    fs.copyFileSync(mockZip1, mirrorGood);
    const res5A = verifyMirrorIntegrity(mockZip1, mirrorGood);
    assert(res5A.valid === true, 'Identical mirror copy returns valid: true');
    assert(typeof res5A.sha256 === 'string' && res5A.sha256.length === 64, 'Computes and returns valid SHA-256 for mirror');

    // Real production mirror verification
    const prodMirror = verifyMirrorIntegrity('dist/leadnoria-v1.7.5.zip', 'extension.zip');
    assert(prodMirror.valid === true, 'Production extension.zip mirrors dist/leadnoria-v1.7.5.zip byte-for-byte');
    assert(prodMirror.sha256 === '08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85', 'Production mirror matches exact expected SHA-256 hash');

    // Subcase 5B: Size mismatch
    const mirrorBadSize = path.join(sandboxDir, 'mirror-bad-size.zip');
    fs.writeFileSync(mirrorBadSize, Buffer.concat([fs.readFileSync(mockZip1), Buffer.from([0x00])]));
    const res5B = verifyMirrorIntegrity(mockZip1, mirrorBadSize);
    assert(res5B.valid === false, 'Detects mirror size mismatch');

    // Subcase 5C: Byte mismatch with equal length
    const mirrorBadBytes = path.join(sandboxDir, 'mirror-bad-bytes.zip');
    const badBytesBuf = Buffer.from(fs.readFileSync(mockZip1));
    badBytesBuf[10] ^= 0xFF;
    fs.writeFileSync(mirrorBadBytes, badBytesBuf);
    const res5C = verifyMirrorIntegrity(mockZip1, mirrorBadBytes);
    assert(res5C.valid === false, 'Detects mirror byte-for-byte mismatch');

    // Subcase 5D: Missing mirror file
    const res5D = verifyMirrorIntegrity(mockZip1, path.join(sandboxDir, 'missing-mirror.zip'));
    assert(res5D.valid === false, 'Detects missing mirror file');

  } finally {
    // Isolated sandbox cleanup
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    console.log('\n[sandbox] Cleaned up temporary test sandbox');
  }

  console.log('\n================================================================');
  console.log(`TOTAL DRIFT DETECTION TESTS PASSED: ${passed} / ${total}`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runDriftTestSuite();
