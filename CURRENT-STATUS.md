# Current project status — 25 October 2026

## Current extension

- Simplified collection: Start runs directly on Search, with a spinning lead counter and Stop underneath. No review popup or separate progress page is required. See [UI checks](docs/current-review/simple-collection-ui.md).

- User-requested Meta Ad Library collection now checks installed Chrome extension capabilities instead of the permanently false server gate. UI and background worker use the same check. Hosted previews cannot start collection.
- Search uses country and All Ads URL parameters. Preset identity survives plan review. Empty scans terminate; pause remains paused. Startup failures are visible rather than silently leaving a running screen.
- Existing login/challenge and rate-limit stops remain. No challenge bypass, paid API, external website crawling, or server collection was added.
- Local URL-wrapper decoding, messaging/short-link classification, conservative business history, only-new-business filter, local follow-up notes/status, excluded keywords and configurable CSV/Sheets columns are included.
- Country inference remains evidence-based; missing evidence is unknown. An observed website link is not proof of reachability or ownership.

## Verification

`npm test` runs TypeScript, the unpacked build, and 27 current offline suites. The new mocked Chrome pipeline exercises startup, country/All Ads URLs, empty results, persistence, pause and challenge stop. Mock tests make no live Meta requests.

Previous hosted-browser checks covered imports, reload, business history, local notes, Sheets columns and a downloaded CSV. They do not prove MV3 runtime behavior.

Historical release-archive tests remain separate (`npm run verify:legacy`); older missing archives have not been fabricated. No claim that every historical test passes is made.

## Remaining limits

Real installed Chrome MV3 integration, current Meta DOM compatibility, automatic scrolling on live ads, service-worker suspension/resumption and full live collection remain unverified. The user will perform the live test. A passing offline test does not establish production readiness.

`extension.zip` is the current distributable; extract and load its manifest folder. `extension/` is the matching unpacked runtime. Older `review/` packages are historical.

Original upstream: https://github.com/nafiz-pranto/LeadNoria
