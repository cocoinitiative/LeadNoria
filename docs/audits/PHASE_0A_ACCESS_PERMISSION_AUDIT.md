# Phase 0A Audit: Access, Permission & Product Constraints Audit
**Project:** LeadNoria  
**Repository:** https://github.com/nafiz-pranto/LeadNoria  
**Baseline:** v1.7.6 (`3b03f612b2565718b18360baf2c83844006f5970`)  
**Audit Date:** 2026-10-12  
**Audit Type:** Read-Only Investigation, Policy Research, and Decision Gate  
**Implementation Status:** NOT AUTHORIZED — DECISION GATE ONLY  

---

## 1. Executive Summary

This Phase 0A audit evaluated whether LeadNoria's intended automated research workflow against the Meta Ad Library can proceed compliantly under applicable platform terms, data protection laws, and non-negotiable product constraints.

### Key Audit Findings:
1. **Explicit Platform Prohibition (BLOCKER):** Meta Terms of Service Section 3.2 and Meta Automated Data Collection Terms explicitly prohibit accessing or collecting data from Meta products using automated means without prior express written permission from Meta. LeadNoria does not possess written authorization from Meta.
2. **Irresolvable Architectural Conflict (BLOCKER):** Meta's only officially authorized programmatic interface is the Meta Ad Library API (via Meta Graph API, requiring registered Meta Developer credentials and App Review). However, LeadNoria's non-negotiable product constraints strictly ban all APIs (official, private, or third-party) and paid services. Because Meta requires the API for programmatic data access and bans automated web extraction without written consent, the intended zero-API scraper cannot operate legally without express written authorization that the project currently lacks.
3. **Internal Product Constraint Violations in Codebase (HIGH):** The codebase contains an active deep website verification engine (`src/extension/websiteVerifier.ts`) backed by `optional_host_permissions: ["https://*/*"]` that crawls up to 5 pages per advertiser destination domain, extracting contact details, emails, and phone numbers. This directly violates the project's non-negotiable rule prohibiting "Google Maps, Google Search, alternate lead sources, and external website crawling or probing."
4. **Server Headless Automation Conflict (HIGH):** The repository maintains a secondary Node.js/Express server (`src/server/browserWorker.ts`) utilizing Playwright headless Chromium automation to query `https://www.facebook.com/ads/library/?...`, which triggers Meta anti-bot countermeasures (HTTP 403 / 429) and represents access-control collision risks.
5. **Dependency & Privacy Governance Issues (MEDIUM):** An unused dependency (`@google/genai: ^2.4.0`) is packaged in `package.json` dependencies, and external website crawling extracts personal identifiers (unvetted personal phone numbers and emails) without privacy notices required under GDPR Article 14.

### Gate Recommendation:
**Final Gate Decision: NO-GO** for automated production collection. Automated collection from the Meta Ad Library web interface cannot proceed without written permission from Meta. Non-collection development (offline testing, synthetic fixtures, UX modeling, deterministic relevance heuristics) remains permissible under controlled boundaries.

---

## 2. Audit Scope & Limitations

### In-Scope:
- Authoritative Meta terms, conditions, automated data collection policies, and privacy mandates.
- LeadNoria v1.7.6 codebase architecture: Chrome Extension MV3 (`src/extension/`) and Express/Playwright backend (`src/server/`).
- Dependency manifest (`package.json`), build configuration (`scripts/build-extension.mjs`), and manifest permissions (`manifest.json`).
- Repository integrity: Git working-tree status and SHA-256 validation of historical release zips.

### Out-of-Scope & Limitations:
- No active automated scraping campaigns or live data extraction tests were executed.
- No production source code, configurations, manifest permissions, or dependencies were altered.
- Legal analysis is conducted as a technical compliance audit; formal legal advice must be obtained from qualified legal counsel.

---

## 3. Official Source Register

| Source Title | Official URL | Relevant Section / Clause | Publication / Update Date | Date Accessed | Applicable Requirement Explanation | Regulatory Stance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Meta Terms of Service** | https://www.facebook.com/terms.php | Section 3.2 ("Permissions you grant to us and commitments you make to us") | January 1, 2025 / Current | 2026-10-12 | Prohibits accessing or collecting data from Meta Products using automated means without prior permission, regardless of login state. | **EXPLICIT PROHIBITION** |
| **Meta Automated Data Collection Terms** | https://www.facebook.com/apps/site/terms/automated_data_collection_terms.php | Sections 1, 2, 3 ("Express Written Permission", "Permitted Use", "Prohibited Activities") | Current | 2026-10-12 | Requires express written permission from Meta prior to deploying scrapers, bots, or crawlers; bans selling, sublicensing, or transferring collected data. | **EXPLICIT PROHIBITION** |
| **Meta Platform Terms** | https://developers.facebook.com/terms | Section 1-3 ("Access and Use of Platform Data") | Current | 2026-10-12 | Governs programmatic data access via Meta APIs. Requires developer registration, App Review, data protection assessment, and rate limits. | **CONDITIONAL PERMISSION (API ONLY)** |
| **Meta Ad Library Overview & Help** | https://www.facebook.com/ads/library/ | Help Documentation / About Ad Library | Current | 2026-10-12 | Public UI provided for manual transparency search by citizens and advertisers. Programmatic access is routed exclusively to the Ad Library API. | **AMBIGUOUS / SILENT ON WEB SCRAPING** |
| **Meta Ad Library API Documentation** | https://www.facebook.com/ads/library/api/ | Requirements & Getting Started | Current | 2026-10-12 | Official programmatic access path requiring Meta Developer account, identity verification, access tokens, and rate limits. | **OFFICIALLY PERMITTED (API ONLY)** |
| **EU General Data Protection Regulation (GDPR)** | https://eur-lex.europa.eu/eli/reg/2016/679/oj | Articles 5, 6, 14 | May 25, 2018 | 2026-10-12 | Requires lawful basis (Art. 6) and notification to data subjects (Art. 14) within one month when collecting personal contact data indirectly. | **RESTRICTIVE COMPLIANCE BURDEN** |

---

## 4. Answers to Mandatory Policy Questions

### Q1: Is automated collection from the intended Meta Ad Library interface explicitly permitted?
**Answer: NO.** Automated collection from the web interface (`https://www.facebook.com/ads/library/*`) is explicitly prohibited by Meta Terms of Service Section 3.2 and the Meta Automated Data Collection Terms. Meta provides no public clause authorizing browser automation or web scrapers on this interface.

### Q2: Is written authorization, express permission, or another form of approval required?
**Answer: YES.** Meta Terms of Service Section 3.2 states: *"You may not access or collect data from our Products using automated means (without our prior permission)..."* Furthermore, Section 1 of the Automated Data Collection Terms explicitly states that users must obtain *"express written permission"* directly from Meta. Acceptance of standard web terms does not confer permission.

### Q3: Does permission differ between manual browsing and automated collection?
**Answer: YES.** Manual browsing of the public web interface is permitted to all internet users for ad transparency and verification. However, automated collection (programmatic DOM extraction via browser extensions, headless drivers, or bots) is subject to explicit contractual prohibitions under Section 3.2.

### Q4: Are there applicable restrictions on collection frequency, scale, storage, reuse, or redistribution?
**Answer: YES.** 
1. **Automated extraction:** Zero tolerance without express written permission.
2. **If authorized under Automated Data Collection Terms:** Data cannot be sold, sublicensed, or redistributed to third parties, and collection must be strictly throttled so as not to burden infrastructure. Meta retains unilateral right to revoke collection permissions at any time.
3. **If accessed via official Ad Library API:** Strict API rate limits apply, data must not be used for discriminatory profiling, and data must be kept synchronized and pruned per Meta Platform Terms.

### Q5: What restrictions apply to advertiser information, ad content, destination information, and contact details?
**Answer:**
- **Advertiser & Ad Content:** Protected by intellectual property rights, Meta terms, and fair use boundaries. Cannot be redistributed commercially as a raw competing dataset.
- **Destination URLs & Landing Pages:** Public links can be referenced, but automated probing/crawling is governed by the destination websites' respective `robots.txt` and terms.
- **Contact Details (Emails, Phone Numbers):** Insofar as contact data identifies sole proprietors or individual business representatives, it constitutes personal data under GDPR and CCPA/CPRA. Scraping contact details without providing required notice (GDPR Art. 14) poses substantial regulatory liability.

### Q6: Can the intended workflow proceed without violating the project's no-API and no-paid-service rules?
**Answer: NO.** This is a fundamental contradiction:
- Meta's only authorized programmatic channel is the official Meta Ad Library API.
- LeadNoria's Non-Negotiable Constraint #2 strictly prohibits: *"All APIs, including official APIs, private APIs, undocumented endpoints, and third-party API services."*
- Therefore, complying with Meta's authorization terms requires using the official API (violating the project rule), while adhering to the project's zero-API rule forces the tool into unauthorized web scraping (violating Meta Terms of Service).

### Q7: Which requirements cannot be established conclusively from public documentation?
**Answer:**
1. Whether Meta would grant bespoke written scraper authorization to a commercial lead-generation tool without requiring the official Graph API onboarding process.
2. Whether Meta considers passive DOM reading in a locally installed, user-driven browser extension (where the human clicks search) to constitute "automated means" in private enforcement guidelines (though judicially and contractually, extensions automating DOM parsing have been repeatedly litigated by Meta as prohibited automation).

### Q8: What exact approval or clarification is needed before production collection can proceed?
**Answer:**
1. **Meta Authorization:** Formal written agreement or written exemption from Meta Legal / Platform Partnerships expressly authorizing LeadNoria to programmatically parse `https://www.facebook.com/ads/library/*` without using the Graph API.
2. **Project Sponsor Alignment:** Explicit resolution of the conflict between the project's zero-API constraint and Meta's official API mandate.

---

## 5. Audit B — Intended Access Method Analysis

### A. Chrome Extension Workflow (Current Implementation)
```
[User Action in Popup/Sidepanel]
        │
        ▼
[Service Worker: service-worker.ts]
        │  Opens background browser tab:
        │  https://www.facebook.com/ads/library/?active_status=all&q={keyword}&country={country}
        ▼
[Target Tab: content-script.ts]
        │  Executes waitForDynamicAdCards()
        │  Scrolls window iteratively (window.scrollBy)
        │  Observes mutations (MutationObserver)
        ▼
[DOM Parsing: metaAdapter.ts]
        │  Scans DOM elements matching "Library ID: [0-9]+"
        │  Extracts Advertiser Name, Facebook Page Link, Redirect Shim (l.facebook.com/l.php?u=...)
        │  Extracts Ad text, CTA button text, Start date
        ▼
[Heuristic Evaluation: relevanceEngine.ts & bulkProcessor.ts]
        │  Normalizes tokens, categorizes intent, checks deduplication
        ▼
[Persistence: bulkStore.ts & chrome.storage.local]
        │  Stores leads and evidence in IndexedDB / chrome.storage.local
        ▼
[Deep Verification (PROHIBITED): websiteVerifier.ts]
        │  Uses optional_host_permissions: ["https://*/*"]
        │  Fetches advertiser destination website via native fetch()
        │  Recursively crawls up to 5 same-origin subpages
        │  Extracts emails, phone numbers, contact signals
        ▼
[Export: src/extension/export/]
        └─ Generates CSV / JSON for user local download
```

### B. Node.js Playwright Backend Workflow (Alternative Pipeline)
- **Path:** `server.ts` -> `src/server/app.ts` -> `src/server/browserWorker.ts`
- **Execution:** Launches headless Chromium (`chromium.launch({ headless: true })`) directly navigating to `https://www.facebook.com/ads/library/?active_status=all...`.
- **Evasion / Blocking:** Lines 532-535 detect HTTP 403 / 429 status codes: *"Meta Ad Library returned HTTP 403 Forbidden. Cloud datacenter IP is blocked by Meta anti-bot security perimeter."* Lines 542-544 detect *"Security Check"* or *"You’re Temporarily Blocked"* and abort execution.

### C. Access Violations Against Non-Negotiable Constraints:
1. **External Website Crawling (`src/extension/websiteVerifier.ts`):**
   - Lines 31-33: `MAX_PAGES_PER_DOMAIN = 5; MAX_PAGE_TIMEOUT_MS = 10000; MAX_DOMAIN_VERIFICATION_TIME_MS = 30000;`
   - Lines 826-920 (`verifyLeadWebsite`): Deep multi-page crawler inspecting external advertiser domains for phone numbers and emails.
   - **Constraint Violated:** *"Google Maps, Google Search, alternate lead sources, and external website crawling or probing are prohibited."*
2. **Server-Side Headless Automation (`src/server/browserWorker.ts`):**
   - Automates Playwright directly against Meta's public web surface from a server context, violating Meta ToS and creating infrastructure blocking risks.

---

## 6. Audit C — Repository & Release Safety Baseline

### Git Working-Tree Status
- **Current Branch:** `main`
- **Current Commit Hash:** `3b03f612b2565718b18360baf2c83844006f5970` (`release: finalize LeadNoria v1.7.6`)
- **Staged Changes:** None (clean index).
- **Existing Unstaged Changes (Preserved Exactly):**
  - `M test-logs/phase29-production-observation-log.json`
  - `M tests/test-phase27-production-pilot.mjs`
  - `M tests/test-phase28-release-operations.mjs`
  - `M tests/test-phase30-production-analytics.mjs`
  - `M tests/test-phase31-research-optimization.mjs`
  - `M tests/test-phase32-reliability-growth-readiness.mjs`
- **Untracked Directories/Files:**
  - `reports/` (historical audit notes)
  - `scripts/` (audit & test utility scripts)
  - `validation-evidence/`

### Historical Artifact Hash & Integrity Verification
Hashes and sizes of release artifacts were computed via SHA-256:

| Artifact Path | File Size (Bytes) | Computed SHA-256 Hash | Baseline Reported Hash | Status |
| :--- | :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.5.zip` | 354,168 | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **EXACT MATCH** |
| `dist/leadnoria-v1.7.6.zip` | 357,748 | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **EXACT MATCH** |
| `extension.zip` | 354,168 | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **EXACT MATCH (v1.7.5 mirror)** |

All historical release zip archives are intact and unmodified.

---

## 7. Audit D — Technical Dependency and Permission Inventory

### Dependency Classification (`package.json`)

| Dependency Name | Version | Category | Where Used | Notes / Constraint Alignment |
| :--- | :--- | :--- | :--- | :--- |
| `@google/genai` | `^2.4.0` | Production (`dependencies`) | **Unused** | Present in `package.json` dependencies, but zero imports exist in `src/`. Should be removed or moved to dev. |
| `playwright` | `^1.63.0` | Production (`dependencies`) | Test suite & `src/server/browserWorker.ts` | Used for server-side scraping worker. Conflicts with extension-only pure browser architecture. |
| `express` | `^4.21.2` | Production (`dependencies`) | `server.ts`, `src/server/app.ts` | Local HTTP API server. |
| `dotenv` | `^17.2.3` | Production (`dependencies`) | Server environment loading | Used by server runtime. |
| `lucide-react` | `^0.546.0` | Production (`dependencies`) | Extension UI & Web UI | UI icons. Permitted. |
| `motion` | `^12.23.24` | Production (`dependencies`) | Extension UI & Web UI | UI animations. Permitted. |
| `react`, `react-dom`| `^19.0.1` | Production (`dependencies`) | Extension UI & Web UI | UI rendering framework. Permitted. |
| `recharts` | `^3.10.1` | Production (`dependencies`) | Extension UI & Web UI | Analytics charting. Permitted. |
| `vite` | `^6.2.3` | Production (`dependencies`) | Build & dev server | Build tool. Permitted. |

### Extension Manifest Permissions Analysis (`manifest.json` / `build-extension.mjs:114-160`)
1. **Required Permissions:**
   - `storage`: Permitted (IndexedDB & chrome.storage.local for local research persistence).
   - `tabs`: Permitted (opening and controlling research tab navigation).
   - `scripting`: Permitted (fallback injection of content script into research tabs).
   - `sidePanel`: Permitted (Chrome side panel UI host).
2. **Host Permissions:**
   - `https://www.facebook.com/ads/library/*`: Permitted for extension content script injection.
   - `https://web.facebook.com/ads/library/*`: Permitted for extension content script injection.
3. **Optional Host Permissions:**
   - `https://*/*`: **EXCESSIVE / CONFLICT.** Included solely to allow `websiteVerifier.ts` to perform multi-page HTTP crawling against arbitrary advertiser websites. Violates the product constraint banning external crawling and probing.

---

## 8. Audit E — Data Handling and Privacy Findings

### Data Collected:
1. **Ad Identification:** Ad Library ID, Start date, Active status, Ad creative body copy, CTA button label.
2. **Advertiser Identity:** Facebook Page Name, Facebook Page URL, Page Likes/Followers (if visible).
3. **Landing Page Metadata:** External destination URL decoded from `l.facebook.com/l.php?u=...`.
4. **Deep Website Verification Data (from `websiteVerifier.ts`):** Domain, title, meta description, visible page text, candidate emails, candidate phone numbers, postal addresses.

### Storage & Transmission:
- **Local Storage:** All extracted records are held strictly in client-side storage (`chrome.storage.local` and IndexedDB).
- **Network Transmission:** Zero telemetry or data exfiltration endpoints were found in the extension bundle. The extension does not transmit scraped data to any remote server owned by LeadNoria.

### Privacy Compliance Concerns:
1. **GDPR Article 14 (Indirect Collection of Personal Data):** When scraping contact emails and telephone numbers of small business owners or sole proprietors via `websiteVerifier.ts`, the collector is required to notify individuals of data collection within one month unless disproportionate effort can be legally established. LeadNoria has no notice mechanism.
2. **Retention Lifecycle:** No automated data purging or user data retention policy exists; records accumulate locally in IndexedDB until manually cleared by the user.

---

## 9. Comprehensive Findings Classification

| ID | Severity | Finding Summary | Evidence | Impact | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F-01** | **BLOCKER** | Automated collection from Meta Ad Library prohibited without written permission | Meta Terms of Service Sec. 3.2; Automated Data Collection Terms Sec. 1 | Operating automated scraping against Meta Ad Library exposes project/users to breach of terms and IP blocks | Maintain NO-GO on production scraping; seek sponsor clarification |
| **F-02** | **BLOCKER** | Project "Zero API" rule conflicts with Meta's sole authorized access channel | Non-negotiable Constraint #2 vs Meta Platform Terms | Project cannot use official API due to rule, but cannot scrape web UI due to Meta ToS | Require product owner decision: allow official API or restrict to manual research |
| **F-03** | **HIGH** | Active external website crawler violates product constraints | `src/extension/websiteVerifier.ts:31-33`, `826-920`; `optional_host_permissions: ["https://*/*"]` | Direct contradiction of Section 2 prohibiting external website crawling/probing | Deprecate/disable `websiteVerifier.ts` and remove `optional_host_permissions` |
| **F-04** | **HIGH** | Node.js Playwright backend attempts direct server scraping against Meta | `src/server/browserWorker.ts:524-535` | Triggers immediate Meta HTTP 403 / 429 IP bans; contradicts extension-only focus | Decommission or isolate server-side Playwright scraper to synthetic fixture validation |
| **F-05** | **MEDIUM** | Unused Google GenAI dependency in production dependencies | `package.json:16` (`@google/genai: ^2.4.0`) | Creates dependency bloat and confusion over external AI service usage | Move to devDependencies or remove during next approved maintenance phase |
| **F-06** | **LOW** | Lack of automated retention lifecycle for stored leads | `src/extension/bulkStore.ts` | Leads persist indefinitely in local IndexedDB without automated TTL pruning | Add local data retention cleanup settings in UI |

---

## 10. Remediation Plan

To resolve the identified blockers and move beyond the current gate:

### Blocker 1: Platform Authorization
- **Required Evidence:** Written authorization agreement or documented API grant from Meta Platform Operations / Meta Legal permitting programmatic extraction from the Ad Library.
- **Alternative Path:** If written permission for web scraping is not granted by Meta, the product must be formally re-scoped to either:
  1. An assistive **manual research companion** (where the user manually navigates, and the tool merely assists with in-tab bookmarking/structuring without automated batch loops); or
  2. A developer tool integrating the official **Meta Ad Library API** with authorized credentials.

### Blocker 2: Product Constraint Alignment
- **Required Evidence:** Written amendment from product leadership reconciling the "Zero API" constraint with Meta's legal reality.

### Internal Constraint Remediation (High-Priority):
- Strip `optional_host_permissions: ["https://*/*"]` from `scripts/build-extension.mjs` and `src/extension/manifest.json`.
- Disconnect or remove `websiteVerifier.ts` from the core extension research pipeline to comply with the prohibition on external web crawling.
- Restrict `src/server/browserWorker.ts` exclusively to synthetic/mock fixture execution (`validationMode === 'CONTROLLED_FIXTURE'`).

---

## 11. Final Gate Decision

### **DECISION: NO-GO**

**Justification:**
1. Authoritative platform policies (Meta Terms of Service Section 3.2 and Automated Data Collection Terms) explicitly prohibit automated data collection from Meta products without prior express written permission.
2. LeadNoria has no documented written permission from Meta.
3. The project's non-negotiable constraints ban the only officially authorized mechanism for programmatic access (the Meta Ad Library API).
4. The current codebase contains active implementations that violate internal constraints (external website deep crawling in `websiteVerifier.ts`).

*Note: This NO-GO decision applies specifically to automated production data collection against Meta Ad Library. It does not prohibit non-collection engineering work, such as synthetic fixture testing, local UI development, offline data modeling, or documentation.*
