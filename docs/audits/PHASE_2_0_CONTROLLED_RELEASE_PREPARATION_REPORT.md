# LeadNoria — Phase 2.0: Controlled Release Preparation Report

**Date:** 2026-10-14  
**Audit Phase:** Phase 2.0 (Controlled Release Preparation)  
**Baseline Git Commit:** `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f` (Phase 1 Complete on `origin/main`)  
**Operating Environment:** Windows 11 / Node.js v22.14.0 / PowerShell  
**Isolation Status:** Local Offline Environment | Zero External Network Access  
**Release Publication Status:** **STRICTLY LOCAL ONLY — NOT DEPLOYED / NOT RELEASED**  

---

## 1. Executive Verdict

### **VERDICT: PASS**

The LeadNoria codebase, packaging pipeline, and isolated release candidate artifact have undergone comprehensive verification against all Phase 2.0 criteria. All non-negotiable product constraints and fail-closed safety invariants are intact. Historical release archives remain immutable bit-for-bit. Packaging isolation prevents overwrite of historical releases, excludes development/sensitive assets, and strictly scopes permissions to Meta Ad Library research.

| Assessment Area | Status | Evidence / Notes |
| :--- | :--- | :--- |
| **Git Baseline & Integrity** | **PASS** | HEAD matches baseline `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f`. Zero unauthorized branches or commits. |
| **Historical Archive Immutability** | **PASS** | Hashes for `v1.7.5.zip`, `v1.7.6.zip`, and `extension.zip` verified identical before and after all operations. |
| **Release Candidate Isolation** | **PASS** | Built to isolated path: `dist/release-candidate/leadnoria-v1.7.6-candidate.zip`. Zero overwrites. |
| **Candidate Artifact Contents** | **PASS** | Exactly 12 runtime assets; zero prohibited files (`.env`, `.git`, `.ts`, `.map`, `node_modules`). |
| **Manifest & Permissions Audit** | **PASS** | Manifest V3; permissions: `storage`, `tabs`, `scripting`, `sidePanel`; host permissions strictly Meta Ad Library. |
| **Safety Gates (Fail-Closed)** | **PASS** | `isLiveCollectionPermitted() === false`, `isExternalWebsiteCrawlingPermitted() === false`. |
| **Qualification Invariants** | **PASS** | Geographic targeting vs. business location, CTA vs. destination, strict-local rules all strictly enforced. |
| **TypeScript Strictness** | **PASS** | `tsc --noEmit` clean: 0 compiler errors across entire codebase. |
| **Automated Offline Regression** | **PASS** | 17/17 suites passed (484 assertions), plus Phase 2.0 Candidate suite (29 assertions) passed. |
| **Reproducibility** | **PASS** | Bit-for-bit identical unpacked assets; identical ZIP member contents and CRC32s across independent builds. |
| **Working Tree & User Preservation** | **PASS** | All user data files and protected test logs preserved untouched. |

---

## 2. Initial Branch, HEAD, Remote State & Working-Tree Summary

At the beginning of Phase 2.0, the repository was inspected directly via Git:

- **Current Branch:** `main`
- **Current HEAD Commit:** `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f`
- **Commit Subject:** `feat(phase1): complete phase 1 offline ci typescript remediation and integration hardening`
- **Remote Configuration:**
  - `origin`: `https://github.com/nafiz-pranto/LeadNoria` (fetch & push)
  - `main` tracks `origin/main` [up to date]
- **Working-Tree Status:**
  - Protected user data files (`.data/research_jobs.json`, `.data/research_results.json`, `test-logs/phase29-production-observation-log.json`, `tests/test-phase27-production-pilot.mjs`, `tests/test-phase28-release-operations.mjs`, `tests/test-phase30-production-analytics.mjs`, `tests/test-phase31-research-optimization.mjs`, `tests/test-phase32-reliability-growth-readiness.mjs`) were present in the working tree from earlier exploratory phases and were preserved without modification.
  - No unexpected modifications to core source code (`src/` or `scripts/`) were present.
  - `git diff --check` confirmed zero whitespace or patch errors.

---

## 3. Proposed Release Version & Supporting Evidence

### Current Version Metadata
- `package.json`: `"version": "1.7.6"`
- `src/extension/manifest.json`: `"version": "1.7.6"`
- Unpacked build manifest (`extension/manifest.json`): `"version": "1.7.6"`
- Historical release archives present:
  - `dist/leadnoria-v1.7.5.zip` (version 1.7.5 release)
  - `dist/leadnoria-v1.7.6.zip` (version 1.7.6 historical baseline release)

### Versioning Analysis & Recommendation
In accordance with Semantic Versioning (SemVer) and Chrome Web Store versioning guidelines:
1. `dist/leadnoria-v1.7.6.zip` already exists as an immutable historical archive (hash: `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105`).
2. Therefore, releasing a new archive under version `1.7.6` would collide with the existing historical release artifact.
3. For the **next formal release**, the proposed version is:
   - **`1.7.7`** (Recommended patch increment) if released as a maintenance hardening of the v1.7 line, OR
   - **`1.8.0`** (Alternative minor increment) representing the complete Phase 0 and Phase 1 hardening milestone.
4. **Current Phase Action:** Per Phase 2.0 instructions ("Do not change version numbers merely to make the repository appear ready... keep them limited to release preparation"), `package.json` and `manifest.json` were maintained at `1.7.6` for candidate building, and the release candidate was explicitly named with `-candidate` suffix:
   - `dist/release-candidate/leadnoria-v1.7.6-candidate.zip`
   This isolates the candidate from historical archives while providing an exact baseline for the upcoming authorized version bump (e.g. to `1.7.7`).

---

## 4. Changes Made (Complete File List)

During Phase 2.0, modifications were strictly confined to release candidate generation, verification testing, and documentation:

1. **`dist/release-candidate/leadnoria-v1.7.6-candidate.zip`** (New File)
   - The isolated local release candidate archive created via `scripts/build-extension.mjs --package --package-output ...`.
2. **`tests/test-phase20-release-candidate.mjs`** (New File)
   - Comprehensive Phase 2.0 release candidate regression test suite verifying archive existence, contents, drift, manifest, safety gates, qualification invariants, and archive immutability.
3. **`docs/audits/PHASE_2_0_CONTROLLED_RELEASE_PREPARATION_REPORT.md`** (New File)
   - This comprehensive Phase 2.0 release preparation audit report.

*No source code in `src/`, build scripts in `scripts/`, or existing test suites in `tests/` were modified. No Git commits, tags, or pushes were performed.*

---

## 5. Packaging Method & Exact Candidate Artifact Path

### Packaging Method
The extension was built using the established safe packaging process:
```powershell
node scripts/build-extension.mjs --package --package-output dist/release-candidate/leadnoria-v1.7.6-candidate.zip
```

### Safety Controls Enforced by Packaging Pipeline
- `scripts/packaging-safety.mjs` enforces validation before any packaging occurs.
- Rejects paths targeting historical release archives (`dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, `extension.zip`) even if overwrite is specified.
- Verifies destination directory is valid and isolated (`dist/release-candidate/`).
- Bundles only compiled runtime assets from `./extension/`.
- Decompresses and validates contents post-build to ensure zero file drift.

### Exact Candidate Artifact Path
- **Relative Path:** `dist/release-candidate/leadnoria-v1.7.6-candidate.zip`
- **Absolute Path:** `E:\project anti\leadnoria\dist\release-candidate\leadnoria-v1.7.6-candidate.zip`

---

## 6. Candidate SHA-256 Hash & Artifact Contents Summary

### Artifact Integrity
- **File Size:** `376,521 bytes` (367.7 KB)
- **SHA-256 Hash:** `5BB320F988B379370B9911F974CB865740694C231742648F1E3DEA6C19907417`

### Artifact Contents (Exact 12 Runtime Assets)
Decompression and inspection of `dist/release-candidate/leadnoria-v1.7.6-candidate.zip` confirmed the archive contains exactly the following 12 files:

| File Name | Uncompressed Size (bytes) | CRC32 | Purpose |
| :--- | :--- | :--- | :--- |
| `manifest.json` | 992 | `4b05fdcf` | Extension manifest (V3) |
| `app.js` | 277,333 | `1b279ae7` | Side panel & UI application logic |
| `content-script.js` | 134,815 | `5e8dbda4` | Scraper & DOM inspector script |
| `service-worker.js` | 74,657 | `83d9bcba` | Background service worker |
| `styles.css` | 130,064 | `3ecf346b` | Compiled CSS (Tailwind bundle) |
| `sidepanel.html` | 835 | `86b6a655` | Chrome side panel UI container |
| `popup.html` | 840 | `1a4e16d5` | Extension popup container |
| `icons/icon-16.png` | 236 | `3d56ef19` | Extension icon (16x16) |
| `icons/icon-32.png` | 338 | `69094da5` | Extension icon (32x32) |
| `icons/icon-48.png` | 448 | `ad3260c6` | Extension icon (48x48) |
| `icons/icon-128.png` | 913 | `2d4f20bf` | Extension icon (128x128) |
| `rules/ad-library-net-rules.json`| 1,226 | `d3beaf6d` | Declarative Net Request rules |

### Prohibited Content Audit: **100% CLEAN**
The release candidate was inspected for prohibited development, credential, and scratch files:
- `.env` / credentials / secret keys: **0 found (CLEAN)**
- `.git` / `.github` / Git metadata: **0 found (CLEAN)**
- TypeScript source files (`.ts`, `.tsx`): **0 found (CLEAN)**
- Source maps (`.map`): **0 found (CLEAN)**
- Dependency folders (`node_modules`): **0 found (CLEAN)**
- Research job / user data files (`.data/`, `research_*.json`): **0 found (CLEAN)**
- Test files / logs (`tests/`, `test-logs/`, `*.log`): **0 found (CLEAN)**
- Scratch files / temporary scripts: **0 found (CLEAN)**
- Unrelated zip archives: **0 found (CLEAN)**

---

## 7. Manifest, Permissions, Runtime & Product-Scope Audit

Detailed static and dynamic inspection of `manifest.json` and compiled bundle assets inside the candidate:

### 1. Manifest V3 Architecture
- `manifest_version: 3`
- `name: "LeadNoria"`
- `version: "1.7.6"`
- `action.default_popup: "popup.html"`
- `side_panel.default_path: "sidepanel.html"`
- `background.service_worker: "service-worker.js"` (type: `module`)
- `content_scripts`: Matches strictly `*://*.facebook.com/ads/library/*`

### 2. Runtime Permissions
- Declared permissions: `["storage", "tabs", "scripting", "sidePanel"]`
- No dangerous permissions declared:
  - No `webRequestBlocking`
  - No `cookies`
  - No `management`
  - No `proxy`
  - No `debugger`

### 3. Host Permissions Scope
- Declared host permissions:
  - `https://www.facebook.com/ads/library/*`
  - `https://web.facebook.com/ads/library/*`
- **Zero broad/wildcard host permissions:** No `<all_urls>`, `*://*/*`, or `https://*/*`.
- **Zero external host permissions:** No access to Google Maps, Google Search, third-party APIs, or private enrichment domains.

### 4. Code Execution & Security Audit
- `content_security_policy`: Standard Manifest V3 default (`script-src 'self'; object-src 'self'`).
- No dynamic code execution (`eval()`: false, `new Function()`: false).
- No remote code loading (no external scripts via HTTP/HTTPS).
- No external web crawling or probing mechanisms.

---

## 8. Safety-Gate Verification Results

All LeadNoria safety gates remain permanently fail-closed:

```typescript
// src/config/collectionGate.ts
export function isLiveCollectionPermitted(): boolean {
  return false;
}

export function isExternalWebsiteCrawlingPermitted(): boolean {
  return false;
}
```

### Verification Findings
1. `isLiveCollectionPermitted()` evaluates strictly to `false`.
2. `isExternalWebsiteCrawlingPermitted()` evaluates strictly to `false`.
3. `assertLiveCollectionPermitted()` throws an unconditional error:
   `"Live automated collection is disabled: required platform and product permissions are not established."`
4. `assertExternalWebsiteCrawlingPermitted()` throws an unconditional error:
   `"External website crawling is prohibited: LeadNoria is strictly confined to Meta Ad Library."`
5. No feature flags, environment variables, or packaging scripts override or bypass these safety gates.
6. The compiled runtime bundles (`app.js`, `content-script.js`, `service-worker.js`) contain the active safety checks.

---

## 9. Geographic Qualification & CTA/Destination Invariant Results

Regression tests verified that release preparation has not degraded LeadNoria's qualification invariants:

1. **Targeting vs. Business Location Distinctness:**
   - Ad audience targeting country (`targetCountryCode`) is strictly distinguished from advertiser operational location (`businessCountryCode`).
   - Ad targeting does NOT infer business location.
2. **CTA vs. Destination Distinctness:**
   - User call-to-action (`CTA_CLASSIFICATION`, e.g. `SHOP_NOW`, `LEARN_MORE`) is separated from the resolved destination (`DESTINATION_CLASSIFICATION`, e.g. `MESSENGER`, `WHATSAPP`, `EXTERNAL_WEBSITE`).
3. **Missing URL Handling:**
   - A missing destination URL is classified as `UNKNOWN` / `DESTINATION_NOT_OBSERVED`; it does NOT infer that the business lacks a website.
4. **Strict-Local Qualification Gate:**
   - Admits `LOCAL_VERIFIED`.
   - Strictly rejects `FOREIGN_VERIFIED`.
   - Excludes `LOCAL_PROBABLE` and `LOCATION_UNKNOWN` from qualification in strict-local mode.
5. **Score Boundary Enforcement:**
   - Numerical relevance scores (0–100) are strictly bounded.
   - High scores (e.g. 99) never override negative qualification decisions or bypass geographic/relevance disqualifiers.
6. **Unassessed Evidence Protection:**
   - Missing or unassessed evidence fails closed and never silently qualifies an entity.

---

## 10. Exact Verification Commands & Actual Results

### Command 1: TypeScript Compiler Strictness Check
- **Command:** `npm.cmd run typecheck`
- **Underlying Call:** `tsc --noEmit`
- **Exit Code:** `0`
- **Output:** Clean, 0 diagnostics, 0 errors.

### Command 2: Git Diff Check
- **Command:** `git diff --check`
- **Exit Code:** `0`
- **Output:** Clean, zero whitespace errors or broken diff lines.

### Command 3: Master Offline Regression Runner
- **Command:** `node scripts/verify-offline.mjs`
- **Exit Code:** `0`
- **Suites Executed:** 17
- **Suites Passed:** 17
- **Suites Failed:** 0
- **Total Assertions:** 484
- **Execution Time:** 219.42 seconds
- **Breakdown of Executed Suites:**
  1. Phase 0.1 Safety Lock: `PASSED` (2.92s)
  2. Relevance Calibration Engine: `PASSED` (0.96s)
  3. Entity Resolution & Deduplication: `PASSED` (0.90s)
  4. Evidence Waterfall & Adversarial Copy: `PASSED` (0.80s)
  5. Geographic Accuracy & Hierarchy: `PASSED` (1.11s)
  6. Global Country Profiles: `PASSED` (0.86s)
  7. Strict Local Mode Contract: `PASSED` (1.09s)
  8. CTA, Destination & Export Integrity: `PASSED` (0.97s)
  9. Storage Persistence & Recovery Integrity: `PASSED` (0.94s)
  10. Qualification Gate & Scoring: `PASSED` (1.08s)
  11. UI Workflow Qualification: `PASSED` (0.95s)
  12. Unified Lead Intelligence UI: `PASSED` (1.10s)
  13. Packaging Safety & Archive Isolation: `PASSED` (1.65s)
  14. Dependency Hygiene & Runtime Boundary: `PASSED` (0.85s)
  15. CI Safety Invariants & Boundary Enforcement: `PASSED` (1.14s)
  16. Phase 1.0D TypeScript & CI Integrity: `PASSED` (100.53s)
  17. Phase 1.0E Final Integration & Readiness: `PASSED` (1.03s)

### Command 4: Phase 2.0 Release Candidate Test Suite
- **Command:** `node node_modules/tsx/dist/cli.mjs tests/test-phase20-release-candidate.mjs`
- **Exit Code:** `0`
- **Suites Executed:** 1
- **Assertions Passed:** 29
- **Assertions Failed:** 0
- **Tests Evaluated:**
  - Tests 1–4: Candidate archive existence, isolation, size, and hash validity.
  - Tests 5–8: 12-file asset count, bit-for-bit uncompressed drift check, prohibited files audit.
  - Tests 9–13: Manifest V3 version, name, version alignment, host permission scoping.
  - Tests 14–17: Safety gates permanent fail-closed status.
  - Tests 18–25: Geographic, CTA, destination, and strict-local qualification invariants.
  - Tests 26–29: Historical archive SHA-256 hash immutability and packaging path protection.

---

## 11. Reproducibility Results

To evaluate packaging reproducibility, two independent clean builds were executed to separate isolated output files:
- Run 1 Output: `dist/local/candidate-run-1.zip`
- Run 2 Output: `dist/local/candidate-run-2.zip`

### Findings
1. **Uncompressed Directory Assets:**
   - Every compiled file in `./extension/` (`manifest.json`, `app.js`, `content-script.js`, `service-worker.js`, `styles.css`, `popup.html`, `sidepanel.html`, icons, and rules) produced bit-for-bit identical content across runs.
2. **Packaged ZIP Contents:**
   - Both archives contained the exact same 12 files.
   - Exact byte sizes match: `376,521 bytes` for both runs.
   - CRC32 checksums for every member entry in both ZIP archives matched 100%.
3. **Outer Container Hash Note:**
   - The outer ZIP archive SHA-256 differed across runs solely due to dynamic local MS-DOS modification timestamps written into file record headers by `archiver` during packaging.
   - When extracted, all payload files are 100% bit-for-bit identical.

---

## 12. Historical Archive Hashes (Before and After)

The 3 historical release archives were hashed before and after all packaging and verification operations:

| Archive Path | Expected Baseline SHA-256 | Pre-Run Hash | Post-Run Hash | Status |
| :--- | :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **IMMUTABLE (MATCH)** |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **IMMUTABLE (MATCH)** |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **IMMUTABLE (MATCH)** |

Zero historical archives were modified, touched, repaired, overwritten, or deleted.

---

## 13. Protected-File & Unrelated-Working-Tree Preservation Results

All protected and user-owned working tree files were tracked and verified:

1. **Protected Research Data & Logs:**
   - `.data/research_jobs.json` — Preserved
   - `.data/research_results.json` — Preserved
   - `test-logs/phase29-production-observation-log.json` — Preserved
2. **Protected Test & Audit Files:**
   - `tests/test-phase18-final-audit.mjs` — Preserved
   - `tests/test-phase27-production-pilot.mjs` — Preserved
   - `tests/test-phase28-release-operations.mjs` — Preserved
   - `tests/test-phase30-production-analytics.mjs` — Preserved
   - `tests/test-phase31-research-optimization.mjs` — Preserved
   - `tests/test-phase32-reliability-growth-readiness.mjs` — Preserved
3. **Reports & Validation Evidence:**
   - All directories in `reports/` and `validation-evidence/` were left intact.

No destructive Git commands (`git reset --hard`, `git clean -f`, `git add .`, etc.) were executed.

---

## 14. Known Limitations, Unresolved Findings & Recommended Next Action

### Known Limitations
1. **Container ZIP Timestamp Nondeterminism:**
   Standard ZIP compression includes local creation timestamps in archive headers. While payload contents and CRC32s are deterministic, the outer SHA-256 varies if rebuilt at different times. If deterministic outer archive hashing is desired in a future release cycle, a normalized archive timestamp utility (e.g. zeroing header timestamps) could be adopted.
2. **Version Bump Prerequisite for Release:**
   Because `dist/leadnoria-v1.7.6.zip` is already an immutable release archive, publishing the new codebase requires an explicit version increment (e.g. to `1.7.7` or `1.8.0`) in a separately authorized release execution phase.
3. **Production Collection Authorization Remains Not Established:**
   `isLiveCollectionPermitted()` and `isExternalWebsiteCrawlingPermitted()` are intentionally hardcoded to `false`. Automated collection from Meta Ad Library cannot occur without explicit terms compliance and authorized permission.

### Recommended Next Action
- Present this Phase 2.0 Controlled Release Preparation Report for review.
- Await separate user authorization before any version increment, tagging, GitHub Release publication, or distribution.

---

## 15. Statement on Release Readiness

### **TECHNICAL READINESS STATEMENT**
The release candidate archive located at:
`dist/release-candidate/leadnoria-v1.7.6-candidate.zip`  
(SHA-256: `5BB320F988B379370B9911F974CB865740694C231742648F1E3DEA6C19907417`)

**IS TECHNICALLY READY** for a separately authorized release decision.

The package has passed all automated typecheck, offline regression, packaging safety, manifest security, runtime scope, and qualification invariant audits. No code or release artifact has been published, tagged, committed, pushed, or deployed.
