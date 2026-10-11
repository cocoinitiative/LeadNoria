# LeadNoria v1.7.6 — Release Candidate Validation Report

**Date:** 2026-10-11  
**Target Repository:** `https://github.com/nafiz-pranto/LeadNoria`  
**Base Commit (HEAD):** `f0c5ce2017055d918072f63cd5db1dce402c00b6`  
**Branch:** `main` (synchronized with `origin/main`)  
**Package Version:** `1.7.6`  
**Release Candidate Artifact:** `dist/leadnoria-v1.7.6.zip`  
**Verdict:** `PASS — RELEASE CANDIDATE BUILT AND VALIDATED`

---

## 1. Executive Summary

LeadNoria `v1.7.6` was packaged, verified, and validated as an independent release candidate containing the geographic accuracy hardening, multi-level pipeline accounting reconciliation, and capacity expansion committed to GitHub under commit `f0c5ce2`.

All historical release archives were strictly protected and remain byte-for-byte intact. The compiled v1.7.6 package was subjected to:
1. Full TypeScript compile checks (`tsc --noEmit`).
2. Comprehensive unit and regression suites covering geographic accuracy, strict relevance gating, build drift detection, defect repairs, and permission boundaries.
3. Live real-browser end-to-end testing in Chromium against the public Meta Ad Library across three production scenarios (Furniture, Sofa, Office Furniture in Bangladesh).
4. Direct extension installation and service-worker lifecycle verification from the unpacked release package.

---

## 2. Release Artifact & Historical Integrity

### A. New Release Candidate Package
- **Path:** `dist/leadnoria-v1.7.6.zip`
- **Byte Size:** `357,748 bytes` (349.4 KB)
- **SHA-256 Hash:** `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105`
- **Manifest Version:** `1.7.6` (`manifest_version: 3`)
- **Package File Count:** 12 files (100% verified source-to-archive parity)
- **Included Production Files:**
  1. `app.js` (UI bundle)
  2. `content-script.js` (ad card extraction)
  3. `service-worker.js` (background worker & geographic classifier)
  4. `styles.css` (Tailwind & extension styles)
  5. `manifest.json` (extension manifest v1.7.6)
  6. `popup.html` (fixed popup container)
  7. `sidepanel.html` (responsive side panel)
  8. `icons/icon-16.png`
  9. `icons/icon-32.png`
  10. `icons/icon-48.png`
  11. `icons/icon-128.png`
  12. `icons/icon-256.png`
- **Exclusion Integrity:** Excluded all test scripts, markdown docs, scratch files, development configs, and node_modules. Zero Google Maps functionality included.

### B. Historical Archive Protection
Both historical baseline archives were checked before and after build/testing. Neither archive was altered or overwritten:
- `dist/leadnoria-v1.7.5.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` (354,168 bytes — **UNCHANGED**)
- `extension.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` (354,168 bytes — **UNCHANGED**)

---

## 3. Version Metadata Consistency

The version was bumped from `1.7.5` to `1.7.6` across authoritative locations:
- `package.json`: `"version": "1.7.6"`
- `src/extension/manifest.json`: `"version": "1.7.6"`
- `extension/manifest.json`: `"version": "1.7.6"`
- `scripts/build-extension.mjs`: Configured to generate `dist/leadnoria-v1.7.6.zip` while freezing historical v1.7.5 archives.

---

## 4. Automated Regression & Quality Test Results

| Test Suite | Commands / Script | Result | Assertions / Cases |
| :--- | :--- | :---: | :---: |
| **TypeScript Type Check** | `npm.cmd run lint` (`tsc --noEmit`) | **PASS** | 0 errors |
| **Geographic Accuracy Suite** | `tests/test-geographic-accuracy.mjs` | **PASS** | 16 / 16 passed |
| **Strict Relevance Gate V2** | `tests/test-strict-gate-v2.mjs` | **PASS** | 45 / 45 passed |
| **Extraction Failure & Status** | `tests/test-extraction-failure-reporting.mjs` | **PASS** | 15 / 15 passed |
| **Build Drift Detection** | `tests/test-build-drift-detection.mjs` | **PASS** | 23 / 23 passed |
| **Defect Repair & Behavioral** | `tests/test-v173-defect-repair-and-validation.mjs` | **PASS** | 25 / 25 passed |
| **Permissions & Safety Audit** | `tests/test-prompt51-permission-reconciliation.mjs` | **PASS** | 14 / 14 passed |

---

## 5. Live Real-Browser Validation in Chromium

Conducted using Playwright with the real unpacked v1.7.6 extension loaded into Chromium against live Meta Ad Library.

### Live Scenario Execution Summary

| Metric | Scenario A: Furniture | Scenario B: Sofa | Scenario C: Office Furniture | Total / Aggregate |
| :--- | :---: | :---: | :---: | :---: |
| **Target Country** | Bangladesh (`BD`) | Bangladesh (`BD`) | Bangladesh (`BD`) | `BD` |
| **Budget Ceiling** | 25 leads | 25 leads | 25 leads | 75 leads |
| **Raw Cards Observed** | 218 | 291 | 275 | **784** |
| **Unique Valid Ad IDs** | 51 | 13 | 50 | **114** |
| **Unique Entities Evaluated** | 135 | 159 | 160 | **454** |
| **Total Qualified Leads** | 25 | 9 | 21 | **55** |
| **LOCAL_VERIFIED** | 0 | 0 | 0 | **0** |
| **LOCAL_PROBABLE** | 4 | 3 | 7 | **14** |
| **FOREIGN_VERIFIED** | 11 | 3 | 8 | **22** |
| **LOCATION_UNKNOWN** | 10 | 3 | 6 | **19** |
| **Stored Lead Records** | 25 | 9 | 21 | **55** |
| **Exported CSV Rows** | 25 | 9 | 21 | **55** |
| **Storage / Export Parity** | 100% (`true`) | 100% (`true`) | 100% (`true`) | **100%** |
| **Formula-Safe CSV** | `true` | `true` | `true` | **100%** |
| **Stop Reason** | `TARGET_REACHED` | `BUDGET_TIME_ELAPSED` | `BUDGET_TIME_ELAPSED` | — |
| **Elapsed Time** | 68.8s | 73.5s | 75.2s | 217.5s |

### Geographic Classification Breakdown & Observations
1. **Separation of Target vs Physical Location:**
   - Meta search targeted Bangladesh (`targetCountryCode: "BD"`).
   - The classifier never conflated `targetCountryCode` with `businessCountryCode`.
   - International advertisers running ads targeting Bangladesh were accurately classified as `FOREIGN_VERIFIED`:
     - *Fairway Furniture*: `businessCountryCode: GB`, Reason: North Devon, UK mention.
     - *Dreamline Outdoor Furniture*: `businessCountryCode: IN`, Reason: Jaipur, India mention.
     - *Hospitality Furniture Concepts*: `businessCountryCode: AU`, Domain: `.net.au`.
     - *Amazon India*: `businessCountryCode: IN`, Domain: `amazon.in`.
2. **Honest Domestic Evidence Evaluation:**
   - Public ad creative text rarely contains full corporate street addresses or `+880` international prefixes.
   - Domestic businesses mentioning local cities (Dhaka, Chittagong, Sylhet) or `.com.bd` domains are classified as `LOCAL_PROBABLE` (14 leads).
   - Zero businesses were falsely escalated to `LOCAL_VERIFIED` without explicit telephone or physical registry proof, guaranteeing data integrity.
3. **Capacity Hardening Verification:**
   - Scenario A collected **25 leads**, reaching the target budget and conclusively confirming the removal of the old 6-lead cap.
   - Scenario C collected **21 leads** within 75 seconds.

---

## 6. Known Limitations & Diagnostic Findings

1. **Local-Business Verification in Ad Copy:**
   Because public ad cards prioritize concise marketing copy over full legal addresses, 0 leads reached `LOCAL_VERIFIED`. They legitimately remain `LOCAL_PROBABLE`. Authoritative verification requires deep website crawling or external business registry lookup.
2. **Automated Popup Screenshot Investigation & Resolution:**
   - *Investigation:* In `popup.html`, `<div id="root"></div>` is present in the static HTML before React mounts. The earlier test script waited on `#root, main, div`, which immediately satisfied Playwright before React hydrated the tree, resulting in a pre-render shell (1.9 KB).
   - *Resolution:* Created `scripts/verify-extension-ui.mjs` which explicitly waits for child elements (`#root > div`, `header`, `button`, `main`). When asserting rendered child elements, the popup and side panel render completely, yielding verified screenshots:
     - `v176-popup-rendered-verified.png`: 40.1 KB
     - `v176-sidepanel-rendered-verified.png`: 43.7 KB
   - Live Meta tabs were cleanly captured at full resolution (157 KB – 334 KB).

---

## 7. Working-Tree & Git State

### Pre-existing Files Preserved Untouched (6 Tracked Files):
1. `test-logs/phase29-production-observation-log.json`
2. `tests/test-phase27-production-pilot.mjs`
3. `tests/test-phase28-release-operations.mjs`
4. `tests/test-phase30-production-analytics.mjs`
5. `tests/test-phase31-research-optimization.mjs`
6. `tests/test-phase32-reliability-growth-readiness.mjs`

### Version Preparation Changes:
- `package.json` (version 1.7.6)
- `src/extension/manifest.json` (version 1.7.6)
- `scripts/build-extension.mjs` (packaging v1.7.6 package; preserving v1.7.5 archives)
- `tests/test-build-drift-detection.mjs` (checks active v1.7.6 while asserting historical mirror integrity)
- `tests/test-v173-defect-repair-and-validation.mjs` (accepts version 1.7.6)
- `extension/` (compiled unpacked extension v1.7.6)
- `dist/leadnoria-v1.7.6.zip` (new release candidate archive)

### Untracked Artifacts Retained:
- `validation-evidence/v1.7.6-release-candidate/` (all logs, exports, and screenshots)
- Historical audit reports and evidence directories remain intact.

---

## 8. Release Authorization Readiness

The release candidate `dist/leadnoria-v1.7.6.zip` is completely built, verified against automated test suites, and validated through real Chrome execution against Meta Ad Library.

**Current Git Status:**
- Zero commits created.
- Zero tags created.
- Zero Git pushes executed.
- Ready for explicit user authorization before staging, committing, tagging, or releasing.
