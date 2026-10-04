# Accounts and Letterboxd watchlists

Implementation lives on `codex/watchlist` (draft PR #6). Resend sender verification
is complete and its key is installed in Pages production and Actions. The apex
DNS points to Pages and the domain serves over HTTPS. Manual
refresh still needs a GitHub dispatch token. Ordinary browsing works without it.

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
   secret. Install `GITHUB_DISPATCH_TOKEN` as a Pages production secret; use a
   fine-grained token with Actions: write for this repository only. Do not paste
   keys in chat or committed files. Wrangler prompts privately:

   ```sh
   npx wrangler pages secret put RESEND_API_KEY --project-name london-cine-info
   npx wrangler pages secret put GITHUB_DISPATCH_TOKEN --project-name london-cine-info
   gh secret set RESEND_API_KEY --repo thesquaredD/london-cine-info
   ```

4. Give the existing Actions `CLOUDFLARE_API_TOKEN` D1: Edit in addition to Pages:
   Edit. The OAuth used for local setup has D1 access, but the existing Actions
   token failed the remote D1 preflight with Cloudflare code 7403. Its current
   scope is Pages only; add D1 access before activating account jobs. The configured account is
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

Daily screening reconciliation tracks absent films. The weekly email includes
watchlist films with screenings that were never alerted, or have been absent for
more than 30 days. Failed/stale imports are excluded from mail delivery. Combined
movie IDs sharing a Letterboxd slug are deduplicated. Resend idempotency keys are
stable per account/day, and a shared atomic quota keeps combined sign-in/digest
requests under 90 emails in a 24-hour window. Users beyond that cap wait for the
next weekly run. Unsubscribe works without signing in; deletion cascades through
all account data.

Email templates currently use plain text. The remaining v1 visual polish stays
deferred as agreed in PLAN.md.
