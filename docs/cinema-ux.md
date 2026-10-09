# Cinema preferences and watchlist UX

Cinema search and borough/radius filters operate on available options, independently of the complete selected-ID set. The original manual-save implementation already retained selections during search; closing its unsaved draft discarded them. A browser run of the unmodified 956e6d6 base confirmed A → search B → select B → clear search retains both; unsaved dismissal returns to zero, while explicitly saved choices survive reload. No search-specific root cause was reproduced. Regression coverage now includes selection through search, geography, dismissal and reload, including preserving Tomorrow + Evening filters.

Cinema edits update the active filter immediately. The application-level hook retains desired choices outside the dialog lifecycle, serializes account writes and coalesces interactions while a request is pending. Only acknowledged writes show Saved. Failed browser storage retains guest choices in memory and explicitly reports the persistence failure. Account writes use the last acknowledged version; conflicts retain local choices and offer a deliberate **Use saved choices** recovery. That recovery discards pending edits only after successfully loading the saved state. Identity epochs prevent old writes from updating state after sign-out or account switching. Guest merge and server-side version protection are unchanged.

**Edit cinemas** is contextual to the active My cinemas filter, including an empty selection, and remains outside the phone Quick filters dialog. Navigation uses the existing Film pages landmark, with Discover and For you groups followed by Preferences.

## Chooser layout

Search stays above the compact tool row and cinema results. The dialog has a bounded height: only the results scroll, while selected-cinema chips, save status and Done remain visible in the footer. Near me and Borough controls open compact panels 4px below their own triggers, clamped to the chooser width even when the toolbar wraps; successful postcode lookup closes its panel and exposes the radius control in the toolbar. Clicking outside a tool or focusing search dismisses it. Escape closes an open tool first and restores focus to its trigger. The location disclosure is abbreviated and lives inside the optional panel.

## Geographical discovery

Distances use the Haversine formula and existing venue coordinates, with a 3958.7613-mile Earth radius. Ties sort by cinema name then ID. Missing, nonfinite, out-of-range and (0, 0) coordinates are unknown, never zero distance. Unknown locations appear at the end of nearest-first results and are excluded by a finite radius. Search, multi-select boroughs and radius combine without removing selections.

The real-data preview audited on 8 October contains 465 venues; all have finite in-range, nonzero coordinates. This is a validity check, not a claim of surveyed accuracy.

Postcodes are sent directly to [Postcodes.io's single-postcode endpoint](https://api.postcodes.io/docs/api/lookup-postcode/) only after Find location is pressed. Its [API documentation](https://postcodes.io/docs/api/api-reference-postcodes-io/) describes a free service requiring no authentication. No autocomplete polling is used: one request per submitted lookup, a 10-second timeout, and explicit feedback for invalid postcodes or service failure. No guaranteed availability is assumed; users can continue searching and browsing boroughs. Geolocation is requested only after Use my location. Origin coordinates and postcode text stay in component memory, are excluded from analytics and shared URLs, and are never persisted. The UI discloses the third-party postcode request; requests omit the referrer.

Travel zones remain blocked by data and assignment policy. [TfL's rail and Tube map](https://tfl.gov.uk/assets/downloads/london-rail-and-tube-services-map.pdf) describes station fare zones, including stations in multiple zones. No authoritative cinema-to-zone mapping was established. A nearest-station approximation would require an explicitly chosen policy and a maintained source; boroughs are not relabelled as zones.

## Hide watchlist ratings

The browser preference defaults off and applies to the Watchlist page and catalogue views with My watchlist enabled. Rating columns and expanded cards are omitted, including the mobile selected-sort column. Rating sort options are removed; an incoming rating sort has Title ascending as its effective sort. The original URL sort and rating column order remain available when ratings are shown again. Trailers, titles, showtimes and booking actions remain available. Storage failure is reported in Settings. This preference is browser-local, not synced to the account.

## Verification

Unit checks: distance symmetry, known coordinates, unknown values and inclusive radius boundaries; display scoping and restored ordering.

Browser checks use deterministic screening fixtures, desktop and 390px viewports, and an isolated local account database. The cinema suite covers real guest merge, cross-device removal, failures/retry, serial rapid edits under a held response, dialog dismissal, blocked browser storage, conflicts, background focus and sign-out while a response is pending. Geography checks cover successful and invalid postcodes, denied location and selected cinemas outside visible filters. Watchlist checks cover remembered hiding, rating-sort URLs, expanded details, mobile sort options and normal All movies display.

Replay from the worktree:

```sh
npm ci
npm run build-data -- --fixture
npm run build
npm run e2e:accounts -- --grep 'guest search|serialized rapid|blocked guest|real favourite|old pending|postcode failures'
npm run e2e -- tests/e2e/hide-ratings.spec.ts
```
