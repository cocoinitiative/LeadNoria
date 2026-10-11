# LeadNoria v1.7.6 Release Notes

**Release Date:** 2026-10-11  
**Authoritative Version:** `1.7.6`  
**Distribution Package:** `dist/leadnoria-v1.7.6.zip`  
**Package Byte Size:** `357,748 bytes`  
**Package SHA-256:** `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105`

---

## Overview

LeadNoria v1.7.6 introduces verified business location intelligence, multi-tier geographic qualification, pipeline ledger reconciliation, and removal of artificial test-lead quotas for the Meta Ad Library scraper.

---

## Key Features & Hardening

### 1. Decoupled Geographic Classification Engine
- **Decoupling Meta Target Country from Business Location:** Meta Ad Library ad-targeting parameters (`targetCountryCode`) are strictly decoupled from physical business location (`businessCountryCode`). The classifier never conflates search ad-targeting with the advertiser's physical premises.
- **Honest Four-Tier Classification Hierarchy:**
  - `LOCAL_VERIFIED`: Strict proof via domestic telephone dialing codes (`+880`) or verified physical address.
  - `LOCAL_PROBABLE`: Strong domestic signals (e.g. division/district cities, `.bd` domains, local delivery phrases) without full postal street address.
  - `FOREIGN_VERIFIED`: Verified international presence via foreign telephone codes (`+91`, `+44`, `+1`), foreign ccTLDs (`.in`, `.co.uk`, `.com.au`), or international city mentions.
  - `LOCATION_UNKNOWN`: Ad creative contains no geographic evidence; transparently held as unknown.
- **Strict Local Mode & General Discovery Modes:**
  - *General Discovery Mode (`researchMode: 'AUTO_DISCOVERY'`):* Retains relevant international and domestic commercial advertisers targeting the market, stamping their physical origins transparently.
  - *Strict Local Mode (`strictLocalMode: true`):* Strictly disqualifies `FOREIGN_VERIFIED` advertisers (`rejectedCount++`) and holds `LOCATION_UNKNOWN` candidates in review (`uncertainCount++`).

### 2. Multi-Level Pipeline Ledger Reconciliation
- **Level 1 (Ad Card Decisions):** `rawAds = duplicatesRemoved (merges) + relevantCandidates + notRelevantCandidates + uncertainCandidates`.
- **Level 2 (Unique Entities):** `uniqueEntitiesObserved = relevantEntities + notRelevantEntities + uncertainEntities`.
- **Level 3 (Storage & Export Parity):** `finalUniqueLeads = storedLeads = exportedCsvRows = sum(geographic classifications)` with 100% mathematical parity.

### 3. Transparent CSV Export & Formula Safety
- Added 5 structured geographic columns to CSV exports:
  - `Target Country Code`
  - `Business Country Code`
  - `Geographic Classification`
  - `Location Confidence`
  - `Location Evidence`
- Comprehensive formula-injection protection prepending `'` to all untrusted cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r`.

### 4. Quota Discipline & Capacity Expansion
- Eliminated artificial 6-lead testing quotas across live validation routines while preserving safe bounded runtime ceilings.

---

## Live Validation Summary (Bangladesh Meta Ad Library)

Tested live in Chromium against real Meta Ad Library feeds across 3 business categories:
- **Furniture:** 218 raw cards inspected, 135 unique entities, 25 leads collected (25 stored, 25 exported).
- **Sofa:** 291 raw cards inspected, 159 unique entities, 9 leads collected (9 stored, 9 exported).
- **Office Furniture:** 275 raw cards inspected, 160 unique entities, 21 leads collected (21 stored, 21 exported).
- **Aggregate Yield (55 leads):**
  - `LOCAL_VERIFIED`: 0
  - `LOCAL_PROBABLE`: 14
  - `FOREIGN_VERIFIED`: 22
  - `LOCATION_UNKNOWN`: 19
  - Stored & Exported Parity: 55 / 55 (100%)

*Note: In public Meta Ad Library ad copy, advertisers rarely display full postal street addresses in short creative copy. Leads with city tokens or domestic domains are honestly classified as `LOCAL_PROBABLE` (14 leads) and foreign advertisers targeting Bangladesh are classified as `FOREIGN_VERIFIED` (22 leads). General Discovery Mode retains all relevant active advertisers while recording their transparent origin.*

---

## Integrity & Verification

| Asset | Byte Size | SHA-256 Checksum | Status |
| :--- | :--- | :--- | :--- |
| `dist/leadnoria-v1.7.6.zip` | 357,748 bytes | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | Active Release Candidate |
| `dist/leadnoria-v1.7.5.zip` | 354,168 bytes | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | Frozen Historical Archive |
| `extension.zip` | 354,168 bytes | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | Frozen Historical Archive |
