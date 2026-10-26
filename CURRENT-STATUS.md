# Current project status - 26 October 2026

The extension attempts each unique advertiser Page's public About information, then contact/basic information when website, email or phone is missing. The old 40-Page cap is removed. Results are cached per run. Access restrictions stop further Page visits; missing fields stay empty and unchecked Pages are marked explicitly.

CSV and Copy for Sheets contain exactly: Page name, Page URL, Website, Email, Phone. Export uses the full stored list rather than the 50-row preview. Missing stored rows block export and offer Retry.

Observed Page websites remain separate from messaging ad CTAs. Page identity and address evidence are checked; search country does not establish business country. No paid API, external website crawling, login bypass or fabricated contacts.

See [Page workflow engineering review](docs/current-review/page-research-hardening.md) for delayed-render handling, preserved observations, identity-scoped caching, bounded retry, cancellation, access restrictions and localized phone digits.

## Verification

30 current offline suites plus TypeScript, extension build and ZIP immutability checks. Isolated Chromium loads the actual MV3 extension against intercepted fixture pages: collection, About/contact fallback, storage, five-column CSV, real clipboard, reload and tab cleanup. A separate seeded 65-row storage scenario verifies export beyond the preview and missing-row recovery.

These are fixture checks, not live Meta tests. Current Facebook layouts, real access restrictions and worker suspension/resumption still require live testing. Historical archive suites remain separate.

See [benchmark report](docs/current-review/about-contacts-five-column-benchmark.md). Extract extension.zip and load the folder containing manifest.json. extension/ contains the matching runtime.
