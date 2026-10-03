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
