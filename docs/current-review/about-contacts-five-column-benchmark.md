# About contacts and five-column benchmark

## Behavior

Each unique observed business Page is attempted through public About and, when fields are missing, contact/basic information. Published website, email and phone observations retain their source and time internally. Same-Page results are cached. There is no 40-Page cap. Login/access barriers stop enrichment; unavailable values stay blank. A messaging CTA never establishes that a business has no website.

Exports contain only Page name, Page URL, Website, Email, Phone. Copy uses tab-separated cells for Sheets; download uses quoted CSV. Formula-like cells are escaped. Complete stored results are loaded before export, including records beyond the 50-row progress preview. Missing storage rows disable export until recovered.

## Evidence and scope

- 29 offline workflow suites; TypeScript, unpacked build and ZIP immutability checks.
- Mocked Chrome benchmark: 65 unique Page attempts, contacts, caching and five-column output.
- DOM fixture: visible public contacts retained; unrelated posts, hidden contacts and Maps links excluded.
- Actual isolated Chromium MV3: real service worker, content script, tabs, scripting, IndexedDB, UI, download and clipboard against two intercepted advertiser fixtures. Contact-section fallback and Bengali output verified.
- 65 seeded stored records: all exported despite a 50-row run preview. Removing one record blocks export; restoring it and Retry recovers.

Reports: [offline](about-contacts-offline-report.json), [MV3 fixture workflow](about-contacts-mv3-report.json).

No personal browser was used. Fixture requests were intercepted and other network traffic blocked. These checks do not establish current live Facebook layout compatibility. Country remains unknown without sufficient published evidence; public contact syntax is not a deliverability or ownership guarantee. External website crawling and paid/API collection are not used.
