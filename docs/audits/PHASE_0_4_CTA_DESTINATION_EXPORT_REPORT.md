# LEADNORIA — PHASE 0.4 AUDIT REPORT
## CTA, Destination Classification & Export Integrity

**Date:** 2026-10-12  
**Baseline:** v1.7.6 (`3b03f612b2565718b18360baf2c83844006f5970`) + Phases 0.1, 0.2, 0.3  
**Status:** COMPLETE (STOP CONDITION REACHED)  
**Production Collection Authorization:** NOT ESTABLISHED (Safety Lock Active)  

---

## 1. Executive Summary

Phase 0.4 addressed critical modeling and export integrity defects identified in the Phase 0 audit:
1. **Decoupled CTA Intent from Destination Type:** Previously, `websiteState` was modeled solely on the presence or absence of a destination URL, causing missing URLs to be misclassified as proof that no website exists (`not_found`). In addition, CTA labels like `Shop Now` or `Learn More` were conflated with external website existence. CTA (`CtaType`) and technical destination endpoint (`DestinationType`) are now modeled as strictly independent concepts.
2. **Deterministic Evidence-Based Classification:** Introduced `classifyCta()` and `classifyDestination()` with explicit reason codes (`CTA_TEXT_MATCH`, `VISIBLE_EXTERNAL_DESTINATION`, `EXPLICIT_MESSAGING_SIGNAL`, `EXPLICIT_INSTANT_FORM_SIGNAL`, `EXPLICIT_CALL_SIGNAL`, `INSUFFICIENT_DESTINATION_EVIDENCE`, `CONFLICTING_DESTINATION_SIGNALS`, `DESTINATION_NOT_OBSERVED`). SHOP_NOW or LEARN_MORE alone without destination URLs no longer fabricates `EXTERNAL_WEBSITE`.
3. **Preserved Ad-Level Evidence Across Entity Merges:** Previously, `mergeCandidateIntoEntity` in `src/extension/entityResolver.ts` preserved only a single `sampleCta`, discarding creative variations. `ExtensionLead` now persists an immutable array `adEvidence: AdLevelEvidence[]`, recording distinct ad library IDs, raw CTAs, normalized CTA types, destination endpoints, reason codes, confidence, and observation timestamps.
4. **Repaired Critical CSV Export Promotion Defect:** Confirmed and fixed the severe bug in `src/extension/metaAdapter.ts` line 1148 (`l.relevanceDecision || 'RELEVANT'`). Unevaluated candidates are now explicitly exported as `UNASSESSED` (never silently promoted to `RELEVANT`), defaulting relevance score to `N/A` and confidence to `NONE`.
5. **Enforced Configurable Qualification Filters:** Added `requiredCtaTypes` and `requiredDestinationTypes` to `ResearchIntent`. Enforced these filters fail-closed during aggregation and export.
6. **Zero Live Collection / Offline Integrity:** Completed purely with local deterministic logic and offline test suites. All 8 regression test suites passed with 100% success rate (199 passing assertions across all suites).

---

## 2. Baseline & Working-Tree Status

- **Git Commit:** `3b03f612b2565718b18360baf2c83844006f5970` (`main` branch)
- **Phase 0.1 Safety Locks:** Verified active and unbypassed (`isLiveCollectionPermitted()` and `isExternalWebsiteCrawlingPermitted()` return `false`).
- **Preserved User Modifications:** The 6 pre-existing modified files remain completely untouched:
  - `test-logs/phase29-production-observation-log.json`
  - `tests/test-phase27-production-pilot.mjs`
  - `tests/test-phase28-release-operations.mjs`
  - `tests/test-phase30-production-analytics.mjs`
  - `tests/test-phase31-research-optimization.mjs`
  - `tests/test-phase32-reliability-growth-readiness.mjs`
- **Release Archive Integrity:** Verified bit-for-bit SHA-256 match before and after the phase:
  - `dist/leadnoria-v1.7.5.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85`
  - `dist/leadnoria-v1.7.6.zip`: `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105`
  - `extension.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85`

---

## 3. Existing Architecture Audit vs. Verified Reality

| Baseline Hypothesis | Audit Finding | Verification Status | Remedy Applied |
| :--- | :--- | :--- | :--- |
| `websiteState` modeled solely on destination URL presence | Confirmed. Ads without extracted URLs were stamped `websiteState: 'not_found'`, asserting no website exists. | **CONFIRMED** | Stamped `websiteState: 'unknown'` unless explicit absence (`NO_VISIBLE_DESTINATION`) is observed. |
| Inadequate destination type modeling | Confirmed. Destination was only an unclassified string URL. Instant forms, WhatsApp chats, app store downloads, and calls were not differentiated. | **CONFIRMED** | Introduced `DestinationType` enum and classifier supporting 8 discrete states. |
| Entity merge discards ad-level evidence | Confirmed. Single `sampleCta` and `sampleCopy` overwritten or kept first occurrence only. Multiple ads under same advertiser lost creative evidence. | **CONFIRMED** | Added `adEvidence: AdLevelEvidence[]` tracking each ad individually. |
| Export defaults unevaluated relevance to `RELEVANT` | Confirmed. `src/extension/metaAdapter.ts` had `l.relevanceDecision || 'RELEVANT'`, promoting unassessed leads to 100% relevant. | **CONFIRMED** | Replaced with `l.relevanceDecision || 'UNASSESSED'`, score `N/A`, confidence `NONE`. |

---

## 4. Data Contract Specifications

### A. CTA Model
```typescript
export type CtaType =
  | 'SHOP_NOW'
  | 'LEARN_MORE'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'SEND_MESSAGE'
  | 'CALL_NOW'
  | 'DOWNLOAD'
  | 'GET_QUOTE'
  | 'OTHER'
  | 'UNKNOWN';
```

### B. Destination Model
```typescript
export type DestinationType =
  | 'EXTERNAL_WEBSITE'
  | 'INSTANT_FORM'
  | 'MESSAGING'
  | 'CALL'
  | 'APP'
  | 'OTHER'
  | 'UNKNOWN'
  | 'NO_VISIBLE_DESTINATION';
```

### C. Ad-Level Evidence
```typescript
export interface AdLevelEvidence {
  libraryId: string;
  ctaText?: string;
  ctaType: CtaType;
  destinationType: DestinationType;
  destinationUrl?: string;
  destinationDomain?: string;
  reasonCode: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  observedAt: string;
}
```

### D. Relevance Decision
```typescript
export type RelevanceDecision = 'RELEVANT' | 'UNCERTAIN' | 'NOT_RELEVANT' | 'UNASSESSED';
```

---

## 5. Classification Rules & Evidence Engine

Implemented in `src/extension/destinationClassifier.ts`:

1. **CTA Normalization (`classifyCta`)**:
   - Preserves original raw CTA text (`rawCtaText`).
   - Normalizes Unicode and whitespace.
   - Punctuation-tolerant regex matching (`Shop Now!` -> `SHOP_NOW`, `Send WhatsApp Message` -> `SEND_MESSAGE`).
   - Unrecognized non-empty text maps to `OTHER` with `CTA_TEXT_OTHER`.
   - Empty/missing text maps to `UNKNOWN` with `CTA_TEXT_MISSING`.

2. **Destination Classification (`classifyDestination`)**:
   - Technical URLs evaluated without external requests or redirects.
   - WhatsApp (`wa.me`, `whatsapp.com`) & Messenger -> `MESSAGING` with `EXPLICIT_MESSAGING_SIGNAL` (HIGH confidence).
   - Google Play / Apple App Store -> `APP` with `EXPLICIT_APP_SIGNAL` (HIGH confidence).
   - Instant Forms (`/lead_gen/`, `/canvas_doc/`, `instant_form`) -> `INSTANT_FORM` with `EXPLICIT_INSTANT_FORM_SIGNAL` (HIGH confidence).
   - Independent commercial domains -> `EXTERNAL_WEBSITE` with `VISIBLE_EXTERNAL_DESTINATION` (HIGH confidence).
   - Direct call CTA without URL -> `CALL` with `EXPLICIT_CALL_SIGNAL` (MEDIUM confidence).
   - Explicit absence flag -> `NO_VISIBLE_DESTINATION` with `DESTINATION_NOT_OBSERVED` (HIGH confidence).
   - Conflicting signals (e.g. ad marked no destination but URL exists) -> `UNKNOWN` with `CONFLICTING_DESTINATION_SIGNALS` (LOW confidence).
   - Missing URL with `SHOP_NOW` or `LEARN_MORE` -> `UNKNOWN` with `INSUFFICIENT_DESTINATION_EVIDENCE` (LOW confidence). *Does NOT fabricate EXTERNAL_WEBSITE.*

3. **Deterministic Aggregation Precedence**:
   `EXTERNAL_WEBSITE` (7) > `INSTANT_FORM` (6) > `MESSAGING` (5) > `CALL` (4) > `APP` (3) > `OTHER` (2) > `NO_VISIBLE_DESTINATION` (1) > `UNKNOWN` (0).

---

## 6. Entity Merge & Evidence Preservation

In `src/extension/entityResolver.ts` (`mergeCandidateIntoEntity`):
- When an incoming ad candidate matches an existing advertiser entity, its individual creative evidence is classified and appended to `target.adEvidence`.
- Deduplicated by `libraryId`: multiple observations of the same ad update or retain the existing ad evidence without unbounded duplication.
- Distinct ads under the same advertiser retain their own individual `ctaType` and `destinationType`.
- Aggregated roll-up properties (`observedCtaTexts`, `observedCtaTypes`, `observedDestinationTypes`, `primaryCtaType`, `primaryDestinationType`) are recomputed deterministically using the defined precedence rules.
- Legacy display fields (`sampleCta`, `sampleCopy`) remain populated for backward compatibility but are no longer the exclusive store of creative data.

---

## 7. Qualification Gates & Export Integrity

1. **Qualification Gate Enforcement**:
   - `ResearchIntent` supports `requiredCtaTypes?: CtaType[]` and `requiredDestinationTypes?: DestinationType[]`.
   - In `aggregateCandidatesToLeads` and `bulkProcessor.ts`: candidates failing configured CTA or Destination criteria are rejected with reason codes `CTA_FILTER_MISMATCH` and `DESTINATION_FILTER_MISMATCH`.
   - Missing or `UNKNOWN` destinations do not satisfy specific criteria (e.g. `EXTERNAL_WEBSITE`).
2. **Export Qualification Repair**:
   - Defect fixed: Unevaluated leads exported without a relevance assessment export as `UNASSESSED` (never `RELEVANT`), with score `N/A` and confidence `NONE`.
   - New columns added to CSV/TSV: `CTA Type`, `Destination Type`, `Destination Confidence`, `Destination Reason`.
   - Formula injection protection verified: escapes leading `=`, `+`, `-`, `@`, `\t`, `\r` by prefixing a single-quote (`'`).
   - Qualified-only export (`qualifiedOnly: true`) enforces strict geographic gates (`LOCAL_VERIFIED` only, rejecting `FOREIGN_VERIFIED`, `LOCATION_UNKNOWN`, and `LOCAL_PROBABLE`).

---

## 8. Files Changed and Reasons

| File | Change Description |
| :--- | :--- |
| `src/extension/types.ts` | Added `CtaType`, `DestinationType`, `DestinationConfidence`, `AdLevelEvidence`, `RelevanceDecision`. Extended `ScrapedAdCandidate` and `ExtensionLead` with CTA and destination fields. |
| `src/extension/destinationClassifier.ts` | **NEW MODULE:** Deterministic pure local classification of CTA text, technical destination endpoint, and multi-ad roll-up aggregation. |
| `src/extension/relevanceEngine.ts` | Added `requiredCtaTypes` and `requiredDestinationTypes` to `ResearchIntent`. Made `compileResearchIntent` accept options config or positional arguments. |
| `src/extension/entityResolver.ts` | Preserved ad-level evidence in `mergeCandidateIntoEntity` via `adEvidence` array deduplicated by `libraryId`. Aggregated advertiser-level CTA & destination intelligence. |
| `src/extension/metaAdapter.ts` | Fixed `l.relevanceDecision || 'RELEVANT'` export defect. Added CTA and destination columns to CSV export. Enforced CTA/destination filtering and ad-level evidence retention in `aggregateCandidatesToLeads`. |
| `src/extension/bulkProcessor.ts` | Evaluated CTA/destination per candidate, populated `adEvidence`, enforced qualification filters, and avoided defaulting unevaluated leads to `RELEVANT`. |
| `tests/test-cta-destination-export.mjs` | **NEW TEST SUITE:** Comprehensive offline suite with 31 assertions covering CTA classification, destination classification, entity merge evidence preservation, qualification filters, and export integrity. |

---

## 9. Offline Test Matrix & Exact Results

All tests executed offline via `node ./node_modules/tsx/dist/cli.mjs`:

| Test Suite File | Command Line | Passed | Failed | Status |
| :--- | :--- | :---: | :---: | :---: |
| `tests/test-cta-destination-export.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-cta-destination-export.mjs` | 31 | 0 | **PASS** |
| `tests/test-geographic-accuracy.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-geographic-accuracy.mjs` | 16 | 0 | **PASS** |
| `tests/test-global-country-profiles.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-global-country-profiles.mjs` | 15 | 0 | **PASS** |
| `tests/test-strict-gate-v2.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-strict-gate-v2.mjs` | 45 | 0 | **PASS** |
| `tests/test-phase01-safety-lock.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-phase01-safety-lock.mjs` | 14 | 0 | **PASS** |
| `tests/test-relevance-engine.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-relevance-engine.mjs` | 37 | 0 | **PASS** |
| `tests/test-entity-resolution.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-entity-resolution.mjs` | 21 | 0 | **PASS** |
| `tests/test-evidence-waterfall.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-evidence-waterfall.mjs` | 20 | 0 | **PASS** |
| **TOTAL** | — | **199** | **0** | **100% PASS** |

---

## 10. Remaining Limitations & Next Phase Recommendations

1. **DOM Scraper Creative Extraction**: The content script currently extracts the first CTA element it sees on a candidate card. Expanding card DOM traversal to capture auxiliary carousel slide CTAs will provide richer ad-level evidence once live collection permissions are established.
2. **Deep Link Shim Unwrapping**: Meta wraps outbound links in `facebook.com/l.php?u=...`. While decoded in `destinationClassifier.ts` via regex/URL params offline, edge cases involving nested tracking shims can be further expanded.
3. **Recommended Next Phase:** **Phase 0.5 — Extension UI, Storage Normalization & Production Review Gate** before any consideration of live environment collection authorization.
