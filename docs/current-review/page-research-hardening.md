# Public Page workflow engineering review - 26 October 2026

## Plan and implemented decisions

Keep the user flow unchanged: keywords + country -> Start -> collect advertiser cards -> inspect their public Page About/contact -> qualify and deduplicate -> save -> copy/download five columns. Advertisers come from observed Ad Library cards, not an independent Facebook Page search. Country selection describes the ad search, not proof of business origin.

| Failure mode | Implemented change | Evidence |
| --- | --- | --- |
| Page says loaded before contacts render | Wait for observed identity and fields; incomplete sections get a bounded eight-second polling window | Mock delayed fields and actual MV3 delayed-contact fixture |
| Website, phone and email render at different times | Merge independently matched snapshots instead of replacing earlier observations | Disappearing-field test |
| Navigation briefly exposes the old Page heading | Reject those observations and continue bounded polling | Stale-heading test |
| Browser destroys an execution context during navigation | Retry one script failure, preserve prior observations if reads fail again | Transient-execution test |
| One navigation failure poisons the run cache | Cache confirmed checks, allow a later ad to trigger a second visit; at most two failed visits per identity | Navigation recovery and bounded-failure tests |
| Same URL is paired with another advertiser name | Cache key includes canonical Page URL and normalized advertiser name | Cross-name cache test |
| User stops during enrichment | Cancel waits, close owned tab, do not cache incomplete reads or spend retry budget | Cancel/resume test |
| Access restriction appears after some fields were read | Preserve earlier confirmed fields, mark restriction and stop subsequent Page visits | Restriction-preservation test |
| Hidden/post/navigation content looks like contact information | Read visible business content, exclude posts/nav/forms and hidden elements; detect a visible login overlay | Isolated DOM test |
| Published phone uses non-Latin digits | Normalize Bengali, Devanagari, Arabic, Persian and full-width digits before phone validation | Contact and DOM tests |

An observed link is not proof of website ownership/reachability. Missing links do not prove no website exists. No phone/email or business country is guessed. Export stays exactly Page name, Page URL, Website, Email, Phone. Publicly published business contacts only; no login or challenge bypass and no external website crawl/API.

## Research basis

Chrome documents that worker globals can disappear and storage is needed for durable results: [service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle). The existing IndexedDB result/checkpoint persistence is retained. This patch does not claim recovery of an in-flight Page read after forced worker termination; a durable enrichment queue is a further step requiring its own lifecycle tests.

Playwright documents that modern pages continue lazy rendering after load and hydration can lag visible content: [navigation and hydration](https://playwright.dev/docs/navigations). This supports field-based polling and delayed-render fixtures rather than trusting only document load or one fixed delay.

Implementation limits: serial Page checks trade speed for bounded load; incomplete sections can take longer than before. Cache is per run. Conservative exact normalized name checks can reject renamed/redirected Pages. Visible fields and DOM structures can differ on real Facebook. Fixture passes do not prove live Facebook compatibility.

## Validation

Current offline report: page-resilience-offline-report.json. Browser report: page-resilience-mv3-report.json. The MV3 browser uses a new isolated profile and intercepted fixtures; the contact section injects fields 3.5 seconds after load. Network outside fixtures is blocked. The existing 65-record export/retry scenario and exact five-column contract remain covered.
