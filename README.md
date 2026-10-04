# London Ciné Info

A static London cinema listings site powered by Clusterflick, using Vite,
TypeScript and Preact. [PLAN.md](PLAN.md) records the implementation and source limits.

Requires Node 24 or later.

```sh
npm ci
npm run build-data -- --fixture
npm run dev
```

The fixture build is deterministic and needs no network access. To use the live
feed instead:

```sh
npm run build-data
npm run build
```

`GH_TOKEN` is optional locally and increases the GitHub API rate limit. The script
uses the latest public releases of `clusterflick/data-combined` and
`clusterflick/data-matched`. Downloads are cached in `.cache/clusterflick`; an
asset's release tag, ID, modification time and size determine cache reuse.
`--now <ISO timestamp>` can fix the time for investigation or replay.

Verification:

```sh
npm run build-data -- --fixture
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run e2e
```

## Data output

Generated files are excluded from git:

- `public/data/films.<hash>.json`: film metadata, ratings, facet bitsets and compact
  screening tuples. Each tuple keeps day, local minute, venue, format, accessibility
  availability and event status together, so filters can match a single screening.
  The seventh event flag is optional for compatibility with earlier catalogues.
- `public/data/meta.<hash>.json`: venues, boroughs, memberships, facet dictionaries
  and counts, build time, upstream release tags and diagnostics. Facet counts refer
  to distinct films, not the number of screenings.
- `public/data/showtimes.<hash>/<movieId>.json`: showtimes grouped by London date,
  with booking URLs, format and accessibility flags, plus actor/overview details.
  UTC timestamps remain available even when DST repeats a local hour.
- `src/generated/manifest.json`: URLs of the current film, metadata and showtime
  assets. The UI imports this manifest at build time; generate data before typechecking.

The shared contract is in `src/shared/data.ts`. Film facet bitsets are base64,
least significant bit first; option order comes from `meta.facets`. Screening
format/accessibility masks use those same dictionaries. Formats without upstream
metadata are marked `standard` (unspecified), rather than inferred as digital/2D.

Validation and reference checks complete before publication. Output is staged and
replaces the previous generated set only on success. Every data URL is versioned,
so Cloudflare can cache it as immutable. A failed Actions build does not deploy.

Known source limits:

- `releaseDate` is TMDB's original release date, not a verified UK release date.
  New/classic/upcoming flags use that date; the UI describes this limitation.
  Films with a future year but no date appear under Calendar's date-unknown group.
- Invalid booking URLs fall back to the validated showing-details URL and carry
  `bookingFallback: true`. The UI labels those links as screening details. The affected movie/showing IDs are in diagnostics.
- Membership mapping is venue eligibility, not a guarantee of coverage for a
  specific format or special event.

## Sources and licences

Screenings and movie metadata come from Clusterflick's public combined release;
ratings come from its matched release. These build artifacts have no explicit
licence and are used under the personal, non-commercial posture recorded in the
plan. Per-venue transformed data is the documented CC BY 4.0 fallback, not a source
currently used by this pipeline. The public UI's attribution must reflect that
distinction. Rating URLs retain links to their original providers.

Borough boundaries and their OGL attribution are documented in
[`src/data/README.md`](src/data/README.md). The synthetic fixture has no upstream
movie descriptions or rating data.

`public/tmdb-logo.svg` is TMDB's approved blue/green long logo, downloaded from
its [branding page](https://www.themoviedb.org/about/logos-attribution). About
includes the required non-endorsement notice; the logo retains its original colours.

## Deployment

CI runs typecheck, lint, tests and a fixture-backed build for pull requests and
`main`. The production workflow repeats checks, builds live data, then uses
Wrangler Direct Upload. It runs on pushes to `main`, manually, and at 06:45 and
11:45 UTC daily. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are repository
secrets. Local preview deployments use:

```sh
npx wrangler pages deploy dist --project-name london-cine-info --branch codex-core-ui
```

## Core UI

The table sorts all seven columns, shows 200 films per page, and loads a film's
showtimes only when expanded. Search matches titles, original titles and directors;
original language and director filters are encoded in the URL. Only one film opens
at a time. Screening groups use London dates and include format, accessibility,
sold-out and booking-detail badges.

Filters sit above the table: Search, When, Cinema, Genre and More filters on desktop.
Below 800px, Search fills a row and When, Cinema and Filters open a full-width bottom
sheet. The table shows Title and Director at phone widths; expanding a film reveals
its ratings and year. Desktop retains all seven separately sortable columns. The theme follows the system with an override
for this visit. No cookies or browser storage are used.

All page links currently select their dataset flags. Retrospectives are grouped alphabetically by director, with sorting inside each
group and continued headings across page boundaries. Co-directed films appear in
each qualifying director’s group. Calendar groups release dates earliest first,
with unknown dates last; column sorts apply inside each group and headings repeat
across page boundaries. Events replaces Year with special-screening labels and
matches filters and expanded programmes against event screenings only.

Display offers Title & original, Title only and Original title (falling back to
the title when missing). Title sorting follows the displayed title. Rating columns
can be dragged or moved with accessible arrow buttons; expanded ratings follow
the same order. These choices survive navigation and reset on reload.
Browser tests use the synthetic fixture, at
1200px and 390px, covering pagination, sort, filters, navigation, lazy loading,
retries, filter sheet keyboard behavior, theme and overflow.

## Filters

All nine filters are available in More filters (Filters on mobile). Each picker supports multiple choices;
cinemas are grouped by borough and boroughs by inner/outer London. Long lists can
be searched. Day offers Today, Tomorrow, This weekend, Next 7 days, Later and exact
dates. Time offers bands and a custom start-time range, including overnight ranges.
A separate checkbox hides sold-out screenings.

Selections match **any** value within a filter and **all** selected filters together.
Screening filters must match the same screening: a film cannot borrow a day from
one cinema and an accessibility flag from another. The expanded programme applies
the same selections. Counts show distinct films matching the other filters, ignoring
choices within the picker being counted; zero-result options remain available so they can also be excluded. Chips above the table remove individual choices; Clear all resets
the complete selection, including custom sorting. The chip row appears only when
there is something to clear and reserves no empty space after reset.
Query parameters preserve filters in shared links.

In the filter sheet, a sticky Show results button closes the sheet. Cinema and When
shortcuts open directly to their category. Escape closes choosers and sheets without
clearing search text, and sheets return focus to their trigger. A currently expanded film stays
open when changing filters if it still matches. No preference is persisted.

Filter options toggle selected/unselected with a click or Space. The explicit
Exclude options toggle switches new choices to exclusions; clicking an existing
selection or exclusion clears it.
Excluded options show a minus checkbox and NOT label; chips use the same label.
Positive choices still match any value; every excluded value is rejected. Screening
exclusions apply to individual screenings, so a film can remain when it has another
matching screening. Exclusions are shared using repeated `not_<filter>` parameters.
Today and Tomorrow buttons above the table replace day selections/exclusions and
keep all other filters; clicking the active shortcut clears the day filter.

Picker Clear buttons remain in place and are disabled when empty. Summaries keep
a single line and counts have reserved space, and helper text does
not appear/disappear on selection. Active chips use a reserved horizontal strip
that can scroll, keeping the table toolbar height stable. The geometry regression
checks every picker through select/deselect at desktop and phone widths,
including long cinema labels and overnight time ranges.

Desktop dropdown lists retain their height when a search has few or no matches.
Filter sheets use a single scrolling surface, so long option lists do not require
nested scrolling.

Page navigation stays in a desktop sidebar and a separate Pages drawer on phones. Film filters remain in the results toolbar and mobile filter sheet.

Accounts and Letterboxd watchlists: see [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md) for platform setup, verification and activation.
