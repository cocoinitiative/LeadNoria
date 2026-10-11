# LeadNoria Phase 0.7: Browser Extension UI & Manual Workflow Verification Audit Report

**Date:** October 12, 2026  
**Repository:** [LeadNoria](https://github.com/nafiz-pranto/LeadNoria)  
**Baseline Commit:** `3b03f612b2565718b18360baf2c83844006f5970` (`release: finalize LeadNoria v1.7.6`)  
**Active Branch:** `main`  
**Execution Environment:** Windows (PowerShell / Node.js v22.14.0)  
**Verification Scope:** Browser Extension UI, ViewModel Mappings, Settings Wiring, Manual Workflow, and Qualification Presentation Hardening (Offline Synthetic Fixtures Only)  

---

## 1. Executive Summary & Assessment

**Overall Phase Assessment: PASS**  
*(Live collection and live browser probing remain permanently BLOCKED by policy; manual workflow verified via comprehensive offline synthetic UI test harness and unpacked build validation).*

### Key Achievements in Phase 0.7:
1. **Honest Qualification Presentation:** Completely eliminated false-positive qualification in the UI. Candidates lacking verified eligibility or undergoing review are strictly rendered as `REVIEW_REQUIRED` or `UNASSESSED`. A critical defect in `App.tsx` where non-canonical records defaulted to a hardcoded `status: 'QUALIFIED', score: 85` was discovered and fixed.
2. **Transparent Reason Codes & Failed Gates:** Integrated Phase 0.6 qualification output (`qualificationFailedGates` and `qualificationReasons`) into both table rows and the detail drawer. Raw gate codes (e.g. `GATE_FAIL_FOREIGN_VERIFIED`, `GATE_FAIL_REQUIRED_CTA_MISSING`) are translated into human-readable explanations while preserving diagnostic codes. If reasons are missing, truthful fallback messaging (`Qualification reason unavailable; review required.`) is presented rather than fabricated praise.
3. **Strict Decoupling of Score, Confidence, and Qualification:** The UI now explicitly communicates that lead scores (0.00–1.00) are purely ranking heuristics, confidence reflects evidence corroboration, and neither can visually override a failed qualification gate. High-scoring foreign leads or irrelevant businesses display their score honestly while remaining prominently flagged with amber `REVIEW_REQUIRED` badges.
4. **Geographic Distinction & Disclaimer Transparency:** Table and detail views now display both Target Research Country and Evidence-Supported Physical Country side-by-side, explicitly disclaiming that Meta ad delivery in a target region does not verify physical advertiser presence.
5. **Distinct CTA and Destination Attributes:** Call-to-Action (CTA) and Destination are displayed as independent attributes across cards and drawers. Missing destination URLs are accompanied by clear disclaimers that absence of an ad URL does not prove a business lacks an external website.
6. **Full Settings-to-Execution Wiring:** Added UI configuration controls for Strict-Local mode, Required CTA filters, and Required Destination filters. Verified that settings propagate seamlessly from the UI form through pre-flight plan review into the background payload, qualification gates, and CSV export.
7. **Comprehensive 27-Scenario Test Suite:** Authored `tests/test-ui-workflow-qualification.mjs` verifying all 27 required synthetic UI scenarios from the Phase 0.7 mission specification with 100% pass rate.
8. **Protected Files & Archive Integrity Preserved:** All 6 pre-existing protected files remain untouched. Release archives (`dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, and `extension.zip`) were verified unchanged via cryptographic SHA-256 matching. `isLiveCollectionPermitted()` remains permanently `false`.

---

## 2. Baseline & Working-Tree State

* **Baseline Git Commit:** `3b03f612b2565718b18360baf2c83844006f5970`
* **Branch:** `main` tracking `origin/main`
* **Collection Safety Lock:** Confirmed active and fail-closed (`isLiveCollectionPermitted() === false`, `isExternalWebsiteCrawlingPermitted() === false`).
* **Protected Files Status:**
  * `test-logs/phase29-production-observation-log.json`: **Untouched** (preserved identical to baseline)
  * `tests/test-phase27-production-pilot.mjs`: **Untouched**
  * `tests/test-phase28-release-operations.mjs`: **Untouched**
  * `tests/test-phase30-production-analytics.mjs`: **Untouched**
  * `tests/test-phase31-research-optimization.mjs`: **Untouched**
  * `tests/test-phase32-reliability-growth-readiness.mjs`: **Untouched**
* **Release Archive Cryptographic Verification (SHA-256):**
  * `dist/leadnoria-v1.7.5.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` (Verified Match)
  * `dist/leadnoria-v1.7.6.zip`: `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` (Verified Match)
  * `extension.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` (Verified Match)

---

## 3. UI Architecture Map

The LeadNoria browser extension UI operates as a Chrome Side Panel and Popup interface built with Preact/React, Tailwind CSS, and TypeScript.

```
+--------------------------------------------------------------------------------------------------+
|                                    LeadNoria Extension UI                                        |
+--------------------------------------------------------------------------------------------------+
                                                  |
           +--------------------------------------+--------------------------------------+
           |                                                                             |
           v                                                                             v
+-----------------------+                                                     +--------------------+
|  ResearchConfigView   |  (Configures query, country,                        |   Navigation Bar   |
|                       |   strict-local mode, required CTA/Dest)             |                    |
+-----------------------+                                                     +--------------------+
           |                                                                             |
           v                                                                             |
+-----------------------+                                                                |
|   PlanReviewModal     |  (Pre-flight confirmation of research plan                     |
|                       |   & qualification filters before launch)                       |
+-----------------------+                                                                |
           |                                                                             |
           v                                                                             |
+-----------------------+                                                                |
|   Extension Runtime   |  (Sends 'START_RESEARCH' message with                          |
|   & Storage Layer     |   fail-closed qualification criteria)                          |
+-----------------------+                                                                |
           |                                                                             |
           +--------------------------------------+--------------------------------------+
                                                  |
                                                  v
                                      +-----------------------+
                                      |   ResultsTableView    |
                                      +-----------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
              +---------------------+                           +--------------------+
              | ResultDetailDrawer  |                           |    ExportModal     |
              |                     |                           |                    |
              | (10 Detail Sections,|                           | (Strict Qualified  |
              |  Geo, CTA/Dest,     |                           |  enforcement toggle|
              |  Failed Gates &     |                           |  & format choice)  |
              |  Score Disclaimers) |                           +--------------------+
              +---------------------+
```

### Component Breakdown & Responsibilities:
1. **`src/extension/ui/App.tsx` (Top-Level Controller):** Manages overall extension view states (`CONFIG`, `RUNNING`, `RESULTS`, `HISTORY`), dispatches runtime messages, hydrates local state, coordinates record selection, and handles drawer navigation.
2. **`src/extension/ui/components/ResearchConfigView.tsx`:** Form controls for search keyword, target country, strict-local qualification toggle, required CTA filter, and required destination filter.
3. **`src/extension/ui/components/PlanReviewModal.tsx`:** Pre-flight modal summarizing parameters, strict-local policy, and required conversion attributes.
4. **`src/extension/ui/components/ResultsTableView.tsx`:** Candidate ledger featuring qualification filters (`ALL`, `QUALIFIED`, `REVIEW_REQUIRED`, `UNASSESSED`), color + symbol badges, score indicators, geographic badges, CTA/destination tags, and review alerts.
5. **`src/extension/ui/components/ResultDetailDrawer.tsx`:** In-depth record inspection drawer with dedicated sections for:
   * Entity Identity and Aliases.
   * Target Country vs. Business Physical Location (with targeting disclaimers).
   * Observed CTA and Destination classification (with missing URL disclaimers).
   * Lead Score and Confidence breakdown (with ranking disclaimers).
   * Mandatory & Optional Qualification Gates Ledger with explicit pass/fail statuses and reason codes.
   * Raw Meta Ad Library evidence cards.
6. **`src/extension/ui/components/ExportModal.tsx`:** Export dialogue enforcing safe CSV/JSON generation with formula injection prevention and an explicit toggle to restrict exports to verified `QUALIFIED` leads only.
7. **`src/extension/ui/viewModelMappers.ts`:** Authoritative mapper converting raw extension leads, canonical intelligence records, and legacy stored entities into unified ViewModels (`ResultRowViewModel`, `ResultDetailViewModel`) without fabricating data.

---

## 4. Summary of Files Changed & Rationale

| File Path | Description of Changes |
| :--- | :--- |
| `src/extension/ui/types.ts` | Extended `ResultRowViewModel` and `ResultDetailViewModel` with `relevanceDecision`, `qualificationState`, `scoreConfidence`, `targetCountryCode`, `businessCountryCode`, `geographicClassification`, `ctaType`, `destinationType`, `qualificationFailedGates`, and `qualificationReasons`. Added filter fields to `PlanReviewViewModel`. |
| `src/extension/ui/humanLabels.ts` | Added human-readable labels for qualification states (`REVIEW_REQUIRED`, `UNASSESSED`), geographic classifications (`LOCAL_VERIFIED`, `FOREIGN_VERIFIED`, etc.), CTA types, destination types, and Phase 0.6 qualification reason codes. |
| `src/extension/ui/designSystem.ts` | Added semantic status badge definitions pairing colors with accessible symbols (`REVIEW_REQUIRED` with amber warning triangle `⚠`, `UNASSESSED` with slate ring `○`, `LOCAL_VERIFIED` with pin `📍`, `FOREIGN_VERIFIED` with globe `🌐`). |
| `src/extension/ui/viewModelMappers.ts` | Added `isExtensionLead`, `extensionLeadToResultRowViewModel`, and `extensionLeadToResultDetailViewModel`. Bridged Phase 0.6 qualification outputs directly to UI models. Preserved truthful fallbacks for unassessed/review-required leads. |
| `src/extension/ui/App.tsx` | Fixed critical bug where non-canonical leads defaulted to hardcoded `QUALIFIED` status in the detail drawer. Routed all candidate inspections through `toResultDetailViewModel`. Wired research plan filters (`strictLocal`, `requiredCta`, `requiredDestination`) and qualified export options. |
| `src/extension/ui/components/ResultsTableView.tsx` | Added `REVIEW_REQUIRED` and `UNASSESSED` filter options. Displayed separate geographic badges, score badges, CTA badges, destination badges, and review reason alerts. |
| `src/extension/ui/components/ResultDetailDrawer.tsx` | Added comprehensive geographic analysis section, CTA/destination evidence section, score/confidence ranking disclaimer, and itemized qualification gates checklist. |
| `src/extension/ui/components/ResearchConfigView.tsx` | Added UI configuration options for strict-local mode, required CTA types, and required destination types. |
| `src/extension/ui/components/PlanReviewModal.tsx` | Updated pre-flight modal to summarize configured qualification criteria. |
| `src/extension/ui/components/ExportModal.tsx` | Added "Strict Qualified Export" toggle to prevent exporting review-required leads unless explicitly intended. |
| `src/extension/countryProfiles/profiles/bd.ts` | Enhanced Bangladesh phone regex to recognize standard domestic and international spacing/hyphen patterns (e.g. `+880 1712-345678`). |
| `src/extension/qualificationGate.ts` | Corrected `ResearchIntent` type import path. |
| `src/extension/types.ts` | Added optional view model convenience aliases to `ExtensionLead`. |
| `tests/test-ui-workflow-qualification.mjs` | New comprehensive test suite verifying all 27 required synthetic UI scenarios. |

---

## 5. Audit Findings & Hardening Results

### 5.1 Status & Qualification-Reason Presentation Findings
* **Defect Identified:** In `src/extension/ui/App.tsx`, inspecting any lead that was not an instance of Phase 24's `CanonicalLeadRecord` triggered a mock fallback object that hardcoded `uRecord.qualification = { status: 'QUALIFIED', score: 85 }`. As a result, foreign leads, unassessed leads, and leads with failed qualification gates visually appeared fully qualified in the detail drawer.
* **Remediation:** Replaced the mock generator with `toResultDetailViewModel(rawLead)`, which invokes `extensionLeadToResultDetailViewModel`. Authoritative qualification statuses (`QUALIFIED`, `REVIEW_REQUIRED`, `UNASSESSED`) are now preserved 100% faithfully.
* **Reason Display:** When `qualificationReasons` are available, each failed gate is mapped to human-friendly text (e.g. `GATE_FAIL_FOREIGN_VERIFIED` $\rightarrow$ "Foreign business location"). If reasons are absent on a `REVIEW_REQUIRED` lead, the UI renders: `"Qualification reason unavailable; review required."` instead of fabricating justifications.

### 5.2 Geographic Presentation Findings
* **Defect Identified:** Previously, the UI only displayed `geographicContext` as a single opaque string, often showing only the target country. Users could not distinguish between where an ad was targeted and where the advertiser was physically verified.
* **Remediation:** Separated Target Research Country (`targetCountryCode`) from Physical Business Country (`businessCountryCode`). The UI renders distinct badges (`📍 Locally verified [BD]`, `🌐 Foreign verified [US]`, `? Local probable [BD]`, `— Location unknown`). The detail drawer displays an explicit targeting disclaimer:
  > *"Targeting ads to users in BD does not confirm that the business is physically located in BD. Qualification strictly requires evidence of local physical presence."*

### 5.3 CTA and Destination Presentation Findings
* **Defect Identified:** Destination presence was conflated with website existence. Advertisers using Meta Instant Forms or WhatsApp links without a domain URL were previously labeled as having "missing websites," creating the false impression of an unviable business.
* **Remediation:** CTA (e.g. `LEARN_MORE`, `SIGN_UP`, `SEND_MESSAGE`) and Destination Type (e.g. `EXTERNAL_WEBSITE`, `INSTANT_FORM`, `MESSAGING`, `CALL`, `APP`) are now classified and rendered as completely independent badges. The UI includes an explicit destination disclaimer:
  > *"Advertiser uses an on-platform Meta Instant Form. Absence of an external destination URL does not imply that the advertiser lacks a website outside this campaign."*

### 5.4 Score, Confidence, and Evidence Presentation Findings
* **Defect Identified:** Score (bounded $0.00$ to $1.00$) was previously susceptible to being confused with qualification status, and confidence was rendered alongside score without clarifying its distinct meaning.
* **Remediation:** Lead scores are formatted consistently as percentages (e.g. `85%`) alongside confidence (`HIGH`, `MEDIUM`, `LOW`, `NONE`). The detail drawer explicitly states:
  > *"Lead Score is a ranking heuristic based on observed evidence signals. It does not prove eligibility and cannot override failed qualification gates."*
* A lead with a $0.96$ score that fails geographic qualification remains strictly flagged as `REVIEW_REQUIRED`.

### 5.5 Settings-to-Qualification Configuration Verification
* Verified that selecting Target Country, Strict-Local Mode, Required CTA, and Required Destination in `ResearchConfigView` correctly passes into `StartResearchPayload`.
* `StartResearchPayload` passes parameters to `evaluateLeadQualificationGates` and `exportLeadsToCsv`, ensuring that configuration settings are authoritative rather than UI-only cosmetic filters.

---

## 6. Synthetic UI Workflow & Test Matrix (27 Scenarios)

The test suite in `tests/test-ui-workflow-qualification.mjs` executes 56 deterministic assertions covering all 27 required synthetic scenarios:

| # | Scenario Description | Expected Outcome | Verification Status |
| :-: | :--- | :--- | :---: |
| 1 | Fully qualified synthetic candidate | Status `QUALIFIED`, score & confidence preserved, `LOCAL_VERIFIED` | **VERIFIED BY EXECUTION** |
| 2 | Relevant but foreign business in strict-local | Status `REVIEW_REQUIRED`, `FOREIGN_VERIFIED`, lists `GATE_FAIL_FOREIGN_VERIFIED` | **VERIFIED BY EXECUTION** |
| 3 | Local-probable business | Status `REVIEW_REQUIRED` under strict-local policy, badge communicates probable | **VERIFIED BY EXECUTION** |
| 4 | Unknown business location | Status `REVIEW_REQUIRED`, lists `GATE_FAIL_LOCATION_UNKNOWN` | **VERIFIED BY EXECUTION** |
| 5 | Unassessed relevance candidate | Status `REVIEW_REQUIRED`, relevance decision `UNASSESSED` | **VERIFIED BY EXECUTION** |
| 6 | Rejected relevance candidate | Relevance preserved as `NOT_RELEVANT`, status `REVIEW_REQUIRED` | **VERIFIED BY EXECUTION** |
| 7 | High score ($0.96$) with failed qualification | Score preserved as $0.96$, status strictly remains `REVIEW_REQUIRED` | **VERIFIED BY EXECUTION** |
| 8 | High confidence with failed qualification | Confidence `HIGH` preserved, candidate strictly remains `NOT_RELEVANT` | **VERIFIED BY EXECUTION** |
| 9 | Missing score | Score remains `undefined`, not coerced to $0$ or $100$ | **VERIFIED BY EXECUTION** |
| 10 | Missing qualification reasons | Truthful fallback `"Qualification reason unavailable; review required."` displayed | **VERIFIED BY EXECUTION** |
| 11 | Required CTA missing | Candidate marked `REVIEW_REQUIRED`, lists `GATE_FAIL_REQUIRED_CTA_MISSING` | **VERIFIED BY EXECUTION** |
| 12 | Required destination missing | Candidate marked `REVIEW_REQUIRED`, lists `GATE_FAIL_REQUIRED_DESTINATION_MISSING` | **VERIFIED BY EXECUTION** |
| 13 | External website destination | Classified as `EXTERNAL_WEBSITE`, website state `found` | **VERIFIED BY EXECUTION** |
| 14 | Messaging destination | Classified as `MESSAGING` with human-friendly label | **VERIFIED BY EXECUTION** |
| 15 | Instant form destination | Classified as `INSTANT_FORM` with label `"Meta instant form"` | **VERIFIED BY EXECUTION** |
| 16 | Unknown destination | Preserved as `UNKNOWN` with missing evidence explanation | **VERIFIED BY EXECUTION** |
| 17 | Conflicting geo evidence after merge | Authoritative re-evaluation demotes candidate to `REVIEW_REQUIRED` (`FOREIGN_VERIFIED`) | **VERIFIED BY EXECUTION** |
| 18 | Stored legacy candidate with unsafe status | `normalizeStoredLead` demotes unsafe `QUALIFIED` status to `REVIEW_REQUIRED` | **VERIFIED BY EXECUTION** |
| 19 | Interrupted research state | Run state recognized as `PARTIAL`, allows resumption | **VERIFIED BY EXECUTION** |
| 20 | Empty results state | Displays $0$ exportable records, export action disabled | **VERIFIED BY EXECUTION** |
| 21 | Loading state & active execution | `COLLECTING` maps to active running job, `COMPLETED` is idle | **VERIFIED BY EXECUTION** |
| 22 | Collection blocked by safety policy | `isLiveCollectionPermitted()` permanently returns `false` | **VERIFIED BY EXECUTION** |
| 23 | Export containing unqualified candidates | `exportLeadsToCsv({ qualifiedOnly: true })` strictly excludes `REVIEW_REQUIRED` rows | **VERIFIED BY EXECUTION** |
| 24 | Filter settings changing eligibility | Adding `requireWebsiteFound: true` disqualifies instant form leads | **VERIFIED BY EXECUTION** |
| 25 | Duplicate candidate evidence after hydration | Duplicate ads collapse into corroboration counts without inflating score | **VERIFIED BY EXECUTION** |
| 26 | Bengali niche text normalization | Bengali Unicode matches canonically under NFC normalization | **VERIFIED BY EXECUTION** |
| 27 | Accessible labels & semantic badges | Badges declare explicit accessible names, pairing colors with distinct symbols | **VERIFIED BY EXECUTION** |

---

## 7. Exact Offline Test & Build Commands Executed

All test and build executions were performed offline without external network requests:

| Test Suite / Build Target | Execution Command | Result | Pass / Fail / Skip |
| :--- | :--- | :---: | :---: |
| **Phase 0.7 UI Workflow & Qualification** | `node ./node_modules/tsx/dist/cli.mjs tests/test-ui-workflow-qualification.mjs` | **PASS** | 56 Passed, 0 Failed |
| **Phase 0.1 Safety Lock Regression** | `node ./node_modules/tsx/dist/cli.mjs tests/test-phase01-safety-lock.mjs` | **PASS** | 14 Passed, 0 Failed |
| **Phase 0.3 Geographic Accuracy** | `node ./node_modules/tsx/dist/cli.mjs tests/test-geographic-accuracy.mjs` | **PASS** | 16 Passed, 0 Failed |
| **Phase 0.3 Global Country Profiles** | `node ./node_modules/tsx/dist/cli.mjs tests/test-global-country-profiles.mjs` | **PASS** | 15 Passed, 0 Failed |
| **Phase 0.3 Strict Local Mode Contract** | `node ./node_modules/tsx/dist/cli.mjs tests/test-strict-local-mode-contract.mjs` | **PASS** | 6 Passed, 0 Failed |
| **Phase 0.4 CTA / Destination / Export** | `node ./node_modules/tsx/dist/cli.mjs tests/test-cta-destination-export.mjs` | **PASS** | 31 Passed, 0 Failed |
| **Phase 0.5 Storage & Recovery Integrity** | `node ./node_modules/tsx/dist/cli.mjs tests/test-storage-recovery-integrity.mjs` | **PASS** | 14 Passed, 0 Failed |
| **Phase 0.6 Qualification & Scoring** | `node ./node_modules/tsx/dist/cli.mjs tests/test-qualification-scoring.mjs` | **PASS** | 20 Passed, 0 Failed |
| **Phase 25 Unified Intelligence UI** | `node ./node_modules/tsx/dist/cli.mjs tests/test-phase25-unified-intelligence-ui.mjs` | **PASS** | 85 Passed, 0 Failed |
| **Extension Unpacked Build** | `node scripts/build-extension.mjs --unpacked-only` | **PASS** | 0 Errors, Clean Build |

**Cumulative Regression Test Count:** **257 Tests Passed, 0 Failed, 0 Skipped.**

---

## 8. Verification Methodology Breakdown

To adhere strictly to audit transparency standards, every verification activity is categorized:

* **Source Inspection:** Verified manifest boundaries, host permissions, absence of paid APIs/crawlers, and view model mapping functions.
* **Unit & Component Tests:** Verified view model transformations, badge semantics, reason mapping, Unicode normalization, and fail-closed gate evaluation.
* **Build Verification:** Successfully built the complete unpacked Chrome extension (`./extension`) using `esbuild` without modifying historical release ZIP archives.
* **Offline Simulated Workflow:** Simulated end-to-end user research workflows (configuration $\rightarrow$ pre-flight review $\rightarrow$ progress $\rightarrow$ table presentation $\rightarrow$ drawer inspection $\rightarrow$ filtered export) using synthetic candidate fixtures and mocked extension state in `tests/test-ui-workflow-qualification.mjs`.
* **Actual Manual Browser Verification:** **NOT VERIFIED / NOT APPLICABLE.** Live browser collection remains strictly prohibited by the Phase 0.1 collection safety lock (`isLiveCollectionPermitted() === false`). Manual interaction with live Meta Ad Library pages was intentionally not performed.

---

## 9. Safety Gate & Artifact Preservation Verification

* **`isLiveCollectionPermitted()`:** Confirmed `false` (`src/config/collectionGate.ts`).
* **External Website Crawling:** Confirmed disabled (`isExternalWebsiteCrawlingPermitted() === false`).
* **Host Permissions:** Verified that `src/extension/manifest.json` contains no broad host permissions (`<all_urls>`, `https://*/*`) or unauthorized domains.
* **Protected Files Integrity:** All 6 pre-existing modified files (`test-logs/phase29-production-observation-log.json`, `tests/test-phase27-production-pilot.mjs`, `tests/test-phase28-release-operations.mjs`, `tests/test-phase30-production-analytics.mjs`, `tests/test-phase31-research-optimization.mjs`, `tests/test-phase32-reliability-growth-readiness.mjs`) remain identical to their initial state.
* **Release Archives Integrity:** Verified that `dist/leadnoria-v1.7.5.zip`, `dist/leadnoria-v1.7.6.zip`, and `extension.zip` were not overwritten or modified.
* **Git Cleanliness:** No commits, pushes, tags, or GitHub release drafts were created.

---

## 10. Remaining Gaps & Recommendations

### Remaining Architectural Gaps:
1. **Side Panel Resizing Constraints:** While the side panel CSS defines responsive fluid widths down to 360px, very narrow panel widths (< 320px) may cause horizontal clipping of long reason codes. Reason codes currently wrap, but truncation with tooltips could further improve compactness.
2. **Offline Fixture Management UI:** An offline fixture injection drawer within the extension options page would facilitate manual testing in standard browser developer mode without requiring manual background script dispatch.

### Recommended Next Phase:
* **Phase 0.8 — Documentation & Safe Package Preparation:** Prepare non-destructive packaging scripts, verify full audit trails from Phase 0A through Phase 0.7, document local synthetic development guides, and ensure the repository is fully prepared for reproducible local evaluation.
