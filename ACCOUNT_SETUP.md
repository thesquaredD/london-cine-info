# Accounts and Letterboxd watchlists

Implementation lives on `codex/watchlist` (PR #6). Resend sender verification
is complete and its key is installed in Pages production and Actions. The apex
DNS points to Pages and the domain serves over HTTPS. The repository-scoped GitHub dispatch token is installed in Pages production
and successfully dispatched the CI workflow. The Actions Cloudflare credential passed the remote D1 preflight. Ordinary browsing works without it.

## Platform

`wrangler.toml` is the source of truth for Pages bindings. Production and preview
have separate D1 databases and KV namespaces. Migrations are already applied to
both remote databases; CI applies them locally and deployment applies them remotely.
Never bind a preview deployment to the production account database. Deep links
use Cloudflare Pages’ [built-in SPA fallback](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering);
there is no `404.html` or conflicting redirect to normalize the URL to `/`.

Request-limit reservations use atomic D1 counters. KV is provisioned as planned,
but is not used to enforce security limits because it is eventually consistent.
Tokens and session cookies contain 256-bit random values; only SHA-256 hashes are
stored. Magic links require a confirmation POST, protecting them from mail scanners.
Sessions slide for 90 days; magic links expire after 15 minutes and redeem once.
Unsubscribe links use a per-account random 256-bit bearer token and confirmation
POST, rather than a signed token. It can only switch off emails, without login.

## Activate email and sync

1. Add `london-cine.info` to Cloudflare and move its nameservers at Namecheap. Check
   existing DNS records before moving them. Attach the domain to the Pages project
   `london-cine-info`. On 4 October 2026 the Cloudflare zone became active and the apex served Pages
   over HTTPS. Cloudflare assigned `betty.ns.cloudflare.com` and
   `cameron.ns.cloudflare.com`.
2. Add `mail.london-cine.info` in Resend. Install its SPF/DKIM records and a DMARC
   record in Cloudflare, then confirm the sender domain is verified. The configured
   sender is `London Ciné Info <hello@mail.london-cine.info>`.
3. Install `RESEND_API_KEY` as a Pages **production** secret and a GitHub Actions
   secret. `GITHUB_DISPATCH_TOKEN` is installed as a Pages production secret and was
   verified by dispatching CI. For replacement, use a
   fine-grained token with Actions: write for this repository only. Do not paste
   keys in chat or committed files. Wrangler prompts privately:

   ```sh
   npx wrangler pages secret put RESEND_API_KEY --project-name london-cine-info
   npx wrangler pages secret put GITHUB_DISPATCH_TOKEN --project-name london-cine-info
   gh secret set RESEND_API_KEY --repo thesquaredD/london-cine-info
   ```

4. Give the existing Actions `CLOUDFLARE_API_TOKEN` D1: Edit in addition to Pages:
   Edit. The OAuth used for local setup has D1 access, but the existing Actions
   token now has D1: Edit and is restricted to this account. After permission
   propagation and resetting the account ID, the manual CI platform preflight
   passed on 4 October 2026. Rerun it after credential changes. The configured account is
   `5d3189d7982be9522311dada6bf49ecc`.
5. Merge the implementation, deploy, then enable the repository variable
   `WATCHLIST_ENABLED=true`. Both the daily account job and manual refresh workflow
   remain off until this switch is enabled. Preview secrets are separate: keep
   email disabled there unless intentionally testing a verified sender.
6. Complete sign-in with your own email, save your public Letterboxd username, click
   Refresh now, and choose an email weekday if desired. Weekly email is **off by
   default**; Wednesday is the recommended selection. No real email delivery or
   real-user watchlist import was exercised by automated tests.

## Local replay

```sh
npm ci
npm run build-data -- --fixture
npm run build
npx wrangler d1 migrations apply london-cine-info --local
npm run e2e:accounts
```

This records the full desktop/390px sign-in → settings → watchlist → filter →
delete flow using synthetic accounts and a synthetic imported film. It uses real
Pages Functions and local D1, without sending email or fetching a real watchlist.
Local recordings/screenshots live under
`~/.Codex/london-cine-info/watchlist/verification/`; CI uses ignored `test-results/`.

For interactive local use:

```sh
npx wrangler pages dev dist --port 4174 --binding DEV_MAGIC_LINK=1
```

POST `/api/auth/request` with an email and matching Origin header. The JSON returns
a test sign-in link **only on localhost**. The website never exposes test links on
public preview or production hosts, even if the flag is accidentally set there.

## Account dialogs and import status

Account actions live in one modal dialog opened from the compact **Sign in** /
**Account** button in the sidebar (or the phone Pages drawer, which closes first so
dialogs never nest). The dialog holds sign-in, Letterboxd username, weekly email
weekday, import, sign out and a separate **Delete account** confirmation view.
Entered values survive failures; conflicting actions are disabled while a request
is in flight. Notices move to the top of the page when the dialog closes.

Migration `0003_import_status.sql` adds `started_at` and `attempt_id` to
`watchlist_sync`. The API derives one of five states from the row: `idle`,
`queued` (manual request recorded, importer not yet running), `importing`
(Actions claimed the job), `completed` and `failed`. A job with no completion
within 30 minutes is reported as failed ("stalled") and can be re-queued; the
daily run also reclaims it. Failure causes are stored as short codes
(`not_found`, `inaccessible`, `unavailable`, `incomplete`, `dispatch`,
`stalled`, `internal`) and translated to fixed user-facing messages; raw
upstream or provider text never reaches the client. A failed GitHub dispatch
refunds the hourly manual-refresh reservation. The Watchlist page shows the same
status, the last successful import time, the imported count versus London
matches, and distinguishes an empty public list from a list with no current
screenings. The client polls every 15 seconds only while an import is pending
and refreshes on window focus.

Preview deployments use the separate `london-cine-info-preview` database; apply
new migrations there manually before testing accounts on a preview:

```sh
npx wrangler d1 migrations apply london-cine-info-preview --remote
```

`tests/auth/import-states.spec.ts` drives every state with controlled API
responses (no real sign-in, email, dispatch or Letterboxd request) at both
widths; `tests/auth/accounts.spec.ts` records the real local Functions flow.

## Import and digest behavior

Public watchlists match exact Letterboxd slugs from Clusterflick ratings. Every page
must parse and the unique slug count must match the advertised count. Missing
markup, private lists, HTTP failures, loops or changing counts retain the last good
list and mark it stale. A truly empty public list replaces the stored list. Fetches
are limited to one per second and one refresh per account per day; manual refresh
is limited to once per hour. The importer stops at 500 pages/14,000 films.

The Actions scripts use parameterized D1 REST batches, and guard updates against
username changes or account deletion during a fetch. Public logs contain counts,
not account emails/usernames. Scheduled maintenance removes expired tokens,
sessions and request-limit records.

The weekly email includes future screenings through the London date ten days
ahead. A film is included when its latest screening in that window is newer than
its last announced screening, so later programmes appear in the week they screen.
An empty digest is skipped. Eight available film cards are followed by a compact
list for sold-out films and overflow, with later dates mentioned in the footer. Failed/stale imports are excluded from mail delivery. Combined
movie IDs sharing a Letterboxd slug are deduplicated. Resend idempotency keys are
stored with the exact email payload in a D1 delivery record per account/London date, and a shared atomic quota keeps combined sign-in/digest
requests under 90 emails in a 24-hour window. Users beyond that cap wait for the
next weekly run. Unsubscribe works without signing in; deletion cascades through
all account data.

Migration 0004 adds `digest_deliveries`. New digests use the `digest-v2/` key
namespace, avoiding the previous per-account/day key collision when the template
changed. A retry reuses the stored HTML, text, headers and key even after a rebuild;
alert writes and delivery completion share one atomic D1 batch. Sent payloads are
removed immediately; completed and never-attempted records are pruned after seven
days. An attempted but unconfirmed delivery is retained for reconciliation and
blocks later sends for that watchlist if its 24-hour Resend deduplication window
has expired. Inspect Resend's delivery record before marking it complete or
clearing it; never rotate its key blindly. Account deletion cascades these records.
Failures are counted with safe provider categories and do not block the rest of
the batch; the Actions run still fails so delivery errors remain visible.

Digests include inline-styled HTML plus a plain-text alternative; sign-in emails
remain plain text. Generate a sample without reading accounts or sending email:
`npx tsx scripts/preview-digest.ts .cache/digest-sample.html [ISO-date]`.
The sample uses a small selection from the currently built catalogue.
The remaining v1 visual polish stays
deferred as agreed in PLAN.md.

## Favourite cinemas

Migration 0005 adds account cinema preferences and per-browser merge receipts, both
removed by account deletion. `/api/cinemas` uses POST for a one-time guest union,
GET to read and PUT with the previous version to replace the selection. A stale
version returns 409; the UI preserves unsaved choices and offers reload/retry.
Guest choices and a random browser ID live in local storage. Account choices are
kept separately in memory and D1, so sign-out restores guest choices without
copying a previous account's favourites into another account.

The production deploy applies migrations automatically; an isolated hosted preview
needs `npx wrangler d1 migrations apply london-cine-info-preview --remote` first.
Replay `npm run e2e:accounts -- tests/auth/cinemas.spec.ts` after a fixture build for
recorded two-browser reconciliation, removal, failed-save and account-isolation
coverage. This uses synthetic accounts and dev magic links, without real email.

## Saved screenings and calendar export

Migration 0006 adds `saved_screenings`, keyed by account and a SHA-256 identity
of film, venue, UTC start and screen. Account deletion cascades these rows.
`/api/calendar` supports GET, POST (idempotent save/update) and DELETE; all require
an authenticated session and mutations require the same origin. The 1,000-event
cap is checked atomically during insertion. `/api/calendar/export` exports the
signed-in account's list or one owned ID; it never exposes another account's rows.
Exports are private and not cached.

`/my-calendar` keeps upcoming and past saved screenings. Individual and full
ICS downloads use UTC timestamps, stable event IDs and estimated runtime ends;
unknown runtime omits the end. Saved details are snapshots, with no subscription
or automatic programme-change updates. Guests can export one screening without
an account; persistent saved plans require sign-in.

Production deployment applies 0006 automatically. Apply pending migrations to an
isolated preview before testing it. Replay
`npm run e2e:accounts -- tests/auth/calendar.spec.ts` for recorded desktop/390px
save, persistence, failed-save retry, export, removal and account-isolation flows.
