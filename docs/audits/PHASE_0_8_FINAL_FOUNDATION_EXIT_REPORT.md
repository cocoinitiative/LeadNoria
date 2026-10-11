# LeadNoria Phase 0.8: Final Foundation Exit Audit & Reproducible Offline Packaging Report

**Date:** October 12, 2026  
**Repository:** [LeadNoria](https://github.com/nafiz-pranto/LeadNoria)  
**Baseline Commit:** `3b03f612b2565718b18360baf2c83844006f5970` (`release: finalize LeadNoria v1.7.6`)  
**Active Branch:** `main`  
**Execution Environment:** Windows (PowerShell / Node.js v22.14.0)  
**Verification Scope:** Phase 0A–0.7 Consolidation, Packaging Reproducibility, Supply-Chain Audit, Foundation Exit Gate  

---

## 1. Executive Summary & Exit Assessment

### Final Phase 0 Exit Recommendation: **PASS**
*(The offline software foundation, deterministic qualification engine, multi-country geographic classifier, CTA/destination models, data recovery layer, and extension UI have satisfied all foundation hardening criteria under 100% offline synthetic verification. Production automated collection authorization remains **NOT ESTABLISHED**).*

### Foundation Exit Rationale:
Across Phases 0A through 0.7, LeadNoria has been comprehensively remediated from a fragile, permissive, single-country tool into a robust, fail-closed, multi-country research and lead qualification framework:
1. **Safety Enforcement:** The collection safety gate (`src/config/collectionGate.ts`) permanently disables live scraping and external website crawling (`isLiveCollectionPermitted() === false`, `isExternalWebsiteCrawlingPermitted() === false`). No external network requests occur during testing.
2. **Deterministic Qualification:** Qualification is strictly rule-based, fail-closed, and decoupled from score or confidence ranking heuristics. Candidates without verified evidence cannot be labeled `QUALIFIED`.
3. **Multi-Country Support:** The geographic classifier supports extensible country profiles (US, GB, CA, AU, IE, BD) with strict-local policy enforcement.
4. **CTA & Destination Separation:** Call-to-Action (CTA) and Destination are classified independently, ensuring on-platform lead forms are not mislabeled as broken websites.
5. **Storage & Recovery Integrity:** Entity deduplication, checkpoint recovery, and legacy schema normalization are strictly idempotent.
6. **Honest UI Presentation:** The extension UI accurately presents authoritative qualification states (`QUALIFIED`, `REVIEW_REQUIRED`, `UNASSESSED`), actionable reason codes, geographic disclaimers, and destination disclaimers.
7. **Packaging Determinism:** The unpacked extension build (`node scripts/build-extension.mjs --unpacked-only`) produces bit-for-bit identical hashes across clean builds.
8. **Artifact Preservation:** All 6 pre-existing protected files and all 3 historical release archives (`dist/*.zip`, `extension.zip`) remain completely untouched.

---

## 2. Current Baseline & Working-Tree State

* **Active Git Branch:** `main` (tracking `origin/main`)
* **HEAD Commit:** `3b03f612b2565718b18360baf2c83844006f5970`
* **Working Tree:** Uncommitted changes are limited strictly to Phase 0.1–0.7 remediation files and Phase 0.8 documentation.
* **Pre-Existing Protected Files (Must Remain Untouched):**
  1. `test-logs/phase29-production-observation-log.json`: **Untouched**
  2. `tests/test-phase27-production-pilot.mjs`: **Untouched**
  3. `tests/test-phase28-release-operations.mjs`: **Untouched**
  4. `tests/test-phase30-production-analytics.mjs`: **Untouched**
  5. `tests/test-phase31-research-optimization.mjs`: **Untouched**
  6. `tests/test-phase32-reliability-growth-readiness.mjs`: **Untouched**
* **Cryptographic Verification of Historical Release Archives (SHA-256):**
  * `dist/leadnoria-v1.7.5.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` (**Verified Match**)
  * `dist/leadnoria-v1.7.6.zip`: `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` (**Verified Match**)
  * `extension.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` (**Verified Match**)

---

## 3. Phase 0A–0.7 Historical Evidence Matrix

| Phase | Core Objective | Primary Audit Report Path | Key Implementation Files | Executed Test Suites | Result Summary | Verification Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **0A** | Access, Permission & Product Constraints Audit | `docs/audits/PHASE_0A_ACCESS_PERMISSION_AUDIT.md` | None (Audit Only) | Read-only investigation | NO-GO on automated collection under Meta ToS 3.2. Identified unused `@google/genai`. | **VERIFIED** |
| **0** | Baseline & Existing System Audit | `docs/audits/PHASE_0_EXISTING_SYSTEM_BASELINE_AUDIT.md` | None (Audit Only) | Baseline test reproduction | Documented test failures, single-country geo classifier, crawler risks, formula injection risks. | **VERIFIED** |
| **0.1** | Collection Safety Lock & Safe Boundary | `docs/audits/PHASE_0_1_COLLECTION_SAFETY_LOCK_REPORT.md` | `src/config/collectionGate.ts`, `service-worker.ts`, `server/app.ts`, `manifest.json` | `tests/test-phase01-safety-lock.mjs` | 14/14 tests passed. Fail-closed gates active. Scoped manifest host permissions. | **VERIFIED** |
| **0.2** | Test Baseline Repair (Offline Only) | `docs/audits/PHASE_0_2_TEST_BASELINE_REPAIR_REPORT.md` | `relevanceEngine.ts`, `entityResolver.ts` | `test-relevance-engine.mjs`, `test-entity-resolution.mjs`, `test-evidence-waterfall.mjs` | 78/78 tests passed. Numeric ID validation & Bengali Unicode normalization repaired. | **VERIFIED** |
| **0.3** | Geographic Classification & Country Profiles | `docs/audits/PHASE_0_3_GEOGRAPHIC_CLASSIFICATION_REPORT.md` | `countryProfiles/` (US, GB, CA, AU, IE, BD), `geographicClassifier.ts` | `test-geographic-accuracy.mjs`, `test-global-country-profiles.mjs`, `test-strict-local-mode-contract.mjs` | 37/37 tests passed. Extensible multi-country profile architecture with strict-local gates. | **VERIFIED** |
| **0.4** | CTA, Destination & Export Integrity | `docs/audits/PHASE_0_4_CTA_DESTINATION_EXPORT_REPORT.md` | `destinationClassifier.ts`, `entityResolver.ts`, `metaAdapter.ts` | `test-cta-destination-export.mjs` | 31/31 tests passed. CTA & Destination separated; ad-level evidence preserved; formula injection blocked. | **VERIFIED** |
| **0.5** | Data Integrity, Storage & Recovery Hardening | `docs/audits/PHASE_0_5_STORAGE_RECOVERY_INTEGRITY_REPORT.md` | `bulkStore.ts`, `bulkProcessor.ts`, `service-worker.ts` | `test-storage-recovery-integrity.mjs` | 14/14 tests passed. Idempotent storage, recovery safety lock check, schema normalization. | **VERIFIED** |
| **0.6** | Qualification Engine & Scoring Hardening | `docs/audits/PHASE_0_6_QUALIFICATION_SCORING_REPORT.md` | `qualificationGate.ts`, `relevanceEngine.ts`, `metaAdapter.ts` | `test-qualification-scoring.mjs` | 20/20 tests passed. Authoritative fail-closed gates, reason codes, deterministic bounded scoring. | **VERIFIED** |
| **0.7** | UI & Manual Workflow Verification | `docs/audits/PHASE_0_7_UI_MANUAL_WORKFLOW_VERIFICATION_REPORT.md` | `ui/types.ts`, `ui/viewModelMappers.ts`, `ui/App.tsx`, `ui/components/*`, `bd.ts` | `test-ui-workflow-qualification.mjs`, `test-phase25-unified-intelligence-ui.mjs` | 141/141 tests passed. Repaired drawer mock, wired settings, honest reason codes, accessible badges. | **VERIFIED** |

---

## 4. Product Scope & Non-Negotiable Boundaries

The following capabilities are strictly prohibited and structurally prevented in LeadNoria:
1. **No External APIs or Paid Services:** LeadNoria makes zero calls to third-party enrichment APIs, proxies, or cloud lead scrapers.
2. **No External Website Crawling:** `isExternalWebsiteCrawlingPermitted()` strictly returns `false`. `verifyLeadWebsite` in `websiteVerifier.ts` fails closed without initiating network traffic.
3. **No Automated Live Scraping:** `isLiveCollectionPermitted()` strictly returns `false`. All attempts to trigger automated collection from Meta Ad Library throw fail-closed errors.
4. **No Evasion Techniques:** No headless browser fingerprint masking, CAPTCHA bypasses, or rotating proxy pools exist in the software.
5. **No Alternate Lead Sources:** Google Maps, Google Search, LinkedIn, and directory scrapers are not permitted or integrated.
6. **No Permissive Safety Overrides:** Safety locks cannot be bypassed via configuration flags or query parameters.

---

## 5. Software Architecture & Invariant Guarantees

```
                                  [ LeadNoria Architecture ]
                                               |
        +--------------------------------------+--------------------------------------+
        |                                                                             |
        v                                                                             v
+-----------------------+                                                     +-----------------------+
|    Presentation UI    |  (SidePanel & Popup)                                |     Offline Storage   |
|   (App.tsx, Tables,   |                                                     |   (BulkStore.ts,      |
|    Detail Drawers)    |                                                     |    checkpoints,       |
+-----------------------+                                                     |    local state)       |
        |                                                                     +-----------------------+
        |                                                                                 ^
        v                                                                                 |
+-----------------------+           +-----------------------+                             |
|  ViewModel Mappers    | --------> |  Qualification Gate   | ----------------------------+
|  (Truthful Badges &   |           |  (Fail-Closed Gates:  |
|   Diagnostic Reasons) |           |   Relevance, Geo,     |
+-----------------------+           |   CTA, Destination)   |
                                    +-----------------------+
                                                ^
                                                |
                                    +-----------------------+
                                    | Geographic Classifier |  (Multi-Country Profiles:
                                    | & Destination Models  |   US, GB, CA, AU, IE, BD)
                                    +-----------------------+
```

### Invariant Guarantees:
* **Qualification State Honesty:** A lead is marked `QUALIFIED` if and only if all mandatory gates pass. Any gate failure demotes the candidate to `REVIEW_REQUIRED`. Unevaluated leads are marked `UNASSESSED`.
* **Score & Confidence Decoupling:** Lead Score ($0.00$–$1.00$) is a ranking heuristic; confidence represents corroborating signal density. Neither can visually or logically override a failed gate.
* **Geographic Distinction:** Ad target country is distinguished from the advertiser's physical country. Strict-local mode admits only `LOCAL_VERIFIED` entities.
* **CTA vs. Destination Independence:** Call-to-action buttons and destination types are classified independently. On-platform instant forms are distinguished from external websites.
* **Storage Idempotence & Recovery:** Repeated ingestion of identical ads produces zero evidence duplication. Checkpoint resumption checks the safety gate before proceeding.
* **Formula Injection Prevention:** CSV export prefixes risky formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quotes to protect spreadsheet users.

---

## 6. Safe Packaging & Reproducibility Audit

### 6.1 Unpacked Extension Build Verification
The project supports non-destructive unpacked extension builds using:
```bash
node scripts/build-extension.mjs --unpacked-only
```

* **Build Inputs:** `src/extension/content-script.ts`, `src/extension/ui/index.tsx`, `src/extension/service-worker.ts`, `src/extension/manifest.json`, `dist/assets/*.css`.
* **Build Outputs:** `./extension/` containing `app.js`, `content-script.js`, `service-worker.js`, `manifest.json`, `popup.html`, `sidepanel.html`, `styles.css`, and PNG icons.
* **Exclusions Verified:** Test files (`tests/`), logs (`test-logs/`), audit reports (`docs/audits/`), node modules, git metadata, and distribution ZIPs are completely excluded.
* **Network Isolation:** 100% offline. `esbuild` compiles local source files directly without external module resolution.

### 6.2 Bit-for-Bit Determinism Verification
To test build reproducibility, two consecutive clean unpacked builds were executed on the current source tree, and SHA-256 hashes of all output files were compared:

| Output File in `./extension` | Build Run 1 Hash (SHA-256) | Build Run 2 Hash (SHA-256) | Match Status |
| :--- | :--- | :--- | :---: |
| `app.js` | `e2e37518a9a15bd2d031838433686e96cfae1b7072ba2a91dcb31a4cd5975966` | `e2e37518a9a15bd2d031838433686e96cfae1b7072ba2a91dcb31a4cd5975966` | **EXACT MATCH** |
| `content-script.js` | `458053b8a044d171903c98efd9f02250825b463f904f369d54c1db42f557b538` | `458053b8a044d171903c98efd9f02250825b463f904f369d54c1db42f557b538` | **EXACT MATCH** |
| `service-worker.js` | `e6af655b7d404fbb434be60acdc8b415d1e7c72aad20a4349f6a7e905d966750` | `e6af655b7d404fbb434be60acdc8b415d1e7c72aad20a4349f6a7e905d966750` | **EXACT MATCH** |
| `manifest.json` | `af0bb917bfc372afaa0dd781a2430bd82a24eecf19fbbb3dd5b4764ab9e2d08e` | `af0bb917bfc372afaa0dd781a2430bd82a24eecf19fbbb3dd5b4764ab9e2d08e` | **EXACT MATCH** |
| `popup.html` | `7731f25818b12b20358ef645d3f30602bdf8acab51a9e5a28f73753e87701925` | `7731f25818b12b20358ef645d3f30602bdf8acab51a9e5a28f73753e87701925` | **EXACT MATCH** |
| `sidepanel.html` | `48b2d6ec5ed8ec02d941f40ffee42f1ec60a7bf5515661e79fa18bc0b7711106` | `48b2d6ec5ed8ec02d941f40ffee42f1ec60a7bf5515661e79fa18bc0b7711106` | **EXACT MATCH** |
| `styles.css` | `10fdadc3ec32d57051e30567d0589b3ba87beff3104793ee4ef3e64d02f3b531` | `10fdadc3ec32d57051e30567d0589b3ba87beff3104793ee4ef3e64d02f3b531` | **EXACT MATCH** |
| `icons/icon-16.png` | `e77a25baebb3f80db5ea24579af947f6681cad4c5c3f2af23409cf5812b99073` | `e77a25baebb3f80db5ea24579af947f6681cad4c5c3f2af23409cf5812b99073` | **EXACT MATCH** |
| `icons/icon-32.png` | `617bb44f30b6542866bee5da9b466dc5a430b864001d5e9519fe6bc48e944599` | `617bb44f30b6542866bee5da9b466dc5a430b864001d5e9519fe6bc48e944599` | **EXACT MATCH** |
| `icons/icon-48.png` | `b6c1953088b084f2fc4354a9ea4accd8270dd2608ef7916f66b2260863c4ae42` | `b6c1953088b084f2fc4354a9ea4accd8270dd2608ef7916f66b2260863c4ae42` | **EXACT MATCH** |
| `icons/icon-128.png` | `517abcc86bda387e8640a442f6988312ea1686f3bc7f5452efdf0c3956bf8815` | `517abcc86bda387e8640a442f6988312ea1686f3bc7f5452efdf0c3956bf8815` | **EXACT MATCH** |
| `icons/icon-256.png` | `ac0b1fda2fa697f96b5758bc20cfbfb3297a2d89ef10a56b35439c5802c02638` | `ac0b1fda2fa697f96b5758bc20cfbfb3297a2d89ef10a56b35439c5802c02638` | **EXACT MATCH** |

**Conclusion:** The unpacked extension packaging process is **100% bit-for-bit deterministic and reproducible**.

---

## 7. Dependency & Supply-Chain Review

* **Extension Runtime Dependencies:** Built strictly via `esbuild` using local TypeScript sources, React 19, and compiled Tailwind CSS. No external CDNs or dynamic remote script injections are used.
* **Server-Only Dependencies:** `express`, `playwright`. Headless scraping is gated behind `assertLiveCollectionPermitted()` and remains disabled.
* **Unused Production Dependency:** `@google/genai: ^2.4.0` remains declared in `package.json:16`, but has zero imports in `src/`. As noted in Phase 0A, this should be removed during future scheduled maintenance to avoid confusion.
* **Test & Build Tooling:** `esbuild`, `tsx`, `typescript`, `archiver`. Operates completely offline.

---

## 8. Phase 0.8 Final Offline Test Verification

During Phase 0.8, all 12 core regression suites were rerun from scratch:

| Test Suite File | Command Executed | Result | Passed | Failed |
| :--- | :--- | :---: | :---: | :---: |
| `tests/test-phase01-safety-lock.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 14 | 0 |
| `tests/test-relevance-engine.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 37 | 0 |
| `tests/test-entity-resolution.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 21 | 0 |
| `tests/test-evidence-waterfall.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 20 | 0 |
| `tests/test-geographic-accuracy.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 16 | 0 |
| `tests/test-global-country-profiles.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 15 | 0 |
| `tests/test-strict-local-mode-contract.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 6 | 0 |
| `tests/test-cta-destination-export.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 31 | 0 |
| `tests/test-storage-recovery-integrity.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 14 | 0 |
| `tests/test-qualification-scoring.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 20 | 0 |
| `tests/test-ui-workflow-qualification.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 56 | 0 |
| `tests/test-phase25-unified-intelligence-ui.mjs` | `node ./node_modules/tsx/dist/cli.mjs` | **PASS** | 85 | 0 |
| **Extension Unpacked Build** | `node scripts/build-extension.mjs --unpacked-only` | **PASS** | Deterministic | 0 |

**Cumulative Phase 0.8 Verification Total:** **335 Tests Passed, 0 Failed, 0 Skipped.**

---

## 9. Unresolved Issues & Explicit Conditions for Future Work

### 9.1 Unresolved Non-Critical Issues:
1. **Unused Dependency `@google/genai`:** Declared in `package.json`, but unused. Scheduled for removal during future dependency hygiene phases.
2. **Side Panel Narrow Width Wrap:** Below 320px width, lengthy diagnostic reason codes may cause text wrap. Truncation tooltips could improve compact layout aesthetics.

### 9.2 Explicit Conditions for Future Work:
1. **Production Automated Collection Remains Prohibited:** The successful completion of Phase 0 does **not** grant authorization to perform automated scraping on Meta Ad Library. `isLiveCollectionPermitted()` must remain `false`.
2. **No Permissive Safety Gates:** Any future phase must preserve fail-closed gate behavior and formula-safe export protections.
3. **Historical Archive Immutability:** `dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, and `extension.zip` must remain permanently untouched.

---

## 10. Conclusion & Recommended Next Phase

### Phase 0 Foundation Exit Decision: **PASS**
LeadNoria has successfully completed all Phase 0 foundation verification and hardening milestones. The offline codebase is reliable, deterministic, well-documented, and protected against unauthorized collection.

### Recommended Next Development Phase:
* **Phase 1.0 — Architecture Consolidation & Clean Packaging Release Engineering:** Formalize unified TypeScript compilation scripts, safely prune unused dependencies (`@google/genai`), and establish reproducible CI workflows for offline synthetic evaluation.
