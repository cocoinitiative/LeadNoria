# Simple collection UI — 25 October 2026

- Country, custom keywords or editable preset, website choice, and one Start collecting button.
- Start launches directly on the same Search screen. The review dialog and automatic navigation to Search progress are removed from this flow.
- A spinning muted-purple ring displays the collected-lead count. Stop stays beside this simple progress area. Results and CSV/Sheets export remain available after collection.
- Technical stage graphs, run IDs, source IDs and checkpoints are removed from the normal progress view. Troubleshooting stays behind a collapsed control in the secondary progress view.
- The user's Leads Sniper screenshots guided the simpler layout; its branding, paid controls and CAPTCHA service were not copied.

Verification: 27 existing current offline suites passed. Final type check and isolated Chromium UI checks cover one-click start, no confirmation dialog, staying on Search, a count update from 0 to 7, animated ring styles, Stop, the export action and a 360px layout. Chrome messages were mocked; this is not a live Meta collection test. The screenshot shows synthetic test progress.

Run the optional UI check with `node tests/test-inline-collection-ui.mjs` after building. It needs Playwright's Chromium executable. Real Meta testing remains the user's test.
