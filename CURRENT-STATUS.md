# Current project status — 25 October 2026

This repository preserves the original MIT-licensed LeadNoria history and adds the current local review changes.

## Implemented and tested

- Separate ad target country from inferred business origin; strict local qualification retains unknown/probable states.
- Distinguish CTA wording, external websites, messaging, phone and unknown destinations.
- Atomic manual-import persistence, visible save failures and snapshot warnings, and persisted ad-ID deduplication within matching country/research criteria.
- Stable result identities and direct selected/filtered CSV downloads with Unicode and review evidence preserved.
- TypeScript, build, 110 existing scoped regression checks, a new offline end-to-end flow, and nine fault-injection cases passed.
- Browser-hosted extension UI was exercised for import, reload/dedup and CSV downloads. One real public Meta ad was manually processed and exported; this was not automated extension scraping.

## Still unverified or blocked

- Actual Chrome MV3 install, service-worker/content-script integration and automatic scrolling/scraping are unverified. The in-app test browser cannot load extensions; personal Chrome testing was stopped at the user's request.
- The live Meta collection and external crawling gates remain disabled.
- `npm test` currently stops because historical v1.7.5/v1.7.6 archives referenced by the test runner are absent. This is not an all-tests-passing production release.
- Older README sections, release metadata, historical archives and generated `extension/` files are inherited snapshots. Run `npm ci` then `npm run build` to regenerate the current extension from source; use the separately uploaded review build for this review.

## Review material

See `docs/current-review/` for Bengali audit and verification reports. Review artifacts, when uploaded, are in `review/`. They contain local test samples, not a licensed lead database.

Original upstream: https://github.com/nafiz-pranto/LeadNoria

No claim of Meta authorization, Chrome Web Store approval, guaranteed country attribution or profitable production readiness is made.
