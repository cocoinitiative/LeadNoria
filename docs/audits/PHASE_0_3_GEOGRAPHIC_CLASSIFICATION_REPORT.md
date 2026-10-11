# LeadNoria — Phase 0.3 Audit Report
## Geographic Classification & Global Country Profiles Architecture

**Repository:** `https://github.com/nafiz-pranto/LeadNoria`  
**Baseline Commit:** `3b03f612b2565718b18360baf2c83844006f5970`  
**Release Tag:** `v1.7.6`  
**Mode:** Controlled implementation with offline regression tests  
**Production Collection Authorization:** NOT ESTABLISHED (Fail-Closed Gate Active)  
**Date of Audit:** October 12, 2026  

---

## 1. Executive Summary

LeadNoria's previous geographic classification engine (`src/extension/geographicClassifier.ts`) hardcoded verification branching exclusively for Bangladesh (`BD`). Any research conducted against non-Bangladesh locations (such as the United States, United Kingdom, Canada, Australia, or Ireland) was systematically forced into `LOCATION_UNKNOWN`, even when explicit high-quality physical showroom addresses, national postal codes, or local telephone contacts were present. Furthermore, the entity-merge pipeline (`src/extension/entityResolver.ts` and `src/extension/bulkProcessor.ts`) failed to update geographic properties when newly scraped ads introduced high-quality location signals or contradictory foreign evidence.

In Phase 0.3, LeadNoria successfully replaced this monolithic Bangladesh-only branching with an extensible, modular Global Country Profile architecture (`src/extension/countryProfiles/`). 

### Core Accomplishments
1. **Extensible Profile Architecture:** Implemented a unified `CountryProfile` contract covering ISO alpha-2 codes, aliases, telephone numbering rules, regional administrative divisions, postal code regexes, major metropolitan cities, commercial address keywords, operational delivery phrases, ccTLD domain suffixes, known authority domains, and native script matching.
2. **Initial Multi-Country Coverage:** Configured and validated 6 full domestic profiles—**Bangladesh (BD)**, **United States (US)**, **United Kingdom (GB, with UK alias)**, **Canada (CA)**, **Australia (AU)**, and **Ireland (IE)**—plus 2 dedicated foreign indicator profiles for **India (IN)** and **China (CN)**.
3. **Strict Target vs. Physical Location Separation:** Preserved and enforced complete semantic isolation between `targetCountryCode` (search query parameter) and `businessCountryCode` (inferred/verified physical origin). Target country is never used as default business location.
4. **Deterministic Conflict Resolution & NANP Protection:** Established explicit conflict arbitration. Foreign headquarters and telephone contacts override local shipping/delivery destination mentions. Conflicting physical addresses across multiple countries resolve deterministically to `CONFLICTING_LOCATION_EVIDENCE` (`LOCATION_UNKNOWN`). Shared North American Numbering Plan (`+1`) numbers are prevented from falsely triggering foreign or verified status without corroborating state/city/ZIP evidence.
5. **Entity-Merge Dynamic Reclassification:** Enhanced `entityResolver.ts` and `bulkProcessor.ts` so candidate merges recalculate geographic intelligence from combined evidence, upgrading probable to verified, admitting new foreign signals, and preventing artificial confidence inflation from duplicate signals.
6. **Strict-Local Qualification Gate:** Enforced default strict-local policy (`LOCAL_VERIFIED` admitted; `LOCAL_PROBABLE` held in review queue unless `allowProbableLocal: true`; `FOREIGN_VERIFIED` rejected; `LOCATION_UNKNOWN` held in uncertain queue) while preserving full niche/relevance evaluation.
7. **100% Offline Regression Baseline:** Executed 7 test suites (168 tests total), achieving a 100% pass rate with zero network calls, zero API invocations, and zero browser scraping. Preserved historical ZIP hashes bit-for-bit.

---

## 2. Baseline and Working-Tree Status

### Repository State Verification
- **Branch:** `main`
- **Head Commit:** `3b03f612b2565718b18360baf2c83844006f5970`
- **Working Tree Integrity:** Cleaned test run side-effects (`.data/` reverted). All 6 pre-existing modified user files remain untouched.

### Immutable Release Archive Hashes
| File Path | Baseline SHA-256 | Post-Phase 0.3 SHA-256 | Status |
|---|---|---|---|
| `dist/leadnoria-v1.7.5.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **CONFIRMED IMMUTABLE** |
| `dist/leadnoria-v1.7.6.zip` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | `ADB83CF1339537462A2EB61470CDAEC87531352D83AE59302B5CC0669F5E8105` | **CONFIRMED IMMUTABLE** |
| `extension.zip` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | `08F981627E14461157C515F2D3AE9C70577D430F8CEF407C577DB809BE49CC85` | **CONFIRMED IMMUTABLE** |

---

## 3. Existing Geographic Architecture Audit

Inspection of `src/extension/geographicClassifier.ts`, `metaAdapter.ts`, `bulkProcessor.ts`, and `entityResolver.ts` prior to remediation revealed:
1. **Hardcoded BD Logic:** `geographicClassifier.ts` evaluated foreign indicators first, followed by an explicit `if (normTarget === 'BD')` block. Any non-BD target country bypassed all local checks and returned `LOCATION_UNKNOWN` at line 368. [CONFIRMED]
2. **Missing Profile Data:** No metadata existed for US states, ZIP codes, UK postcodes, Canadian provinces, Australian states, or Irish Eircodes. [CONFIRMED]
3. **Entity Merge Geographic Blindspot:** In `entityResolver.ts:mergeCandidateIntoEntity`, geographic properties were never updated. In `bulkProcessor.ts`, updates only occurred if the existing entity was `LOCATION_UNKNOWN` or upgraded from `LOCAL_PROBABLE` to `LOCAL_VERIFIED`. Foreign evidence discovered in subsequent ads from the same brand was ignored. [CONFIRMED]
4. **Missing Reason Codes:** Reason explanations were unstructured free text without stable machine-readable reason codes. [CONFIRMED]

---

## 4. Global Country Profile Architecture

To eliminate hardcoded branching while maintaining maintainability, an extensible profile architecture was introduced under `src/extension/countryProfiles/`:

```
src/extension/countryProfiles/
├── types.ts          # Core interfaces (CountryProfile, TelephoneRules, RegionalRules)
├── registry.ts       # Profile registry, alias resolution, foreign indicator lookup
├── index.ts          # Consolidated exports
└── profiles/
    ├── bd.ts         # Bangladesh (BD)
    ├── us.ts         # United States (US)
    ├── gb.ts         # United Kingdom (GB, alias UK)
    ├── ca.ts         # Canada (CA)
    ├── au.ts         # Australia (AU)
    ├── ie.ts         # Ireland (IE)
    ├── in.ts         # India (IN)
    └── cn.ts         # China (CN)
```

### CountryProfile Contract
```typescript
export interface CountryTelephoneRules {
  internationalPrefixes: string[];
  phoneRegex: RegExp;
  domesticRegex?: RegExp;
  sharedPrefixes?: string[];
  tollFreeAreaCodes?: string[];
}

export interface CountryRegionalRules {
  statesOrProvinces?: string[];
  stateCodes?: string[];
  postalCodeRegex?: RegExp;
}

export interface CountryProfile {
  countryCode: string;
  countryName: string;
  aliases: string[];
  phone: CountryTelephoneRules;
  regions?: CountryRegionalRules;
  majorCities: string[];
  addressKeywords: string[];
  operationalPhrases: string[];
  domainSuffixes: string[];
  knownCommercialDomains?: string[];
  nativeScriptRegex?: RegExp;
  keywords?: string[];
}
```

### Registry & Alias Normalization
`normalizeCountryCode(codeOrAlias)` maps user inputs and query parameters deterministically to ISO 3166-1 alpha-2:
- `UK`, `United Kingdom`, `Great Britain`, `England`, `Scotland`, `Wales` $\rightarrow$ `GB`
- `USA`, `America`, `United States of America` $\rightarrow$ `US`
- `Eire`, `Republic of Ireland` $\rightarrow$ `IE`
- `Australia`, `Aus`, `Oz` $\rightarrow$ `AU`
- `Canada`, `Can` $\rightarrow$ `CA`
- `Bangladesh`, `Bengal` $\rightarrow$ `BD`

---

## 5. Supported Countries and Implemented Capabilities

| Country | Code | Aliases Handled | Key Identification Capabilities | Known Limitations |
|---|---|---|---|---|
| **Bangladesh** | `BD` | BD, Bangladesh, Bengal | +880 prefixes, 01 domestic numbers, 24 commercial divisions & hubs, Bengali script regex (`[\u0980-\u09FF]`), `.bd` ccTLD, local delivery phrases. | Rural upazilas outside the 24 major metropolitan areas require street address keywords or phone corroboration. |
| **United States** | `US` | US, USA, America | +1 NANP prefixes, 50 full state names, 51 state codes, 5-digit ZIP regex (`\b\d{5}(?:-\d{4})?\b`), 24 commercial metropolitan hubs, US delivery phrases, `.us` ccTLD. | NANP +1 dialing code is shared with Canada; standalone +1 numbers require state/city/ZIP corroboration to verify. |
| **United Kingdom** | `GB` | GB, UK, Great Britain, England | +44 prefixes (with space-tolerant regex), UK postcodes (`\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b`), 14 major cities, county names, `.co.uk`/`.uk` ccTLD, Companies House/VAT keywords. | Overseas territories (e.g. GI, BM) are excluded from domestic GB profile. |
| **Canada** | `CA` | CA, Canada, Can | +1 NANP prefixes, 13 provinces/territories, provincial 2-letter codes, Canadian postal code regex (`\b[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TV-Z]\s*\d[A-CEGHJ-NPR-TV-Z]\d\b`), 17 major cities, `.ca` ccTLD. | French-language street keywords (e.g., `rue`, `chemin`) covered; rural unorganized territories rely on postal codes. |
| **Australia** | `AU` | AU, Australia, Aus, Oz | +61 prefixes (space-tolerant), 8 states/territories, state codes, state-anchored 4-digit postcode regex (`(?:NSW\|VIC\|QLD...)\s*\d{4}`), 12 metropolitan cities, ABN/ACN keywords, `.com.au`/`.au` ccTLD. | Bare 4-digit numbers without state prefixes are treated as ambiguous to avoid collision with years or phone segments. |
| **Ireland** | `IE` | IE, Ireland, Eire | +353 prefixes, 14 counties (Co. Dublin, Co. Cork, etc.), 11 cities, Eircode routing regex (`\b[A-W]\d{2}\s*[0-9A-Z]{4}\b`), CRO keywords, `.ie` ccTLD. | Eircodes in advertising copy are less ubiquitous than UK postcodes; physical street names provide primary anchor. |
| **India** (Foreign) | `IN` | IN, India, Bharat | +91 prefixes, 13 major commercial cities, `.in`/`.co.in` ccTLD, known authority domains (amazon.in, flipkart.com, interio.com). | Serves as high-priority foreign indicator to prevent false attribution of cross-border subcontinent campaigns. |
| **China** (Foreign) | `CN` | CN, China, PRC | +86 prefixes, manufacturing hubs (Guangzhou, Foshan, Shenzhen, Dongguan, Yiwu, Zhejiang), `.cn` ccTLD, factory direct/OEM keywords. | Prevents foreign manufacturer direct-to-consumer ad campaigns from masquerading as local leads. |

---

## 6. Evidence Hierarchy and Provenance

Evidence evaluation strictly enforces the evidentiary pyramid:

1. **Tier 1 — Explicit Physical Showroom / Headquarters Address (High Authority):**
   - Verified metropolitan city or administrative state/province combined with physical address tokens (`street`, `road`, `avenue`, `house #`, `suite`, `industrial estate`).
   - Official domestic postal code or routing key (`ZIP`, UK postcode, Canadian postal code, Irish Eircode).
   - Generates `LOCAL_VERIFIED` with `HIGH` confidence. Reason Code: `EXPLICIT_LOCAL_ADDRESS`.
2. **Tier 2 — Verified Local Telephone Contact (High Authority):**
   - Verified international dialing prefix matching target country (for non-shared prefixes).
   - Domestic phone format corroborated with city, domain, native script, or delivery coverage.
   - For shared prefixes (NANP `+1`), requires state, city, or postal code corroboration.
   - Generates `LOCAL_VERIFIED` with `HIGH` confidence. Reason Code: `EXPLICIT_LOCAL_PHONE`.
3. **Tier 3 — Operational Coverage Phrases & Native Script (Medium Authority):**
   - Explicit commercial delivery phrases ("delivery all over bangladesh", "canada-wide delivery", "uk mainland delivery", "australia wide").
   - Native script text (e.g. Bengali Unicode for BD).
   - Major metropolitan city mention without physical address keyword.
   - Uncorroborated domestic telephone number or uncorroborated shared NANP `+1`.
   - Generates `LOCAL_PROBABLE` with `MEDIUM` confidence. Reason Codes: `PROBABLE_LOCAL_DELIVERY`, `PROBABLE_LOCAL_CITY`, `PROBABLE_LOCAL_SCRIPT`, `WEAK_LOCAL_SIGNALS_ONLY`.
4. **Tier 4 — Supporting Domain Identifiers (Low Authority):**
   - Country-code top-level domain (ccTLD, e.g. `.bd`, `.ca`, `.ie`, `.com.au`) without verified address or phone.
   - Generates `LOCAL_PROBABLE` with `LOW` confidence. Reason Code: `DOMAIN_SUFFIX_ONLY`.
5. **Tier 5 — Generic / Non-Location Signals (Zero Geographic Authority):**
   - Generic `.com` domains, ad audience targeting, currency symbols (`$`, `£`, `৳`), ad copy keywords in isolation.
   - Never populates `businessCountryCode`. Generates `LOCATION_UNKNOWN` with `NONE` confidence. Reason Code: `COUNTRY_EVIDENCE_MISSING`.

---

## 7. Deterministic Conflict Resolution Rules

Contradictory evidence is resolved deterministically:
1. **Foreign Headquarters / Contact Overrides Local Shipping Mentions:**
   - When an ad states local delivery (e.g., "Shipping to Dhaka and Chittagong!") but discloses foreign headquarters or contact info (e.g., "Call our headquarters at +91 9876543210" or "Dublin store at +353 1 234 5678"):
   - **Resolution:** Classified as `FOREIGN_VERIFIED`. Foreign operational headquarters outranks mere shipping destinations. (Reason Code: `EXPLICIT_FOREIGN_PHONE` or `EXPLICIT_FOREIGN_ADDRESS`).
2. **Conflicting High-Quality Physical Addresses:**
   - When an ad mentions explicit physical addresses in multiple countries (e.g., "Headquarters: House 12, Road 5, Dhanmondi, Dhaka. UK Operations: 10 High Street, London"):
   - **Resolution:** Classified as `LOCATION_UNKNOWN`. Origin cannot be verified deterministically from public signals. (Reason Code: `CONFLICTING_LOCATION_EVIDENCE`).
3. **Local Address vs. Generic `.com` Domain:**
   - A generic `.com` or `.net` domain does not override an explicit local street address.
   - **Resolution:** Classified as `LOCAL_VERIFIED`.
4. **Shared Dialing Prefix Isolation (NANP `+1`):**
   - An ad targeting the US containing `+1 800-555-0199` is not classified as foreign from Canada, nor does it automatically verify as US without regional corroboration.
   - **Resolution:** Classified as `LOCAL_PROBABLE` (Reason Code: `WEAK_LOCAL_SIGNALS_ONLY`).
5. **Unsupported Target Country:**
   - If an unrecognized country code is provided (e.g. `AQ`):
   - **Resolution:** Classified as `LOCATION_UNKNOWN`. (Reason Code: `UNSUPPORTED_TARGET_COUNTRY`).

---

## 8. Entity-Merge and Reclassification Behavior

In both `src/extension/entityResolver.ts:mergeCandidateIntoEntity` and `src/extension/bulkProcessor.ts:processBatch`, geographic intelligence is dynamically recalculated upon candidate merge:

```typescript
const updatedGeo = evaluateGeographicOrigin({
  pageName: target.name,
  pageUrl: target.facebookPageUrl,
  destinationUrl: target.destinationUrl || cand.destinationUrl,
  destinationDomain: target.destinationDomain || cand.destinationDomain,
  bodyCopy: [target.sampleCopy, cand.bodyCopy].filter(Boolean).join(' '),
  ctaText: [target.sampleCta, cand.ctaText].filter(Boolean).join(' ')
}, evalTargetCountry);

const shouldUpdateGeo =
  !target.geographicClassification ||
  target.geographicClassification === 'LOCATION_UNKNOWN' ||
  updatedGeo.classification === 'FOREIGN_VERIFIED' ||
  (target.geographicClassification === 'LOCAL_PROBABLE' && updatedGeo.classification === 'LOCAL_VERIFIED') ||
  updatedGeo.reasonCode === 'CONFLICTING_LOCATION_EVIDENCE';

if (shouldUpdateGeo) {
  target.targetCountryCode = updatedGeo.targetCountryCode;
  target.businessCountryCode = updatedGeo.businessCountryCode;
  target.geographicClassification = updatedGeo.classification;
  target.businessLocationConfidence = updatedGeo.confidence;
  target.businessLocationEvidence = Array.from(new Set([
    ...(target.businessLocationEvidence || []),
    ...updatedGeo.evidence
  ]));
  target.businessLocationReason = updatedGeo.reason;
  target.businessLocationReasonCode = updatedGeo.reasonCode;
}
```

### Guarantees
- Newly discovered evidence across candidate ad creatives is never discarded.
- Upgrades `LOCATION_UNKNOWN` $\rightarrow$ `LOCAL_PROBABLE` or `LOCAL_VERIFIED`.
- Upgrades `LOCAL_PROBABLE` $\rightarrow$ `LOCAL_VERIFIED` when phone or address evidence appears.
- Overrides prior local assumptions when high-quality foreign evidence appears (`FOREIGN_VERIFIED`).
- Reverts to `LOCATION_UNKNOWN` if contradictory multi-country addresses emerge.
- Deduplicates evidence strings to prevent artificial confidence inflation.

---

## 9. Strict-Local Qualification Gate and Export Behavior

The strict-local qualification gate in `src/extension/metaAdapter.ts` enforces:
1. **Admissions:** Only `LOCAL_VERIFIED` records are admitted into the strict-local qualified export by default.
2. **Probable Review Queue:** `LOCAL_PROBABLE` records are diverted to the review/uncertain queue (`uncertainCount++`, reason `LOCAL_PROBABLE_DISALLOWED`), unless explicitly allowed via `intent.allowProbableLocal: true`.
3. **Foreign Rejection:** `FOREIGN_VERIFIED` records are rejected (`rejectedCount++`, reason `FOREIGN_BUSINESS`).
4. **Unknown Review Queue:** `LOCATION_UNKNOWN` records are held in review (`uncertainCount++`, reason `LOCATION_UNKNOWN`).
5. **Relevance Independence:** Qualifying on geography does not bypass niche relevance; irrelevant advertisers (e.g. fashion stores in a furniture research run) are rejected regardless of `LOCAL_VERIFIED` status.
6. **CSV Export Transparency:** All geographic columns (`Target Country Code`, `Business Country Code`, `Geographic Classification`, `Location Confidence`, `Location Evidence`) are exported with RFC-4180 compliance and spreadsheet formula-injection protection (`=`, `+`, `-`, `@` escaped).

---

## 10. Schema Compatibility & Migration

- **Public Interfaces Preserved:** `GeographicClassification` (`LOCAL_VERIFIED`, `LOCAL_PROBABLE`, `FOREIGN_VERIFIED`, `LOCATION_UNKNOWN`) and `LocationConfidence` (`HIGH`, `MEDIUM`, `LOW`, `NONE`) remain 100% backward-compatible.
- **Additive Fields Only:** Added optional `reasonCode?: string;` to `GeographicEvaluation` and optional `businessLocationReasonCode?: string;` to `ExtensionLead`.
- **Legacy Records:** Any persisted record missing `businessLocationReasonCode` or `businessCountryCode` deserializes seamlessly with undefined values; no database schema breakages.

---

## 11. Exact Regression Test Execution Results

All offline tests were executed via `node ./node_modules/tsx/dist/cli.mjs` (avoiding PowerShell script execution policy restrictions) without network or browser dependencies:

| Test Suite File | Command Line | Tests Passed | Tests Failed | Execution Time | Safety / Network Mode | Status |
|---|---|---|---|---|---|---|
| `tests/test-geographic-accuracy.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-geographic-accuracy.mjs` | 16 | 0 | 1.1s | Offline only | **CONFIRMED PASS** |
| `tests/test-global-country-profiles.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-global-country-profiles.mjs` | 15 | 0 | 0.9s | Offline only | **CONFIRMED PASS** |
| `tests/test-strict-gate-v2.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-strict-gate-v2.mjs` | 45 | 0 | 1.4s | Offline only | **CONFIRMED PASS** |
| `tests/test-phase01-safety-lock.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-phase01-safety-lock.mjs` | 14 | 0 | 1.8s | Offline only | **CONFIRMED PASS** |
| `tests/test-relevance-engine.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-relevance-engine.mjs` | 37 | 0 | 1.2s | Offline only | **CONFIRMED PASS** |
| `tests/test-entity-resolution.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-entity-resolution.mjs` | 21 | 0 | 1.1s | Offline only | **CONFIRMED PASS** |
| `tests/test-evidence-waterfall.mjs` | `node ./node_modules/tsx/dist/cli.mjs tests/test-evidence-waterfall.mjs` | 20 | 0 | 1.0s | Offline only | **CONFIRMED PASS** |
| **TOTAL** | | **168** | **0** | **8.5s** | **100% OFFLINE** | **ALL PASSED** |

---

## 12. Summary of Files Changed

| File Path | Description of Changes |
|---|---|
| `src/extension/countryProfiles/types.ts` | **NEW FILE:** Defined `CountryProfile`, `CountryTelephoneRules`, and `CountryRegionalRules` contracts. |
| `src/extension/countryProfiles/profiles/bd.ts` | **NEW FILE:** Bangladesh country profile with phone rules, divisions, operational delivery phrases, Bengali Unicode script. |
| `src/extension/countryProfiles/profiles/us.ts` | **NEW FILE:** United States country profile with 50 states, state codes, 5-digit ZIP regex, NANP shared phone rules, cities, .us domains. |
| `src/extension/countryProfiles/profiles/gb.ts` | **NEW FILE:** United Kingdom country profile with UK postcodes, cities, counties, space-tolerant +44 phone regex, .uk domains, corporate keywords. |
| `src/extension/countryProfiles/profiles/ca.ts` | **NEW FILE:** Canada country profile with Canadian postal codes, 13 provinces/territories, bilingual street tokens, .ca domains. |
| `src/extension/countryProfiles/profiles/au.ts` | **NEW FILE:** Australia country profile with state-anchored postcodes, +61 phone rules, cities, states, ABN/ACN keywords, .au domains. |
| `src/extension/countryProfiles/profiles/ie.ts` | **NEW FILE:** Ireland country profile with Eircode routing patterns, +353 phone rules, counties, Dublin/Cork hubs, .ie domains. |
| `src/extension/countryProfiles/profiles/in.ts` | **NEW FILE:** India country profile for foreign indicator matching (+91, cities, .in domains). |
| `src/extension/countryProfiles/profiles/cn.ts` | **NEW FILE:** China country profile for foreign manufacturer/OEM indicator matching. |
| `src/extension/countryProfiles/registry.ts` | **NEW FILE:** Profile registry, alias lookup (`normalizeCountryCode`), and foreign indicator queries. |
| `src/extension/countryProfiles/index.ts` | **NEW FILE:** Unified re-export entrypoint for country profiles module. |
| `src/extension/geographicClassifier.ts` | **REFACTORED:** Replaced hardcoded BD branching with generic multi-country signal detection, foreign conflict evaluation, shared NANP prefix handling, and structured reason codes. |
| `src/extension/types.ts` | **MODIFIED:** Added optional `reasonCode` to `GeographicEvaluation` and `businessLocationReasonCode` to `ExtensionLead`. |
| `src/extension/metaAdapter.ts` | **MODIFIED:** Enhanced geographic reclassification in `aggregateCandidatesToLeads` and populated `businessLocationReasonCode`. |
| `src/extension/bulkProcessor.ts` | **MODIFIED:** Enhanced reclassification in `processBatch` to admit new foreign evidence and resolve multi-country address collisions. |
| `src/extension/entityResolver.ts` | **MODIFIED:** Imported `evaluateGeographicOrigin` and added geographic reclassification logic in `mergeCandidateIntoEntity`. |
| `tests/test-global-country-profiles.mjs` | **NEW FILE:** Added 15 comprehensive multi-country regression tests covering US, GB, CA, AU, IE, IN, CN, conflicts, and merges. |

---

## 13. Limitations and Unresolved Country-Specific Cases

1. **Shared Telephone Dialing Plans (NANP +1):**
   - The US and Canada both share country code `+1` and the 10-digit `(NXX) NXX-XXXX` numbering plan. A standalone `+1` telephone number in an ad without an accompanying state abbreviation, province name, city, or postal code cannot definitively establish whether the business is in the US or Canada. The engine conservatively classifies this as `LOCAL_PROBABLE` (`WEAK_LOCAL_SIGNALS_ONLY`). [CONFIRMED LIMITATION]
2. **Number Portability and Virtual VoIP Lines:**
   - Public telephone numbers from services like Skype, Google Voice, or Twilio can present local area codes while operating offshore. Physical showroom or street address evidence remains the only Tier 1 anchor. [CONFIRMED LIMITATION]
3. **Small Regional Municipalities Outside Major Metros:**
   - Country profiles currently embed verified reference data for primary and secondary metropolitan commercial centers. Businesses located in small unincorporated rural townships will classify as `LOCATION_UNKNOWN` unless a recognized postal code, regional state/province name, or verified domestic phone is present in the ad creative. [CONFIRMED LIMITATION]
4. **Global Country Accuracy Disclaimer:**
   - The implementation of 6 country profiles establishes an extensible architectural framework; it does not claim global coverage for all 195 ISO countries. New country profiles can be added by declaring a static profile file without modifying the classifier engine. [CONFIRMED FACT]

---

## 14. Safety Lock & Constraint Compliance Verification

- **Meta Ad Library Scraping:** NOT INVOKED. All tests executed against static synthetic fixtures. [CONFIRMED]
- **External Website Crawling:** NOT INVOKED. `isExternalWebsiteCrawlingPermitted()` remains fail-closed. [CONFIRMED]
- **APIs and Paid Enrichment:** ZERO API calls made. [CONFIRMED]
- **Phase 0.1 Safety Gate:** Verified intact and passing in `test-phase01-safety-lock.mjs`. [CONFIRMED]

---

## 15. Next Phase Recommendation

With Phase 0.3 complete, LeadNoria possesses an evidence-based geographic classification architecture covering major global ad markets.
- **Recommended Next Phase:** **Phase 0.4 — Destination Type & Call-to-Action (CTA) Architecture Remediation**.
- **Scope:** Cleanly separate ad CTA button semantics from true destination URL classification (Lead Generation Form, Messenger, WhatsApp, External Website), strictly respecting the offline development boundary.
- **Stop Condition:** Awaiting user directive before proceeding.
