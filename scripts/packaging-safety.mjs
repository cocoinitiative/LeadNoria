import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { verifyZipMatchesDirectory } from './release-integrity.mjs';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

/**
 * Historical release archives that are sealed and strictly immutable.
 * These files must NEVER be targeted, modified, replaced, or overwritten.
 */
export const PROTECTED_RELEASE_ARCHIVES = Object.freeze([
  'dist/leadnoria-v1.0.0.zip',
  'dist/leadnoria-v1.1.0.zip',
  'dist/leadnoria-v1.2.0.zip',
  'dist/leadnoria-v1.2.1.zip',
  'dist/leadnoria-v1.3.0.zip',
  'dist/leadnoria-v1.4.0.zip',
  'dist/leadnoria-v1.5.0.zip',
  'dist/leadnoria-v1.6.0.zip',
  'dist/leadnoria-v1.7.0.zip',
  'dist/leadnoria-v1.7.1.zip',
  'dist/leadnoria-v1.7.2.zip',
  'dist/leadnoria-v1.7.3.zip',
  'dist/leadnoria-v1.7.4.zip',
  'dist/leadnoria-v1.7.5.zip',
  'dist/leadnoria-v1.7.6.zip',
  'extension.zip'
]);

/**
 * Exact set of required runtime files that MUST be present in any built
 * browser extension directory or distributable package.
 */
export const REQUIRED_PACKAGE_FILES = Object.freeze([
  'manifest.json',
  'app.js',
  'service-worker.js',
  'content-script.js',
  'styles.css',
  'popup.html',
  'sidepanel.html',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'icons/icon-256.png'
]);

/**
 * Disallowed file patterns that must NEVER enter a distributable extension package.
 */
export const PROHIBITED_FILE_PATTERNS = Object.freeze([
  /^\.env/i,
  /\.env$/i,
  /\.key$/i,
  /\.pem$/i,
  /credentials/i,
  /secret/i,
  /\.test\.[mc]?[jt]s$/i,
  /^tests\//i,
  /^test-/i,
  /\.log$/i,
  /test-logs\//i,
  /\.git/i,
  /node_modules/i,
  /docs\//i,
  /reports\//i,
  /validation-evidence\//i,
  /\.zip$/i,
  /\.ts$/i,
  /\.tsx$/i,
  /\.map$/i
]);

/**
 * Determines whether a given path targets a protected historical release archive.
 */
export function isProtectedHistoricalArchive(targetPath, rootDir = process.cwd()) {
  if (!targetPath || typeof targetPath !== 'string') return false;

  const resolvedTarget = path.resolve(rootDir, targetPath);
  const normalizedTarget = resolvedTarget.replace(/\\/g, '/').toLowerCase();

  for (const protectedRel of PROTECTED_RELEASE_ARCHIVES) {
    const resolvedProtected = path.resolve(rootDir, protectedRel);
    const normalizedProtected = resolvedProtected.replace(/\\/g, '/').toLowerCase();

    if (normalizedTarget === normalizedProtected) {
      return true;
    }
  }

  // Also protect against matching basenames in dist/ or root
  const baseName = path.basename(resolvedTarget).toLowerCase();
  for (const protectedRel of PROTECTED_RELEASE_ARCHIVES) {
    if (baseName === path.basename(protectedRel).toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a packaging destination path against historical protection rules,
 * directory confinement, and overwrite policies.
 */
export function validatePackagingDestination(targetPath, options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const allowOverwrite = Boolean(options.allowOverwrite);
  const confinedDir = options.confinedDir ? path.resolve(rootDir, options.confinedDir) : null;

  if (!targetPath || typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('INVALID_DESTINATION: Destination path must be a non-empty string.');
  }

  const resolvedPath = path.resolve(rootDir, targetPath);

  // 1. Strict Historical Archive Protection (Cannot be overridden even with allowOverwrite)
  if (isProtectedHistoricalArchive(resolvedPath, rootDir)) {
    throw new Error(
      `PROTECTED_HISTORICAL_ARTIFACT: Destination targets a protected historical release archive: "${targetPath}". Historical archives are strictly immutable.`
    );
  }

  // 2. Directory Confinement & Path Traversal Guard
  if (confinedDir) {
    const relativeToConfined = path.relative(confinedDir, resolvedPath);
    if (relativeToConfined.startsWith('..') || path.isAbsolute(relativeToConfined)) {
      throw new Error(
        `PATH_TRAVERSAL_DETECTED: Destination "${targetPath}" escapes allowed confinement directory "${options.confinedDir}".`
      );
    }
  }

  // 3. Extension Validation
  if (!resolvedPath.toLowerCase().endsWith('.zip')) {
    throw new Error(`INVALID_PACKAGE_FORMAT: Destination "${targetPath}" must have a .zip extension.`);
  }

  // 4. Overwrite Protection
  if (fs.existsSync(resolvedPath) && !allowOverwrite) {
    throw new Error(
      `DESTINATION_ALREADY_EXISTS: Output file already exists at "${resolvedPath}". Explicit overwrite permission is required.`
    );
  }

  return {
    resolvedPath,
    isProtected: false
  };
}

/**
 * Validates the contents of a built extension directory against runtime requirements
 * and security exclusion rules.
 */
export function validateExtensionPackageContents(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`EXTENSION_DIR_MISSING: Source directory does not exist: "${dirPath}".`);
  }

  // Recursive directory scanner
  function scanFiles(curDir, prefix = '') {
    const items = fs.readdirSync(curDir, { withFileTypes: true });
    let results = [];
    for (const it of items) {
      const rel = prefix ? `${prefix}/${it.name}` : it.name;
      const full = path.join(curDir, it.name);
      if (it.isDirectory()) {
        results = results.concat(scanFiles(full, rel));
      } else if (it.isFile()) {
        results.push({ rel, full, size: fs.statSync(full).size });
      }
    }
    return results;
  }

  const files = scanFiles(dirPath);
  const fileRelSet = new Set(files.map(f => f.rel.replace(/\\/g, '/')));
  const errors = [];

  // 1. Check all required runtime assets
  for (const req of REQUIRED_PACKAGE_FILES) {
    if (!fileRelSet.has(req)) {
      errors.push(`Missing required extension runtime asset: "${req}"`);
    } else {
      const f = files.find(item => item.rel.replace(/\\/g, '/') === req);
      if (f && f.size === 0) {
        errors.push(`Required extension asset is empty (0 bytes): "${req}"`);
      }
    }
  }

  // 2. Check for prohibited files
  for (const f of files) {
    const norm = f.rel.replace(/\\/g, '/');
    for (const pattern of PROHIBITED_FILE_PATTERNS) {
      if (pattern.test(norm)) {
        errors.push(`Package contains prohibited asset matching ${pattern}: "${norm}"`);
        break;
      }
    }
  }

  // 3. Manifest Integrity Check
  const manifestPath = path.join(dirPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (manifest.manifest_version !== 3) {
        errors.push(`Invalid manifest_version: expected 3, got ${manifest.manifest_version}`);
      }
      if (manifest.optional_host_permissions && manifest.optional_host_permissions.includes('https://*/*')) {
        errors.push('Manifest contains broad optional_host_permissions: ["https://*/*"]');
      }
      if (manifest.host_permissions && manifest.host_permissions.includes('<all_urls>')) {
        errors.push('Manifest contains broad host_permissions: ["<all_urls>"]');
      }
    } catch (err) {
      errors.push(`Failed to parse manifest.json: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`PACKAGE_CONTENT_VALIDATION_FAILED:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  return {
    valid: true,
    fileCount: files.length,
    files: Array.from(fileRelSet).sort()
  };
}

/**
 * Creates an isolated, verified ZIP archive using atomic temporary writes
 * and strict destination validation.
 */
export async function createSafeZipArchive(sourceDir, zipPath, options = {}) {
  const rootDir = options.rootDir || process.cwd();

  // 1. Validate destination
  const { resolvedPath } = validatePackagingDestination(zipPath, {
    rootDir,
    allowOverwrite: options.allowOverwrite,
    confinedDir: options.confinedDir
  });

  // 2. Validate package contents
  validateExtensionPackageContents(sourceDir);

  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // 3. Use atomic temporary file to prevent check-then-overwrite race conditions
  const tempZipPath = path.join(
    parentDir,
    `.tmp-pack-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`
  );

  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(tempZipPath);
      const archive = new archiver.ZipArchive({ zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });

    // 4. Verify created archive matches source directory exactly
    const driftCheck = verifyZipMatchesDirectory(tempZipPath, sourceDir);
    if (!driftCheck.valid) {
      throw new Error(`ARCHIVE_DRIFT_DETECTED: Generated ZIP does not match source directory: ${driftCheck.reason}`);
    }

    // 5. Atomic rename to destination
    if (fs.existsSync(resolvedPath) && options.allowOverwrite) {
      fs.unlinkSync(resolvedPath);
    }
    fs.renameSync(tempZipPath, resolvedPath);

    // 6. Compute SHA-256 and size
    const stat = fs.statSync(resolvedPath);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(resolvedPath)).digest('hex').toUpperCase();

    return {
      success: true,
      zipPath: resolvedPath,
      size: stat.size,
      sha256: hash,
      fileCount: driftCheck.fileCount
    };
  } catch (err) {
    // Clean up temporary file on failure, preserving any pre-existing files
    if (fs.existsSync(tempZipPath)) {
      try {
        fs.unlinkSync(tempZipPath);
      } catch (_) {}
    }
    throw err;
  }
}
