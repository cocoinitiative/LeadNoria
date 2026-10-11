# LeadNoria — Safe Offline Development & Testing Workflow Guide

**Version:** 1.7.6-phase0.8  
**Scope:** Offline Development, Synthetic Testing, and Non-Destructive Packaging  
**Enforcement Boundary:** Strict Zero-Network Local Operation  

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
* **Package Manager:** npm (using pre-resolved `node_modules` or `npm ci --ignore-scripts` when offline cache is present).
* **Direct Execution Runtime:** `node ./node_modules/tsx/dist/cli.mjs` is used to execute TypeScript ESM scripts directly across both Unix and Windows environments where shell execution policies may restrict wrapper commands.

### 2.2 Offline Dependency Policy
* All development tasks rely exclusively on dependencies committed in `package.json` and resolved in `node_modules`.
* **Never attempt network-dependent dependency updates (`npm install <package>`, `npm update`)** during offline testing or air-gapped evaluation.
* If a clean workspace lacks `node_modules`, install only from an approved internal repository cache or pre-mirrored archive using `npm ci --prefer-offline`.

---

## 3. Safe Offline Build Workflow

### 3.1 Unpacked Extension Build (Recommended)
To build the unpacked Chrome extension for local loading without modifying historical archives or creating distribution ZIPs, run:

```bash
# Direct node execution (Cross-Platform / Windows PowerShell / Bash)
node scripts/build-extension.mjs --unpacked-only
```

#### What This Command Does:
1. Compiles and bundles `src/extension/content-script.ts` into `./extension/content-script.js` (IIFE format via `esbuild`).
2. Compiles and bundles `src/extension/ui/index.tsx` into `./extension/app.js` (ESM format via `esbuild`).
3. Compiles `src/extension/service-worker.ts` into `./extension/service-worker.js`.
4. Writes `./extension/manifest.json`, responsive `sidepanel.html`, fixed-width `popup.html`, and bundled Tailwind styles.
5. Generates deterministic PNG icons (16, 32, 48, 128, 256 px).
6. **Exits immediately (`--unpacked-only`), completely bypassing ZIP archive generation and protecting historical release archives.**

#### Determinism & Reproducibility:
The `--unpacked-only` build generates bit-for-bit identical hashes across clean runs when executed on identical source trees.

### 3.2 Loading the Unpacked Extension in Developer Mode
1. Open Google Chrome or Chromium.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `./extension` directory in the project root.
5. Open the LeadNoria Side Panel or Popup to inspect the UI.

---

## 4. Running Offline Regression Test Suites

All tests in the safe development baseline operate exclusively on local in-memory synthetic fixtures, avoiding external network traffic.

### 4.1 Master Test Execution Matrix

Execute tests using `node ./node_modules/tsx/dist/cli.mjs <test-script>`:

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
```

### 4.2 Cumulative Test Verification Count
* **Current Passing Offline Tests:** 335 assertions across 12 test suites.
* **Failures:** 0
* **Skips:** 0

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

### 7.2 Release Archive Overwrite Prevention
* **Symptom:** Running `npm run build:extension` without flags attempts to write `dist/leadnoria-v1.7.6.zip`.
* **Solution:** Always pass `--unpacked-only` to ensure historical archives remain untouched:
  `node scripts/build-extension.mjs --unpacked-only`

### 7.3 Unassessed Leads Export Leaks
* **Symptom:** A lead shows in CSV export even though its relevance decision is `UNASSESSED`.
* **Solution:** Ensure export is called with `{ qualifiedOnly: true }`. Default exports include raw candidates unless strict qualification is explicitly enforced.
