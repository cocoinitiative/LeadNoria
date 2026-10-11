import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';

/**
 * Validates that an existing ZIP archive contains exactly the uncompressed
 * files and byte contents present in the target directory.
 * 
 * Returns:
 * { valid: true, fileCount: number, files: string[] }
 * or
 * { valid: false, reason: string, drifted?: Array<{ file: string, issue: string }> }
 */
export function verifyZipMatchesDirectory(zipPath, dirPath) {
  if (!fs.existsSync(zipPath)) {
    return { valid: false, reason: `Archive file missing: ${zipPath}` };
  }
  if (!fs.existsSync(dirPath)) {
    return { valid: false, reason: `Target directory missing: ${dirPath}` };
  }

  const zipBuf = fs.readFileSync(zipPath);
  if (zipBuf.length < 22) {
    return { valid: false, reason: `Archive file corrupted or truncated (${zipBuf.length} bytes)` };
  }

  // Find End of Central Directory Record (EOCD)
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65557); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return { valid: false, reason: 'Invalid ZIP archive: End of Central Directory signature not found' };
  }

  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  const cdSize = zipBuf.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);

  if (cdOffset >= zipBuf.length || cdOffset + cdSize > zipBuf.length) {
    return { valid: false, reason: 'Corrupted ZIP archive: Central Directory bounds invalid' };
  }

  const zipFiles = new Map();
  let offset = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > zipBuf.length) {
      return { valid: false, reason: `Corrupted ZIP archive: truncated Central Directory header at entry ${i}` };
    }
    const sig = zipBuf.readUInt32LE(offset);
    if (sig !== 0x02014b50) {
      return { valid: false, reason: `Corrupted ZIP archive: invalid Central Directory signature 0x${sig.toString(16)} at entry ${i}` };
    }

    const method = zipBuf.readUInt16LE(offset + 10);
    const crc32 = zipBuf.readUInt32LE(offset + 16);
    const compSize = zipBuf.readUInt32LE(offset + 20);
    const uncompSize = zipBuf.readUInt32LE(offset + 24);
    const nameLen = zipBuf.readUInt16LE(offset + 28);
    const extraLen = zipBuf.readUInt16LE(offset + 30);
    const commentLen = zipBuf.readUInt16LE(offset + 32);
    const localHeaderOffset = zipBuf.readUInt32LE(offset + 42);

    const name = zipBuf.toString('utf-8', offset + 46, offset + 46 + nameLen);

    if (!name.endsWith('/')) {
      if (localHeaderOffset + 30 > zipBuf.length) {
        return { valid: false, reason: `Corrupted ZIP archive: local header offset out of bounds for ${name}` };
      }
      const locSig = zipBuf.readUInt32LE(localHeaderOffset);
      if (locSig !== 0x04034b50) {
        return { valid: false, reason: `Corrupted ZIP archive: invalid local header signature for ${name}` };
      }
      const locNameLen = zipBuf.readUInt16LE(localHeaderOffset + 26);
      const locExtraLen = zipBuf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + locNameLen + locExtraLen;

      if (dataStart + compSize > zipBuf.length) {
        return { valid: false, reason: `Corrupted ZIP archive: compressed data out of bounds for ${name}` };
      }

      const compData = zipBuf.slice(dataStart, dataStart + compSize);
      let uncompressedData;

      try {
        if (method === 0) {
          uncompressedData = compData;
        } else if (method === 8) {
          uncompressedData = zlib.inflateRawSync(compData);
        } else {
          return { valid: false, reason: `Unsupported compression method ${method} for ${name}` };
        }
      } catch (err) {
        return { valid: false, reason: `Decompression failure for ${name}: ${err.message}` };
      }

      if (uncompressedData.length !== uncompSize) {
        return { valid: false, reason: `Uncompressed size mismatch for ${name}: expected ${uncompSize}, got ${uncompressedData.length}` };
      }

      const actualCrc = (zlib.crc32(uncompressedData) >>> 0);
      if (actualCrc !== (crc32 >>> 0)) {
        return { valid: false, reason: `CRC32 checksum mismatch for ${name}: expected 0x${crc32.toString(16)}, got 0x${actualCrc.toString(16)}` };
      }

      const normalizedName = name.replace(/\\/g, '/');
      zipFiles.set(normalizedName, uncompressedData);
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  // Collect all files from dirPath
  function scanDir(curDir, prefix = '') {
    const items = fs.readdirSync(curDir, { withFileTypes: true });
    let results = [];
    for (const it of items) {
      const rel = prefix ? `${prefix}/${it.name}` : it.name;
      const full = path.join(curDir, it.name);
      if (it.isDirectory()) {
        results = results.concat(scanDir(full, rel));
      } else if (it.isFile()) {
        results.push({ rel, full });
      }
    }
    return results;
  }

  const diskFiles = scanDir(dirPath);
  const diskFileMap = new Map();
  for (const f of diskFiles) {
    diskFileMap.set(f.rel.replace(/\\/g, '/'), fs.readFileSync(f.full));
  }

  const drifted = [];
  for (const [name, diskContent] of diskFileMap.entries()) {
    if (!zipFiles.has(name)) {
      drifted.push({ file: name, issue: 'File present in compiled output but missing from archive' });
      continue;
    }
    const zipContent = zipFiles.get(name);
    if (!diskContent.equals(zipContent)) {
      drifted.push({
        file: name,
        issue: 'Content mismatch (compiled output differs from archive content)',
        diskBytes: diskContent.length,
        archiveBytes: zipContent.length
      });
    }
  }

  for (const [name] of zipFiles.entries()) {
    if (!diskFileMap.has(name)) {
      drifted.push({ file: name, issue: 'File present in archive but missing from compiled output' });
    }
  }

  if (drifted.length > 0) {
    return {
      valid: false,
      reason: `Source-to-archive drift detected (${drifted.length} file(s) differ)`,
      drifted
    };
  }

  return {
    valid: true,
    fileCount: zipFiles.size,
    files: Array.from(zipFiles.keys()).sort()
  };
}

/**
 * Validates that mirror archive is byte-for-byte identical to primary archive
 * and shares exact SHA-256 hash.
 */
export function verifyMirrorIntegrity(archivePath, mirrorPath) {
  if (!fs.existsSync(archivePath)) {
    return { valid: false, reason: `Primary archive missing: ${archivePath}` };
  }
  if (!fs.existsSync(mirrorPath)) {
    return { valid: false, reason: `Mirror archive missing: ${mirrorPath}` };
  }

  const stat1 = fs.statSync(archivePath);
  const stat2 = fs.statSync(mirrorPath);

  if (stat1.size !== stat2.size) {
    return { valid: false, reason: `Size mismatch: primary is ${stat1.size} B, mirror is ${stat2.size} B` };
  }

  const buf1 = fs.readFileSync(archivePath);
  const buf2 = fs.readFileSync(mirrorPath);

  if (!buf1.equals(buf2)) {
    return { valid: false, reason: 'Byte-for-byte mismatch between primary and mirror archive' };
  }

  const hash1 = crypto.createHash('sha256').update(buf1).digest('hex').toUpperCase();
  const hash2 = crypto.createHash('sha256').update(buf2).digest('hex').toUpperCase();

  if (hash1 !== hash2) {
    return { valid: false, reason: `SHA-256 mismatch: primary ${hash1} vs mirror ${hash2}` };
  }

  return { valid: true, size: stat1.size, sha256: hash1 };
}
