> Historical report: the 40-Page cap and export columns below are superseded by [the current benchmark](about-contacts-five-column-benchmark.md).

# Public Facebook Page evidence — 25 October 2026

The user reports that the preceding basic collection build worked in their live test. This report does not treat that as a live test of the new Page enrichment.

## Research findings and decisions

An ad's Messenger destination does not establish whether the business has a website. Keep the ad destination/CTA and the business's Page-listed website as separate fields.

Meta describes Page transparency country information as the primary country location of people who manage a Page. It is therefore not sufficient proof of business headquarters. Source: [Meta Page transparency](https://about.fb.com/news/2020/04/page-and-account-transparency/).

Chrome supports executing a self-contained reader in a tab with scripting and matching host permissions. Source: [Chrome scripting documentation](https://developer.chrome.com/docs/extensions/reference/api/scripting).

## Implemented

- During user-started ad collection, read the advertiser's public About section in a separate inactive, owned tab. Never close a user-owned tab. Close each owned Page tab after checking.
- Require a supported Facebook Page URL, matching final Page identity and matching visible business name. Redirects to another identity do not supply evidence. Home-page posts are not used as About data.
- Read visible About website links and matching published business structured data. Decode Facebook link wrappers locally. Exclude Messenger/social destinations, Maps address links, Meta infrastructure links and links inside posts.
- Extract explicit country evidence from the matching business address or a visible Maps address label. This bypasses the old eight-profile limitation when an address country is recognized in the current 81-country/region catalogue. It does not provide complete worldwide coverage or independent verification of the address.
- Multiple address countries produce an unknown origin for review. The target country remains separate. Manager-country locations are not used as headquarters evidence.
- Save Page check status, source URL, time and explanation. Display them under a collapsed Facebook Page check in lead details. Export them alongside a separate Page website column; preserve the original ad destination.
- Use Page websites in website filters/Sheets copy without changing the ad's messaging CTA. A website link remains unverified for reachability and ownership.
- Cache checks within the run, one Page at a time, with delays and bounded loading waits. Stop Page checks on a login/challenge. Honor Stop/Pause. The current limit is 40 new unique Page checks per run; unexamined/budget-limited Pages stay unverified.

## Limits

Missing links never prove that a business has no website. Blocked, missing, identity-mismatched and unexamined Pages do not become website-free leads by certainty.

Real Facebook About layouts and current structured data availability vary and have not been live-tested in this build. Strict name matching may leave valid aliases unresolved. Scripts read public content only; they do not sign in, click through challenges, fetch external business websites or use paid services.

The legacy LOCAL_VERIFIED/FOREIGN_VERIFIED enum labels remain for compatibility. New Page-address classifications are inferences from a public business claim, not independently verified ownership, headquarters or physical presence. Source and reasoning are preserved.

## Verification

28 current offline suites plus TypeScript/build pass. New tests cover the Messenger+website case through batch processing, UI mapping and CSV; country separation; non-profile country DE; conflicting addresses; wrong Page/name; missing link; Maps exclusion; cache, cleanup, cancellation and login stop.

An isolated Chromium test of local HTML checks the actual DOM reader, matching business schema, post-link exclusion and login detection. The prior one-click inline UI test also passes. No new live Meta/MV3 success is claimed.

## Next quality work

Prioritize real About-layout fixtures across languages, broader country names/address profiles, a clearly separate listing-versus-verified website state, and business-contact evidence with source/time. Then measure precision on labelled local/foreign/unknown samples before changing qualification thresholds. Keep uncertain records available for review rather than increasing counts through guesses.
