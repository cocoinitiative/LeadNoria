# LeadNoria — Safe Offline Development & Testing Workflow Guide

**Version:** 1.7.6-phase1.0E<br>
**Scope:** Final Integration Audit, End-to-End Consistency & Release Readiness<br>
**Enforcement Boundary:** Strict Zero-Network Local Operation<br>

---

## 1. Non-Negotiable Development Boundaries

LeadNoria is exclusively an offline-first research and lead qualification tool for Meta Ad Library ad data. During development, testing, and continuous integration, the following restrictions are non-negotiable and strictly enforced:

* **Zero External Network Calls:** No APIs, paid services, enrichment endpoints, web scraping, or crawler connections may be initiated during local execution.
* **Fail-Closed Safety Gate:** `isLiveCollectionPermitted()` and `isExternalWebsiteCrawlingPermitted()` in `src/config/collectionGate.ts` must remain permanently set to `false`.
* **Zero Platform Automation / Evasion:** No CAPTCHA solving, IP rotation, proxy spoofing, or session hijacking may be implemented.
* **Manifest Host Permissions:** Manifest permissions must remain tightly scoped (`https://www.facebook.com/ads/library/*` and `https://web.facebook.com/ads/library/*`). Broad wildcards (`<all_urls>`, `https://*/*`) are prohibited.
* **Artifact Immutability:** Historical distribution ZIPs (`dist/*.zip`, `extension.zip`) must never be modified or overwritten during routine development.

---

## 2. Environment Setup & Dependency Management

### 2.1 Node.js & Tooling Requirements
* **Node.js:** v20.x or v22.x LTS (tested on Node v22.14.0).
* **Direct Execution Runtime:** `node ./node_modules/tsx/dist/cli.mjs` is used to execute TypeScript ESM scripts directly across both Unix and Windows environments where shell execution policies may restrict wrapper commands.
* **TypeScript Compiler:** `node ./node_modules/typescript/bin/tsc --noEmit` or `npm run typecheck`.

### 2.2 Two Separated Dependency & Verification Modes

To eliminate ambiguity between standard hosted continuous integration and true air-gapped execution, LeadNoria defines two explicitly separated dependency modes:

#### Mode A — Standard Hosted CI (Lockfile-Based)
* **Execution Environment:** GitHub Actions hosted runner (`ubuntu-latest`) defined in `.github/workflows/offline-ci.yml`.
* **Network Disclosure:** Ephemeral cloud runner environments require outbound network access during container initialization to fetch the repository checkout (`actions/checkout`), provision the Node.js runtime (`actions/setup-node`), and download pinned dependencies from the public npm registry via `npm ci --prefer-offline --no-audit`.
* **Zero Network Boundary:** Immediately after dependency installation completes, all subsequent operations—including unpacked extension compilation (`build-extension.mjs`), full TypeScript typechecking (`tsc --noEmit`), and all 16 regression test suites—execute completely offline with zero external network requests.
* **Security & Permissions:** Runs under strictly minimal permissions (`permissions: contents: read`), with zero publication, release, push, or deployment credentials.

#### Mode B — Strict Offline Verification (Air-Gapped / Isolated)
* **Execution Environment:** Local workstation, air-gapped development machine, or network-isolated CI container.
* **Zero Registry Access:** Outbound network access to the npm registry or remote services is completely disabled or unavailable.
* **Pre-requisite:** Relies strictly on pre-installed, lockfile-consistent dependencies inside `node_modules` or a populated local npm cache.
* **Strict Offline Command:**
  ```bash
  # Verify without network access (fails explicitly if dependencies are missing rather than silently falling back to registry)
  npm ci --offline
  # Run master offline verification
  npm run verify:offline
  ```
* **Failure Handling:** If required dependencies are missing from `node_modules` or the offline cache, `npm ci --offline` fails immediately with `ENOTCACHED` rather than silently opening remote network connections.
* **Verification Command:** `node scripts/verify-offline.mjs` or `npm test` runs fully in zero-network mode using synthetic in-memory fixtures.

---

## 3. Safe Offline Build & Packaging Workflow

### 3.1 Mode A — Unpacked Extension Build (Default & Recommended)
To build the unpacked Chrome extension for local loading without modifying historical archives or creating distribution ZIPs, run:

```bash
# Direct node execution (Cross-Platform / Windows PowerShell / Bash)
node scripts/build-extension.mjs --unpacked-only
# Or via npm script (preconfigured with safe default)
npm run build:extension
```

#### What This Command Does:
1. Compiles and bundles `src/extension/content-script.ts` into `./extension/content-script.js` (IIFE format via `esbuild`).
2. Compiles and bundles `src/extension/ui/index.tsx` into `./extension/app.js` (ESM format via `esbuild`).
3. Compiles `src/extension/service-worker.ts` into `./extension/service-worker.js`.
4. Writes `./extension/manifest.json`, responsive `sidepanel.html`, fixed-width `popup.html`, and bundled Tailwind styles.
5. Generates deterministic PNG icons (16, 32, 48, 128, 256 px).
6. **Exits immediately (`--unpacked-only` / default mode), completely bypassing ZIP archive generation and protecting historical release archives.**

#### Determinism & Reproducibility:
The unpacked build generates bit-for-bit identical hashes across clean runs when executed on identical source trees.

### 3.2 Mode B — Isolated Local Extension Packaging
To create an isolated local ZIP archive of the unpacked extension for local validation or offline distribution testing:

```bash
# Package to default safe isolated location: dist/local/leadnoria-v1.7.6-local.zip
node scripts/build-extension.mjs --package
# Or via npm script
npm run package:extension

# Package to a custom isolated output destination
node scripts/build-extension.mjs --package --out dist/isolated-test.zip

# Overwrite existing destination (strictly rejected on protected historical archives)
node scripts/build-extension.mjs --package --out dist/isolated-test.zip --overwrite
```

#### Packaging Safety & Isolation Rules:
* **Historical Release Archive Immutability:** Attempts to target historical release archives (`dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, `extension.zip`) are **unconditionally rejected**, even if `--overwrite` or relative path navigation (`../dist/leadnoria-v1.7.6.zip`) is attempted.
* **Fail-Closed on Existing Files:** By default, if the destination file already exists, the packager aborts safely without modifying or corrupting the existing file.
* **Atomic File Generation:** The ZIP archive is written to an isolated temporary file (`.tmp-pack-*.zip`) and renamed only after successful creation and content verification.
* **Package Content Validation:** The packager enforces strict runtime asset inclusion (manifest, scripts, styles, HTML, icons) and automatically rejects prohibited files (`.env`, `.git`, test fixtures, test logs, source maps, server files, `node_modules`).

### 3.3 Loading the Unpacked Extension in Developer Mode
1. Open Google Chrome or Chromium.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `./extension` directory in the project root.
5. Open the LeadNoria Side Panel or Popup to inspect the UI.

---

## 4. Running Offline Regression Test Suites

All tests in the safe development baseline operate exclusively on local in-memory synthetic fixtures, avoiding external network traffic.

### 4.1 Master Automated Offline Verification Command

To run the complete offline verification suite (unpacked extension build, 15 regression test suites, and pre/post historical archive immutability checks) in a single deterministic pass:

```bash
# Via npm script
npm run verify:offline
# Or alias
npm test

# Direct node execution (cross-platform)
node scripts/verify-offline.mjs
```

### 4.2 Individual Test Suite Execution Matrix

Individual suites may also be executed directly using `node ./node_modules/tsx/dist/cli.mjs <test-script>`:

```powershell
# 1. Collection Safety Lock (Fail-closed assertions & manifest checks)
node ./node_modules/tsx/dist/cli.mjs tests/test-phase01-safety-lock.mjs

# 2. Semantic Relevance Engine (Calibration dataset & category rules)
node ./node_modules/tsx/dist/cli.mjs tests/test-relevance-engine.mjs

# 3. Entity Resolution & Deduplication (Scenarios A through U)
node ./node_modules/tsx/dist/cli.mjs tests/test-entity-resolution.mjs

# 4. Evidence Waterfall & Adversarial Copy (Scenarios 1 through 20)
node ./node_modules/tsx/dist/cli.mjs tests/test-evidence-waterfall.mjs

# 5. Geographic Accuracy & Evidence Hierarchy (BD & Global)
node ./node_modules/tsx/dist/cli.mjs tests/test-geographic-accuracy.mjs

# 6. Global Country Profiles (US, GB, CA, AU, IE, BD profiles)
node ./node_modules/tsx/dist/cli.mjs tests/test-global-country-profiles.mjs

# 7. Strict Local Mode Contract (General discovery vs strict local)
node ./node_modules/tsx/dist/cli.mjs tests/test-strict-local-mode-contract.mjs

# 8. CTA & Destination Classification (Ad evidence & formula safety)
node ./node_modules/tsx/dist/cli.mjs tests/test-cta-destination-export.mjs

# 9. Storage Persistence & Recovery Integrity (Idempotence & normalization)
node ./node_modules/tsx/dist/cli.mjs tests/test-storage-recovery-integrity.mjs

# 10. Qualification Gate & Deterministic Scoring (Fail-closed gates)
node ./node_modules/tsx/dist/cli.mjs tests/test-qualification-scoring.mjs

# 11. Extension UI & Manual Workflow Verification (27 synthetic scenarios)
node ./node_modules/tsx/dist/cli.mjs tests/test-ui-workflow-qualification.mjs

# 12. Unified Lead Intelligence UI (85 comprehensive UI assertions)
node ./node_modules/tsx/dist/cli.mjs tests/test-phase25-unified-intelligence-ui.mjs

# 13. Safe Packaging Isolation & Historical Protection (45 safety assertions)
node ./node_modules/tsx/dist/cli.mjs tests/test-packaging-safety.mjs

# 14. Dependency Hygiene & Runtime Boundary Audit (25 hygiene assertions)
node ./node_modules/tsx/dist/cli.mjs tests/test-phase10b-dependency-hygiene.mjs

# 15. CI Safety Invariants & Boundary Enforcement (27 safety assertions)
node ./node_modules/tsx/dist/cli.mjs tests/test-phase10c-ci-safety-invariants.mjs

# 16. TypeScript & CI Integrity (25 safety & compiler assertions)
node ./node_modules/tsx/dist/cli.mjs tests/test-phase10d-typecheck-integrity.mjs

# 17. Final Integration & Release Readiness (27 end-to-end assertions)
node ./node_modules/tsx/dist/cli.mjs tests/test-phase10e-integration-readiness.mjs
```

### 4.3 Cumulative Test Verification Count
* **Current Passing Offline Tests:** 484 assertions across 17 test suites.
* **Failures:** 0
* **Skips:** 0

### 4.4 Automated GitHub Actions CI Workflow
The repository includes `.github/workflows/offline-ci.yml`, configured with:
* **Minimal Permissions:** `permissions: contents: read` (read-only repository contents).
* **Pinned Node.js:** Node.js 22 LTS with npm cache.
* **Lockfile Installation:** `npm ci --prefer-offline` (standard registry package download for runner dependencies only).
* **Zero Network Application Execution:** Runs `npm run verify:offline` in strict zero-network mode using synthetic local fixtures.
* **Zero Release / Deployment / Publication:** The workflow contains no automated publish, push, release, or deployment steps.

---

## 5. Distinguishing Verification Levels

To prevent misattributing offline unit pass marks to live production capabilities, LeadNoria uses four distinct verification tiers:

| Tier | Definition | Examples | Allowed in Offline Mode? |
| :--- | :--- | :--- | :---: |
| **Tier 1: Source & Manifest Inspection** | Verifying code syntax, imports, manifest keys, and hardcoded boundaries. | Checking `isLiveCollectionPermitted() === false` or `manifest.json`. | **YES** |
| **Tier 2: Unit & Component Testing** | Testing discrete algorithms against mocked inputs. | Testing `evaluateGeographicOrigin` or `classifyCta`. | **YES** |
| **Tier 3: Simulated Offline Workflow** | Simulating end-to-end pipelines using synthetic fixtures and in-memory event buses. | `tests/test-ui-workflow-qualification.mjs` verifying UI states. | **YES** |
| **Tier 4: Live Production Collection** | Direct HTTP/Playwright requests to live Meta Ad Library or external advertiser domains. | Running live scraper against `facebook.com/ads/library`. | **STRICTLY PROHIBITED** |

---

## 6. Excluded & Prohibited Live Tests

The following legacy scripts involve live network probing or live browser scraping and **MUST NOT BE RUN** during offline development:

| Script Path | Prohibited Operation | Current Status |
| :--- | :--- | :--- |
| `tests/test-live-research-run.mjs` | Initiates real Playwright browser session against Meta | **BLOCKED BY POLICY** |
| `tests/test-live-reality-sequence.mjs` | Queries real ad library endpoints | **BLOCKED BY POLICY** |
| `tests/test-prompt5-live-validation.mjs` | Live extraction validation | **BLOCKED BY POLICY** |
| `tests/test-prompt56-live-bulk.mjs` | High-volume live scraping attempt | **BLOCKED BY POLICY** |
| `scripts/run-live-validation-v175.mjs` | Live ad extraction script | **BLOCKED BY POLICY** |

*Attempting to execute live collection scripts will result in an immediate runtime exception thrown by `assertLiveCollectionPermitted()` in `src/config/collectionGate.ts`.*

---

## 7. Diagnosing Failures & Common Gotchas

### 7.1 PowerShell Script Execution Policy
* **Symptom:** `npm.ps1 cannot be loaded because running scripts is disabled on this system.`
* **Solution:** Bypass powershell script execution blockers by running Node directly:
  `node ./node_modules/tsx/dist/cli.mjs <script-path>`

### 7.2 Release Archive Overwrite Prevention & Packaging Isolation
* **Hardened Behavior (Phase 1.0A):** Both `node scripts/build-extension.mjs` (without flags) and `npm run build:extension` default to unpacked builds and will **never** generate or overwrite a ZIP file.
* **Protected Archives:** Historical release archives (`dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, and `extension.zip`) are permanently protected. Attempts to output to them are rejected at runtime regardless of `--overwrite` flags or relative path trickery.
* **Isolated Packaging:** To package the extension, use `npm run package:extension` or `node scripts/build-extension.mjs --package`. Output is directed to `dist/local/leadnoria-v1.7.6-local.zip` or a custom isolated location passed via `--out`.

### 7.3 Unassessed Leads Export Leaks
* **Symptom:** A lead shows in CSV export even though its relevance decision is `UNASSESSED`.
* **Solution:** Ensure export is called with `{ qualifiedOnly: true }`. Default exports include raw candidates unless strict qualification is explicitly enforced.
