# LEADNORIA — PHASE 0.2: TEST BASELINE REPAIR REPORT
**Mode:** Controlled implementation with regression tests (Offline Only)  
**Baseline:** v1.7.6 + Phase 0.1 Safety Lock Changes  
**Commit:** `3b03f612b2565718b18360baf2c83844006f5970`  
**Execution Date:** 2026-10-12  
**Safety Status:** PASS — Zero network calls, Zero live collection, Collection Safety Lock intact  

---

## 1. Executive Summary

Phase 0.2 investigated, reproduced, and repaired all verified offline test failures reported in the Phase 0 Baseline Audit without weakening production validation, without introducing external services or APIs, and without relaxing the Phase 0.1 collection safety locks.

Three distinct offline test failures were targeted:
1. `tests/test-relevance-engine.mjs` — Suite 4 entity multi-ad aggregation failure (`rflLead.activeAdCount === 2 (got 0)`).
2. `tests/test-entity-resolution.mjs` — Scenario J deduplication failure (`rflEntity?.adCount === 3 (got 0)`).
3. `tests/test-evidence-waterfall.mjs` — Scenario 16 localized local-language failure (`case16.decision === 'RELEVANT' (got 'UNCERTAIN')`).

All three failures were successfully reproduced under offline conditions, their precise technical root causes established, and minimal surgical remediations implemented:
- **Mock ID Validation Mismatch:** The production validation rules (`/^[0-9]{5,25}$/` and `sanitizeAdLibraryIds`) correctly model real Meta Ad Library numeric identifier formats (15–16 digit strings). The test suites previously used 4-digit numeric strings (`1001`, `1002`) or non-numeric alphanumeric synthetic strings (`ad_rfl_1`, `ad_res_1`, `ad_pres_1`), which were filtered out by production ID sanitizers. The production validators were **strictly preserved without relaxation**. Synthetic test fixtures were updated to realistic 15-digit numeric strings satisfying the invariant.
- **Bengali Tokenization & Taxonomy Gap:** The tokenizer (`tokenizeText` in `src/extension/relevanceEngine.ts`) stripped combining marks (`\p{M}`) by using `[^\p{L}\p{N}\s-]`. In Unicode, Indic/Bengali vowel diacritics (*kar* marks like া, ি, ী, ু, ূ, ৃ, ে, ৈ, ো, ৌ) and viramas/hasant (্) are classed as `\p{M}` (Mark), not `\p{L}` (Letter). Stripping marks fragmented every Bengali word into single letters separated by whitespace, which were then discarded by the `< 2` character filter (`'ফার্নিচার'` became `[]`). In addition, `BOUNDED_TAXONOMY.furniture` lacked localized Bengali root and product terms mapped in `queryPlanner.ts`. Adding `\p{M}` and `normalize('NFC')` to `tokenizeText` and incorporating verified localized terms resolved the issue cleanly while preserving existing English and multi-category behavior.

All 6 safe regression suites now execute offline with **100% pass rates** (153 total assertions across all suites passed).

---

## 2. Repository Baseline and Working-Tree Status

### 2.1 Git Status & Commit Baseline
- **Branch:** `main`
- **Commit:** `3b03f612b2565718b18360baf2c83844006f5970`
- **Porcelain Working-Tree State:**
```text
 M scripts/build-extension.mjs
 M src/extension/manifest.json
 M src/extension/relevanceEngine.ts
 M src/extension/service-worker.ts
 M src/extension/websiteVerifier.ts
 M src/server/app.ts
 M src/server/browserWorker.ts
 M test-logs/phase29-production-observation-log.json
 M tests/test-entity-resolution.mjs
 M tests/test-evidence-waterfall.mjs
 M tests/test-phase27-production-pilot.mjs
 M tests/test-phase28-release-operations.mjs
 M tests/test-phase30-production-analytics.mjs
 M tests/test-phase31-research-optimization.mjs
 M tests/test-phase32-reliability-growth-readiness.mjs
 M tests/test-relevance-engine.mjs
?? docs/
?? reports/
?? scripts/
?? src/config/collectionGate.ts
?? tests/test-phase01-safety-lock.mjs
?? validation-evidence/
```

### 2.2 Preserved Known Pre-Existing Modified Files
The six known user-modified files remain intact and untouched:
1. `test-logs/phase29-production-observation-log.json` — Untouched
2. `tests/test-phase27-production-pilot.mjs` — Untouched
3. `tests/test-phase28-release-operations.mjs` — Untouched
4. `tests/test-phase30-production-analytics.mjs` — Untouched
5. `tests/test-phase31-research-optimization.mjs` — Untouched
6. `tests/test-phase32-reliability-growth-readiness.mjs` — Untouched

### 2.3 Historical Archive Immutability & Hash Verification
The historical release ZIP archives were verified via SHA-256 before and after execution. None were modified, re-compressed, or touched:

| Archive Path | Expected SHA-256 | Verified Post-Repair SHA-256 | File Size (Bytes) | Integrity Status |
|---|---|---|---|---|
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | 354,168 | **MATCH / UNCHANGED** |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | 357,748 | **MATCH / UNCHANGED** |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | 354,168 | **MATCH / UNCHANGED** |

---

## 3. Failure Reproduction and Root Cause Analysis

### 3.1 Failure 1: `tests/test-relevance-engine.mjs`
- **Classification:** CONFIRMED
- **Reproduction Output:**
  ```text
  AssertionError [ERR_ASSERTION]: RFL Furniture merged 2 ads (got 0)
      at testAssert (file:///tests/test-relevance-engine.mjs:19:3)
      at file:///tests/test-relevance-engine.mjs:640:1
  ```
- **Root Cause Analysis:**
  In `src/extension/metaAdapter.ts`:
  ```typescript
  // Line 971:
  const rawAdIds = Array.from(new Set(cands.map(c => c.libraryId).filter(id => /^[0-9]{5,25}$/.test(id))));
  const adIds = sanitizeAdLibraryIds(rawAdIds);
  ```
  The test candidate fixtures in `tests/test-relevance-engine.mjs:559-607` provided 4-digit mock IDs:
  - `libraryId: '1001'` (4 digits)
  - `libraryId: '1002'` (4 digits)
  - `libraryId: '2001'` (4 digits)
  - `libraryId: '3001'` (4 digits)
  - `libraryId: '4001'` (4 digits)
  
  Because 4 digits is strictly less than the minimum 5 digits required by `/^[0-9]{5,25}$/`, every candidate ID was rejected during extraction. Consequently, `rawAdIds` was empty `[]`, resulting in `rflLead.activeAdCount === 0` and failing assertion line 640.
- **Production Validation Integrity:** Real Meta Ad Library Archive IDs are 15- to 16-digit numeric integer strings (e.g., `884910284910281`). The `/^[0-9]{5,25}$/` validation regex introduced in v1.7.5 hardening is correct. Lowering the production threshold to 4 digits would risk accepting corrupted or truncated DOM artifact strings. The production validator was **preserved without change**.

---

### 3.2 Failure 2: `tests/test-entity-resolution.mjs`
- **Classification:** CONFIRMED
- **Reproduction Output:**
  ```text
  [FAIL] [Scenario J] 3 distinct queries (Furniture, Sofa, Furniture Store) finding RFL Furniture
     Expected: ONE FINAL ENTITY with matchedQueries = [Furniture, Sofa, Furniture Store] and adCount = 3
     Actual:   entitiesCount: 1, matchedQueries: ["Furniture","Sofa","Furniture Store"], adCount: 0
  AssertionError [ERR_ASSERTION]: Failed [Scenario J]: 3 distinct queries (Furniture, Sofa, Furniture Store) finding RFL Furniture
      at check (file:///tests/test-entity-resolution.mjs:66:10)
      at runEntityResolutionTests (file:///tests/test-entity-resolution.mjs:478:5)
  ```
- **Root Cause Analysis:**
  In `src/extension/entityResolver.ts`:
  ```typescript
  // Lines 563-569:
  if (/^[0-9]{5,25}$/.test(cand.libraryId) && !target.adLibraryIds.includes(cand.libraryId)) {
    target.adLibraryIds.push(cand.libraryId);
  }
  target.adLibraryIds = sanitizeAdLibraryIds(target.adLibraryIds);
  target.adCount = target.adLibraryIds.length;
  ```
  Scenario J (lines 432, 448, 464) provided alphanumeric mock IDs:
  - `libraryId: 'ad_rfl_1'`
  - `libraryId: 'ad_rfl_2'`
  - `libraryId: 'ad_rfl_3'`
  
  Query 1 initialized the entity with `adLibraryIds: ['ad_rfl_1']`. During Queries 2 and 3, `mergeCandidateIntoEntity` executed. Because `'ad_rfl_1'`, `'ad_rfl_2'`, and `'ad_rfl_3'` fail `/^[0-9]{5,25}$/`, `sanitizeAdLibraryIds` purged all invalid IDs from `target.adLibraryIds`. `target.adCount` was reset to `target.adLibraryIds.length`, which evaluated to `0`.
  Subsequent scenarios with similar non-numeric IDs in `mergeCandidateIntoEntity` (Scenario L with `ad_res_1`/`ad_res_2` and Scenario T with `ad_pres_1`/`ad_pres_2`) would have encountered the identical defect once Scenario J was unblocked.
- **Production Validation Integrity:** Production identity merge logic enforces `activeAdCount = deduplicatedValidIds.length` to avoid metric inflation. Updating the test fixture IDs to realistic numeric strings resolved the issue while strictly upholding production data integrity.

---

### 3.3 Failure 3: `tests/test-evidence-waterfall.mjs`
- **Classification:** CONFIRMED
- **Reproduction Output:**
  ```text
  [FAIL] [Scenario 16] Bengali script advertiser and copy accepted under Bengali intent -> Expected: RELEVANT
  ADVERSARIAL SUITE COMPLETED: 19/20 PASSED
  AssertionError [ERR_ASSERTION]: All 20 adversarial scenarios must pass cleanly: 19 !== 20
      at file:///tests/test-evidence-waterfall.mjs:286:8
  ```
- **Root Cause Analysis:**
  Scenario 16 evaluates:
  ```javascript
  const case16 = evaluateStrictRelevanceV3({
    advertiserName: 'আরএফএল ফার্নিচার',
    adText: 'সেরা ডাইনিং চেয়ার ও খাট কিনুন বিশেষ ছাড়ে। এখনই অর্ডার করুন।',
    destinationUrl: 'https://rflbd.example.com/furniture',
    destinationDomain: 'rflbd.example.com',
    ctaText: 'Shop Now',
    matchedKeyword: 'ফার্নিচার'
  }, compileResearchIntent('CUSTOM', ['ফার্নিচার', 'Furniture'], undefined, 'BD'));
  ```
  The failure was caused by a combination of two root factors:
  1. **Unicode Regex Combining Mark Stripping:**
     `tokenizeText` in `src/extension/relevanceEngine.ts` used:
     ```typescript
     text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/)
     ```
     In Unicode, Bengali vowels (*kar* signs: া, ি, ী, ু, ূ, ৃ, ে, ৈ, ো, ৌ), viramas (্), and nasal marks are categorized as `\p{M}` (Mark / Combining Characters), **not** `\p{L}` (Letter). The regex stripped every vowel mark and virama, replacing them with whitespace:
     - `'ফার্নিচার'` became `'ফ'`, `' '`, `'র'`, `' '`, `'ন'`, `' '`, `'চ'`, `' '`, `'র'`
     - Filter `w.length >= 2` then discarded every single character, causing `tokenizeText('ফার্নিচার')` to return `[]` (empty array).
     - Ad copy tokens for `'ডাইনিং'`, `'চেয়ার'`, `'খাট'` were similarly fragmented into single letters and discarded.
  2. **Taxonomy Locale Alignment:**
     `BOUNDED_TAXONOMY.furniture` in `relevanceEngine.ts` only contained English `rootTerms` (`furniture`, `furnishing`) and English `productServiceTerms` (`chair`, `table`, `bed`). Even though `queryPlanner.ts:68` defines `BD: ['ফার্নিচার', 'আসবাবপত্র']`, the taxonomy engine lacked localized Bengali root and product terms. As a result, `'আরএফএল ফার্নিচার'` failed `hasCoreVerticalInName` and was classified only as a moderate product term, while ad copy containing `'ডাইনিং চেয়ার ও খাট'` produced no product signals.

  With `\p{M}` combining mark preservation and localized taxonomy terms added:
  - `tokenizeText('ফার্নিচার')` -> `['ফার্নিচার']`
  - `tokenizeText` on copy -> preserves `['সেরা', 'ডাইনিং', 'চেয়ার', 'খাট', 'কিনুন', 'বিশেষ', 'ছাড়ে', 'এখনই', 'অর্ডার', 'করুন']`
  - Entity recognized as `SIGNAL_ENTITY_NAME_EXACT` (`STRONG`)
  - Product catalog recognized as `SIGNAL_COPY_PRODUCT_CATALOG` (`STRONG`)
  - Evaluated as `RELEVANT`, `HIGH` confidence, score `0.73`.

---

## 4. Changes Implemented

### 4.1 Production Code Changes
Only **one** production file was modified (`src/extension/relevanceEngine.ts`):

#### `src/extension/relevanceEngine.ts`
1. **Unicode Combining Mark Preservation (`tokenizeText`):**
   ```typescript
   export function tokenizeText(text: string): string[] {
     if (!text) return [];
     return text
       .normalize('NFC')
       .toLowerCase()
       .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ')
       .split(/[\s-]+/)
       .map(w => w.trim())
       .filter(w => w.length >= 2 && !STOP_WORDS.has(w))
       .map(stemToken);
   }
   ```
   - Added `.normalize('NFC')` to ensure canonical composition of Unicode glyphs.
   - Added `\p{M}` to regular expression character class to preserve Unicode combining marks, accents, and abugida vowel diacritics.
2. **Furniture Taxonomy Locale Alignment (`BOUNDED_TAXONOMY`):**
   - Added `'ফার্নিচার'`, `'আসবাবপত্র'` to `furniture.rootTerms`.
   - Added `'চেয়ার'`, `'ডাইনিং'`, `'খাট'`, `'সোফা'`, `'টেবিল'`, `'আলমারি'` to `furniture.productServiceTerms`.
   - Strictly matches established definitions in `queryPlanner.ts:68`.

---

### 4.2 Test Suite Changes

#### `tests/test-relevance-engine.mjs`
- Updated candidate mock IDs in Suite 4 (`mixedScrapedCandidates`):
  - `'1001'` -> `'100000000001001'`
  - `'1002'` -> `'100000000001002'`
  - `'2001'` -> `'100000000002001'`
  - `'3001'` -> `'100000000003001'`
  - `'4001'` -> `'100000000004001'`
- Preserved all assertions, scenarios, scoring checks, and quota discipline logic.

#### `tests/test-entity-resolution.mjs`
- Updated synthetic candidate IDs:
  - Scenario J: `'ad_rfl_1'`, `'ad_rfl_2'`, `'ad_rfl_3'` -> `'900000000000001'`, `'900000000000002'`, `'900000000000003'`
  - Scenario L: `'ad_res_1'`, `'ad_res_2'` -> `'900000000000011'`, `'900000000000012'`
  - Scenario T: `'ad_pres_1'`, `'ad_pres_2'` -> `'900000000000021'`, `'900000000000022'`
- Preserved all deduplication checks, merge history assertions, and multi-query tracking logic.

#### `tests/test-evidence-waterfall.mjs`
- Added explicit regression checks around Scenario 16:
  - Verified `tokenizeText('ফার্নিচার')` contains `'ফার্নিচার'`.
  - Verified `tokenizeText` preserves Bengali vowel marks (`চেয়ার`/`চেয়ার`).
  - Verified catalog terms `'ডাইনিং'` and `'খাট'` are parsed as distinct tokens.
  - Verified mixed Latin/Bengali tokens (`'RFL ফার্নিচার'`) preserve both scripts (`'rfl'`, `'ফার্নিচার'`).
  - Verified `ENTITY_IDENTITY` `STRONG` and `PRODUCT_OR_SERVICE_SIGNAL` `STRONG` signals.

---

## 5. Test Execution Results

All six specified safe offline test suites were executed. Zero network calls or browser instances were created.

| Test Suite | Execution Mode | Pre-Repair Status | Post-Repair Status | Detailed Outcome |
|---|---|---|---|---|
| `tests/test-relevance-engine.mjs` | Offline / Synthetic | FAILED (Suite 4) | **PASSED** | 37/37 assertions passed |
| `tests/test-entity-resolution.mjs` | Offline / Synthetic | FAILED (Scenario J) | **PASSED** | 21/21 scenarios passed (A–U) |
| `tests/test-evidence-waterfall.mjs` | Offline / Synthetic | FAILED (Scenario 16) | **PASSED** | 20/20 scenarios passed + 6 regression assertions |
| `tests/test-geographic-accuracy.mjs` | Offline / Synthetic | PASSED | **PASSED** | 16/16 regression tests passed |
| `tests/test-strict-gate-v2.mjs` | Offline / Synthetic | PASSED | **PASSED** | 45/45 assertions passed |
| `tests/test-phase01-safety-lock.mjs` | Offline / Static | PASSED | **PASSED** | 14/14 safety lock tests passed |

### Total Executed Assertions
- **Total Assertions Passed:** 153 / 153
- **Total Failures:** 0
- **Regression Pass Rate:** 100.0%

---

## 6. Tests Skipped and Reasons

| Test File | Reason Skipped |
|---|---|
| `tests/test-phase27-production-pilot.mjs` | User-modified pre-existing file; live network collection test prohibited by mandatory safety constraints. |
| `tests/test-phase28-release-operations.mjs` | User-modified pre-existing file; release operations test out of scope for Phase 0.2. |
| `tests/test-phase30-production-analytics.mjs` | User-modified pre-existing file; production analytics test out of scope for Phase 0.2. |
| `tests/test-phase31-research-optimization.mjs` | User-modified pre-existing file; research optimization test out of scope for Phase 0.2. |
| `tests/test-phase32-reliability-growth-readiness.mjs` | User-modified pre-existing file; growth readiness test out of scope for Phase 0.2. |
| `scripts/run-live-*.mjs` | Live collection scripts; prohibited by project policy and collection safety lock. |

---

## 7. Confirmation of Collection Safety and Platform Isolation

1. **Phase 0.1 Collection Safety Lock:**
   - `src/config/collectionGate.ts` remains active with `isLiveCollectionPermitted() === false` and `isExternalWebsiteCrawlingPermitted() === false`.
   - `src/extension/manifest.json` and `scripts/build-extension.mjs` have zero `optional_host_permissions` or broad `https://*/*`.
   - Service worker pipeline blocks live collection (`stopReason: 'COLLECTION_NOT_AUTHORIZED'`).
   - Server Playwright scraper throws fail-closed error.
   - Server route `POST /api/research` returns HTTP 403 Forbidden.
2. **Zero External Requests:**
   - No requests to `facebook.com`, Meta Ad Library, or external advertiser websites were initiated during any test.
   - All tests used purely in-memory synthetic fixtures.
3. **Zero APIs or Paid Services:**
   - No external APIs, paid subscriptions, or alternate data sources were introduced.

---

## 8. Remaining Architectural Deficiencies & Next Steps

The following known architectural limitations identified in Phase 0 were intentionally **not** modified during Phase 0.2 in accordance with strict phase scope boundaries:

1. **Geographic Classifier Generalization (Phase 1 Target):**
   - `src/extension/geographicClassifier.ts` currently only recognizes Bangladesh (`BD`). Non-BD research queries classify as `LOCATION_UNKNOWN`. Needs multi-country profiles (US, UK, CA, AU, etc.).
2. **Explicit Destination & CTA Modeling (Phase 1 Target):**
   - Missing destination URLs are currently conflated with "no website" rather than distinguished as Meta Instant Forms, WhatsApp ads, Messenger ads, or Lead Generation forms.
   - Subsequent ads merged into an existing entity overwrite or drop earlier ad CTAs.
3. **Unused Dependencies:**
   - `@google/genai: ^2.4.0` remains in `package.json` production dependencies without source code imports.

---

## 9. Conclusion and Sign-off

Phase 0.2 is complete. The offline test baseline is repaired, deterministic, and verifiable. All historical archives and pre-existing files remain preserved. The repository is ready for Phase 1 (Geographic Classification & Destination Architecture) upon explicit user direction.
