# LEADNORIA — PHASE 4 AUDIT & REMEDIATION REPORT
# ADVERTISER IDENTITY & DEDUPLICATION

**Date:** 2026-10-14
**Project:** LeadNoria
**Target Roadmap Phase:** Phase 4: Advertiser Identity & Deduplication
**Proposed Version:** 1.7.7
**Baseline Git Commit:** `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f`
**Execution Mode:** Fully Autonomous Audit → Remediation → Verification Loop
**Final Phase Gate Verdict:** **PASS** (Zero Blockers, Ready for Phase 5)

---

## 1. Executive Summary

Phase 4 of LeadNoria's original 14-phase roadmap mandates comprehensive auditing, defect remediation, and deterministic regression verification of **Advertiser Identity & Deduplication**.

Following the successful remediation of Phase 2 (Meta Ad CTA and Destination Classification) and Phase 3 (Niche Relevance and Qualification Rules), this phase audited and resolved critical structural defects in:
1. Candidate advertiser grouping and existing-lead reconciliation in `src/extension/metaAdapter.ts`.
2. Hierarchical duplicate relationship classification (`EXACT_DUPLICATE`, `PROBABLE_DUPLICATE`, `DISTINCT_ADVERTISER`, `UNKNOWN_IDENTITY`) in `src/extension/entityResolver.ts`.
3. Conflicting stable identifier detection (Facebook Page ID and Page slug conflicts) preventing false merges.
4. Storage normalization and deterministic recovery in `src/extension/bulkStore.ts`.
5. Formula-safe CSV export retaining full identity provenance (`Canonical Page ID`, `Canonical Page Slug`, `Identity Confidence`, `Relationship Type`, `Aliases`) without disturbing legacy columns.

All 23 required regression gates in `tests/test-phase04-identity-deduplication.mjs` passed with 100% deterministic success. The master offline verification suite (`scripts/verify-offline.mjs`) ran all 20 regression suites with 0 failures, 100% archive immutability, and permanently fail-closed collection boundaries.

---

## 2. Initial Repository State

- **Branch / HEAD:** `main` at `1ad52aba237caaa4fc0e525e945d8d20ff0cce5f`
- **Proposed Local Version:** `1.7.7` (synchronized across `package.json`, `package-lock.json`, and `extension/manifest.json`)
- **Safety Gates Active:**
  - `isLiveCollectionPermitted() === false` (Fail-Closed)
  - `isExternalWebsiteCrawlingPermitted() === false` (Fail-Closed)
- **Pre-Execution Archive Hashes (SHA-256):**
  - `dist/leadnoria-v1.7.5.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85`
  - `dist/leadnoria-v1.7.6.zip`: `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105`
  - `extension.zip`: `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85`
- **Clean Untracked/Modified Status:** All research artifacts, observation logs, and audit files preserved without destructive operations.

---

## 3. Canonical Identity Model Found in Repository

The LeadNoria product schema uses a deterministic, multi-tiered identity model:

| Field Name | Type | Provenance / Source | Role in Identity Resolution |
|---|---|---|---|
| `canonicalPageId` | `string \| undefined` | Meta Ad Library Facebook Page ID (e.g. `?id=123456789`) | **Primary stable anchor (Tier 1)**. Exact match proves `EXACT_DUPLICATE`. Conflicting IDs strictly enforce `DISTINCT_ADVERTISER`. |
| `canonicalPageSlug` | `string \| undefined` | Normalized username/slug from Facebook Page URL (e.g. `facebook.com/hatilbd`) | **Secondary stable anchor (Tier 2)**. Exact match proves `EXACT_DUPLICATE`. Conflicting slugs prevent automatic merge. |
| `canonicalName` | `string` | Display name stripped of boilerplate & NFKC-normalized | Core human-readable entity identity. Normalized for Unicode, zero-width chars, and legal designations. |
| `destinationDomain` | `string \| undefined` | Normalized host from `destinationUrl` (decoded link shims) | Corroborating signal (Tier 3). Excluded if in `GENERIC_SHARED_DOMAINS` (Amazon, Daraz, wa.me, etc.). |
| `aliases` | `string[]` | Alternative observed display names from merged candidate cards | Preserves original observed display names without overwriting canonical name. |
| `identityConfidence` | `'STRONG' \| 'MODERATE' \| 'WEAK' \| 'UNRESOLVED' \| 'AMBIGUOUS'` | Computed decision confidence | Explicit certainty metric. Decoupled from niche score or qualification status. |
| `relationshipType` | `'PARENT_BRAND' \| 'LOCAL_BRANCH' \| 'INDEPENDENT_BUSINESS' \| 'UNRESOLVED_RELATIONSHIP'` | Branch/relationship detection | Separates distinct geographic branch variants from parent brand without shared Page ID. |
| `mergeHistory` | `EntityMergeRecord[]` | Audit log of candidate merge events | Structured trail recording `timestamp`, `mergeReason`, `sourceLibraryId`, `sourceQuery`, `confidence`. |

---

## 4. In-Scope Defects Identified & Remediated

### Defect 1: Naive Display Name Grouping in `metaAdapter.ts: aggregateCandidatesToLeads`
- **Severity:** HIGH
- **Root Cause:** In `aggregateCandidatesToLeads`, raw candidates were grouped solely by `key = cleanName.toLowerCase()`.
  1. Two distinct advertisers sharing a generic or common name (e.g., "Apex" or "Star Decor") with conflicting Facebook Page IDs (`111` vs `222`) or conflicting domains were falsely collapsed into a single lead.
  2. Two candidate cards from the same advertiser with slight display name differences (e.g., "Hatil Living" vs "Hatil Living - Official") sharing the exact same Page ID were placed into separate leads.
  3. Pre-existing stored leads in `actualExistingLeads` were indexed solely by `lead.canonicalName.toLowerCase()`, failing to match incoming cards with identical Page IDs if the display name varied.
- **Remediation:** Re-architected candidate grouping in `aggregateCandidatesToLeads` to use `EntityResolutionIndex` and hierarchical identity rules. Candidates with matching Page IDs or slugs merge into the same group regardless of display variations. Candidates with generic short names without corroboration remain separate. Candidates with conflicting Page IDs or conflicting non-shared domains strictly branch into distinct entities.

### Defect 2: Missing Section 6 Duplicate Evidence-Strength Hierarchy (`DuplicateMatchLevel`)
- **Severity:** MEDIUM
- **Root Cause:** `EntityMergeDecision` tracked `confidence` and `relationshipType`, but lacked explicit Section 6 classification (`EXACT_DUPLICATE`, `PROBABLE_DUPLICATE`, `DISTINCT_ADVERTISER`, `UNKNOWN_IDENTITY`).
- **Remediation:** Added `DuplicateMatchLevel` and exported `classifyDuplicateRelationship(candidate, target)` in `src/extension/entityResolver.ts`. Attached `matchLevel` across Tiers 1–8 of `evaluateEntityMerge`.

### Defect 3: Missing Conflicting Page ID Guard in Tier 3 & Tier 7
- **Severity:** HIGH
- **Root Cause:** In `evaluateEntityMerge`, Tier 3 and Tier 7 checked for conflicting Page slugs and conflicting domains, but did not check for direct numeric Facebook Page ID conflicts (`pageNorm.pageId !== targetPageNorm.pageId`).
- **Remediation:** Added explicit `pageId` conflict checks in Tier 3 and Tier 7. If both records have stable Page IDs and they differ, merging is strictly prevented and classified as `DISTINCT_ADVERTISER`.

### Defect 4: Compound Legal Suffix Truncation in `getComparisonNameKey`
- **Severity:** MEDIUM
- **Root Cause:** Suffix stripping executed a single linear pass. For compound Commonwealth suffixes like "Private Limited" where "limited" was stripped first, "private" remained attached, causing "Hatil Furniture Pvt Ltd" and "Hatil Furniture Private Limited" to fail string equivalence.
- **Remediation:** Added iterative stripping loop in `getComparisonNameKey` and included compound tokens (`'private limited'`, `'pvt ltd'`, `'pte ltd'`, `'private'`).

### Defect 5: Identity Column Omission in RFC-Compliant CSV Export
- **Severity:** MEDIUM
- **Root Cause:** `exportLeadsToCsv` omitted canonical identity fields and review status (`canonicalPageId`, `canonicalPageSlug`, `identityConfidence`, `relationshipType`, `aliases`).
- **Remediation:** Appended 5 new columns (`Canonical Page ID`, `Canonical Page Slug`, `Identity Confidence`, `Relationship Type`, `Aliases`) to headers and row formatters, maintaining exact 0-indexed positions for legacy columns 1–39 with formula injection sanitization.

### Defect 6: Non-Idempotent Merge Audit History
- **Severity:** LOW
- **Root Cause:** Repeated runs of the same candidate and query added redundant duplicate entries to `target.mergeHistory`.
- **Remediation:** Added idempotency check in `mergeCandidateIntoEntity` to prevent duplicate audit records for the same `sourceLibraryId` and `sourceQuery`.

---

## 5. Summary of Files Changed

| File Path | Description of Changes |
|---|---|
| `src/extension/entityResolver.ts` | Added `DuplicateMatchLevel` & `classifyDuplicateRelationship()`. Added `matchLevel` to `EntityMergeDecision`. Added Page ID conflict guards to Tiers 3 & 7. Added iterative suffix stripping in `getComparisonNameKey()`. Added zero-width character stripping in `normalizeAdvertiserName()`. Made `mergeHistory` recording idempotent. |
| `src/extension/metaAdapter.ts` | Upgraded candidate grouping in `aggregateCandidatesToLeads()` to use `EntityResolutionIndex` and stable identifier matching. Enriched `mockLead` with normalized domains and Page IDs. Appended 5 canonical identity columns in `exportLeadsToCsv()`. |
| `src/extension/bulkStore.ts` | Updated `normalizeStoredLead()` to safely recover `canonicalPageId`, `canonicalPageSlug`, and deduplicate `aliases`. Updated `saveBatch()` in IndexedDB and `MemoryStoreFallback` to compute stable canonical keys (`fb_${id}`). |
| `scripts/verify-offline.mjs` | Registered Suite 20: Phase 4 Advertiser Identity & Deduplication in master offline verification runner. |
| `tests/test-phase04-identity-deduplication.mjs` | Created authoritative 23-gate deterministic regression test suite covering all Section 11 requirements. |

---

## 6. Duplicate Classification & Merge Rules

LeadNoria implements a strict 4-level evidence hierarchy:

```
[Incoming Card] + [Target Entity]
       │
       ▼
1. Conflicting Evidence Check?
   - Page ID A !== Page ID B          ──► DISTINCT_ADVERTISER (No Merge)
   - Page Slug A !== Page Slug B      ──► DISTINCT_ADVERTISER (No Merge)
   - Domain A !== Domain B            ──► DISTINCT_ADVERTISER (No Merge)
   - Local Branch Variant Detected    ──► DISTINCT_ADVERTISER (No Merge)
       │
       ▼ (No Conflicts)
2. Stable Identifier Match?
   - Page ID A === Page ID B          ──► EXACT_DUPLICATE (Merge Tier 1)
   - Page Slug A === Page Slug B      ──► EXACT_DUPLICATE (Merge Tier 2)
       │
       ▼ (No Stable ID)
3. Non-Generic Name + Clean Domain?
   - CompName Match + Domain Match    ──► PROBABLE_DUPLICATE (Merge Tier 3)
       │
       ▼
4. Ambiguous / Generic / Missing?
   - Shared Marketplace Domain (wa.me)──► UNKNOWN_IDENTITY (No Merge)
   - Generic Short Name (Apex, Nova)  ──► UNKNOWN_IDENTITY (No Merge)
   - Name Match Alone (Unverified)    ──► PROBABLE_DUPLICATE / UNKNOWN (No Merge)
   - Different Names Without IDs      ──► DISTINCT_ADVERTISER (No Merge)
```

---

## 7. Verification Evidence & Test Results

### Section 11: 23 Required Regression Gates

All 23 gates executed in `tests/test-phase04-identity-deduplication.mjs`:

| Gate # | Verification Gate Description | Result | Evidence / Implementation |
|---|---|---|---|
| **Gate 01** | Exact stable-identifier duplicate | **PASS** | Cards sharing Page ID `12345678901` merge into 1 lead with `adCount: 2`. |
| **Gate 02** | Missing identifiers do not produce false matches | **PASS** | Generic cards without Page ID or domain remain separate leads. |
| **Gate 03** | Similar advertiser names remain separate | **PASS** | `Star Decor Center` vs `Star Decor Store` with different Page IDs stay separate. |
| **Gate 04** | Unicode and whitespace normalization | **PASS** | Bengali text, zero-width spaces (`\u200B`), and NFKC accents normalize canonically. |
| **Gate 05** | Case normalization where appropriate | **PASS** | `hatil furniture pvt ltd` and `HATIL FURNITURE PRIVATE LIMITED` equate. |
| **Gate 06** | Conflicting stable identifiers prevent merge | **PASS** | `Nova Furnishings` with Page ID `...001` vs `...002` strictly remain 2 leads. |
| **Gate 07** | Same advertiser retains distinct ad records | **PASS** | Ad 1 (`CALL_NOW`) and Ad 2 (`SHOP_NOW`) preserved in `lead.adEvidence`. |
| **Gate 08** | Exact duplicate across multiple keywords | **PASS** | Same ad ID under 2 keywords yields 1 lead; `matchedKeywords` has both. |
| **Gate 09** | Repeated processing is idempotent | **PASS** | Ingesting candidate 3 times produces identical `adCount: 1` and `adEvidence: 1`. |
| **Gate 10** | Stored and newly discovered duplicate handling | **PASS** | Incoming card merges with stored lead via matching Page ID despite name variation. |
| **Gate 11** | Partial identity records remain safe | **PASS** | Missing URLs or CTAs do not throw; states recorded as `not_found`/`unknown`. |
| **Gate 12** | Probable duplicates not reported as verified | **PASS** | Name + domain match without Page ID classifies as `PROBABLE_DUPLICATE`. |
| **Gate 13** | Conflict handling preserves original evidence | **PASS** | Merging preserves Campaign Alpha and Beta copy in `adEvidence` and audit trail. |
| **Gate 14** | Storage recovery does not reintroduce duplicates | **PASS** | `normalizeStoredLead` purges duplicate IDs, aliases, and adEvidence items. |
| **Gate 15** | Export retains identity evidence and review status | **PASS** | CSV rows output `Canonical Page ID`, `Slug`, `Confidence`, `Relationship`, `Aliases`. |
| **Gate 16** | CTA & destination data associated with correct ad | **PASS** | Ad A retains `CALL`/`CALL_NOW`; Ad B retains `MESSAGING`/`SEND_MESSAGE`. |
| **Gate 17** | Country & niche qualification evidence intact | **PASS** | Merging UK campaign into BD lead updates classification to `FOREIGN_VERIFIED`. |
| **Gate 18** | Deduplication cannot override qualification | **PASS** | Merging cards cannot qualify an advertiser that failed relevance or geographic gates. |
| **Gate 19** | Backward compatibility with existing records | **PASS** | Schema v1 records rehydrate smoothly into schema v2 format. |
| **Gate 20** | Existing Phase 2 CTA/destination tests pass | **PASS** | `tests/test-phase02-cta-destination-remediation.mjs` passes 20/20 gates. |
| **Gate 21** | Existing Phase 3 qualification tests pass | **PASS** | `tests/test-phase03-niche-qualification-remediation.mjs` passes 24/24 gates. |
| **Gate 22** | Both safety gates remain permanently fail-closed | **PASS** | `isLiveCollectionPermitted() === false` & `isExternalWebsiteCrawlingPermitted() === false`. |
| **Gate 23** | No unauthorized external network behavior | **PASS** | Manifest host permissions strictly confined to `facebook.com` / `meta.com`. |

---

## 8. Master Offline Verification Runner Results

Command: `node scripts/verify-offline.mjs`

```
========================================================================
LEADNORIA: AUTOMATED OFFLINE REGRESSION VERIFICATION RUNNER
Mode: Offline-First | Zero External Network | Fail-Closed Safety Invariants
========================================================================

--- STEP 0: PRE-RUN HISTORICAL ARCHIVE INTEGRITY ---
  ✓ Historical release archives intact (v1.7.5, v1.7.6, extension.zip)

--- STEP 1: TYPESCRIPT STRICTNESS CHECK (tsc --noEmit) ---
  ✓ TypeScript compiler check clean (52.32s)

--- STEP 2: SAFE UNPACKED EXTENSION BUILD ---
  ✓ Unpacked extension build succeeded (0.60s)

--- STEP 3: REGRESSION TEST SUITE EXECUTION ---
  [1/20] Running Phase 0.1 Safety Lock... PASSED (2.04s)
  [2/20] Running Relevance Calibration Engine... PASSED (0.65s)
  [3/20] Running Entity Resolution & Deduplication... PASSED (0.59s)
  [4/20] Running Evidence Waterfall & Adversarial Copy... PASSED (0.58s)
  [5/20] Running Geographic Accuracy & Hierarchy... PASSED (0.55s)
  [6/20] Running Global Country Profiles... PASSED (0.56s)
  [7/20] Running Strict Local Mode Contract... PASSED (0.60s)
  [8/20] Running CTA, Destination & Export Integrity... PASSED (0.60s)
  [9/20] Running Storage Persistence & Recovery Integrity... PASSED (0.76s)
  [10/20] Running Qualification Gate & Scoring... PASSED (0.60s)
  [11/20] Running UI Workflow Qualification... PASSED (0.63s)
  [12/20] Running Unified Lead Intelligence UI... PASSED (0.60s)
  [13/20] Running Packaging Safety & Archive Isolation... PASSED (1.47s)
  [14/20] Running Dependency Hygiene & Runtime Boundary... PASSED (0.69s)
  [15/20] Running CI Safety Invariants & Boundary Enforcement... PASSED (0.76s)
  [16/20] Running Phase 1.0D TypeScript & CI Integrity... PASSED (51.15s)
  [17/20] Running Phase 1.0E Final Integration & Readiness... PASSED (0.86s)
  [18/20] Running Phase 2 CTA & Destination Remediation... PASSED (0.70s)
  [19/20] Running Phase 3 Niche Relevance & Qualification Remediation... PASSED (0.53s)
  [20/20] Running Phase 4 Advertiser Identity & Deduplication... PASSED (0.44s)

--- STEP 4: POST-RUN HISTORICAL ARCHIVE INTEGRITY ---
  ✓ Historical release archives remained 100% immutable throughout execution

========================================================================
VERIFICATION SUMMARY
========================================================================
Total Suites Executed: 20
Suites Passed:         20
Suites Failed:         0
Total Execution Time:  118.29s
Safety Gates:          isLiveCollectionPermitted() === false [FAIL-CLOSED]
                       isExternalWebsiteCrawlingPermitted() === false [FAIL-CLOSED]
Historical Archives:   100% Intact & Immutable
========================================================================

✅ ALL OFFLINE VERIFICATION SUITES PASSED SUCCESSFULLY.
```

---

## 9. Historical Archive Integrity Certification

| Archive Path | Algorithm | Reference SHA-256 | Post-Run SHA-256 | Status |
|---|---|---|---|---|
| `dist/leadnoria-v1.7.5.zip` | SHA-256 | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **MATCH (IMMUTABLE)** |
| `dist/leadnoria-v1.7.6.zip` | SHA-256 | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **MATCH (IMMUTABLE)** |
| `extension.zip` | SHA-256 | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **MATCH (IMMUTABLE)** |

---

## 10. Remaining Blockers

**None.**
All 23 Phase 4 verification gates pass. All 20 offline suites pass. Typechecking is clean. Fail-closed safety gates remain active.

---

## 11. Final Verdict

**VERDICT: PASS**

Phase 4 (Advertiser Identity & Deduplication) has successfully met all acceptance criteria, remediated all in-scope identity defects, verified full backward compatibility, and passed all 20 regression suites.

**Phase 5 is READY TO BEGIN.**
