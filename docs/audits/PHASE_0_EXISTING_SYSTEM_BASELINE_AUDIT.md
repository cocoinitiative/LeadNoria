# Phase 0 Audit: Existing System & Baseline Audit
**Project:** LeadNoria  
**Repository:** https://github.com/nafiz-pranto/LeadNoria  
**Baseline Release:** v1.7.6 (`3b03f612b2565718b18360baf2c83844006f5970`)  
**Previous Phase:** Phase 0A (Access, Permission & Product Constraints Audit — Decision: NO-GO for production automated collection)  
**Audit Date:** 2026-10-12  
**Audit Status:** READ-ONLY AUDIT ONLY — NO IMPLEMENTATION  

---

## 1. Executive Summary

This Phase 0 audit provides a comprehensive, evidence-based baseline investigation of the LeadNoria repository at release v1.7.6. The audit establishes the exact current state of the architecture, data pipeline, policy constraints, test coverage, and code-level defects prior to any remediation.

### Key Baseline Findings:
1. **Production Collection Blocked (BLOCKER):** Confirms Phase 0A NO-GO decision. Meta Terms of Service Section 3.2 and Automated Data Collection Terms prohibit automated web scraping without prior express written permission. The project lacks authorization, and its non-negotiable "zero API" constraint prohibits using Meta's sole authorized channel (the official Graph API).
2. **Prohibited External Website Crawler Active in Extension (BLOCKER/HIGH):** `src/extension/websiteVerifier.ts` implements a deep same-origin crawler (`MAX_PAGES_PER_DOMAIN = 5`) using native `fetch()` and `optional_host_permissions: ["https://*/*"]` to scrape external advertiser websites for phone numbers, emails, and postal addresses. This directly violates the project's non-negotiable rule banning external website crawling and probing.
3. **Dual Architecture & Server Scraper Collision (HIGH):** The repository contains two distinct products: a Chrome MV3 Extension (`src/extension/`) and a standalone Express web application (`src/App.tsx`, `server.ts`) with a headless Playwright scraper (`src/server/browserWorker.ts`). The server worker attempts automated Chromium navigation against `https://www.facebook.com/ads/library/*`, which triggers Meta anti-bot 403/429 blocks and violates the extension-only model.
4. **Hardcoded Geographic Limitations (HIGH):** The geographic classification engine (`src/extension/geographicClassifier.ts`) only possesses local rules, division lists, and phone patterns for Bangladesh (`BD`). Any search targeting the United States, United Kingdom, Canada, Australia, or any other market automatically results in `LOCATION_UNKNOWN` for all leads.
5. **Missing Destination Modeling & Conflation (MEDIUM):** The pipeline does not separately model CTA wording, CTA action type, and actual destination type (Instant Form, External Website, WhatsApp/Messenger, App, Call, None). Missing destination URLs are conflated with "no website," leading to misclassification of on-platform lead forms.
6. **Strict ID Regex Regressions in Test Suite (MEDIUM):** Hardening in `src/extension/metaAdapter.ts` and `src/extension/entityResolver.ts` enforcing `/^[0-9]{5,25}$/` causes offline unit tests utilizing 4-digit mock IDs (`1001`, `1002`) to fail (`test-relevance-engine.mjs` and `test-entity-resolution.mjs`), masking regression verification.
7. **Safe Local Test Baseline Established:** Fully offline test suites (`test-geographic-accuracy.mjs` and `test-strict-gate-v2.mjs`) passed 100% cleanly without external network access or live Meta scraping.

---

## 2. Repository & Git Baseline

### Working Tree State
- **Current Branch:** `main`
- **Current Commit:** `3b03f612b2565718b18360baf2c83844006f5970` (`release: finalize LeadNoria v1.7.6`)
- **Git Status:** 6 pre-existing modified tracked files preserved untouched:
  - `M test-logs/phase29-production-observation-log.json`
  - `M tests/test-phase27-production-pilot.mjs`
  - `M tests/test-phase28-release-operations.mjs`
  - `M tests/test-phase30-production-analytics.mjs`
  - `M tests/test-phase31-research-optimization.mjs`
  - `M tests/test-phase32-reliability-growth-readiness.mjs`
- **Untracked Directories:** `docs/audits/` (Phase 0A & Phase 0 reports), `reports/`, `scripts/`, `validation-evidence/`.

### Historical Artifact Integrity Verification
SHA-256 hashes and file sizes for all immutable historical release archives were verified against reported values:

| Artifact Path | Size (Bytes) | Computed SHA-256 Hash | Baseline Reported Hash | Status |
| :--- | :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | 354,168 | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **CONFIRMED MATCH** |
| `dist/leadnoria-v1.7.6.zip` | 357,748 | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **CONFIRMED MATCH** |
| `extension.zip` | 354,168 | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **CONFIRMED MATCH** |

---

## 3. Current Architecture

The repository contains two overlapping, partially decoupled sub-systems:

```
LeadNoria Repository (v1.7.6)
├── Sub-System 1: Chrome MV3 Extension (Core Product)
│   ├── Entry Points: scripts/build-extension.mjs, manifest.json, sidepanel.html, popup.html
│   ├── UI: src/extension/ui/ (React 19 + Tailwind CSS)
│   ├── Service Worker: src/extension/service-worker.ts (Background orchestration, tabs)
│   ├── Content Script: src/extension/content-script.ts (DOM scanning, MutationObserver)
│   ├── Extraction & Normalization: src/extension/metaAdapter.ts
│   ├── Semantic Relevance: src/extension/relevanceEngine.ts, evidenceWaterfall.ts
│   ├── Entity Resolution: src/extension/entityResolver.ts
│   ├── Geographic Classification: src/extension/geographicClassifier.ts, geography/
│   ├── Local Storage: src/extension/bulkStore.ts (IndexedDB) & chrome.storage.local
│   ├── Export: src/extension/export/ (CSV RFC-4180, JSON)
│   └── Prohibited Sub-module: src/extension/websiteVerifier.ts (External web crawler)
│
└── Sub-System 2: Node.js / Express Web Application & Automation Backend
    ├── Server: server.ts, src/server/app.ts (Express on port 3000)
    ├── Dashboard UI: src/App.tsx, src/main.tsx, src/components/ (Multi-workspace suite)
    ├── Automation Engine: src/server/browserWorker.ts (Playwright headless scraper)
    └── Mock Data / Fixtures: src/data/ (Pre-populated sample data)
```

### Component Inventory Table

| Component | File Path | Primary Responsibility | Callers / Entry | Dependencies | Side Effects / Storage | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Extension Manifest** | `src/extension/manifest.json`, `scripts/build-extension.mjs` | Defines MV3 permissions, content scripts, background worker | Chrome Browser runtime | None | Requests `tabs`, `storage`, `scripting`, `https://*/*` | Verified |
| **Service Worker** | `src/extension/service-worker.ts` | Orchestrates research runs, tab creation, batch loops, checkpoints | Extension UI message `START_RESEARCH` | `bulkStore`, `queryPlanner`, `metaAdapter`, `websiteVerifier` | Modifies `chrome.storage.local`, creates tabs | Needs Mocking |
| **Content Script** | `src/extension/content-script.ts` | Scans Facebook DOM, scroll execution, dynamic waiting | Injected via manifest or `chrome.scripting` | `metaAdapter` | Scrolls webpage DOM, listens for mutations | Partial |
| **Meta Adapter** | `src/extension/metaAdapter.ts` | Identifies ad cards, extracts raw text, decodes redirect shims, checks challenges | Content Script, Service Worker | `relevanceEngine`, `geographicClassifier` | Pure DOM parser / memory data mapper | Unit Tested |
| **Relevance Engine** | `src/extension/relevanceEngine.ts` | Tokenization, strict v2/v3 scoring, negative category filtering | `metaAdapter`, `evidenceWaterfall` | Bounded taxonomy dictionaries | In-memory evaluation | Unit Tested |
| **Evidence Waterfall** | `src/extension/evidenceWaterfall.ts` | Multi-stage evidence accumulation, anti-inflation, coverage ratio | `service-worker`, `bulkProcessor` | `relevanceEngine` | In-memory evaluation | 19/20 Passed |
| **Entity Resolver** | `src/extension/entityResolver.ts` | Deduplicates advertisers, resolves page IDs/slugs, protects marketplaces | `bulkProcessor`, `metaAdapter` | `metaAdapter` | In-memory deduplication index | Unit Tested |
| **Geographic Classifier** | `src/extension/geographicClassifier.ts` | Evaluates physical country vs target country | `metaAdapter`, `bulkProcessor` | BD regex, city list, foreign indicators | In-memory evaluation | 16/16 Passed |
| **Website Verifier** | `src/extension/websiteVerifier.ts` | Deep external website crawler (crawls up to 5 subpages) | `service-worker.ts:897` | Native `fetch`, `websiteCache` | External HTTP requests to arbitrary domains | Prohibited |
| **Bulk Store** | `src/extension/bulkStore.ts` | IndexedDB persistent storage for batches, leads, checkpoints | `service-worker.ts` | Native `indexedDB` | Local browser IndexedDB persistence | Safe Local |
| **CSV Exporter** | `src/extension/export/csvExporter.ts` | RFC-4180 serialization with formula injection defense | `service-worker.ts`, UI modals | None | Local file download generation | Unit Tested |
| **Browser Worker** | `src/server/browserWorker.ts` | Standalone server Playwright scraper for Meta Ad Library | `src/server/app.ts` | `playwright` (`chromium`) | Headless browser execution against Meta | Prohibited |

---

## 4. End-to-End Data Flow Audit

### Stage-by-Stage Trace
```
Stage 1: User Configuration
  Source: src/extension/ui/components/ResearchConfigView.tsx
  Data: StartResearchPayload { keywords, countryCode, locationName, targetLeadCount, mode }
  Validation: Country code validated against locationCatalogue.ts.

Stage 2: Tab Navigation & Page Loading
  Source: src/extension/service-worker.ts:380-395
  Action: chrome.tabs.create({ url: "https://www.facebook.com/ads/library/?active_status=all..." })
  Failure/Retry: waitForTabLoad() polls tab status up to 30s; halts on tab close.

Stage 3: DOM Scanning & Dynamic Waiting
  Source: src/extension/content-script.ts:49-100 (waitForDynamicAdCards)
  Action: MutationObserver listens for new DOM nodes. window.scrollBy scrolls page.

Stage 4: Ad-Card Identification & Field Extraction
  Source: src/extension/metaAdapter.ts:120-250 (extractAdCardsWithDiagnostics)
  DOM Matcher: Elements matching /(?:Library ID|ID de la biblioteca|...):\s*([0-9]+)/i.
  Extracted Fields: libraryId, pageName, facebookPageUrl, destinationUrl (decoded via l.php shim), bodyCopy, ctaText, isActive.
  Challenge Detection: checkForBotChallenge() detects "Security Check" or "You’re Temporarily Blocked".

Stage 5: Entity Resolution & Deduplication
  Source: src/extension/entityResolver.ts:320-538 (evaluateEntityMerge)
  Logic: Evaluates Facebook Page ID > Page Slug > Destination Domain > Brand Name.
  Marketplace Protection: GENERIC_SHARED_DOMAINS (Amazon, Daraz, Etsy) never trigger auto-merge.

Stage 6: Geographic Classification
  Source: src/extension/geographicClassifier.ts:160-378 (evaluateGeographicOrigin)
  Logic: Checks foreign indicators (IN, GB, US, AU, CN) -> checks BD local signals -> defaults to LOCATION_UNKNOWN.

Stage 7: Semantic Relevance Evaluation
  Source: src/extension/relevanceEngine.ts & evidenceWaterfall.ts
  Decision: RELEVANT (score >= threshold), UNCERTAIN (ambiguous), or NOT_RELEVANT (negative category conflict).

Stage 8: Deep Website Crawling (PROHIBITED)
  Source: src/extension/websiteVerifier.ts:826-920 (verifyLeadWebsite)
  Action: Initiates fetch() to external domain; extracts email, phone, addresses; crawls up to 5 subpages.

Stage 9: Persistence & Checkpoint
  Source: src/extension/bulkStore.ts (IndexedDB: databases leadnoria_runs, leadnoria_batches, leadnoria_leads)
  Recovery: Stored checkpoints allow resuming interrupted runs.

Stage 10: Export Pipeline
  Source: src/extension/export/csvExporter.ts & metaAdapter.ts:1071-1160 (exportLeadsToCsv)
  Output: Local browser file download (CSV / JSON) with formula injection sanitization.
```

### Trust Boundary Analysis
- **Untrusted External DOM:** Facebook Ad Library DOM elements are sanitized against script and formula injection.
- **Untrusted External Websites:** Crawling arbitrary advertiser domains introduces SSRF, malformed payload, and rate-limit risks in `websiteVerifier.ts`.
- **Client Storage Boundary:** All lead data is contained locally in IndexedDB / chrome.storage.local; zero exfiltration endpoints exist.

---

## 5. Extension Permissions & Network Behavior

### Manifest Permissions Inventory
- `permissions`: `["storage", "tabs", "scripting", "sidePanel"]`
  - `storage`: Required for local IndexedDB / chrome.storage state.
  - `tabs`: Required to navigate and close the research tab.
  - `scripting`: Required to inject `content-script.js`.
  - `sidePanel`: Required for Chrome side panel UI.
- `host_permissions`:
  - `https://www.facebook.com/ads/library/*` (Permitted scope for target interface)
  - `https://web.facebook.com/ads/library/*` (Permitted alternate domain)
- `optional_host_permissions`:
  - `https://*/*`: **EXCESSIVE & PROHIBITED.** Grants arbitrary cross-origin fetch capabilities across the entire internet, used exclusively to support `websiteVerifier.ts`.

### External Network Destinations
1. `facebook.com` / `web.facebook.com`: Intended target for research.
2. Arbitrary advertiser domains: Contacted via `fetch()` in `websiteVerifier.ts`.
3. Third-party telemetry / tracking: **None.** No analytics, tracking pixels, or remote telemetry servers exist in the extension code.

---

## 6. Phase 0A Findings Re-Verification

### A. External Website Crawler (`src/extension/websiteVerifier.ts`)
- **Status: CONFIRMED.**
- **Code Locations:** Lines 31–33 (`MAX_PAGES_PER_DOMAIN = 5`), lines 826–920 (`verifyLeadWebsite`), lines 920–960 (`defaultFetch`).
- **Behavior:** Performs multi-page HTTP recursive crawling on advertiser destination websites using browser `fetch()`. Parses HTML to harvest phone numbers, email addresses, and postal addresses. Invoked by `service-worker.ts:897`.
- **Constraint Impact:** Directly violates Non-Negotiable Constraint #2 ("No external website crawling or probing"). Must be completely disabled and decoupled.

### B. Broad Host Permissions (`manifest.json` & `build-extension.mjs`)
- **Status: CONFIRMED.**
- **Code Locations:** `scripts/build-extension.mjs:130-132`, `src/extension/manifest.json:20-22`.
- **Behavior:** Declares `optional_host_permissions: ["https://*/*"]`.
- **Constraint Impact:** Exists solely to facilitate `websiteVerifier.ts`. Must be eliminated. Minimum necessary permission is restricted strictly to `https://www.facebook.com/ads/library/*` and `https://web.facebook.com/ads/library/*`.

### C. Server-Side Playwright Scraper (`src/server/browserWorker.ts`)
- **Status: CONFIRMED.**
- **Code Locations:** `src/server/browserWorker.ts:524-535`.
- **Behavior:** Launches headless Chromium via Playwright, navigates to Meta Ad Library, handles HTTP 403 / 429 blocks, and evaluates in-page DOM. Invoked via HTTP POST `/api/research/jobs` on the standalone Express server (`src/server/app.ts`).
- **Constraint Impact:** Server-side scraping against Meta Ad Library triggers datacenter IP blocks and bypasses the user-driven browser extension model. Must be restricted to synthetic/fixture mode or decommissioned.

### D. Unused Dependency (`@google/genai`)
- **Status: CONFIRMED.**
- **Code Location:** `package.json:16` (`"@google/genai": "^2.4.0"`).
- **Behavior:** Declared in production `dependencies`, but zero source imports exist across `src/`. Leftover dependency from an earlier prototype.
- **Constraint Impact:** Creates misleading impression of external AI API usage. Should be removed during dependency cleanup.

---

## 7. Core Product Requirements Audit

### A. Geographic Qualification
- **Status: PARTIALLY IMPLEMENTED / GEOGRAPHICALLY DEFICIENT.**
- **Analysis:**
  - Distinction between `targetCountryCode` and `businessCountryCode` is strictly modeled in types (`types.ts:343-348`) and tested in `test-geographic-accuracy.mjs`.
  - Evidence hierarchy prevents `.bd` domain alone from claiming verified local presence (produces `LOCAL_PROBABLE` with `LOW` confidence).
  - **Deficiency:** Rules are hardcoded exclusively for Bangladesh (`BD`) in `src/extension/geographicClassifier.ts:259-363`. There are no rule sets, telephone regexes, or city catalogs for any other target country. Running research for the US, UK, or Canada unconditionally outputs `LOCATION_UNKNOWN` for every lead.
  - **Entity Merge Risk:** `mergeCandidateIntoEntity` in `entityResolver.ts:544-650` fails to update `geographicClassification` when merging candidates with new location evidence.

### B. CTA & Destination Classification
- **Status: INCOMPLETE / CONFLATED.**
- **Analysis:**
  - `creativeSignals.ts:30-80` normalizes CTA button text into categories (`SHOP_NOW`, `LEARN_MORE`, `SEND_MESSAGE`, `CALL_NOW`, `BOOK_NOW`, `SIGN_UP`).
  - **Deficiency:** Destination type is NOT modeled as a distinct entity. The codebase treats `destinationUrl` existence as binary: `websiteState = destinationUrl ? 'found' : 'not_found'`.
  - Missing destination URLs are treated as "not found", failing to account for Meta Instant Forms, Messenger/WhatsApp destinations, or native Page likes.
  - Subsequent ad CTAs are dropped during entity merging (`if (!target.sampleCta && cand.ctaText)`).

### C. Niche Qualification
- **Status: CONFIRMED / FUNCTIONAL FOR ENGLISH; FAILING FOR NON-LATIN.**
- **Analysis:**
  - Strict Relevance Gate v2 (`relevanceEngine.ts`) and Evidence Waterfall v3 (`evidenceWaterfall.ts`) enforce hard contradiction penalties against sports, healthcare, gaming, and politics.
  - All 45 assertions in `test-strict-gate-v2.mjs` passed cleanly.
  - **Deficiency:** Fails on non-Latin / Bengali script tokenization (Scenario 16 in `test-evidence-waterfall.mjs` failed due to token extraction mismatch on `আরএফএল ফার্নিচার`).

### D. Advertiser Identity & Deduplication
- **Status: ROBUST ARCHITECTURE / DEFECT IN TEST FIXTURES.**
- **Analysis:**
  - `entityResolver.ts` implements multi-signal precedence (Page ID > Page Slug > Destination Domain > Specific Brand Name).
  - Protects shared marketplace hosts (Amazon, Daraz, Etsy) from cross-merging merchants.
  - **Defect:** Hardened regex `/^[0-9]{5,25}$/` in `entityResolver.ts:563` and `metaAdapter.ts:971` causes 4-digit mock IDs to be discarded, resulting in `adCount: 0` during unit tests.

### E. Qualification & Export Safety
- **Status: PARTIALLY VERIFIED.**
- **Analysis:**
  - RFC-4180 CSV serializer (`csvExporter.ts`) correctly neutralizes spreadsheet formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - **Deficiency:** `exportLeadsToCsv` in `metaAdapter.ts:1140` uses a fallback: `l.relevanceDecision || 'RELEVANT'`, which defaults un-evaluated records to `RELEVANT`.
  - CSV export columns (`phone`, `email`, `streetAddress`) depend on the prohibited `websiteVerifier.ts` crawler.

---

## 8. Test & Quality Baseline

### Available Test Suites & Inspection
The repository contains 85 test files in `tests/`. Most tests are standalone `.mjs` scripts executed with `tsx`.

### Safely Executed Test Results (Zero Network / Offline):
1. **`tests/test-geographic-accuracy.mjs`:**
   - **Command:** `cmd.exe /c npx tsx tests/test-geographic-accuracy.mjs`
   - **Outcome:** **PASSED (16/16 tests passed).**
   - **Coverage:** Verified target vs business country separation, phone prefix validation, foreign classification, and CSV geographic headers.
2. **`tests/test-strict-gate-v2.mjs`:**
   - **Command:** `cmd.exe /c npx tsx tests/test-strict-gate-v2.mjs`
   - **Outcome:** **PASSED (45/45 assertions passed).**
   - **Coverage:** Verified evidence traceability, contradiction overrides, category taxonomy, and formula injection escaping.
3. **`tests/test-relevance-engine.mjs`:**
   - **Command:** `cmd.exe /c npx tsx tests/test-relevance-engine.mjs`
   - **Outcome:** **FAILED on line 640** (`RFL Furniture merged 2 ads (got 0)`).
   - **Root Cause:** 4-digit mock IDs in test fixture rejected by production `{5,25}` regex.
4. **`tests/test-entity-resolution.mjs`:**
   - **Command:** `cmd.exe /c npx tsx tests/test-entity-resolution.mjs`
   - **Outcome:** **FAILED on Scenario J** (`adCount: 0` instead of 3).
   - **Root Cause:** 4-digit mock IDs in test fixture rejected by production `{5,25}` regex.
5. **`tests/test-evidence-waterfall.mjs`:**
   - **Command:** `cmd.exe /c npx tsx tests/test-evidence-waterfall.mjs`
   - **Outcome:** **PARTIAL (19/20 passed, 1 failed).**
   - **Root Cause:** Scenario 16 failed on non-Latin Bengali token matching.

---

## 9. Build & Release Architecture

### Build Script Inspection (`scripts/build-extension.mjs`)
- **Target Directory:** `extension/`
- **Build Operations:**
  1. Generates icons via custom PNG encoder (`zlib.deflateSync`).
  2. Injects version from `package.json` (authoritative version: `1.7.6`).
  3. Writes `manifest.json`.
  4. Generates entrypoint HTML files (`sidepanel.html`, `popup.html`).
  5. Bundles Service Worker (`src/extension/service-worker.ts` -> `extension/service-worker.js`) via esbuild (ESM, target `chrome120`).
  6. Bundles Content Script (`src/extension/content-script.ts` -> `extension/content-script.js`) via esbuild (IIFE, target `chrome120`).
  7. Bundles UI App (`src/extension/ui/index.tsx` -> `extension/app.js`) via esbuild (ESM, JSX automatic).
  8. Emits Tailwind CSS.
- **Defects in Build Script:**
  - Hardcodes `optional_host_permissions: ["https://*/*"]` directly into the generated manifest.
  - Bundles `websiteVerifier.ts` into the service worker bundle.

---

## 10. Documentation Baseline

- **README.md / Spec Claims:** Describe LeadNoria as a local, browser-first research tool.
- **Obsolete Google Maps Artifacts:** Numerous legacy documentation files (`LEADNORIA-GOOGLE-MAPS-PHASE1-REPORT.md`, `LEADNORIA-GOOGLE-MAPS-PHASE3-PRODUCT-SPEC.md`) remain in the repository root, creating confusion about product scope.
- **Unstated Limitations:** Documentation does not disclose that geographic classification is currently hardcoded solely for Bangladesh (`BD`), nor that live collection against Meta Ad Library web interface lacks platform authorization.

---

## 11. Privacy & Data-Handling Observations

1. **Personal Contact Scraping Risk:** `websiteVerifier.ts` extracts emails and phone numbers from external sites without user consent or GDPR Article 14 notification mechanisms.
2. **Local Data Containment:** Scraped records remain strictly local to the user's browser machine (IndexedDB / chrome.storage.local). No remote transmission or third-party telemetry occurs.
3. **Retention & Deletion:** No automated TTL data retention or deletion lifecycle exists in the extension store.

---

## 12. Material Findings Classification

| ID | Severity | Status | File Path & Lines | Finding Summary | Impact | Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | **BLOCKER** | CONFIRMED | Platform Policy | Meta Terms Sec. 3.2 prohibits automated collection without written permission | Production automated scraping is unauthorized | Maintain NO-GO; isolate tool to local fixture / manual mode |
| **F-02** | **BLOCKER** | CONFIRMED | `src/extension/websiteVerifier.ts:31-33, 826-920` | Prohibited external website crawler active in extension pipeline | Violates non-negotiable rule banning external web crawling | Fully disable and decouple `websiteVerifier.ts` from extension |
| **F-03** | **HIGH** | CONFIRMED | `scripts/build-extension.mjs:130-132`, `manifest.json:20-22` | Overly broad `optional_host_permissions: ["https://*/*"]` declared | Security risk; exists solely for prohibited web crawler | Remove `optional_host_permissions` from manifest and build |
| **F-04** | **HIGH** | CONFIRMED | `src/server/browserWorker.ts:524-535` | Server-side Playwright scraper navigates Meta Ad Library directly | Triggers HTTP 403 / 429 IP bans; contradicts extension architecture | Restrict browser worker strictly to synthetic fixture mode |
| **F-05** | **HIGH** | CONFIRMED | `src/extension/geographicClassifier.ts:259-363` | Geographic classification rules hardcoded exclusively for Bangladesh | Non-BD targets unconditionally produce `LOCATION_UNKNOWN` | Expand classification engine to support global target country models |
| **F-06** | **MEDIUM** | CONFIRMED | `src/extension/types.ts:328`, `creativeSignals.ts:30-80` | Incomplete modeling: destination type conflated with URL existence | Misses on-platform Instant Forms; misclassifies lead destinations | Add explicit `DestinationType` enum and decouple CTA from destination |
| **F-07** | **MEDIUM** | CONFIRMED | `src/extension/entityResolver.ts:563`, `metaAdapter.ts:971` | Strict `/^[0-9]{5,25}$/` regex breaks 4-digit mock IDs in tests | Causes test suite assertions to fail (`adCount: 0`) | Permit mock IDs in test harnesses or update test fixtures to 15-digit IDs |
| **F-08** | **MEDIUM** | CONFIRMED | `package.json:16` | Unused dependency `@google/genai` declared in production dependencies | Package bloat; misleading external AI usage signal | Remove dependency from `package.json` |
| **F-09** | **MEDIUM** | CONFIRMED | `src/extension/evidenceWaterfall.ts:220-237` | Bengali script tokenization mismatch in Evidence Waterfall | Fails Scenario 16 in adversarial test suite | Update tokenizer to support non-Latin unicode word boundaries |
| **F-10** | **LOW** | CONFIRMED | `src/extension/metaAdapter.ts:1140` | Fallback `l.relevanceDecision || 'RELEVANT'` defaults un-evaluated leads | Risk of exporting unverified records as RELEVANT | Change default fallback to `UNCERTAIN` or `NOT_RELEVANT` |

---

## 13. Prioritized Remediation Backlog

1. **Task 1: Isolate & Enforce NO-GO Gate on Automated Collection (BLOCKER)**
   - Lock down automated collection paths.
   - Establish local synthetic fixture harness as the sole authorized execution path for development.
2. **Task 2: Strip Prohibited Web Crawler & Broad Permissions (BLOCKER/HIGH)**
   - Remove `optional_host_permissions: ["https://*/*"]` from `scripts/build-extension.mjs` and `manifest.json`.
   - Remove `websiteVerifier.ts` calls from `service-worker.ts` and UI export pipelines.
3. **Task 3: Reconcile Test Fixture Library IDs (MEDIUM)**
   - Update mock test candidate IDs across `tests/` to valid 15-digit numeric strings so regression tests pass.
4. **Task 4: Implement Explicit CTA & Destination Classification (MEDIUM)**
   - Introduce `DestinationType`: `EXTERNAL_WEBSITE`, `NO_VISIBLE_DESTINATION`, `INSTANT_FORM`, `MESSAGING`, `CALL`, `APP`, `OTHER`, `UNKNOWN`.
   - Decouple CTA text from destination type.
5. **Task 5: Generalize Geographic Classification Engine (HIGH)**
   - Generalize `geographicClassifier.ts` beyond Bangladesh (`BD`) to support US, UK, and international target countries.
6. **Task 6: Decommission Server Scraper & Clean Up Dependencies (MEDIUM)**
   - Restrict `src/server/browserWorker.ts` strictly to synthetic mode.
   - Remove `@google/genai` from `package.json`.

---

## 14. Final Baseline Assessment

The LeadNoria codebase contains high-quality deterministic heuristics for semantic relevance, formula-safe CSV export, and entity deduplication. However, it cannot operate in production due to platform authorization gates and internal product constraint violations (external website crawling and server Playwright scraping).

**Recommended Next Action:** Await user authorization before proceeding to Phase 0 baseline remediation. Do not implement code changes or reactivate live collection.
