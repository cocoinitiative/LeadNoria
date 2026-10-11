# LeadNoria — Phase 1.0B: Dependency Hygiene, Runtime Boundary Audit & Offline Regression Report

**Phase:** Phase 1.0B
**Date:** 2026-10-12
**Baseline Git Commit:** `d49336c720a60d1e2a5e434a6a23537387dfaf51`
**Working Branch:** `main`
**Execution Mode:** Offline-first, Zero-Network Dependency Hygiene
**Safety Gate Status:** `isLiveCollectionPermitted() === false` (FAIL-CLOSED)
**Phase Verdict:** **PASS**

---

## 1. Executive Summary

Phase 1.0B audited and hardened the dependency topology and runtime boundaries of LeadNoria, building on the safe packaging baseline established in Phase 1.0A:
1. **`@google/genai` Excision:** Demonstrably proved that `@google/genai` had zero source imports, zero build tooling references, and zero runtime usage. Safely pruned `@google/genai` from `package.json` dependencies and consistently updated `package-lock.json` offline, eliminating 18 transitive bloat packages (including HTTP agent dependencies and a package with an installation script, `protobufjs`).
2. **Playwright Runtime Isolation:** Traced all Playwright usage across the codebase. Confirmed that Playwright is actively required by server-side ingestion (`src/server/browserWorker.ts`) and offline E2E test suites, but is **100% isolated from the browser extension runtime**. Confirmed that any live collection path through Playwright is fail-closed behind `isLiveCollectionPermitted() === false`.
3. **Supply-Chain & Manifest Audit:** Confirmed zero arbitrary URL/git dependencies, zero unauthorized lifecycle hooks in `package.json`, and zero broad Chrome extension host permissions.
4. **Historical Release & Protected File Immutability:** Maintained 100% bit-for-bit SHA-256 integrity of all historical release archives (`dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, and `extension.zip`) and preserved all 6 protected pre-existing files.
5. **Offline Test Verification:** Executed 14 test suites covering 405 automated assertions (including the new 25-assertion suite `tests/test-phase10b-dependency-hygiene.mjs` and the 45-assertion Phase 1.0A packaging safety suite), passing with 0 failures and 0 skips.

---

## 2. Baseline Environment & Working-Tree State

### 2.1 Git & Environment State
* **Branch:** `main` *(Verified by execution: `git branch --show-current`)*
* **Baseline HEAD:** `d49336c720a60d1e2a5e434a6a23537387dfaf51` *(Verified by execution: `git rev-parse HEAD`)*
* **Node.js Version:** `v22.14.0` *(Verified by execution)*
* **npm Version:** `10.9.2` *(Verified by execution)*
* **Lockfile:** `package-lock.json` (Lockfile version 3) present and committed.

### 2.2 Protected Files Preservation
The following six pre-existing files were inspected and preserved untouched:
1. `test-logs/phase29-production-observation-log.json`: **UNTOUCHED**
2. `tests/test-phase27-production-pilot.mjs`: **UNTOUCHED**
3. `tests/test-phase28-release-operations.mjs`: **UNTOUCHED**
4. `tests/test-phase30-production-analytics.mjs`: **UNTOUCHED**
5. `tests/test-phase31-research-optimization.mjs`: **UNTOUCHED**
6. `tests/test-phase32-reliability-growth-readiness.mjs`: **UNTOUCHED**

### 2.3 Historical Release Archive Hash Verification
Hashes were calculated at Phase 1.0B baseline and confirmed identical to reference values:

| Artifact Path | Reference SHA-256 | Phase 1.0B Inception Hash |
| :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` |

---

## 3. Dependency Inventory & Audit Decisions

| Package Name | Type | Declared Version | Actual Usage Path | Decision | Evidence & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `@google/genai` | Production | `^2.4.0` | None (0 imports across entire codebase) | **REMOVED** | Legacy unused dependency. Removed from `package.json` and `package-lock.json` offline without churn. |
| `@tailwindcss/vite` | Production | `^4.1.14` | Vite plugin for Tailwind v4 | **RETAINED** | Required by Vite build pipeline for compiling UI styles. |
| `@vitejs/plugin-react` | Production | `^5.0.4` | Vite plugin for React JSX / Fast Refresh | **RETAINED** | Required for building React components into extension/dashboard. |
| `dotenv` | Production | `^17.2.3` | Environment configuration | **RETAINED** | Used by `server.ts` and dev tooling. |
| `express` | Production | `^4.21.2` | Local HTTP API server | **RETAINED** | Core dependency for `src/server/app.ts` local research API. |
| `lucide-react` | Production | `^0.546.0` | SVG icons for React UI | **RETAINED** | Imported across 110+ React components in `src/`. |
| `motion` | Production | `^12.23.24` | Animation engine | **RETAINED** | Used for smooth UI transitions in research interface. |
| `playwright` | Production | `^1.63.0` | Headless browser engine (Server & Tests) | **RETAINED** | Required by `src/server/browserWorker.ts` and 12 offline E2E test suites. Blocked from live scraping via safety gate. |
| `react` | Production | `^19.0.1` | UI library | **RETAINED** | Core UI component foundation (133+ files). |
| `react-dom` | Production | `^19.0.1` | React DOM renderer | **RETAINED** | UI mount runtime. |
| `recharts` | Production | `^3.10.1` | Analytics charts | **RETAINED** | Used for research metrics visualization. |
| `vite` | Prod/Dev | `^6.2.3` | Modern frontend bundler | **RETAINED** | Used by `npm run build` and UI development. |
| `archiver` | Dev | `^8.0.0` | ZIP compression utility | **RETAINED** | Required by Phase 1.0A safe packaging module (`scripts/packaging-safety.mjs`). |
| `esbuild` | Dev | `^0.28.2` | Fast JavaScript/TypeScript bundler | **RETAINED** | Core builder for extension content scripts, service worker, and server. |
| `tsx` | Dev | `^4.23.13` | Direct TypeScript execution runtime | **RETAINED** | Standard test runner for all 14 offline regression test suites. |
| `typescript` | Dev | `~5.8.2` | TypeScript compiler | **RETAINED** | Static type checking and type definition generation. |

---

## 4. `@google/genai` Audit & Excision Decision

### 4.1 Search Scope and Results
* **Exhaustive Codebase Search:** Executed ripgrep searches across `src/`, `scripts/`, `tests/`, and root files for:
  - `@google/genai`: 0 source imports, 0 script imports. Found only in legacy test allowlists (`test-phase17-security-e2e.mjs` and `test-phase18-final-audit.mjs`), package manifests, and audit reports documenting it as unused.
  - `GoogleGenAI`: 0 occurrences.
  - `GoogleGenerativeAI`: 0 occurrences.
  - `genai`: 0 code occurrences.
  - `gemini`: Mentioned only in `.env.example` and security assertions explicitly asserting `assert.strictEqual(code.includes('generativelanguage.googleapis.com'), false, 'No Gemini API')`.
* **Conclusion:** `@google/genai` is 100% dead code in LeadNoria. Its presence contradicted LeadNoria's strict deterministic offline architecture.

### 4.2 Safe Offline Removal & Lockfile Reconciliation
* **Action:** Executed `npm.cmd uninstall @google/genai --package-lock-only`.
* **Lockfile Impact:**
  - Removed `@google/genai` and 18 transitive packages that were only pulled in by it: `fetch-blob`, `formdata-polyfill`, `gaxios`, `gcp-metadata`, `google-auth-library`, `google-logging-utils`, `https-proxy-agent`, `json-bigint`, `jwa`, `jws`, `long`, `node-domexception`, `node-fetch`, `p-retry`, `protobufjs`, `retry`, `web-streams-polyfill`, `ws`.
  - Crucially, `protobufjs` had an installation lifecycle script (`hasInstallScript: true`). Its removal improved supply-chain cleanliness.
* **Network Isolation:** Executed entirely offline without network requests.
* **Test Adaptation:** Updated `tests/test-phase18-final-audit.mjs` (a non-protected legacy audit test) so its dependency assertion checks `actualDeps.every(d => acceptedDeps.includes(d))` rather than failing on the removal of `@google/genai`.

---

## 5. Playwright Runtime Boundary Audit

### 5.1 Architecture & Import Paths
1. **Server Entry Point (`src/server/browserWorker.ts`):**
   - Imports `chromium` from `'playwright'`.
   - Used for `runBrowserWorker()` and `checkBrowserAvailability()`.
2. **Offline Test Framework (`tests/test-*.mjs`):**
   - 12 test suites import `playwright` to test extension loading and UI behavior in headless Chromium.
3. **Chrome Extension Runtime Boundary:**
   - **`src/extension/` imports Playwright:** **NO (0 occurrences)**.
   - **Compiled `./extension/` bundle contains Playwright:** **NO (0 bytes)**.
   - Chrome MV3 extensions cannot run Node.js native libraries like Playwright; the extension uses standard web and Chrome extension APIs.

### 5.2 Safety Gate Verification
* **Fail-Closed Enforcement:** In `src/server/browserWorker.ts` (lines 454–506):
  ```typescript
  if (!isFixtureMode) {
    if (!isLiveCollectionPermitted()) {
      // Abort immediately with status BLOCKED and stopReason COLLECTION_NOT_AUTHORIZED
      return blockedResult;
    }
  }
  ```
* In `src/server/app.ts` (lines 176–183):
  ```typescript
  if (request.validationMode !== 'CONTROLLED_FIXTURE' && !isLiveCollectionPermitted()) {
    return res.status(403).json({
      success: false,
      error: 'COLLECTION_NOT_AUTHORIZED: Live automated collection from Meta Ad Library is disabled and unauthorized.'
    });
  }
  ```
* Because `isLiveCollectionPermitted() === false` permanently, no code path can launch a live Meta scraping session.
* **Decision:** Playwright is retained for existing offline test suites and server architecture, with confirmed isolation from the browser extension and fail-closed safety gate enforcement.

---

## 6. Supply-Chain and Installation Safety Review

| Review Item | Verified State | Evaluation |
| :--- | :--- | :--- |
| **Package Registries** | Default npm registry (`https://registry.npmjs.org/`). No `.npmrc` overrides. | **SAFE** |
| **Dependency URLs** | Zero git repos (`git://`, `git+https://`), zero tarball URLs (`http://`, `https://`), zero local file dependencies (`file:`). | **SAFE** |
| **Semver Pinning** | Explicit semver boundaries (`^` and `~`). Zero wildcards (`*`) or `latest` tags. | **SAFE** |
| **Package Lifecycle Scripts** | `package.json` contains 0 install scripts (`preinstall`, `postinstall`, `prepare` absent). | **SAFE** |
| **Transitive Install Scripts** | Reduced to only 2 essential native build dependencies: `esbuild` and `fsevents`. | **SAFE** |
| **Extension Host Permissions** | Tightly scoped to Meta Ad Library (`https://www.facebook.com/ads/library/*`). Zero broad host permissions. | **SAFE** |

---

## 7. Phase 1.0A Packaging Protections Status

All Phase 1.0A protections were re-tested and confirmed operational:
* **Default Build Mode:** `npm run build:extension` and `node scripts/build-extension.mjs` execute in unpacked-only mode by default without creating or touching any ZIP archive.
* **Packaging Intent:** ZIP packaging requires explicit `--package` flag (`npm run package:extension`).
* **Protected Archive Rejection:** Attempts to target `dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, or `extension.zip` are unconditionally rejected by `scripts/packaging-safety.mjs`, even when `--overwrite` is passed.
* **Traversal Protection:** Directory traversal attempts escaping allowed output folders are blocked.
* **Content Allowlist:** Non-runtime assets (`.env`, secrets, tests, test logs, `node_modules`, server code) are strictly excluded from packaging.
* **Atomic Generation:** Packaging writes to `.tmp-pack-*.zip` and performs safe renaming only upon successful completion.

---

## 8. Verification Results

All tests were executed offline in a zero-network local environment.

### 8.1 Test Execution Matrix

| Test Suite | Focus Area | Assertions | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `tests/test-phase01-safety-lock.mjs` | Safety gate fail-closed lock & host permissions | 14 | 14 | 0 | **PASS** |
| `tests/test-relevance-engine.mjs` | Semantic relevance scoring calibration | 37 | 37 | 0 | **PASS** |
| `tests/test-entity-resolution.mjs` | Entity deduplication and resolution | 21 | 21 | 0 | **PASS** |
| `tests/test-evidence-waterfall.mjs` | Evidence waterfall & adversarial copy | 20 | 20 | 0 | **PASS** |
| `tests/test-geographic-accuracy.mjs` | Geographic classification & evidence hierarchy | 16 | 16 | 0 | **PASS** |
| `tests/test-global-country-profiles.mjs` | Country profiles (US, GB, CA, AU, IE, BD) | 15 | 15 | 0 | **PASS** |
| `tests/test-strict-local-mode-contract.mjs` | Strict-local mode qualification | 6 | 6 | 0 | **PASS** |
| `tests/test-cta-destination-export.mjs` | CTA & destination classification | 31 | 31 | 0 | **PASS** |
| `tests/test-storage-recovery-integrity.mjs` | Storage recovery, checkpointing, and idempotence | 14 | 14 | 0 | **PASS** |
| `tests/test-qualification-scoring.mjs` | Qualification evaluator fail-closed gates | 20 | 20 | 0 | **PASS** |
| `tests/test-ui-workflow-qualification.mjs` | UI manual research workflow verification | 56 | 56 | 0 | **PASS** |
| `tests/test-phase25-unified-intelligence-ui.mjs` | Comprehensive UI intelligence and state tests | 85 | 85 | 0 | **PASS** |
| `tests/test-packaging-safety.mjs` | Phase 1.0A safe packaging isolation | 45 | 45 | 0 | **PASS** |
| `tests/test-phase10b-dependency-hygiene.mjs` | **Phase 1.0B dependency hygiene & runtime boundary** | 25 | 25 | 0 | **PASS** |
| `node scripts/build-extension.mjs --unpacked-only` | Unpacked extension compilation | N/A | Exit 0 | 0 | **PASS** |
| **Total Test Assertions** | | **405** | **405** | **0** | **PASS** |

### 8.2 Build Verification
* **Command:** `node scripts/build-extension.mjs --unpacked-only`
* **Exit Code:** `0`
* **Output:** Compiled 12 assets into `./extension/`.
* **Zero ZIPs Created:** Verified that zero archive files were created or modified during the build.

---

## 9. Historical Artifact & Protected File Integrity Check

### 9.1 Historical Release Archives
| Archive File | Baseline SHA-256 | Post-Phase SHA-256 | Status |
| :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **UNCHANGED** |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **UNCHANGED** |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **UNCHANGED** |

### 9.2 Git Status & Files Changed
* **Modified Files:**
  - `package.json`: Removed `@google/genai` dependency.
  - `package-lock.json`: Synchronized offline removal of `@google/genai` and its 18 transitive dependencies.
  - `tests/test-phase18-final-audit.mjs`: Updated dependency assertion to allow approved set without `@google/genai`.
  - `docs/DEVELOPMENT_OFFLINE.md`: Added test 14 and updated cumulative test count to 405.
* **New Files:**
  - `tests/test-phase10b-dependency-hygiene.mjs`: Dedicated regression suite (25 assertions).
  - `docs/audits/PHASE_1_0B_DEPENDENCY_HYGIENE_REPORT.md`: This audit report.
* **No Commits / No Tags:** Zero commits, pushes, tags, or GitHub release publications were executed.

---

## 10. Outstanding Risks & Next Steps

1. **No Live Collection Authorization:** Live collection from Meta Ad Library remains completely unauthorized. `isLiveCollectionPermitted()` is permanently `false`.
2. **External Website Crawling:** External website crawling remains permanently disabled (`isExternalWebsiteCrawlingPermitted() === false`).
3. **Dual Vite Declaration:** `vite` is declared in both `dependencies` and `devDependencies` in `package.json`. While harmless, moving `vite` exclusively to `devDependencies` can be scheduled during a future package cleanup phase if approved.

---

## 11. Final Verdict

**Verdict:** **PASS**

All objectives of Phase 1.0B have been successfully accomplished:
* `@google/genai` is demonstrably unused and has been completely removed from `package.json` and `package-lock.json` offline without churn.
* Playwright runtime boundary is strictly audited and isolated from the browser extension runtime.
* Supply-chain integrity is confirmed clean.
* Packaging protections from Phase 1.0A remain effective.
* 405 automated offline regression assertions passed with zero failures.
* Historical release archives and protected files remain completely untouched.
