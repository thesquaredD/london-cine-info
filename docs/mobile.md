# London Ciné Info phone apps

The Expo SDK 57 app in `mobile/` shares the website's data, accounts and selection logic.
It is implemented for preview builds. Store launch is gated by the device checks below;
`mobile_app` stays false in `changelog/features.json` until both listings are verified.

## Setup

Use Node 24 or later. Install the npm workspace from the repository root:

```sh
npm ci
npm run build-data -- --fixture
npm run typecheck
npm run typecheck:mobile
npm run lint
npm test
cd mobile
npx expo-doctor
npx expo export --platform all
npx expo start --dev-client
```

The workspace pins a single React 19.2.3 through a root development dependency and override,
so optional web SDK peers cannot install a second React alongside the native app. The root
website compiler remains TypeScript 5.9; the mobile workspace uses the SDK-supported 6.0.

The export builds iOS and Android only (`platforms` excludes web). It tests Metro and Hermes
compilation; it does not prove a signed native build installs or works on a phone.

Create an Expo account/project and associate it once, from `mobile/`:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform all --profile development
```

Keep the resulting project ID in app config; do not commit account tokens, provisioning
profiles or signing credentials. The package and bundle ID are `info.londoncine.app`.
Development builds include the dev client. Preview builds use internal distribution
(Android APK; iOS ad hoc devices must be registered). TestFlight uses a production-signed
iOS build followed by EAS Submit. `ios/` and `android/` are generated, never committed.
SDK 57 always uses the New Architecture: its config schema no longer accepts
`newArchEnabled`. Minimum OS versions follow SDK defaults.

## Shared code

`@lci/core` exports TypeScript source from `packages/core/src`. It has no build step and
compiles without DOM or Node ambient types. Vite, Vitest, tsx and Metro consume the same
files. The event index producer is `event-index.ts`; event selection is `events.ts` to
avoid their old shared/lib filename collision. URL and URLSearchParams are standard
runtime globals described by a small declaration file, rather than importing Node code
or enabling DOM types. ICS folding counts UTF-8 octets without a TextEncoder dependency, including malformed Unicode.

Each list owns a ViewState held in memory, preserving it while switching tabs and visiting
details. The collection is `path`. Share uses the core website URL builder. Film detail
is pushed above the tabs so Events and Radar retain their position when going back.
The core selector, screening matcher, facet counts, collection grouping, Events and Radar
are reused. My cinemas updates concrete venue IDs as saved preferences change.

Phone text follows the reading-system scale in `mobile/src/ui/tokens.ts`: body 16/24,
small 14/21, lede 17/25.5, headings 20/26 and 30/34.5; gaps are 12 and sections 40.
Colours transcribe base.css and the final Picturehouse palette. No paid/display font is
bundled: the system face is the explicit fallback until an app embedding licence for
Clash Display is confirmed. Icon and splash are rasterised from `public/favicon.svg`.

## Catalogue loading

The data producer publishes identical manifests to `src/generated/manifest.json` and
`public/catalogue.json`. The public URL is no-cache; hashed data files remain immutable.
Deployment verification checks the expected generation, film hash and an HTTP 200 response
from that film file, alongside revision/changelog verification.

1. Read and validate the last complete generation from the phone cache, and render it.
2. Request `https://london-cine.info/catalogue.json` on every launch. Fetch films, metadata
   and events when generatedAt is newer. Validate the complete set before replacing it.
3. Write one complete file in the OS cache, then commit its name to an AsyncStorage pointer.
   A partial write never replaces the active generation. Clean obsolete generations after
   committing. Disk failure leaves fresh listings usable, with a cache notice.
4. On foreground, refresh if the last successful check was over 30 minutes ago. Concurrent
   refresh requests share one operation. No periodic background task is registered.
5. Refetch the manifest once if a hashed file returns 404. Never retry indefinitely.
   Details load on demand and are cached in memory for the catalogue generation.
6. On a newer unsupported schema keep the old catalogue and ask for an app update. Invalid
   or evicted cached files fall back to network loading. No cache plus no connection shows
   a recoverable empty state.

Schema changes should be additive. Before a breaking schema deploy, release an app that
reads both versions, add a tested adapter, and accept the previous schema for 30 days.
There is no claim that an arbitrary older schema is automatically compatible.

## Sign-in and account storage

The app requests the same sign-in email as the website. It sends an explicit same-origin
header on unauthenticated POSTs because the API's existing origin protection still applies.
The email includes a website link and a six-digit code; both expire after 15 minutes.
The code is bound to the normalised email and newest live token row. Five wrong attempts
invalidate that row, and attempts are rate limited. Successful code redemption consumes
all of the account's sign-in tokens and returns a session without setting a cookie.

The app stores the raw bearer session only in SecureStore (device-only keychain on iOS).
It never puts it in ordinary preferences, navigation parameters, logs or analytics. Sessions
use the same rolling 90-day expiry as the website. A 401 clears the local session and shows
“Your session has expired. Please sign in again.” A stale response cannot clear a different
account's new session. Bearer writes need no Origin; valid cookie sessions retain precedence
and still require Origin. The server does not enable browser CORS.

Guest cinema preferences use a persisted UUID and stable venue IDs in AsyncStorage. On
sign-in, POST /api/cinemas performs the server's receipt-based union once for that UUID and
account. Subsequent loads cannot undo remote removals. PUT uses the acknowledged version;
a 409 retains the draft and offers reloading saved choices. Account data is scoped by user
identity and hidden immediately on sign-out. Guest preferences remain separate.

Account data has no offline mutation queue. Network failures preserve drafts for retry.
Calendar snapshots use the existing API; phone-calendar actions open the OS event editor
through the supported SDK 57 calendar legacy module, avoiding calendar reads. Export-all
builds ICS with core and opens the native share sheet. Session expiry and deletion clear
account state. Delete requires a native confirmation and calls DELETE /api/me.

## Privacy

Privacy policy: https://london-cine.info/privacy. Keep its implementation and
`docs/privacy-policy.md` aligned with the final app binary.

- Account email and saved preferences use the existing server and retention rules.
- Near me asks for foreground coarse location, calculates distances on the phone and never
  saves or transmits coordinates. Denial offers Settings and manual cinema filters.
- The app never reads existing calendar entries. The system editor confirms additions.
- Usage analytics is off by default. The Account switch persists the choice before enabling
  the SDK. Events use the website's names and property allowlist. Requests carry
  X-Analytics-Enabled; no session token, email, search text or coordinates are event properties.
- Cache files can be evicted by the OS. Signing out clears the secure session, not guest
  cinemas or display choices. Account deletion removes server-owned data.

Do not select store disclosure answers solely from this list: inspect the release binary's
permissions, SDK privacy manifests, Expo/Apple/Google diagnostics settings and actual optional
analytics configuration before submission.

## Builds and release

`mobile/eas.json` defines development, preview and production. Production auto-increments
build numbers. runtimeVersion uses appVersion; EAS Update is not configured for v1.
The Phone apps workflow checks relevant PRs, including native bundles and Expo Doctor.
Cloud builds run only on manual workflow dispatch with EXPO_TOKEN configured. The initial
EAS project association and signing setup must exist before non-interactive CI builds.
Store submission is manual from the maintainer's machine:

```sh
cd mobile
npx eas-cli@latest build --platform all --profile preview
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios --profile production
npx eas-cli@latest submit --platform android --profile production
```

Apple Developer and Play accounts, signing, store copy, screenshots and distribution groups
are maintainer-owned. Use TestFlight internal testing and the required Play closed test
before production. Check the current account-specific Play eligibility requirement.
Do not enable mobile_app or publish a “now available” announcement before store listings work.

### Review notes for Apple

London Ciné Info helps people choose screenings at London cinemas. The app has native tabs,
search and navigation; location-based discovery; account cinema preferences; a Letterboxd
watchlist; and a saved screening calendar with native calendar/share actions. Listings refresh
independently of store releases, and cached listings remain readable without a connection.
Booking opens the cinema's own website. The app does not sell cinema tickets or digital goods.
Accounts are optional, use email codes, and can be permanently deleted from Account inside
the app. Supply App Review a controlled account/email-code access arrangement before submission.

### Device and stack gates

These are pending until recorded on actual iPhone and Android preview builds. They are
not satisfied by a successful Metro export. No store registration, EAS build or submission
was performed during local implementation.

| Gate                                                                      | iPhone  | Android | Evidence required                                     |
| ------------------------------------------------------------------------- | ------- | ------- | ----------------------------------------------------- |
| Hermes Unicode normalisation, numeric collation and London/DST formatting | Pending | Pending | Diagnostics results and device/OS                     |
| Native tabs, pushed stack and native header search                        | Pending | Pending | Navigation recording; JS-tabs fallback only if needed |
| Live catalogue scroll (about 1,500+ films), mid-range phone               | Pending | Pending | Frame/performance recording                           |
| Mobile-data download under 3 seconds; warm cached render under 1 second   | Pending | Pending | Timings with device/network conditions                |
| Signed preview installs                                                   | Pending | Pending | EAS build IDs and install result                      |
| TestFlight / Play closed-test completion                                  | Pending | Pending | Distribution records and dates                        |

The plan's three-day stack spike remains an explicit go/no-go gate. The implementation
provides the shared core and native bundles needed to run it, but does not invent a positive
device result. If a separate experimental spike is needed, use codex/mobile-spike and never
merge that experimental branch.

### Device flows before every store release

Record the device, OS, app version, backend revision, date, video and result for each flow:

1. Launch once online, terminate, disable network, reopen: cached catalogue and freshness
   notice; no cached catalogue: retry state. Restore network and refresh.
2. Select Today and one cinema; compare results to the website. Repeat with exclusions and
   special-format Radar/Event filters. Include London DST and midnight behavior.
3. Open Filters; search options, exclude one, change year/time, close by gesture. Android
   back closes the sheet before navigating away. Verify keyboard, large text and safe insets.
4. Near me: deny permission, open Settings, grant coarse permission, change radius, apply
   cinemas. No coordinates in persistent storage or analytics.
5. Request email, enter code, confirm signed-in user. Test wrong/expired code and resend.
   Compare unchanged website link sign-in. Expire the session and confirm recovery wording.
6. Choose guest cinemas, sign in, verify union once. Remove a cinema from another device,
   reload, confirm no resurrection. Force a version conflict and retry or reload.
7. Connect Letterboxd, refresh, observe queued/importing/complete or failure. Open Watchlist,
   change title mode, rating order and hide ratings. Refresh must respect cooldowns.
8. Save a screening, find it in My calendar, add it via system calendar editor, export all,
   inspect the ICS, remove the saved screening. Test API failure without a false success.
9. Toggle analytics off/on/off and inspect permitted events. Sign out, confirm account data
   disappears and guest cinemas remain. Sign into another account; no former account data.
10. Delete a test account through the native confirmation and confirm the server record and
    saved screenings are gone. Verify both themes, phone rotation and large text.

### Local implementation verification

Record final command results here before handoff. Native device, EAS and store checks must
remain marked pending until evidence exists. Browser tests run against local synthetic data,
never production or real sign-in emails. Respect the repository's production-browser constraint.

Local checks on 16 October 2026 (Node 26 locally; CI uses Node 24):

| Check                                                  | Result                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Website, scripts, server and DOM-free core type checks | Passed                                                                         |
| Mobile SDK TypeScript check                            | Passed                                                                         |
| ESLint and changelog validation                        | Passed                                                                         |
| Vitest                                                 | 185 tests passed                                                               |
| Website catalogue browser suite                        | 133 passed; 3 existing platform-specific skips                                 |
| Website analytics browser suite                        | 32 passed                                                                      |
| Website real-Functions account browser suite           | 50 passed (final full run)                                                     |
| Expo Doctor                                            | 21 of 21 checks passed                                                         |
| iOS and Android production Metro/Hermes export         | Passed; approximately 4.9 MB / 5.1 MB                                          |
| DOM boundary negative check                            | Compiler rejects window, document, localStorage, fetch, navigator and location |

Early full account runs encountered hanging local API POSTs. The final implementation
retains the existing cookie flow's request-body reading order; targeted affected flows and
then the complete account suite passed. No assertion was relaxed. Recorded local account
verification is under `~/.Codex/london-cine-info/mobile/verification/accounts-final/`.

Physical-device UI, performance, EAS installation and store checks remain pending. This
machine has no simulator runtime or Android device tooling. No production browser action,
production migration, website deployment, signed EAS build or store submission was performed.
