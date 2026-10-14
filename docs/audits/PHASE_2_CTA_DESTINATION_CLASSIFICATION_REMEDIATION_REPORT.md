# LeadNoria — Phase 2 Remediation Audit Report
## Meta Ad CTA & Destination Classification

**Date:** 2026-10-14
**Auditor:** Antigravity AI (Pair Programming Assistant)
**Baseline Commit:** `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f` (Phase 1 completion on `origin/main`)
**Proposed Local Version:** `1.7.7`
**Phase Scope:** Phase 2 of 14-Phase LeadNoria Roadmap (Meta Ad CTA & Destination Classification)
**Task Type:** Product-development remediation only (Zero publication, deployment, or remote Git mutations)

---

## 1. Initial Repository State

- **Branch:** `main` (tracking `origin/main`)
- **HEAD Commit:** `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f`
- **Working Tree:** Preserved all existing user research data (`.data/`), pilot logs (`test-logs/`), validation evidence (`validation-evidence/`), reports (`reports/`), and previous phase audit documentation.
- **Historical Release Archives (Verified SHA-256 Immutability):**
  - `dist/leadnoria-v1.7.5.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85`
  - `dist/leadnoria-v1.7.6.zip`: `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105`
  - `extension.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85`
- **Release Candidate (Phase 2.1 Baseline):**
  - `dist/release-candidate/leadnoria-v1.7.7-candidate.zip`: `6A99927B280F25185E5FD56BFFDFF537900900223C2C187902F3FD4CE3E0590D`

---

## 2. Findings and Root Causes

| ID | Finding | Severity | File & Function | Root Cause | Scoped Minimal Fix |
|---|---|---|---|---|---|
| **F-01** | `m.me` Messenger shortlink mapped to `UNKNOWN` (`MALFORMED_DESTINATION_URL`) | **HIGH** | `src/extension/destinationClassifier.ts` (`classifyDestination`) | `domain = u.hostname.replace(/^(?:www\\.|m\\.|l\\.)/, '')` stripped `m.` from `m.me`, leaving `me` which has no dot and failed the domain structure check. | Exempted `m.me` from `m.` stripping (`host === 'm.me' ? 'm.me' : host.replace(...)`). |
| **F-02** | Single-letter SLDs (e.g. `m.me`, `x.com`) rejected by domain regex | **MEDIUM** | `src/extension/destinationClassifier.ts` (`classifyDestination`) | Regex `/^[a-z0-9][a-z0-9\-\.]+\.[a-z]{2,}$/i` required at least 2 characters before the TLD dot (`+`). | Updated regex to `/^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+$/i` allowing valid single-letter SLDs while rejecting leading/trailing dots. |
| **F-03** | Missing destination URL defaulted to `NO_WEBSITE` in CSV export | **MEDIUM** | `src/extension/metaAdapter.ts` (`exportLeadsToCsv`) | Fallback expression `l.destinationUrl ? 'NOT_VERIFIED' : 'NO_WEBSITE'` falsely inferred that absence of an ad destination URL proved the business had no website. | Changed fallback to `'NOT_OBSERVED'` preserving explicit unobserved uncertainty. |
| **F-04** | Protocol URIs (`tel:`, `sms:`, `market:`, `itms-apps:`, `mailto:`) and pseudo-protocols unhandled | **MEDIUM** | `src/extension/destinationClassifier.ts` (`classifyDestination`) | `classifyDestination` parsed all URLs via HTTP/HTTPS assumptions, incorrectly classifying `mailto:` as `EXTERNAL_WEBSITE` and protocol schemes as `UNKNOWN`. | Added explicit scheme handlers: `tel:`/`callto:` -> `CALL`, `sms:`/`whatsapp:`/`fb-messenger:`/`tg:` -> `MESSAGING`, `market:`/`itms-apps:` -> `APP`, `mailto:` -> `OTHER`, `javascript:`/`data:`/`about:` -> `UNKNOWN`/`MALFORMED_DESTINATION_URL`. |
| **F-05** | CTA classification result lacked required Section 4 metadata | **LOW** | `src/extension/destinationClassifier.ts` (`CtaClassificationResult`), `types.ts` | Interface omitted `originalCtaText`, `status`, `confidence`, and `evidence`. | Added fields to `CtaClassificationResult` and forwarded them through `classifyCta`, `AdLevelEvidence`, `bulkStore.ts`, and `bulkProcessor.ts`. |
| **F-06** | UI Research Config and filters out of sync with canonical Destination types | **LOW** | `src/extension/ui/components/ResearchConfigView.tsx` | Select options used legacy `APP_STORE` and `WHATSAPP_MESSAGE` rather than canonical types `APP` and `SEND_MESSAGE`, missing `CONTACT_US`, `DOWNLOAD`, `GET_QUOTE`, `OTHER`. | Aligned options to canonical schema (`APP`, `OTHER`, `CONTACT_US`, etc.) and added backward-compatible migration mapping in qualification gates and aggregation pipelines. |

---

## 3. Files Changed and Why

1. **`src/extension/types.ts`**:
   - Added `normalizedCtaText?: string`, `ctaConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'`, and `ctaStatus?: string` to `AdLevelEvidence`.
2. **`src/extension/destinationClassifier.ts`**:
   - Extended `CtaClassificationResult` with `originalCtaText`, `status` (`'CLASSIFIED' | 'UNSUPPORTED' | 'MISSING' | 'AMBIGUOUS'`), `confidence` (`'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'`), and `evidence`.
   - Hardened `classifyCta` to preserve raw text, identify ambiguous action words, and output explicit status/confidence.
   - Handled protocol schemes (`tel:`, `sms:`, `market:`, `itms-apps:`, `mailto:`, `javascript:`, `data:`, `about:`).
   - Exempted `m.me` from mobile prefix stripping and hardened domain validation regex to accept single-letter SLDs while blocking malformed URLs.
   - Extended insufficient destination evidence fallback to include `DOWNLOAD` and `CONTACT_US` without URLs.
3. **`src/extension/metaAdapter.ts`**:
   - Updated `candsAdEvidence` construction to forward `normalizedCtaText`, `ctaConfidence`, and `ctaStatus`.
   - Added backward compatibility mapping (`APP_STORE` -> `APP`) in destination filter checking.
   - Corrected CSV export column fallback from `'NO_WEBSITE'` to `'NOT_OBSERVED'`.
4. **`src/extension/qualificationGate.ts`**:
   - Mapped legacy `APP_STORE` to `APP` in Gate 5 (`GATE_DESTINATION`) so legacy records/filters match canonical destination types.
5. **`src/extension/bulkStore.ts`**:
   - Updated `normalizeStoredLead` rehydration to preserve `normalizedCtaText`, `ctaConfidence`, and `ctaStatus`.
6. **`src/extension/bulkProcessor.ts`**:
   - Updated streaming processor to forward full CTA metadata in `candAdEvidenceItem` and map `APP_STORE` to `APP`.
7. **`src/extension/ui/components/ResearchConfigView.tsx`**:
   - Aligned UI dropdowns with canonical types: added `CONTACT_US`, `DOWNLOAD`, `GET_QUOTE`, `OTHER` to CTA select, and updated `APP_STORE` to `APP` with `OTHER` in destination select.
   - Normalized `APP_STORE` to `APP` in `onOpenPlanReview` payload submission.
8. **`scripts/verify-offline.mjs`**:
   - Registered `tests/test-phase02-cta-destination-remediation.mjs` into `TEST_SUITES` (total 18 suites).
9. **`tests/test-phase02-cta-destination-remediation.mjs`**:
   - Created comprehensive 20-gate regression test suite verifying all Phase 2 acceptance criteria.

---

## 4. Acceptance Criteria Checklist

| Gate | Acceptance Criterion | Status | Evidence |
|---|---|---|---|
| **01** | Support all required destination classes (`EXTERNAL_WEBSITE`, `INSTANT_FORM`, `MESSAGING`, `CALL`, `APP`, `OTHER`, `UNKNOWN`, `NO_VISIBLE_DESTINATION`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 01] |
| **02** | Missing CTA text handling (maps to `UNKNOWN`, `MISSING`, `NONE`, `CTA_TEXT_MISSING`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 02] |
| **03** | Unknown/unsupported CTA text preserves raw text (`OTHER`, `UNSUPPORTED`, `CTA_TEXT_OTHER`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 03] |
| **04** | Missing destination URL retains unknown/unverified state without inventing positive classification | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 04] |
| **05** | Malformed URLs handled safely (`MALFORMED_DESTINATION_URL`, `UNKNOWN`, `NONE`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 05] |
| **06** | External website versus Meta instant form strictly separated | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 06] |
| **07** | Messaging vs Call vs App destinations resolved via schemes & domains (`wa.me`, `m.me`, `sms:`, `tel:`, `market:`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 07] |
| **08** | Conflicting CTA and destination signals flagged (`OTHER`/`UNKNOWN`, `CONFLICTING_DESTINATION_SIGNALS`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 08] |
| **09** | CTA classification and destination classification remain independent | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 09] |
| **10** | URL-to-ad association integrity preserved across multiple ad creatives per advertiser | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 10] |
| **11** | Configured CTA filter requirements gate qualification and candidate aggregation fail-closed | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 11] |
| **12** | Configured destination filter requirements gate qualification and candidate aggregation fail-closed | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 12] |
| **13** | Unknown/unassessed evidence fails closed when a condition is required | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 13] |
| **14** | Qualification gates generate explicit reason messages explaining missing/mismatched evidence | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 14] |
| **15** | Storage and recovery persistence rehydrates and normalizes CTA & destination evidence | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 15] |
| **16** | Export field integrity preserved with CSV columns and formula sanitization | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 16] |
| **17** | Backward compatibility with existing stored records and legacy `APP_STORE` enum mapping | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 17] |
| **18** | Geographic qualification preserved (`targetCountryCode` vs `businessCountryCode`) | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 18] |
| **19** | Permanent safety gates remain fail-closed | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 19] |
| **20** | No new API, host permission, crawler, or unauthorized network dependency introduced | **PASS** | `test-phase02-cta-destination-remediation.mjs` [Gate 20] |

---

## 5. Exact Commands and Verification Results

### 1. Focused CTA, Destination & Export Test Suite
```bash
node node_modules/tsx/dist/cli.mjs tests/test-cta-destination-export.mjs
```
- **Exit Code:** `0`
- **Output:** `31 passed, 0 failed`

### 2. Dedicated Phase 2 Remediation Regression Suite
```bash
node node_modules/tsx/dist/cli.mjs tests/test-phase02-cta-destination-remediation.mjs
```
- **Exit Code:** `0`
- **Output:** `20 PASSED, 0 FAILED`

### 3. TypeScript Compiler Strictness Check
```bash
node ./node_modules/typescript/bin/tsc --noEmit
```
- **Exit Code:** `0`
- **Output:** Clean compilation, 0 diagnostics, 0 errors.

### 4. Master Automated Offline Verification Runner
```bash
node scripts/verify-offline.mjs
```
- **Exit Code:** `0`
- **Summary:**
  - Pre-run historical archive integrity: `PASS`
  - TypeScript strictness (`tsc --noEmit`): `PASS` (51.55s)
  - Safe unpacked extension build: `PASS` (0.66s)
  - Regression Test Suites Executed: **18/18 PASSED** (0 failed)
  - Post-run historical archive integrity: `PASS` (100% intact & immutable)

### 5. Git Diff Cleanliness Check
```bash
git diff --check
```
- **Exit Code:** `0`
- **Output:** No whitespace errors or conflict markers detected.

---

## 6. Safety-Gate Verification

Both mandatory fail-closed product safety invariant gates were independently tested and confirmed:
- `isLiveCollectionPermitted() === false` — **CONFIRMED FAIL-CLOSED**
- `isExternalWebsiteCrawlingPermitted() === false` — **CONFIRMED FAIL-CLOSED**
- `manifest.json` host permissions remain strictly constrained to `facebook.com` and `meta.com` (no `<all_urls>`, no external network APIs, no scraping/crawling endpoints).

---

## 7. Operational Commitments & Authorization Boundary

- **No commits:** No `git commit` was executed.
- **No pushes:** No `git push` was executed.
- **No tags:** No `git tag` was executed.
- **No publication or deployment:** No package was published, uploaded, or deployed.
- **Unrelated work preserved:** All existing user data, pilot logs, reports, and working tree files remain untouched and intact.

---

## 8. Final Verdict & Progression Recommendation

### **FINAL VERDICT: PASS**

Every Phase 2 acceptance criterion has been remediated, verified, and automated in regression testing. There are zero remaining blockers.

**Phase 3 (Next Roadmap Phase) is technically ready to begin upon user authorization.**
