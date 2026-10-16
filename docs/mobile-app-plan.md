# Plan: London Ciné Info as an iPhone and Android app

Written 16 October 2026 for the next agent. Base: `origin/main` at `285c63a` (PR #44).
Interview answers and the comparison of approaches: see "Decision" below. No code was changed
while writing this plan.

## Decision

dio's answers (interview 15–16 October 2026):

- A **more native experience** matters more than reusing the website. A separate phone
  interface is acceptable **if the backend and the filtering logic are shared**.
- First release: the existing browsing, filters, saved films (watchlist and My calendar) and
  cinema preferences. No push notifications, no offline synchronisation.
- Native navigation, gestures and controls, with London Ciné Info's branding.
- Mobile app and shared logic live in **this repository**, as an npm workspace with a
  **shared core package** that both the website and the app import.
- Builds come from **EAS Build and EAS Submit**, with no native folders committed.
- Email sign-in finishes in the app by **typing a one-time code** from the email.
- Screens are built with **React Native primitives and native navigation** (Expo Router).

Stack that follows: **Expo SDK 57** (React Native 0.86, the current release as of 30 June
2026), **Expo Router** with the native stack and native tabs, **FlashList** for the long lists,
a bottom-sheet library for filters, plain `StyleSheet` with a tokens file mirroring
`src/styles`, `expo-secure-store` for the session, `expo-file-system` for the catalogue cache,
`expo-location` for Near me, `expo-web-browser` for booking links, `posthog-react-native` with
the same event names as the website. Sources: [SDK 57](https://expo.dev/changelog/sdk-57.md),
[SDK 56](https://expo.dev/changelog/sdk-56.md),
[native tabs](https://docs.expo.dev/versions/latest/sdk/router/native-tabs.md),
[EAS plans](https://docs.expo.dev/billing/plans/).

Rejected, one line each:

- Capacitor wrapper or installable website: fails the "more native" requirement.
- React Native **without** Expo, Flutter, or two native apps: more to maintain for one person.
- Expo UI (SwiftUI and Jetpack Compose components): most native feel, but production-ready
  only since SDK 56 (May 2026), narrower styling, and layouts written twice where the
  platforms differ. Revisit for pickers and menus once the primitives version ships.
- NativeWind: a second styling vocabulary next to the website's CSS.
- Universal links and app links for sign-in: association files, entitlements and device
  verification for a flow that silently falls back to Safari. The code flow needs none of it.
- Separate repository: every shared-logic change becomes two PRs and a version bump.
- Local Xcode and Android Studio builds: cannot run from CI without a self-hosted Mac.
- EAS Update (over-the-air JavaScript updates): not in v1. App code ships through the
  stores; listings update through Cloudflare regardless.

Two release facts to plan around (both verified during the interview):

- Apple reviews whether an app does more than repackage a website (guideline 4.2). Native
  navigation, Near me, My cinemas, the saved calendar and the watchlist marker are the case
  to make in the review notes. Apple also requires **account deletion inside the app** when
  the app offers sign-in (guideline 5.1.1); `DELETE /api/me` already exists.
- Accounts: Apple Developer Program US$99/year, Google Play US$25 once, EAS free tier about
  15 iOS and 15 Android builds a month on a slow queue (Starter is US$19/month). New personal
  Google Play accounts need a closed test with 12 testers opted in for 14 days before
  production access. dio does these registrations; nothing in the plan depends on them until
  PR 7.

## Scope

In scope for the first store release:

- Five native tabs: **Films**, **Events**, **Radar**, **My films** (Watchlist and My
  calendar), **Account**.
- Films: the catalogue list with a collection switcher (All movies, New releases, Classics,
  Retrospectives, Release calendar), the native header search bar, the personalised shortcut
  strip (Today, Tomorrow, This weekend, This week, Evening, My watchlist, My cinemas, Near me),
  a Filters bottom sheet with every facet in `FILTERS`, sort, and a pushed **film detail**
  screen with screenings by day and cinema, booking links in an in-app browser, Save to My
  calendar, Add to phone calendar, and Share (the website URL for the film).
- Events and Radar with the same grouping and sections as the website.
- Account: sign in by code, Letterboxd username and import status with manual refresh, My
  cinemas picker, display preferences (title mode, hide watchlist ratings), analytics opt-in,
  Privacy and What's new (website pages in the in-app browser), sign out, delete account.
- Guest cinema preferences stored on the phone, merged into the account on sign-in as the
  website does.
- Fresh listings at every launch and on returning to the foreground, with the last catalogue
  cached so the app opens instantly and still shows data without a connection.
- Light and dark mode following the system; Android back gesture; keyboard and inset handling.
- Phones only. iPad and Android tablets install the phone layout (`supportsTablet: false`).

Out of scope (do not build these in v1):

- Friends pages, digest settings (weekday, friends digest), the feedback form and the
  changelog page as native screens. Account links to the website for these.
- Push notifications, background refresh, offline synchronisation of account data.
- EAS Update, widgets, Siri or App Intents, Apple Watch, CarPlay.
- Expo web output. The Preact website stays the website.
- Any change to the website's interface. PRs 1–3 touch shared code and the server only and
  must leave the website's behaviour and test suites unchanged.

## Where things are today

Catalogue and data:

- `src/lib/data.ts:1` imports `src/generated/manifest.json` at build time; `loadCatalogue`
  (`:16-37`) validates `schemaVersion` and film counts; `loadShowtimes` (`:39-56`) fetches
  one hashed file per film and caches the promise.
- `scripts/lib/output.ts:41-49` builds the manifest (`films`, `meta`, `showtimes`, `events`
  as content-hashed paths under `/data/`) and writes it only to `src/generated/manifest.json`
  (`:84`). Nothing public points at the current data files.
- `public/_headers` serves `/data/*` as immutable for a year and `/version.json` and
  `/changelog.json` as `no-cache`. Each Pages deploy replaces the whole site, so the previous
  deploy's hashed files disappear; the Deploy workflow runs twice a day (`45 6,11 * * *`).
- `scripts/verify-deployment.ts` checks `/version.json` after deploy.
- `src/shared/data.ts:1` `DATA_SCHEMA_VERSION = 2`, the `Film`, `DataMeta`, `Venue`,
  `ScreeningFacet` types.

Logic that is already free of the browser (candidates for the core package):

- Everything in `src/shared/`: `account`, `analytics`, `calendar`, `changelog`, `data`,
  `events`, `feedback`, `friends`, `ical` (with their tests).
- `src/lib/catalogue.ts` (`ViewState` `:26-48`, `defaultSort`, `nextSort`, `readView`,
  `viewUrl`, `selectFilms` `:241`, `sortFilms` `:273`, `tableRows`, `formatDate` using
  `Intl.DateTimeFormat` with `timeZone: "Europe/London"` `:299-303`), `src/lib/filters.ts`
  (`FILTERS` `:5`, `CLEAR_FILTERS` `:16`, `dateShortcut`, `eveningShortcut`, facet counts;
  `Intl.DateTimeFormat` at `:40` and `:351`), `src/lib/shortcuts.ts` (`shortcutItems` `:16`;
  depends only on the `user`, `watchlist`, `venues`, `loading` fields of the web hooks),
  `src/lib/events.ts`, `src/lib/years.ts`, `src/lib/distance.ts`, `src/lib/radar.ts`,
  `src/lib/recovery.ts`, `src/lib/friends-response.ts`, and the pure half of
  `src/lib/display.ts` (`:1-24` and `watchlistDisplay` `:34`; `readHideRatings` `:27` reads
  `localStorage`).
- `src/data/event-rules.ts` and `src/data/memberships.ts` (imported by `filters.ts:2`).
- `src/lib/catalogue.ts:59` uses `Intl.Collator("en", { numeric: true })` and `:60` uses
  `normalize("NFD")` with a `\p{M}` regex. Hermes supports these, but the spike (PR 0)
  confirms it on both platforms before anything depends on it.

Logic tied to Preact or the browser (ported, not moved):

- `src/lib/account.ts` (`accountApi` `:13-78` with the analytics headers, `useAccount`
  `:83`), `src/lib/cinemas.ts` (`useCinemas` `:22`, guest preferences in `localStorage`
  `:15` and `:45`, conflict and version handling), `src/lib/calendar.ts` (`useCalendar` `:30`,
  `downloadEvents` `:10` builds a Blob), `src/lib/analytics.ts` (`initAnalytics` `:112`,
  PostHog web SDK, opt-in stored in `localStorage` `:18`), `src/lib/friends.ts`,
  `src/lib/feedback.ts`, `src/lib/preference-focus.ts`, `src/lib/discovery-analytics.ts`.
- "Near me" is a shortcut with no `changes` (`shortcuts.ts:67`); `src/app.tsx:230` opens a
  nearby dialog that uses browser geolocation and `distance.ts`.

Accounts and the API (`functions/api/[[path]].ts`):

- `userFor` `:103-121` identifies the user only from the `__Host-session` cookie and the
  `sessions` table (`migrations/0001_accounts.sql:10`).
- `:155` rejects every non-GET request whose `Origin` header differs from the site origin
  (`server/security.ts:19-21`). React Native's `fetch` sends no `Origin`.
- `POST /api/auth/request` `:179-224` creates a 15-minute `auth_tokens` row (`:203-205`) and
  emails a link (`:206-216`). `POST /api/auth/verify` `:226-249` exchanges the link token for
  a session and sets the cookie (`:249`, `server/security.ts:16-18`, 90 days).
- `GET /api/me` `:266-275` extends the session and re-sets the cookie. `POST /api/auth/logout`
  `:403`, `DELETE /api/me` `:407`, `PUT /api/me` `:412` (username, digest weekday),
  `GET /api/watchlist` `:452`, `POST /api/watchlist/refresh` `:467`, `/api/cinemas`
  `:285` (GET, PUT with `version`, POST), `/api/calendar` `:335` (GET, POST, DELETE),
  `/api/calendar/export` `:375`.
- `server/api.test.ts` runs the Functions in Miniflare with a real D1 schema.
- Rate limits use `quota()` keyed by IP and email (`:187-192`).

Tooling:

- `package.json`: single package, Node 24, `typecheck` runs three tsconfigs, `test` is
  Vitest, `e2e` is Playwright, `prebuild` fetches the Clash Display font and builds the
  changelog. `tsconfig.json` includes the DOM lib and `jsxImportSource: preact`.
- `.github/workflows/ci.yml` runs `build-data --fixture`, typecheck, lint, test, build and
  the `changelog-policy` check. Every PR needs a `changelog/entries/*.json` fragment
  (`AGENTS.md`); `changelog/features.json` is empty.
- The display font comes from Fontshare at build time (`scripts/fetch-display-font.mjs`) and
  is not committed. Its licence allows self-hosting on the site; embedding in an app must be
  checked before the font ships in the binary (fallback: the platform's system font).

## A. Workspace and the core package (PR 1, internal changelog fragment)

Goal: one place for the logic both apps share, with the boundary enforced by the compiler.

- Root `package.json` gains `"workspaces": ["packages/*", "mobile"]`. Nothing else changes
  for the website's scripts.
- New `packages/core/package.json`: name `@lci/core`, `"type": "module"`, `exports`
  mapping `"./*"` to `./src/*.ts` (TypeScript source, consumed by Vite, Vitest, tsx and
  Metro alike; no build step). `packages/core/tsconfig.json` sets `"lib": ["ES2022"]`,
  no DOM, `strict`, `noUncheckedIndexedAccess`. A core file that touches `window`, `document`,
  `localStorage` or `fetch` must fail `tsc`. `readView` and `viewUrl` use the `URL` global,
  which the ES2022 lib does not declare: give core `"types": ["node"]` for `URL` only, or
  move those two functions back to `src/lib/` if that pulls in more than `URL`. The spike
  settles which.
- Move with `git mv`, keeping history: `src/shared/*` → `packages/core/src/`;
  `src/lib/{catalogue,filters,shortcuts,events,years,distance,radar,recovery,friends-response}.ts`
  and their tests → `packages/core/src/`; `src/data/event-rules.ts` and
  `src/data/memberships.ts` → `packages/core/src/data/`. Split `src/lib/display.ts`: the pure
  part moves, `readHideRatings` stays in `src/lib/display.ts` and re-exports the rest.
- `shortcutItems` takes `{ user, watchlist }` and `{ venues, loading }` as plain types defined
  in core, not `AccountState`/`CinemasState` from the web hooks (`shortcuts.ts:1-2`).
- Website imports change from `../shared/x` and `./catalogue` to `@lci/core/x`. Add the
  alias in `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`; `scripts/tsconfig.json`
  and `server/tsconfig.json` import `@lci/core/*` the same way (they currently reach into
  `../../src/shared/data`, e.g. `scripts/lib/output.ts:4-5`).
- `vitest.config.ts` includes `packages/core/src/**/*.test.ts`. `npm run typecheck` adds
  `tsc --noEmit -p packages/core/tsconfig.json`. ESLint: `no-restricted-globals` for
  `window`, `document`, `localStorage`, `navigator`, `location` in `packages/core/**`.
- Done when: `npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`
  pass unchanged, `git diff --stat` shows the website components only changed import lines,
  and `tsc -p packages/core` passes without the DOM lib.

## B. A public catalogue manifest and a shared loader (PR 2, internal fragment)

Goal: an installed app discovers today's listings without an app update, and the loader's
validation lives once.

- `scripts/lib/output.ts`: after installing the data directory, also write the manifest to
  `public/catalogue.json` (same object, same atomic rename). `public/_headers` adds
  `/catalogue.json` with `Cache-Control: no-cache`, next to `/version.json`.
  `scripts/verify-deployment.ts` fetches `/catalogue.json` after deploy and checks
  `generatedAt` matches the build and that `films` resolves with HTTP 200.
- `packages/core/src/catalogue-loader.ts`: `validateCatalogue(manifest, films, meta, events)`
  and `validateShowtimes(id, result)` extracted from `src/lib/data.ts:25-36` and `:46-48`,
  plus `resolveDataUrl(base, path)`. `src/lib/data.ts` keeps `fetch` and the compiled
  manifest and calls the shared validation. The website's behaviour is unchanged.
- The app's loading rules (implemented in PR 4, written here so the server side is settled):
  1. On launch read the cached manifest and files from the app's cache directory and render.
  2. Fetch `https://london-cine.info/catalogue.json`. If `generatedAt` is newer than the
     cache, fetch the three files it names, validate, swap atomically, update the cache.
  3. On returning to the foreground after more than 30 minutes, repeat step 2.
  4. If a hashed file returns 404 (a deploy landed between the two requests), refetch the
     manifest once and retry. Showtime files are fetched on demand and cached in memory
     per session, as the website does.
  5. If `schemaVersion` is newer than the app understands, keep showing the cached catalogue
     and show a notice asking for an app update. If it is older, the app can read it.
- Schema rule, added to `AGENTS.md` by this PR: changes to `DATA_SCHEMA_VERSION` must be
  additive (new optional fields) wherever possible. A breaking bump must ship in a store
  release **before** the Deploy workflow publishes data with that version, and the app's
  loader must keep accepting the previous version for 30 days. The website is built with the
  data and does not need this rule.

## C. Sign-in by code and bearer sessions (PR 3, public fragment behind the flag)

Goal: the app signs in with the existing accounts and the existing sessions table, without
cookies and without domain association.

- Migration `migrations/0009_auth_codes.sql`: `ALTER TABLE auth_tokens ADD COLUMN code TEXT;
ALTER TABLE auth_tokens ADD COLUMN code_attempts INTEGER NOT NULL DEFAULT 0;`.
- `POST /api/auth/request` (`:201-205`) also generates a six-digit code from
  `crypto.getRandomValues`, stores it on the token row, and the email (`:214-215`) becomes:
  link first, then "Or open the app and enter this code: 123 456. Both expire in 15 minutes."
  One template for website and app; the code is bound to the email address and the single
  token row.
- New `POST /api/auth/verify-code` with body `{ email, code }`:
  - Normalise the email as `:183` does. Quota `auth-code:${email}` 5 per 15 minutes.
  - Select the newest unexpired `auth_tokens` row for that user. Increment `code_attempts`;
    at 5 delete the row. Compare the code in constant time.
  - On success: create the session exactly as `:231-245` (same batch, same analytics
    `track` calls, `signup_completed` logic), delete every `auth_tokens` row for that user,
    and return `{ ok: true, userId, session: rawSession, expiresAt }` in the body. No
    `Set-Cookie`.
  - Errors use the existing wording style: "That code is wrong or has expired. Request a new
    email."
- `userFor` (`:103-121`) accepts `Authorization: Bearer <64 hex>` when no cookie matches, and
  returns which transport it used. `GET /api/me` (`:266-275`) extends the session for both but
  only sets the cookie for cookie sessions. Logout and delete leave their `Set-Cookie` as is.
- The origin check (`:155`) applies to cookie-authenticated and unauthenticated non-GET
  requests. A request with a valid bearer header skips it: the token is not ambient, so
  cross-site request forgery does not apply, and the site serves no CORS headers.
- The app's requests carry `X-Analytics-Enabled` like the website (`account.ts:23`); the
  failure tracking in `onRequest` (`:541-575`) then works unchanged.
- `server/api.test.ts` adds: request stores a code; verify-code succeeds and returns a
  session; wrong code five times invalidates; expired code rejected; bearer session reads
  `/api/me`, `/api/cinemas`, `/api/calendar`; bearer non-GET without `Origin` succeeds;
  cookie non-GET without `Origin` still rejected; link verification unchanged.
- Changelog: `changelog/features.json` gains `"mobile_app": false`. This PR's fragment is
  public, `feature: "mobile_app"`, titled along the lines of "Sign-in emails include a code
  for the phone app". It publishes with PR 7.

## D. The Expo app (PRs 4, 5 and 6)

Location `mobile/`, created with `npx create-expo-app@latest mobile --template default`
pinned to SDK 57, then trimmed. `app.json`: name "London Ciné Info", slug `london-cine-info`,
scheme `londoncine`, iOS `bundleIdentifier` and Android `package` both `info.londoncine.app`,
`supportsTablet: false`, `userInterfaceStyle: "automatic"`, `newArchEnabled: true`
(the SDK default). `ios/` and `android/` are gitignored (continuous native generation).

Dependencies, kept to this list: `expo-router`, `react-native-screens`,
`react-native-safe-area-context`, `@shopify/flash-list`, `@gorhom/bottom-sheet` with
`react-native-reanimated` and `react-native-gesture-handler`, `expo-secure-store`,
`expo-file-system`, `expo-location`, `expo-web-browser`, `expo-calendar`, `expo-sharing`,
`posthog-react-native`, `@react-native-async-storage/async-storage`, and `@lci/core`.

Layout:

```
mobile/
  app/_layout.tsx                 providers (catalogue, session, preferences), root native stack
  app/(tabs)/_layout.tsx          NativeTabs: films, events, radar, mine, account
  app/(tabs)/films/index.tsx      list;  films/[id].tsx  detail (pushed)
  app/(tabs)/events/index.tsx
  app/(tabs)/radar/index.tsx
  app/(tabs)/mine/index.tsx       Watchlist | My calendar segments
  app/(tabs)/account/index.tsx    account/sign-in.tsx (modal), account/cinemas.tsx (modal)
  src/catalogue/                  loader, file cache, store
  src/session/                    secure store, api client (port of accountApi)
  src/preferences/                guest cinemas, display, analytics choice (AsyncStorage)
  src/ui/                         tokens.ts, Text, Chip, Row, Sheet, Segmented, Notice
  src/analytics.ts
```

State: React context plus `useSyncExternalStore` stores, no Redux. One `ViewState` (from
core) per list screen, held in memory; `path` carries the collection. No URL state. Share
builds the website URL with `viewUrl` so a shared film opens on the web.

PR 4, skeleton: workspace entry, the app shell, tabs, theme tokens, the catalogue loader and
cache (rules in B), the Films list with the collection switcher, header search and sort, the
film detail screen with screenings and booking links. No account. `mobile_app` stays `false`.

- Films list: FlashList over `sortFilms(selectFilms(films, state))`. Row: title in the display
  face (or the system face until the font licence is confirmed), director and year, next
  screening summary, ratings in `ratingOrder`, watchlist marker. The collection switcher is a
  row of chips under the header on both platforms (no extra native-menu dependency).
- Detail: poster, metadata, ratings with links, screenings grouped by day then cinema from
  `loadShowtimes`, each screening opening its booking URL in `expo-web-browser`; Share.
- Theme: `tokens.ts` transcribes the colour, type and spacing variables from
  `src/styles/base.css` and `picturehouse.css`, light and dark, chosen by `useColorScheme`.
  Body text 16 on the phone (the reading-system document governs text surfaces; the list
  and detail screens follow its spacing rules at phone scale).

PR 5, discovery: the shortcut strip from `shortcutItems`, the Filters bottom sheet listing
every `FILTERS` facet with counts, exclusions and the toggles from the website's sheet
(sold-out, under two hours), the Release calendar collection, Events, Radar, and Near me
(`expo-location` foreground permission, balanced accuracy, radius via `withinRadius`; the
denied state explains and offers Settings). Android back closes sheets before leaving a tab.

PR 6, account: sign-in modal (email → request → code → verify-code → session in
`expo-secure-store`); the account screen as listed in Scope; the My cinemas picker (search,
grouped by cinema group then borough, guest preferences in AsyncStorage with a `browserId`
exactly as `cinemas.ts:13-21` so the merge on sign-in works against the same API with the
same `version` rule); My films with Watchlist (slug match from `/api/watchlist`) and My
calendar (`/api/calendar` grouped by day, remove, Add to phone calendar through
`expo-calendar`, export all through `expo-sharing` of the `.ics` built by core `ical`);
analytics opt-in off by default like the website (`analytics.ts:18`), sign out, delete
account behind a native confirmation. Session expiry (HTTP 401) clears the stored session
and shows the website's wording.

## E. Builds, CI and release (PR 7, public fragment, flips `mobile_app` to true)

- `mobile/eas.json` profiles: `development` (dev client, internal), `preview` (internal
  distribution: Android APK, iOS ad hoc or TestFlight), `production` (store builds, auto
  increment build numbers). `runtimeVersion` policy `appVersion`.
- `.github/workflows/mobile.yml`: on pull requests touching `mobile/**` or `packages/core/**`
  run `npm ci`, `tsc -p mobile`, `eslint mobile`, Vitest for `mobile/src/**/*.test.ts`,
  `npx expo-doctor`, and `npx expo export --platform ios,android` as a bundling smoke test.
  Cloud builds run only on `workflow_dispatch` with `EXPO_TOKEN`, to stay inside the free
  quota. Store submission is `eas submit` from dio's machine for v1.
- Store assets: icon and splash derived from `public/favicon.svg`; `NSLocationWhenInUseUsage
Description` and `NSCalendarsWriteOnlyAccessUsageDescription` strings; Android
  `ACCESS_COARSE_LOCATION`, `WRITE_CALENDAR`. App privacy answers: email (account), coarse
  location (optional, not stored), analytics only when opted in. Privacy policy URL:
  `https://london-cine.info/privacy`, which `docs/privacy-policy.md` must mention the app.
- Review notes for Apple 4.2 drafted in `docs/mobile.md`.
- Beta: TestFlight internal testers and a Google Play closed test for 14 days before
  production. The PR that announces the listings sets `mobile_app` to `true`, which publishes
  PR 3's note and this PR's "London Ciné Info is now on the App Store and Google Play" note.

## PR 0: spike before PR 4 (branch `codex/mobile-spike`, never merged)

Three days at most, deleted afterwards. It decides go or no-go for the stack:

1. Core on Hermes: `normalize("NFD")` with `\p{M}`, `Intl.Collator` numeric, and the
   `Europe/London` date formatting in `catalogue.ts`, `filters.ts` and `events.ts` produce the
   same output as the Vitest suite on an iPhone and an Android emulator.
2. Native tabs (`expo-router/unstable-native-tabs`, beta in SDK 57) and the native stack with
   a header search bar work on both platforms. Fallback if not: the JavaScript tabs that Expo
   Router ships, with the same route files.
3. FlashList scrolls the live catalogue (about 1,500 films) without dropped frames on a
   mid-range Android phone; fetching the films file over mobile data takes under three seconds.
4. An EAS preview build installs on dio's phone.

## Tests

- Core: the moved Vitest suites, unchanged. New tests for `validateCatalogue` and
  `resolveDataUrl`.
- Server: the cases listed in C in `server/api.test.ts`; `npm run e2e:accounts` unchanged.
- Website: `npm run e2e` and `npm run e2e:analytics` unchanged after PRs 1–3.
- Mobile unit tests (Vitest, `mobile/src`): catalogue cache swap and 404 retry, session
  store, cinemas merge decisions, calendar grouping.
- Device flows, run by hand before each store release and recorded in `docs/mobile.md`:
  launch with no network shows the cached catalogue; Today plus one cinema filter; Near me
  with permission denied then granted; sign in by code; save a screening and see it in My
  calendar; sign out; delete account. Maestro flows for these may be added once the UI
  settles; they are not part of CI in v1.

## Docs

- `README.md`: a "Phone apps" section (what the app is, where it lives, that listings update
  through the website's deploys).
- New `docs/mobile.md`: setup (`npm install` at the root, `cd mobile && npx expo start`, dev
  client), the catalogue loading rules, the sign-in flow, build and release runbook, the
  store checklist, the review notes, the device flows.
- `AGENTS.md`: the core package rule (no browser globals, `tsc` without DOM), the schema
  version rule from B, and that the changelog fragment requirement covers `mobile/` changes
  with `feature: "mobile_app"` until launch.
- `docs/privacy-policy.md` and `src/components/privacy.tsx`: the app, coarse location, secure
  storage of the session, and that analytics stay opt-in.
- `docs/changelog.md`: app releases get public notes like any other change; the app opens the
  website's What's new page.

## Delivery

| PR  | Content                                                                             | Size | Depends on                              |
| --- | ----------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| 0   | Spike branch, go/no-go notes in the PR description, not merged                      | M    | 1 (uses the core package from a branch) |
| 1   | Workspace and `packages/core` extraction                                            | M    | —                                       |
| 2   | Public `catalogue.json`, shared loader validation, deploy verification, schema rule | S    | 1                                       |
| 3   | Auth codes, `verify-code`, bearer sessions, tests, `mobile_app` flag                | M    | —                                       |
| 4   | App skeleton: tabs, theme, catalogue loader and cache, Films list and detail        | L    | 0, 1, 2                                 |
| 5   | Shortcuts, Filters sheet, Release calendar, Events, Radar, Near me                  | L    | 4                                       |
| 6   | Account, cinemas, My films, calendar, preferences, analytics, deletion              | L    | 3, 5                                    |
| 7   | EAS profiles, CI workflow, store assets, docs, flag flip, store submission          | M    | 6                                       |

PRs 1 and 3 can proceed in parallel. Every PR adds its changelog fragment and runs
`npm run changelog:validate`. Keep each PR's diff to its area; the website's components must
not change in PRs 2–7.

## Acceptance criteria

- The website behaves and tests exactly as before PRs 1–3; its bundle contains no new code.
- `tsc -p packages/core` passes with `lib: ["ES2022"]` and no DOM types.
- `https://london-cine.info/catalogue.json` is served `no-cache` and names files that
  return 200 immediately after a deploy; the Deploy workflow fails if not.
- A sign-in email contains both the link and a six-digit code; the code signs the app in,
  five wrong attempts invalidate it, and the website's link flow is unchanged.
- A bearer session can read and write cinemas, calendar and profile without an `Origin`
  header; cookie sessions still need one for writes.
- The app opens to the cached catalogue in under a second on a warm start, refreshes within
  the first fetch of `catalogue.json`, and shows an update notice on a newer schema.
- Filters, shortcuts, sort, Events and Radar give the same film sets as the website for the
  same `ViewState` (checked by the shared tests, plus a spot check of three states on device).
- Sign in, sign out, cinemas merge on sign-in, save and remove a screening, delete account all
  work on an iPhone and an Android phone from a preview build.
- The app passes `expo-doctor`, builds on EAS for both platforms, and installs through
  TestFlight and a Play closed test.

## Open points (defaults the implementing agent takes unless dio says otherwise)

- Bundle and package identifier `info.londoncine.app`; app name "London Ciné Info".
- Collection switcher as a chip row rather than a native title menu.
- `expo-calendar` in v1 for Add to phone calendar; share of `.ics` only for export-all.
- Font: Clash Display in the app only if the Fontshare licence allows app embedding;
  otherwise the system face for titles too, decided in PR 4 and recorded in `docs/mobile.md`.
- Minimum OS versions: the SDK 57 defaults.
- Catalogue refresh interval in the foreground: 30 minutes.
