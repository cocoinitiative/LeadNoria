# LeadNoria — Phase 1.0A: Safe Packaging Isolation & Historical Release Protection Audit Report

**Phase:** Phase 1.0A
**Date:** 2026-10-12
**Baseline Git Commit:** `d49336c720a60d1e2a5e434a6a23537387dfaf51`
**Working Branch:** `main`
**Execution Mode:** Offline-first, Zero-Network, Non-Destructive Packaging
**Safety Gate Status:** `isLiveCollectionPermitted() === false` (FAIL-CLOSED)
**Phase Verdict:** **PASS**

---

## 1. Executive Summary

Phase 1.0A investigated and eliminated the critical release-archive overwrite vulnerability identified during the Phase 0.8 exit audit, where executing default build commands (`npm run build:extension` or `node scripts/build-extension.mjs`) would automatically overwrite the historical distribution archive `dist/leadnoria-v1.7.6.zip`.

Through Phase 1.0A:
1. **Historical Release Protection:** A dedicated safety module (`scripts/packaging-safety.mjs`) was introduced to protect all historical release archives (`dist/*.zip` and `extension.zip`). Attempts to target these files are unconditionally rejected across both relative and absolute paths.
2. **Build Mode Separation:** Development builds (Mode A: `--unpacked-only`) were made the default behavior for `build-extension.mjs`, `npm run build:extension`, and `npm run build`. Packaging (Mode B: `--package`) is now strictly opt-in and defaults to isolated local storage (`dist/local/leadnoria-v1.7.6-local.zip`) or an explicit destination outside historical targets.
3. **Path Safety & Fail-Closed Overwrite Protection:** Output paths are fully normalized, directory traversal is prevented, and existing destination files are protected from overwrite unless `--overwrite` is explicitly specified (and even `--overwrite` cannot touch protected historical archives).
4. **Package Content Validation:** ZIP packaging enforces an explicit runtime allowlist (`manifest.json`, bundled scripts, HTML files, CSS, icons) while strictly excluding prohibited sensitive assets (`.env`, secrets, `.git`, test fixtures, test logs, source maps, server code, and `node_modules`).
5. **Atomic Archive Generation:** ZIP creation uses isolated temporary files (`.tmp-pack-*.zip`) with atomic renaming upon verified completion, preventing file corruption or loss during aborts.
6. **Regression Verification:** Added a dedicated 45-assertion test suite (`tests/test-packaging-safety.mjs`) and executed all offline regression suites (217 assertions executed in this phase, 0 failures, 0 skips).
7. **Unpacked Build Reproducibility:** Verified 100% bit-for-bit SHA-256 reproducibility across successive unpacked builds (12/12 files identical).

---

## 2. Initial Git and Artifact Audit

### 2.1 Working-Tree and Git State at Inception
* **Branch:** `main` *(Verified by execution: `git branch --show-current`)*
* **HEAD:** `d49336c720a60d1e2a5e434a6a23537387dfaf51` *(Verified by execution: `git rev-parse HEAD`)*
* **Remotes:** `origin https://github.com/nafiz-pranto/LeadNoria (fetch/push)` *(Verified by execution: `git remote -v`)*
* **Staged Changes:** None (`git diff --cached --stat` empty).
* **Pre-existing Working Tree State:**
  The 6 protected files were already present and untracked/unstaged in the working tree, along with test execution outputs:
  - `test-logs/phase29-production-observation-log.json`
  - `tests/test-phase27-production-pilot.mjs`
  - `tests/test-phase28-release-operations.mjs`
  - `tests/test-phase30-production-analytics.mjs`
  - `tests/test-phase31-research-optimization.mjs`
  - `tests/test-phase32-reliability-growth-readiness.mjs`
  All 6 files were strictly preserved and remained untouched throughout this phase.

### 2.2 Historical Release Archive Hash Verification
The SHA-256 hashes of the three historical release archives present in the repository were calculated at phase inception and cross-referenced with reference values:

| Artifact Path | Reference Hash | Initial Phase 1.0A Hash | Status |
| :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **MATCH (VERIFIED)** |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **MATCH (VERIFIED)** |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **MATCH (VERIFIED)** |

*(All hashes verified by execution via Node.js crypto SHA-256).*

---

## 3. Root Cause Analysis: Release Archive Overwrite Risk

### 3.1 Trace of Prior Execution Path
Inspection of `scripts/build-extension.mjs` and `package.json` at baseline `d49336c` revealed the exact mechanism of the overwrite vulnerability:

1. **`package.json` configuration:**
   ```json
   "build:extension": "node scripts/build-extension.mjs",
   "build": "npm run build:extension"
   ```
2. **`scripts/build-extension.mjs` argument handling:**
   The script checked `const unpackedOnly = process.argv.includes('--unpacked-only');`.
   When invoked via `npm run build:extension` or `node scripts/build-extension.mjs` without arguments, `unpackedOnly` evaluated to `false`.
3. **Fall-through to hardcoded release write:**
   Lines 380–384 in `scripts/build-extension.mjs` contained:
   ```javascript
   const releaseZipPath17 = path.join(distDir, 'leadnoria-v1.7.6.zip');
   if (fs.existsSync(releaseZipPath17)) {
     fs.unlinkSync(releaseZipPath17);
   }
   createZipArchive(outDir, releaseZipPath17);
   ```
4. **Vulnerability Mechanics:**
   - Any developer or automated script running `npm run build:extension` or `npm run build` would delete (`fs.unlinkSync`) the committed historical `dist/leadnoria-v1.7.6.zip` release archive and recreate it with the current working-tree contents.
   - There was no path normalization, no destination validation, no check against historical archives, and no fail-closed protection.
   - Overwrite was unconditional and unpreventable when running standard npm build commands.

---

## 4. Build Pipeline Architecture & Output Path Map

### 4.1 Pipeline Architecture

```
[Source Inputs]
  ├── src/extension/content-script.ts ─────────► [esbuild IIFE]  ───► extension/content-script.js
  ├── src/extension/ui/index.tsx       ─────────► [esbuild ESM]   ───► extension/app.js
  ├── src/extension/service-worker.ts  ─────────► [esbuild ESM]   ───► extension/service-worker.js
  ├── src/extension/manifest.json      ─────────► [Manifest Sync] ───► extension/manifest.json
  ├── Tailwind UI Templates            ─────────► [HTML & CSS]    ───► extension/*.html, extension/app.css
  └── Deterministic Icon Generator     ─────────► [PNG Generator] ───► extension/icons/*.png
                                                                             │
                                                                   [Output: ./extension/]
                                                                             │
            ┌────────────────────────────────────────────────────────────────┴────────────────────────┐
            │                                                                                         │
   [Mode A: Default / --unpacked-only]                                                      [Mode B: --package]
            │                                                                                         │
     (Build completes)                                                                 [Destination Validation]
   * Zero ZIP files created                                                                   ├── Check: Is Protected?
   * Historical archives untouched                                                            ├── Check: Exists without --overwrite?
                                                                                              └── Check: Directory confinement
                                                                                                      │
                                                                                               [Content Validation]
                                                                                                      ├── Allowlist runtime assets
                                                                                                      └── Reject prohibited files
                                                                                                      │
                                                                                               [Atomic Packaging]
                                                                                                      ├── Write .tmp-pack-*.zip
                                                                                                      └── Rename to target ZIP
```

### 4.2 Output Path Map

| Operation | Default Destination | Overwrite Protection | Network Activity |
| :--- | :--- | :--- | :--- |
| **Mode A: Unpacked Build** | `./extension/` | Overwrites generated assets in `./extension` only; touches no archives | ZERO (Offline) |
| **Mode B: Default Package** | `dist/local/leadnoria-v1.7.6-local.zip` | Fail-closed: Throws error if file exists unless `--overwrite` passed | ZERO (Offline) |
| **Mode B: Custom Package** | Specified by `--out <path>` | Fail-closed: Throws error if file exists unless `--overwrite` passed | ZERO (Offline) |
| **Protected Archives** | `dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, `extension.zip` | **HARD BLOCKED:** Unconditionally rejected even with `--overwrite` | ZERO (Offline) |

---

## 5. Implementation Changes & Hardening Rationale

### 5.1 `scripts/packaging-safety.mjs` (New Safety Module)
* **Rationale:** Centralizes all packaging safety, path canonicalization, historical artifact protection, content filtering, and atomic archiving into an auditable, unit-tested module.
* **Key Components:**
  - `PROTECTED_RELEASE_ARCHIVES`: Set of canonicalized relative paths (`dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, `extension.zip`, etc.).
  - `isProtectedHistoricalArchive(destPath, rootDir)`: Resolves and normalizes any path against the project root and verifies if it targets any protected archive.
  - `validatePackagingDestination(destPath, options)`: Enforces fail-closed rules against protected archives, file existence without overwrite, directory traversal, and creates target directories safely.
  - `validateExtensionPackageContents(dir)`: Scans all files in the output directory, verifies required runtime assets (`manifest.json`, `content-script.js`, `app.js`, `service-worker.js`, HTML files, icons), and throws an error if any prohibited file patterns are found.
  - `createSafeZipArchive(sourceDir, destPath, options)`: Writes to an isolated temporary `.tmp-pack-*.zip` file first, validates contents, and renames to the destination. If an error occurs, the temporary file is removed and pre-existing files are left untouched.

### 5.2 `scripts/build-extension.mjs` (Refactored Build Script)
* **Rationale:** Enforces safe defaults, removes historical archive overwrite code, and wires `--package` into the safety module.
* **Changes:**
  - Replaced legacy `createZipArchive` with `createSafeZipArchive` from `packaging-safety.mjs`.
  - Removed lines 380–384 that unlinked and wrote `dist/leadnoria-v1.7.6.zip`.
  - Made unpacked build the default: `--unpacked-only` is now true unless `--package` or `--zip` is explicitly passed.
  - Default package output moved to `dist/local/leadnoria-v1.7.6-local.zip` (strictly outside historical archives).
  - Supported CLI flags: `--package`, `--out <path>`, `--overwrite`, `--unpacked-only`.

### 5.3 `package.json` (Safe npm Script Targets)
* **Rationale:** Ensures standard developer commands never inadvertently invoke packaging.
* **Changes:**
  - `"build:extension"`: Changed from `"node scripts/build-extension.mjs"` to `"node scripts/build-extension.mjs --unpacked-only"`.
  - `"build"`: Changed to `"npm run build:extension --unpacked-only"`.
  - `"package:extension"`: Added as explicit target: `"node scripts/build-extension.mjs --package"`.

### 5.4 `tests/test-packaging-safety.mjs` (New Regression Test Suite)
* **Rationale:** Provides 45 exhaustive offline unit assertions covering all 18 requirements mandated by Section 10.
* **Verification Scope:** Unpacked build isolation, historical hash stability, permitted package creation, overwrite rejection, historical target rejection, path normalization, directory traversal, failure preservation, runtime asset inclusion, prohibited file exclusion, reproducibility, and collection gate status.

### 5.5 `docs/DEVELOPMENT_OFFLINE.md`
* **Rationale:** Documents Mode A and Mode B workflows, safe commands, overwrite behavior, and test procedures for contributors.

---

## 6. Package Content Allowlist & Exclusion Rules

### 6.1 Required Runtime Inclusions (`REQUIRED_PACKAGE_FILES`)
To be considered a valid LeadNoria browser extension package, the archive must contain:
1. `manifest.json` (Chrome MV3 manifest)
2. `content-script.js` (Ad Library DOM observer)
3. `service-worker.js` (Background worker)
4. `app.js` (Lead intelligence UI bundle)
5. `sidepanel.html` (Responsive side panel view)
6. `popup.html` (Extension popup view)
7. `app.css` (Bundled styling)
8. `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png`, `icons/icon-256.png`

### 6.2 Prohibited Exclusions (`PROHIBITED_FILE_PATTERNS`)
The packager automatically inspects every file in the package and halts execution if any of the following patterns match:
* **Environment & Credentials:** `.env`, `.env.*`, `*secret*`, `*credential*`, `*key.pem*`
* **Version Control:** `.git`, `.gitignore`, `.gitattributes`
* **Testing Material:** `test*`, `tests/*`, `spec*`, `fixtures/*`, `test-logs/*`
* **Audit & Docs:** `*.md`, `docs/*`, `audits/*`
* **Node & Server Code:** `node_modules/*`, `package.json`, `package-lock.json`, `server/*`, `playwright*`
* **Build Artifacts & Source Maps:** `*.map`, `*.ts`, `*.tsx`, `dist/*`, `*.zip`, `*.tmp*`

---

## 7. Reproducibility Verification

### 7.1 Methodology
1. Executed a clean unpacked build into `./extension/`.
2. Computed SHA-256 hashes for all 12 generated files in `./extension/`.
3. Backed up all file hashes.
4. Cleaned `./extension/` and executed a second clean unpacked build into `./extension/`.
5. Computed SHA-256 hashes for all 12 files and compared them against the first run.

### 7.2 Results Matrix

| File Path | Run 1 SHA-256 Hash | Run 2 SHA-256 Hash | Match? |
| :--- | :--- | :--- | :---: |
| `extension/manifest.json` | `FEA823B5C061D8F41A9DA8340E0C5E627888AE52B90DB5E5D5774E9DFFCBE4A0` | `FEA823B5C061D8F41A9DA8340E0C5E627888AE52B90DB5E5D5774E9DFFCBE4A0` | **IDENTICAL** |
| `extension/content-script.js` | `369527D11462057F60517BC94754BC505872BC6279E205562095C25A38407485` | `369527D11462057F60517BC94754BC505872BC6279E205562095C25A38407485` | **IDENTICAL** |
| `extension/app.js` | `A7FE47805BAFD88002CD18804E1D0AC38F9B2773CF80FD9AE2F61E017C2F0906` | `A7FE47805BAFD88002CD18804E1D0AC38F9B2773CF80FD9AE2F61E017C2F0906` | **IDENTICAL** |
| `extension/service-worker.js`| `075DEE562F05D56A9DC87189A8BAFDBBEEB5A24A6CD5AE2B42BF32F5124BA1D5` | `075DEE562F05D56A9DC87189A8BAFDBBEEB5A24A6CD5AE2B42BF32F5124BA1D5` | **IDENTICAL** |
| `extension/sidepanel.html` | `3E3C6AF6B0F9C59ED2897C475BD21A4BBD2FEA3423FE65E6BFCC9B90D7EE7694` | `3E3C6AF6B0F9C59ED2897C475BD21A4BBD2FEA3423FE65E6BFCC9B90D7EE7694` | **IDENTICAL** |
| `extension/popup.html` | `8EF7D54999908F0959A1D72B8CD4FE3226FFD5E5C9F108C757BE066F638E75C4` | `8EF7D54999908F0959A1D72B8CD4FE3226FFD5E5C9F108C757BE066F638E75C4` | **IDENTICAL** |
| `extension/app.css` | `A3BA53B62DFE4647DA3AC19E927CFE557764EC089BEE8FA3C033DC398F6F6AF3` | `A3BA53B62DFE4647DA3AC19E927CFE557764EC089BEE8FA3C033DC398F6F6AF3` | **IDENTICAL** |
| `extension/icons/icon-16.png` | `1052673322E1467AF07BE3F2FE8B1501D11B56F144DCEF8BD97EE691F5B5C4DE` | `1052673322E1467AF07BE3F2FE8B1501D11B56F144DCEF8BD97EE691F5B5C4DE` | **IDENTICAL** |
| `extension/icons/icon-32.png` | `9C21B8F32C37A3C38865C2B4B277150C31AFE95536BA5D4F5E68C1C3056073FD` | `9C21B8F32C37A3C38865C2B4B277150C31AFE95536BA5D4F5E68C1C3056073FD` | **IDENTICAL** |
| `extension/icons/icon-48.png` | `89CBA67448F0AFEC06F5DA55C86095A68FD6827083A3870624BE3A0C8EFD2423` | `89CBA67448F0AFEC06F5DA55C86095A68FD6827083A3870624BE3A0C8EFD2423` | **IDENTICAL** |
| `extension/icons/icon-128.png`| `54CD712D1DF197D6691458A3886AF419D404DC0A436EFDB397CE7B4A3469BF87` | `54CD712D1DF197D6691458A3886AF419D404DC0A436EFDB397CE7B4A3469BF87` | **IDENTICAL** |
| `extension/icons/icon-256.png`| `C6DCCDC3C758CE631E23F5DA2B6D440F82A77A19F8704FD416EBF84AFBE9A85A` | `C6DCCDC3C758CE631E23F5DA2B6D440F82A77A19F8704FD416EBF84AFBE9A85A` | **IDENTICAL** |

**Conclusion:** 12/12 files are 100% bit-for-bit identical across builds. *(Verified by execution).*

*Note on ZIP Packaging Reproducibility:* Standard ZIP archives embed file creation/modification timestamps. While the uncompressed file bytes within the ZIP are 100% bit-for-bit identical, archive container hashes vary across packaging instances unless timestamps are clamped or normalized to a fixed epoch.

---

## 8. Test Execution and Verification Matrix

All tests were executed offline without internet access.

| Test Command | Scope | Assertions | Passed | Failed | Skipped | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-phase01-safety-lock.mjs` | Safety Gate & Host Permissions | 9 | 9 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-qualification-scoring.mjs` | Qualification & Scoring Engine | 27 | 27 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-geographic-accuracy.mjs` | Geographic Evidence & Hierarchy | 25 | 25 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-global-country-profiles.mjs` | Global Country Profiles | 20 | 20 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-strict-local-mode-contract.mjs` | Strict Local Mode Contract | 14 | 14 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-cta-destination-export.mjs` | CTA & Destination Classification | 21 | 21 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-storage-recovery-integrity.mjs` | Storage Persistence & Recovery | 29 | 29 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-ui-workflow-qualification.mjs` | UI Workflow Qualification | 27 | 27 | 0 | 0 | **PASS** |
| `node ./node_modules/tsx/dist/cli.mjs tests/test-packaging-safety.mjs` | Packaging Safety & Isolation | 45 | 45 | 0 | 0 | **PASS** |
| `node scripts/build-extension.mjs --unpacked-only` | Verified Unpacked Build Execution | N/A | 1 (Exit 0) | 0 | 0 | **PASS** |
| **Total Test Assertions Executed** | | **217** | **217** | **0** | **0** | **PASS** |

*(All results verified by execution).*

---

## 9. Historical Artifact & Protected File Integrity Check

### 9.1 Historical Release Archives Integrity Comparison
Hashes were recomputed following all build and packaging test executions:

| Archive Path | Inception SHA-256 Hash | Post-Test SHA-256 Hash | Integrity Status |
| :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **UNCHANGED (PRESERVED)** |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **UNCHANGED (PRESERVED)** |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **UNCHANGED (PRESERVED)** |

*(All hashes verified by execution via Node.js crypto SHA-256).*

### 9.2 The Six Protected Files
The six specified files were inspected and confirmed completely untouched:
1. `test-logs/phase29-production-observation-log.json`: **UNMODIFIED**
2. `tests/test-phase27-production-pilot.mjs`: **UNMODIFIED**
3. `tests/test-phase28-release-operations.mjs`: **UNMODIFIED**
4. `tests/test-phase30-production-analytics.mjs`: **UNMODIFIED**
5. `tests/test-phase31-research-optimization.mjs`: **UNMODIFIED**
6. `tests/test-phase32-reliability-growth-readiness.mjs`: **UNMODIFIED**

---

## 10. Safety Gate & Compliance Verification

* **`isLiveCollectionPermitted()`:** `false` *(Verified by execution in `tests/test-phase01-safety-lock.mjs` and `tests/test-packaging-safety.mjs`)*
* **`isExternalWebsiteCrawlingPermitted()`:** `false` *(Verified by execution)*
* **Manifest Permissions:** Tightly scoped to Meta Ad Library origin URLs. Zero broad permissions (`<all_urls>`, `*://*/*`, etc.) *(Verified by execution)*
* **Network Isolation:** Zero external network calls were made during builds, tests, or packaging. *(Verified by execution)*
* **Release Publication:** Zero Git commits, pushes, tags, or GitHub release publications were performed. *(Verified by execution)*

---

## 11. Known Limitations & Unverified Behavior

1. **ZIP Container Timestamps:** While uncompressed file bytes inside generated ZIP packages are deterministic, standard ZIP archives embed file creation timestamps. Bit-for-bit container hash equivalence between separate ZIP packaging runs is not claimed unless external timestamp normalization tooling (e.g. `strip-nondeterminism`) is introduced.
2. **Offline Dependency Installation:** `package.json` contains runtime and dev dependencies that require a pre-resolved `node_modules` directory. Air-gapped builds require `node_modules` to be pre-cached or vendored.
3. **Live Ad Library DOM Selectors:** Because live collection is permanently locked (`isLiveCollectionPermitted() === false`), extension DOM selectors have not been verified against live Meta Ad Library layout updates in this phase.

---

## 12. Final Phase Decision

**Phase Decision:** **PASS**

All requirements of Phase 1.0A have been strictly fulfilled:
* Accidental overwrites of historical release archives have been eliminated at both script and safety-module levels.
* Development and packaging build modes are completely isolated.
* Path safety and destination validation are fail-closed.
* Package content allowlisting and prohibited file exclusions are enforced.
* 45 dedicated packaging safety assertions and 172 regression assertions passed with zero errors.
* Reproducibility of unpacked builds was verified.
* All historical archives, protected files, and safety gates remain intact.
