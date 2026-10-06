# Product analytics

PostHog EU project **296412**, ingestion `https://eu.i.posthog.com`.
The committed `phc_` key is the public ingestion token. No admin key is needed to collect events.

## Questions this answers

One dashboard, **London Cine — growth and friction**, covers weekly visitors, acquisition,
new/returning lifecycle, retention, meaningful feature use, discovery and account activation,
search/filter zero results, import health, API failures, and friends/shared discovery from PR 17.
Production events only; your own activity is included.

Visitors have a persistent random browser ID; successful sign-in links it to an opaque account ID.
Accounts count as new only after their first successful verification. Existing accounts are the
baseline, not backfilled signups. Same-person comparisons across browsers remain approximate.
Direct traffic includes bookmarks and unattributed sharing; it cannot prove word of mouth.
A booking event means an outbound click, not a purchase. Friend request and acceptance involve
different people, so the dashboard compares their counts rather than using a conversion funnel.

## Event contract

| Area           | Events                                                                                                           | Useful properties                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Visits         | `$pageview`                                                                                                      | route, visit source/referrer domain/UTMs, landing route, device type           |
| Discovery      | `search_performed`, `filters_changed`, `film_opened`, `booking_clicked`, `screening_details_clicked`             | settled query, result count, filter values, film/venue IDs, sold out           |
| Accounts       | `account_opened`, `sign_in_requested`, `sign_in_verified`, `signup_completed`, `account_deleted`                 | opaque actor; verified signups only once                                       |
| Own watchlist  | `watchlist_connected`, `watchlist_disconnected`, `watchlist_used`, `watchlist_import_requested/completed/failed` | result/item count, first import, duration, manual/scheduled                    |
| Preferences    | `digest_preference_changed`, `friends_digest_preference_changed`, `app_username_saved`                           | enabled/weekday or first setup; no usernames                                   |
| Friends        | `friend_request_sent/accepted/cancelled/declined`, `friend_removed`, `shared_watchlists_used`                    | selection counts, all-friends flag, any/all match, result count; no friend IDs |
| Public imports | `public_watchlist_import_requested/completed/failed/cancelled`                                                   | item count, duration, controlled failure category                              |
| Failures       | `api_request_failed`, `catalogue_load_failed`, `showtimes_load_failed`                                           | allowlisted endpoint, status, controlled failure category                      |

Search/filter capture waits 600ms for a settled action and loaded results; background updates do
not create repeated search events. Import outcomes are emitted only after the authoritative D1
write succeeds, ignoring stale/replaced jobs. Analytics failures cannot block app operations.

## Privacy and environment

No session replay, automatic click capture, heatmaps, performance or exception collection.
No emails, app/Letterboxd usernames, friend identities, sign-in tokens, raw URLs or error messages.
Search text is deliberate, limited to 200 characters, with URLs, emails and common tokens redacted;
this is not a general personal-data detector. Properties pass a strict allowlist. URLs are rebuilt
from known routes, omitting queries and fragments. GeoIP collection is disabled.
Browser Do Not Track is respected. Scheduled job measurements are independent of browser DNT.

Collection is enabled only on the canonical production host and production watchlist importer.
Cloudflare preview disables `POSTHOG_ENABLED`; local browsers are disabled unless the explicit
`VITE_ANALYTICS_TEST=1` test override is set. Test events always use `environment=test`.
No calendar-specific instrumentation was added.

## Dashboard setup

Preview the complete definition without authentication:

```sh
npm run analytics:dashboard -- --print
```

Create/update the one dashboard with a locally supplied `POSTHOG_PERSONAL_API_KEY` environment
variable, scoped to dashboard and insight read/write. Never commit it or put it into Vite variables.

```sh
npm run analytics:dashboard
```

The script reuses its dashboard by name and insights within that dashboard by name, so rerunning
updates definitions without creating duplicates. This setup needs authenticated PostHog access;
the public ingestion token cannot manage dashboards. Queries must be verified in PostHog after
setup. They remain empty until production deployment; retention takes subsequent weeks to mature.
API reference: https://posthog.com/docs/api/dashboards and https://posthog.com/docs/api/insights.

## Verification and rollout

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run e2e:analytics
npm run e2e:accounts
```

Analytics browser checks run desktop and 390px mobile with synthetic fixtures and intercepted
PostHog requests, recording videos under `~/.Codex/london-cine-info/analytics/verification`.
They verify event counts, zero results, stable visitor IDs, secret stripping, no replay and layout.
CI uses test-results instead. No test events are sent to the live project by these checks.
The account suite covers sign-in and social workflows; unit integration tests additionally verify
one signup despite repeated sign-ins and preserved attribution on server events.

Deployment must apply `0008_analytics_signup.sql` before the API is promoted (the deployment
workflow applies migrations). After deployment, check Live events for a pageview, search, verified
sign-in, successful watchlist import and shared watchlist use, then confirm all dashboard queries
render and exclude `environment=test`. Set `POSTHOG_ENABLED=false` to stop server/import tracking;
remove/disable browser initialization to stop browser tracking.
