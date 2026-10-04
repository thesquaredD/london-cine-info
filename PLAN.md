# london-cine.info — build plan

A London clone of [paris-cine.info](https://paris-cine.info/) (same structure, layout and
behaviour) fed by [Clusterflick](https://github.com/clusterflick) data, deployed as a static
site on Cloudflare Pages for £0/month.

Decisions already taken (interview, 2026-10-02):

| Decision               | Choice                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data posture           | Pragmatic: Clusterflick `combined-data.json` + `matched-data` ratings (unlicensed build artifacts, personal non-commercial use), with CC BY 4.0 per-venue files as the documented fallback |
| Accounts / persistence | None in v1. No login, no localStorage, no cookies. Bookmark column stays visual-only or is dropped (see Open points)                                                                       |
| Hosting                | Cloudflare Pages, free `*.pages.dev` subdomain, custom domain later                                                                                                                        |
| Repo                   | Public, personal GitHub (`github.com/thesquaredD/london-cine-info`)                                                                                                                        |
| Scope                  | All six pages + inline showtimes + dark mode + mobile                                                                                                                                      |
| Filters                | Card → UK memberships, Place → London boroughs, Languages → Accessibility, Format kept                                                                                                     |
| Stack                  | My call: Vite + TypeScript + Preact, no jQuery/DataTables/FullCalendar (see §3)                                                                                                            |

---

## 1. What we are cloning (paris-cine.info, as observed)

Layout (desktop ≥ 800px):

```
┌──────────────┬─────────────────────────────────────────────────────────────┐
│ Pages        │ ☰   PARIS CINÉ INFO (wordmark, black bar)         (account) │
│  All movies  ├─────────────────────────────────────────────────────────────┤
│  New releases│ La base de données des séances de cinéma  (italic tagline)  │
│  Classics    ├────┬──────────────┬──────────┬────┬────┬────┬────┬──────────┤
│  Retrospect. │ 🔖 │ Title        │ Director │ LB │IMDb│ SC │ AC │ Year     │
│  Events      │    │  orig. title │          │    │    │    │    │          │
│  Calendar    ├────┴──────────────┴──────────┴────┴────┴────┴────┴──────────┤
│ Filters      │ ▼ expanded row: [poster+date·runtime] [rating cards]        │
│  search      │                 [showtimes list grouped by day:             │
│  Day         │                  3:30pm ● Cinema name  VO ]                 │
│  Time        ├─────────────────────────────────────────────────────────────┤
│  Card        │ 473 films                                   [1] 2 3         │
│  Place       │                                                             │
│  Cinemas     │                                                             │
│  Languages   │                                                             │
│  Genres      │                                                             │
│  Format      │                                                             │
│ Display      │                                                             │
│  title lang  │                                                             │
│  rating order│                                                             │
│ [Add app] ☀  │                                                             │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

Observed behaviour to reproduce:

- One sortable, paginated table (200 rows/page, 3 pages for 473 films). Sort on any column.
  Default sort: Letterboxd rating desc.
- Title cell: main title bold, original title below in blue italic. Director is a link that
  filters to that director (retrospective). Rating boxes are outlined chips, green text,
  linking out to the source page. Missing rating shows `?`.
- Click a title → row expands inline (only one open at a time): poster (TMDB) with
  `release-date • runtime` caption, actor list + genre/language pills on hover, rating
  cards, then a showtimes list grouped by day header with time, a coloured "verified by N
  sources" dot, cinema name and VO/VF badge. Booking link per showtime.
- Sidebar selects are searchable dropdowns with grouped options and counts, e.g.
  `Drama (330)`. Day: Today, next six weekday names, Beyond/Any. Time: Morning, Afternoon,
  Evening, custom range. Place is hierarchical (city → district). Cinemas grouped by district.
- Pages are client-side views over the same dataset: All, New releases, Classics,
  Retrospectives (rows grouped under director headers), Events (special screenings),
  Calendar (upcoming releases grouped by `Released on <date>` / `Released later`).
- Light theme: `#eaeaea` body, black header bar, Arial/Helvetica. Night mode: `#121820`
  body, `#e5e7eb` text, blue accent for the active page. Toggle persists via localStorage
  on Paris — we will follow system preference only (no persistence).
- Mobile (< 800px): sidebar becomes a drawer, table collapses to Title + Director only,
  page count and pagination in a sticky footer. Paris overflows horizontally at 390px; we
  will not.
- Data: one JSON for the film list (~220 KB for 473 films, ~30 short-keyed fields per film)
  fetched on load; one tiny JSON per film for showtimes fetched on expand.

Screenshots of every state are in `.playwright-mcp/` (ignored by git).

## 2. Data: Clusterflick

Refreshed every morning by Clusterflick's pipeline (combine release ≈ 06:20 UTC, match
release ≈ 11:20 UTC). Everything is a GitHub Release asset; fetched with the public API.

| Asset                                                                                    | Repo             | Size          | Licence                         | We use                                            |
| ---------------------------------------------------------------------------------------- | ---------------- | ------------- | ------------------------------- | ------------------------------------------------- |
| `combined-data.json`                                                                     | data-combined    | 22 MB         | none (internal artifact)        | yes — movies, venues, people, genres, collections |
| `departed-movies.json`                                                                   | data-combined    | 2.4 MB        | none                            | no                                                |
| `imdb.json`, `letterboxd.json`, `metacritic.json`, `rottentomatoes.json`, `moviedb.json` | data-matched     | 0.2–1 MB each | none; IMDb non-commercial terms | yes — four rating columns + links                 |
| `bechdel.json`                                                                           | data-matched     | 0.1 MB        | CC BY-NC 3.0                    | no (v1)                                           |
| 452 per-venue JSON                                                                       | data-transformed | 19 MB total   | CC BY 4.0                       | fallback only                                     |
| 452 per-venue ICS                                                                        | data-calendar    | —             | CC BY 4.0                       | no                                                |

Volume today: 2,153 movies, 32,967 performances, 452 venues, 13,754 people. 1,602 movies
have a TMDB match (poster, year, overview, genres, trailer). Ratings cover 1,549 (IMDb),
1,948 (Letterboxd), 923 (Metacritic), 1,380 (RT) movie ids, keyed by the combined movie id.

Shape (what the build script reads):

```
movies[id]        title, originalTitle, originalLanguage, year, releaseDate, duration(ms),
                  classification, overview, posterPath, youtubeTrailer, imdbId,
                  genres[genreId], directors[personId], actors[personId], collectionId,
                  isUnmatched, includedMovies[],
                  showings{venueShowingId → venueId, url, category, seen, overview{...}},
                  performances[{time(ms), showingId, bookingUrl, screen, notes,
                                status.soldOut, format{source,presentation,dimension},
                                accessibility{audioDescription,subtitled,hardOfHearing,
                                              relaxed,babyFriendly}}]
venues[id]        name, address, geo{lat,lon}, url, type, programming, structure,
                  groupName, socials
people[id]        name
genres[id]        name
matched/*.json    { [movieId]: { rating, reviews, url, … } }
```

Showing categories currently include `movie`, `multiple-movies`, `quiz`, `shorts`,
`talk`, `tv`, `event`, `music`, `comedy` and `workshop`; the pipeline supports other
non-empty category names as events.

Verified during phase 1: Metacritic uses `critics.rating`; Rotten Tomatoes uses
`critics.all.score`. `releaseDate` is TMDB's original release date, not a verified
UK date. The new/classic/upcoming flags use that source date and the UI must make
the limitation clear.

Risks and mitigations:

- **No schema guarantee.** Build script validates with zod and fails loudly; a failed build
  never deploys, so the previous day's site stays live. The CC BY per-venue files are a
  second source we can switch the build script to if `combined-data.json` disappears
  (we would lose the cross-venue merge and ratings join, not the listings).
- **Attribution.** Footer and About page carry: "Screening data from Clusterflick",
  link to the actual combined/matched sources, and describe their licence limits.
  Add CC BY 4.0 attribution only if the pipeline switches to the per-venue fallback.
  Also include the TMDB logo + "This product uses the TMDB API but is not endorsed or
  certified by TMDB", and every rating chip links to its source page (that is how
  Clusterflick itself meets IMDb/Letterboxd/Metacritic/RT attribution).
- **GitHub API rate limit** in Actions is fine with `GITHUB_TOKEN`.

## 3. Stack (my call: smaller and faster than the Paris libraries)

Paris ships jQuery + DataTables + FullCalendar + fancybox + virtual-select, roughly 500 KB
of JS, to render one table. For ~2,000 rows we need none of that:

| Concern         | Choice                                                                    | Why                                                        |
| --------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Build           | Vite 6 + TypeScript                                                       | zero-config static output, hashed assets                   |
| UI              | Preact 10 (+ `@preact/signals`)                                           | 4 KB runtime, JSX, enough for one view tree                |
| Table           | hand-rolled: sort, filter, paginate over an in-memory array               | 2k rows sorts in < 5 ms; no DataTables                     |
| Showtimes list  | hand-rolled day-grouped list                                              | FullCalendar list view is a styled table                   |
| Sidebar selects | `virtual-select-plugin` (MIT, no jQuery, 40 KB)                           | same component Paris uses: grouped options, search, counts |
| Styling         | plain CSS with custom properties, light + night-mode                      | mirrors Paris; no Tailwind                                 |
| Data build      | Node 24 script in `scripts/build-data.ts` (tsx)                           | runs in CI, writes `public/data/`                          |
| Validation      | zod                                                                       | fail fast on upstream schema drift                         |
| Tests           | Vitest (data transforms) + Playwright (smoke + visual, desktop and 390px) |                                                            |
| Hosting         | Cloudflare Pages via `wrangler pages deploy` (Direct Upload)              | daily deploy without a commit                              |

Budget: < 120 KB JS gzipped, first paint < 1 s on 4G, film list JSON ≈ 350–450 KB gzipped.

## 4. Build-time data pipeline (`scripts/build-data.ts`)

1. Resolve latest release of `data-combined` and `data-matched`; download assets to
   `.cache/` (skipped when the tag has not changed).
2. Validate shapes with zod.
3. Derive per movie:
   - `title`, `originalTitle` (shown only if different), `directors[]`, `actors[]` (first
     3 for the pill), `year`, `releaseDate`, `runtime`, `genres[]`, `classification`,
     `poster` (TMDB `w342` URL), `trailer`, `originalLanguage`.
   - Ratings: `lb` (Letterboxd /5), `im` (IMDb /10), `mc` (Metacritic critics /100),
     `rt` (RT critics %), each with its URL. Default sort key: Letterboxd desc.
   - Facets, computed from performances: `days` (set of ISO dates), `timeBands`
     (morning/afternoon/evening + raw times), `venueIds`, `boroughs`, `formats`,
     `accessibility` flags, `memberships`, `soldOut`.
   - Page flags: `isNewRelease` (source `releaseDate` within the last 8 weeks),
     `isClassic` (released > 5 years ago), `isUpcoming` (`releaseDate` > today, no
     performances yet or preview only), `isEvent` (any showing with category ≠ `movie`,
     or `multiple-movies`, or notes matching Q&A / intro / 35mm presentation etc.),
     `retroDirectorIds` (directors with ≥ 3 distinct films screening).
4. Derive per venue: `name`, `group`, `borough` (point-in-polygon against London
   Datastore borough boundaries, OGL licence, vendored once as GeoJSON), `membership[]`
   from a static mapping (`src/data/memberships.ts`):
   - Unlimited: Cineworld Unlimited (`cineworld.co.uk-*`), Odeon Limitless (`odeon.co.uk-*`)
   - Membership / discount: Curzon, Everyman, Picturehouse, BFI, Prince Charles, Genesis,
     Rio, Garden, Lexi, ICA, Barbican, Vue (Vue Pass) — maintained by hand, by venue id prefix
     or `groupName`.
5. Write:
   - `public/data/films.<hash>.json` — compact array, short keys like Paris
     (`ti`, `o_ti`, `di`, `ye`, `lb_r`, `im_r`, …) plus facet bitsets.
   - `public/data/showtimes.<hash>/<movieId>.json` — performances for one film grouped
     by London date, with venue id, UTC time, local time, format, accessibility,
     booking URL and sold-out. Actor/overview details are fetched with this file;
     their removal from the initial film list keeps the payload within budget.
   - `public/data/meta.<hash>.json` — venues (with borough and memberships), boroughs,
     genres, formats, counts for every facet option, `generatedAt`, source release tags.
   - `src/generated/manifest.json` — hashed filenames, imported by the app.
6. Pages Direct Upload limit is 20,000 files / 25 MiB per file: ~2,200 files, fine.

## 5. Front-end

Routes (hash-less, static, one `index.html` + Cloudflare `_redirects` SPA fallback):
`/` (all), `/new`, `/classics`, `/retrospectives`, `/events`, `/calendar`, `/about`.
Filters are mirrored in the query string so views are shareable (Paris does this partly).

Components:

- `App` — layout grid, sidebar drawer state, theme (system preference, toggle in memory).
- `Sidebar` — Pages list; Filters: `SearchBox`, `DaySelect`, `TimeSelect` (bands +
  custom range dialog), `MembershipSelect`, `PlaceSelect` (All London → Inner/Outer →
  borough), `CinemaSelect` (grouped by borough, searchable, counts), `AccessibilitySelect`,
  `GenreSelect`, `FormatSelect`; Display: title mode (Title & original / Title / Original),
  rating column order (drag handles, in-memory only); theme button; about link.
- `FilmTable` — header with sort indicators, body rows, `FilmRow`, `ExpandedRow`,
  pagination footer with `N films`.
- `ExpandedRow` — `PosterCard` (poster, date • runtime, actors + genre pills overlay),
  `RatingCards`, `ShowtimesList` (lazy-fetches `<manifest.showtimes><id>.json`, groups by
  day, applies current Day/Time/Cinema/Place/Format/Accessibility filters so the list
  matches the filters, badges for format and accessibility, sold-out styling, booking link).
- Views: `AllFilms`, `NewReleases`, `Classics`, `Retrospectives` (group headers by
  director, as Paris), `Events` (category badge column replaces Year), `Calendar` (group
  headers `Released on <date>` / `Released later`, release-date sorted), `About`.
- `filters.ts` — pure functions: `applyFilters(films, state) → ids`, facet counts
  recomputed against the current selection (Paris shows counts).

CSS: port the Paris variables and rhythm (table row height, chip outlines, blue italic
original title, black header bar, 800px breakpoint), both themes, 390px layout with
Title + Director only and a sticky footer. No horizontal overflow.

## 6. CI/CD and hosting (all free)

GitHub Actions in the public repo (unlimited minutes):

- `ci.yml` — on PR/push: typecheck, lint, Vitest, build against a cached fixture dataset,
  Playwright smoke on the built site.
- `deploy.yml` — on push to `main`, on `schedule` (cron `45 6,11 * * *` UTC, after
  Clusterflick's combine and match releases), and `workflow_dispatch`:
  `build-data` → `vite build` → `wrangler pages deploy dist --project-name london-cine-info`.
  Concurrency group so two runs never overlap. Fails before deploy on validation errors.
- Secrets: `CLOUDFLARE_API_TOKEN` (Pages: Edit), `CLOUDFLARE_ACCOUNT_ID`.
- Cloudflare Pages project `london-cine-info` → `https://london-cine-info.pages.dev`.
  Cache headers via `_headers`: hashed data files immutable, `index.html` no-cache.

Cost: £0. Cloudflare Pages free tier has unlimited bandwidth; we do not use Pages builds
(Direct Upload), so the 500 builds/month limit does not apply. Custom domain later is the
only possible spend (~£15–25/year for `.info`).

## 7. Phases

| #   | Phase          | Deliverable                                                                                                                                                                                                                                                                | Est.    |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0   | Bootstrap      | `git init`, `env -u GITHUB_TOKEN gh repo create thesquaredD/london-cine-info --public`, Vite+Preact+TS scaffold, ESLint/Prettier, `.gitignore` (`.playwright-mcp/`, `.cache/`, `public/data/`), CI workflow, Cloudflare Pages project, first empty deploy to `*.pages.dev` | ½ day   |
| 1   | Data pipeline  | `build-data.ts` with zod schemas, borough assignment, membership map, films/showtimes/meta outputs, fixture dataset for tests, unit tests                                                                                                                                  | 1 day   |
| 2   | Core UI        | Layout, sidebar, All films table with sort/paginate, expanded row with showtimes, light theme, desktop                                                                                                                                                                     | 1½ days |
| 3   | Filters        | All nine filters with live counts, query-string state, title display mode, rating column reorder                                                                                                                                                                           | 1 day   |
| 4   | Pages          | New releases, Classics, Retrospectives, Events, Calendar, About (attribution, data status, source release tags)                                                                                                                                                            | 1 day   |
| 5   | Theme + mobile | Night mode, 800px drawer layout, 390px table collapse, sticky footer, no overflow                                                                                                                                                                                          | ½ day   |
| 6   | Verify + ship  | Playwright smoke + visual pass at 1200px and 390px, Lighthouse, scheduled deploy live, side-by-side check against paris-cine.info, handoff for your ✅                                                                                                                     | ½ day   |

Total ≈ 6 working days of agent time, shippable after phase 2 (a usable table) and
complete after phase 6.

## 8. State at handoff (2026-10-03, filters and retrospective grouping)

Phases 0 and 1 are committed, merged and deployed. GitHub CLI uses the personal
`thesquaredD` keyring account with workflow scope; prefix project gh commands with
`env -u GITHUB_TOKEN` because the shell token belongs to the work account. Origin
uses HTTPS through gh's credential helper. Cloudflare Pages project
`london-cine-info` uses production branch `main`; both repository Cloudflare secrets
are set and Wrangler is logged in locally. No credentials need to be pasted.

Phase 2 is implemented on `codex/core-ui` in the feature worktree
`/Users/dio/Development/london-cine-info-data-pipeline`; the base checkout remains
on `main`. It adds:

- Paris-style sidebar, masthead and seven-column film table, sortable on every
  column, default Letterboxd descending, 200 rows/page and missing values last.
- Manifest loading, error/retry states, shareable search/language/director filters
  and browser history navigation.
- One inline expanded row, lazy cached showtimes, poster/metadata hover card,
  source-linked ratings, trailer, London day groups, cinema booking links,
  format/accessibility/sold-out badges and clearly labelled booking fallbacks.
- Basic flag views for all six pages plus sources/data status About page. Full
  retrospective/calendar grouping and the event-specific column remain phase 4.
- System theme plus an in-memory toggle, desktop sidebar collapse, native modal
  phone drawer, two-column phone table and sticky pagination, implemented early
  so the core table is usable at 390px. No cookies or persistent browser storage.
- Four additional catalogue unit tests and eight desktop/mobile browser smoke
  tests. CI now builds fixture data before typechecking the generated manifest.
  Deployment checks fixture data, then builds fresh live data for publication.

Pipeline source limits remain: release dates are TMDB originals (not verified UK
dates), memberships describe venue eligibility, and malformed booking links fall
back to validated screening details. All 33 boroughs and membership mappings are
already implemented. Data is ignored, generated and versioned for immutable caching.

Follow-up implementation (`codex/friendly-filters` in the same feature worktree):

- User preference: every filter shown in the sidebar; OR within each multi-select
  picker, AND across different filters.
- Retrospectives now have director headings and counts, alphabetical director
  groups, sorts within groups, distinct row identities for co-directed films and
  continued headings on pagination. The source qualification remains at least
  three films in the programme; filtering can narrow a group to fewer films.
- All nine searchable/counting pickers: day, time, cinema, borough, membership,
  accessibility, format, genre and original language. Date shortcuts, custom
  overnight time ranges, hide-sold-out, active chips, per-picker clear and full
  reset. Cinemas grouped by borough, boroughs by inner/outer London.
- Correlated screening matching and distinct-film counts; expanded showtimes use
  the same filters. URLs support repeated values and legacy language query links.
  Decoded screenings are cached in memory; count updates measured around 22ms
  after initial load on the verification machine.
- 25 unit tests and 18 browser tests cover grouping, pagination, OR/AND semantics,
  correlated matching/counts, date/DST/overnight handling, drawer/chips/reset and
  the original core UI flows at 1200px and 390px.

Additional follow-up: tri-state include/exclude checkboxes across all nine pickers,
NOT chips and shareable exclusion parameters; Today/Tomorrow quick buttons above
the table. Quick buttons replace day choices while preserving other filters.

Layout audit: picker Clear controls are always present (disabled when empty);
summary lines, NOT indicators and count widths are reserved; help text is static;
active chips occupy a fixed-height horizontal strip. Geometry regression covers
all nine pickers at desktop/phone widths, including long labels and overnight ranges.

Next: remaining Display controls (title mode/rating column reorder); remaining
phase 4 calendar release grouping, event column and TMDB logo; final theme/mobile
and performance audit. Retrospective grouping and the screening filters are now
implemented. See README for behavior and replay commands.

## 9. Open points (I will take the recommended default unless you say otherwise)

- **Bookmark column** without persistence is dead weight. Default: drop the 🔖 column in
  v1 and keep a `Watch` placeholder column hidden, to re-enable when accounts arrive.
- **Events definition.** Default: showings whose Clusterflick category ≠ `movie`, plus
  film screenings whose notes mention Q&A, intro, panel, live score, sing-along, quiz,
  marathon, 35mm/70mm presentation. Tunable list in `src/data/event-rules.ts`.
- **New releases window** 8 weeks, **Classics** > 5 years: both constants.
- **Rating columns** Letterboxd, IMDb, Metacritic (critics), Rotten Tomatoes (critics),
  replacing Paris's SensCritique and Allociné. Reorderable in Display like Paris.
- **Default Place** "All London" (Paris defaults to the city proper). Alternative: Zone 1–2
  boroughs. Default: All London.
- **Source-verification dot.** Clusterflick has a single source per venue, so the "verified
  by N sources" dot becomes a plain time marker; sold-out gets a red variant.
- **PWA "Add app" button.** Default: ship a web manifest and icons (cheap), no service
  worker and no offline cache in v1.
- **Original-language filter.** Clusterflick provides `originalLanguage`; it would be a
  cheap extra select. Default: phase 2, since you chose Accessibility for that slot.

---

## 10. v2: Letterboxd watchlist + accounts (interview 2026-10-03)

Supersedes the v1 "no accounts, nothing stored" decision in the table at the top. Everything
else in §1–§9 stands; remaining v1 polish (Display controls, calendar grouping, event column,
TMDB logo, audits) is deferred until this ships.

### 10.1 Decisions

| Decision       | Choice                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import path    | Server fetches the user's **public** Letterboxd watchlist by username and matches films by Letterboxd slug. CSV upload is a later fallback, not v2. |
| Account model  | Real accounts. **Magic link by email**, no passwords, no OAuth.                                                                                     |
| Features       | Watchlist page + "only my watchlist" filter; watchlist marker column (the revived 🔖); **weekly** email digest of new London screenings.            |
| Not in scope   | Saved filters/preferences, manual site bookmarks, other Letterboxd lists, "hide seen". Watchlist only.                                              |
| Backend        | Cloudflare Pages Functions + **D1** (users, sessions, watchlists, alert log) + **KV** (rate limits). Same project, same deploy pipeline, £0.        |
| Email          | **Resend** free tier (3,000/month, 100/day) from `london-cine.info`.                                                                                |
| Domain         | **london-cine.info** (registered 2026-10-03 at Namecheap, assumed dio's). Move nameservers to Cloudflare so Pages + Resend DNS live in one place.   |
| Refresh        | Daily, cached, polite: one fetch per user per day, 1 req/s, honest UA; manual refresh rate-limited to 1/hour; stale banner when fetch fails.        |
| Digest cadence | Weekly. Default **Wednesday after the 11:45 UTC rebuild** (new programmes land Tue/Wed for the Friday week); user can pick the weekday or opt out.  |
| Privacy        | Minimal but correct: `__Host-session` cookie only (strictly necessary, no banner), `/privacy` page, one-click delete account, unsubscribe link.     |
| Sequencing     | Letterboxd first, polish after.                                                                                                                     |

### 10.2 Architecture

Verified 2026-10-03: a public watchlist renders server-side at
`letterboxd.com/<user>/watchlist/page/<n>/`, 28 films per page, each as
`data-item-slug="<slug>"` / `data-target-link="/film/<slug>/"`, with the total in
`.js-watchlist-count` and the last page number in `.paginate-page`. Clusterflick's
`letterboxd.json` already gives every movie its Letterboxd URL, and `Film.ra.lb.url` ships to
the client, so **matching is slug ∩ slug with no fuzzy title logic** and no change to the
film payload.

Where each piece runs (the Workers free plan's 10 ms CPU limit rules out parsing ~23 HTML
pages inside one Function invocation, and Pages has no cron):

```
GitHub Actions (public repo, unlimited minutes, already the daily scheduler)
  deploy.yml ─► build-data ─► vite build ─► pages deploy
             └► scripts/refresh-watchlists.ts   (daily, after deploy)
                   read users+usernames from D1 (wrangler d1 execute --remote --json)
                   fetch watchlist pages politely, parse slugs, upsert into D1
             └► scripts/send-digests.ts         (weekly, same job, gated on weekday)
                   per user: watchlist slugs ∩ films screening now − already alerted
                   render + send via Resend, record in alert log
  refresh.yml ─► workflow_dispatch for one user (manual refresh button)

Cloudflare Pages Functions  (functions/api/*)
  POST /api/auth/request      email → single-use token (hash in D1, 15 min) → Resend magic link
  GET  /api/auth/verify       token → session (hash in D1, 90 days) → Set-Cookie __Host-session
  POST /api/auth/logout
  GET  /api/me                email, letterboxd username, digest prefs, last refresh, stale flag
  PUT  /api/me                set/clear username, digest weekday/opt-out
  DELETE /api/me              cascade delete; sessions, watchlist, alert log
  GET  /api/watchlist         { slugs: string[], fetchedAt, count, stale }
  POST /api/watchlist/refresh rate-limited (KV, 1/h) → GitHub workflow_dispatch(refresh.yml, user)
  GET  /unsubscribe?token=    signed per-user token in every digest; works logged out

D1 tables
  users(id, email UNIQUE, letterboxd_username, digest_weekday NULL=off, created_at)
  auth_tokens(hash, user_id, expires_at)       sessions(hash, user_id, expires_at)
  watchlist_items(user_id, slug, added_at, PRIMARY KEY(user_id, slug))
  watchlist_sync(user_id, fetched_at, count_reported, count_parsed, error)
  alerts_sent(user_id, slug, sent_at, PRIMARY KEY(user_id, slug))
KV  rate limits: auth requests per email/IP, refresh per user
```

Secrets: `RESEND_API_KEY`, `GITHUB_DISPATCH_TOKEN` (fine-grained PAT, Actions: write on this
repo) in Pages; `CLOUDFLARE_API_TOKEN` gains D1 edit for the Actions scripts.

### 10.3 Front-end

- Sidebar **Account** block above Display: signed-out → email field + "Send sign-in link";
  signed-in → email, Letterboxd username field with "Refresh now" and last-synced time,
  digest weekday select (off by default until a username is set), sign out, delete account.
- **Watchlist** page (seventh) lists watchlist films that are screening; heading reads
  "N of your M watchlist films are screening in London". Empty states for signed-out,
  no username, private/empty watchlist, fetch failed (stale banner with last good data).
- Sidebar **"Only my watchlist"** checkbox, available on every view when signed in with a
  synced list; mirrored in the query string like the other filters.
- 🔖 column revived as a Letterboxd mark on matching rows, linking to the film's Letterboxd
  page; sortable (watchlist first). Hidden when signed out.
- Session is the only persisted state; theme and filters stay in-memory/URL as in v1.
- Routes added: `/watchlist`, `/privacy`, `/auth/verify`, `/unsubscribe`.

### 10.4 Testing and local dev

- `wrangler.toml` with D1/KV bindings; `migrations/` applied by `wrangler d1 migrations apply`
  in deploy. `wrangler pages dev dist --d1 --kv` for local Functions with Miniflare.
- Dev mode (`DEV_MAGIC_LINK=1`): auth request returns the link in the JSON body instead of
  emailing, so Playwright can complete sign-in without a mailbox.
- Vitest: watchlist parser against a **synthetic** HTML fixture (same markup, invented
  slugs, never a real user's data); pagination; private/empty detection (`count` present
  but zero items parsed ⇒ keep previous data, flag error); digest diff; token hashing.
- Playwright: sign-in → set username → watchlist page → marker column → filter toggle →
  delete account, at 1200px and 390px. Recorded run-flow for the handoff as usual.

### 10.5 Risks

- **Letterboxd ToS** prohibits scraping. Posture: low volume, cached, polite UA, one fetch
  per user per day; if blocked, the site degrades to the last cached list and the plan's
  fallback is a CSV upload path. Not a commercial product.
- **Markup drift**: parser test fixture plus a runtime guard (reported count vs parsed
  count); a parse failure never wipes a stored list.
- **Deliverability**: SPF, DKIM, DMARC on the new domain before any user email; send from
  a subdomain (`mail.london-cine.info`) so the apex reputation is untouched.
- **Resend 100/day cap**: digests go out in one weekday batch; if users ever exceed ~90,
  spread digest weekdays by default.
- **Free-tier limits**: D1 5M reads/100k writes per day and 5 GB; Pages Functions 100k
  requests/day. Both are orders of magnitude above expected use.

### 10.6 Phases

| #   | Phase             | Deliverable                                                                                                                     | Est.  |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| A   | Domain + platform | Nameservers to Cloudflare, Pages custom domain, Resend domain verified, D1 + KV created, `wrangler.toml`, migrations, local dev | ½ day |
| B   | Auth              | Magic link, sessions, `/api/me`, account block, delete account, `/privacy`                                                      | 1 day |
| C   | Letterboxd sync   | Parser + tests, `refresh-watchlists.ts` in Actions, `/api/watchlist`, refresh dispatch, stale handling                          | 1 day |
| D   | UI                | Watchlist page, filter toggle, marker column, empty states, 390px                                                               | 1 day |
| E   | Weekly digest     | Diff, template, Resend send, unsubscribe, weekday pref, Actions gating                                                          | ½ day |
| F   | Verify + ship     | Playwright flows, recorded handoff, deploy, side-by-side check                                                                  | ½ day |

### 10.7 Open points (defaults I will take unless told otherwise)

- Digest defaults off for consent, with Wednesday suggested when enabled. Include
  future screenings through London date +10 and re-announce when that window has
  a screening newer than the last announced epoch (updated 4 October 2026).
- Session lifetime 90 days, sliding. Magic link 15 minutes, single use.
- Keep Pages rather than migrating to Workers with Static Assets (which would allow a cron
  trigger). Revisit only if Actions-driven scheduling proves awkward.
- Watchlist page shows screening films only; the "M watchlist films" total is informational.

### 10.8 Implementation progress — 4 October 2026

- A: production and isolated preview D1/KV created; both migrations applied;
  Wrangler configuration and local dev ready. Domain attached to Pages and apex DNS points to the site; the zone is active and HTTPS works. Resend sender domain verified;
  RESEND_API_KEY installed in Pages production and Actions. Dispatch token installed and Actions: write verified; the Cloudflare token has D1 permission and the Actions remote preflight passed.
- B–E: implemented magic links/sessions/account deletion/privacy, validated public
  watchlist sync and refresh dispatch, watchlist UI/filter/markers, daily departure
  tracking and opt-in weekly digest/unsubscribe. Digest defaults off for consent.
- F: local Functions/D1 verification passed 39 unit/integration checks and all
  20 browser tests (18 catalogue + 2 recorded account flows). Hosted preview
  passed account API, unavailable-email, origin and no-overflow checks at both widths. PR #6 is merged and deployed; WATCHLIST_ENABLED is true, and the first production
  deploy/account workflow passed. Dio verified live sign-in and Letterboxd import
  on 4 October 2026. Weekly email delivery remains unverified; see ACCOUNT_SETUP.md.

Implementation refinements: D1 enforces rate limits atomically instead of KV;
magic-link and unsubscribe confirmation POSTs prevent email scanners activating
links. Unsubscribe uses a per-user 256-bit random token. These preserve the intended
behavior with no extra service or secret.

## 11. Next priority: account modals, import feedback and errors

User feedback, 4 October 2026: live sign-in and import work, but account forms crowd
the sidebar and import feedback is too weak. This work takes priority over the
deferred Display controls, calendar/events details and final visual/performance audit.

### 11.1 Coordinate with the latest PR

Reviewed PR [#7 — Move film filters to a responsive toolbar](https://github.com/thesquaredD/london-cine-info/pull/7).
It moves screening filters above results and into a mobile filter sheet; it keeps
AccountPanel in the page sidebar. Build this follow-up on the latest integrated
version of that work, retaining the toolbar, page navigation, shared filter URLs
and Only my watchlist control. Check PR #7's latest state before implementation;
its account/browser tests must cover the integration with the shipped accounts.
Do not replace its filter redesign as part of account UX work.

### 11.2 Account interactions in modals

- Replace the sidebar's forms with compact Sign in / Account entry points. Put
  sign-in, Letterboxd connection/import, weekly email settings and sign-out in
  account dialogs. Keep watchlist results and screening filters accessible from
  their existing pages and toolbar.
- Give account deletion a clear, separate confirmation dialog. Describe what is
  deleted and keep Cancel easy to reach; show completion or failure explicitly.
- Use one shared dialog approach consistent with the existing filter sheet:
  labelled dialogs, focus entry/trapping/restoration, Escape and close controls,
  background isolation, and usable desktop/390px layouts. Avoid nested dialogs
  when opening Account from the phone Pages drawer; close the drawer first.
- Preserve entered values on validation/network failure. Distinguish unsaved
  username/email-preference changes from saved settings and disable conflicting
  actions while a request is in flight.

### 11.3 Visible import lifecycle

- Expose honest states: not connected/not imported, request being submitted,
  queued, importing, completed, and failed. A queued GitHub job is not yet an
  active import; do not show a fabricated percentage or ETA.
- Give immediate feedback after Refresh now, prevent duplicate submissions, and
  explain that imports may take time. Keep status visible on the Watchlist page
  after the dialog closes, with accessible live announcements for transitions.
- On completion, show the imported film count, how many have London screenings,
  last successful sync time, and a clear way to view the results. Distinguish a
  valid empty watchlist from a non-empty list with no current London screenings.
- Preserve the last good list during refresh and after failure. Clearly label
  stale results and explain what the user can do next. First-import failure must
  not appear as an empty successful import.
- Audit polling and job state across reloads, navigation, multiple tabs, username
  changes and late responses. Bound waiting and detect jobs that fail or never
  start so the UI cannot remain indefinitely on Refreshing. Define retry behavior
  consistent with server cooldowns and retain accurate state after reopening.

### 11.4 Error handling and recovery

- Audit the full path: sign-in email request/redemption, session/account loading,
  settings save, import dispatch/fetch/parse, logout, deletion and unsubscribe.
  Surface relevant failures at the affected field/action or in a persistent
  page notice when a modal is closed; background browsing should remain usable.
- Provide clear messages and recovery for invalid input, expired/already-used
  links, expired sessions, offline/network failures, unexpected/non-JSON server
  responses, unavailable services, and rate limits. Show when retry becomes
  available using server cooldown/Retry-After information where appropriate.
- Persist safe import failure categories sufficient to distinguish an unknown
  username, an inaccessible/private watchlist, a blocked/unavailable upstream,
  incomplete/changed markup, and internal job failure. Avoid promising a specific
  cause when the upstream response cannot establish it. Offer the appropriate
  correction, public-list guidance, sign-in or retry action.
- Show errors with accessible alert semantics and successes/progress with status
  semantics. Never expose raw stack traces, credentials, provider payloads or
  internal diagnostics. Keep existing anti-enumeration behavior for sign-in.
- Do not silently swallow background refresh errors or replace successful cached
  data with empty data. Clear obsolete notices after recovery without losing a
  newer failure or mixing the state of different account actions.

### 11.5 Acceptance and verification

- Verify sign-in → dialog settings → queued/importing → success → matching films,
  plus dialog dismissal/reopening and navigation while importing, on desktop and
  at 390px. Keyboard focus, error announcements and no overflow are required.
- Exercise invalid/expired links, account service failure, save failure, cooldown,
  dispatch failure, import failure with/without a previous list, a stalled job,
  a valid empty list and a list with zero screening matches. Use controlled
  fixtures/fault injection; do not send extra real email for automated tests.
- Extend meaningful API/unit and recorded browser coverage for these states,
  including PR #7's toolbar/mobile-sheet integration. Finish with a verification
  handoff and evidence for dio's review.
- User constraint: stop and report before any further browser actions. Planning
  and code/API inspection can proceed; do not start browser verification without
  returning to dio about the required browser step.

### 11.6 Implementation progress — 4 October 2026

- 11.2 done: compact Sign in / Account entry point in the sidebar; one shared
  `Dialog` (native modal, labelled, Escape/close/backdrop, initial focus, focus
  restoration to the opener or the phone menu button, phone bottom sheet). The
  Pages drawer closes before the dialog opens so dialogs never nest. Delete has
  its own confirmation view with Cancel first. Inputs keep their values on
  failure; unsaved changes are flagged and block importing until saved.
- 11.3 done: `watchlist_sync.started_at` / `attempt_id` (migration 0003); API
  reports idle / queued / importing / completed / failed with timestamps, retry
  time and a safe message. Stalled jobs (30 min) become failed and re-queueable.
  Watchlist page shows status, last successful import, count vs. London matches,
  empty-list vs. no-matches wording, stale labelling, Refresh and Account
  buttons; sidebar shows a compact running-import status. Polling only while
  pending, plus focus refresh; a mismatch between the two account reads retries
  once before surfacing.
- 11.4 done: importer failures carry codes (`WatchlistError`), dispatch failure
  refunds the hourly reservation and is retryable immediately; non-JSON, 401,
  429 (`Retry-After`) and network failures have fixed messages; page-level
  notices persist after the dialog closes and are dismissable; account-service
  errors appear only where accounts matter (Watchlist page / watchlist filter).
- 11.5: 42 unit/API tests (lifecycle, stalled, refund, code mapping) and 10
  browser tests at 1200px/390px (recorded real-Functions flow plus controlled
  fault injection for expired links, service failure, save failure, cooldown,
  dispatch failure, import failure with and without a previous list, stalled
  job, empty list, zero matches, focus and overflow). Interactive browser
  verification on the live site is not started, per the constraint in 11.5;
  it waits for dio.
