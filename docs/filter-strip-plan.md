# Plan: replace the filter bar with a quiet shortcut strip

Written 10 October 2026 for the next agent. Base: `origin/main` at `dd622a6` (PR #28).
Design discussion and mockups: https://claude.ai/artifact/DMvoSGAq1CeukAkGMUj9sy (round two,
variant A, with the amendments in "Decision" below).

## Decision

dio's verdict after two rounds of mockups:

- The filter bar is overwhelming because the shortcuts (Today, Tomorrow, Evening, My
  cinemas, …) and the pickers (When, Cinema, Genre, …) are the same filters drawn twice, as
  three equal rows of boxed buttons with counts. On the phone "Quick filters" and "All
  filters" describe the UI mechanism rather than the films.
- A quiet line of plain-text shortcuts under the search row, with one Filters button, is the
  right shape. It must **not** lose one-tap access to the shortcuts dio uses from the get-go,
  in particular My watchlist. A horizontally scrolling strip that hides items is rejected.
- This is a **full replacement**, not a flagged variant. The current bar, the two shortcut
  rows and the phone Quick filters dialog are removed in the same PR. Existing tests are
  updated to the new bar, not kept alive for an old one.

Three things make it fit on a phone without scrolling or a dialog:

1. **Personalised set.** Shortcuts appear only when they apply to this visitor. My watchlist
   needs a connected watchlist; My cinemas needs chosen cinemas. A signed-out visitor sees
   only the date group plus Near me.
2. **Quiet rendering.** Plain text, no boxes, no counts on the bar. Active = full-strength
   ink with a brass underline. One hairline separates the date group from the personal group.
3. **Wrap, never scroll.** On the phone the line may wrap to a second line. Nothing is hidden.

## Scope

In scope:

- Desktop row 1: search, Cinema picker, Genre picker, Filters button. Row 2: the strip.
- Phone row 1: search and Filters button on one line. Row 2: the strip, wrapping.
- The Filters sheet (`dialog.filter-sheet`) gains "Under 2 hours" next to "Hide sold-out
  screenings" and shows the Watchlists trigger on desktop as well as phone. Everything removed
  from the bar remains reachable in the sheet.
- Delete the `When` row picker, the `year` row picker, the row `WatchlistsButton`, the
  `.quick-days` rows, `QuickFilters`, `QuickFilterTrigger` and `quick-filters.tsx`, and the CSS
  that only served them.
- Update every e2e spec that drives the old controls. Add a spec for the strip.
- Update `docs/cinema-ux.md` where it describes the Quick filters dialog.

Out of scope (do not do these):

- The "Filters index" sheet redesign from the mockups. The current accordion sheet stays.
- Teaching the search box genres or cinemas.
- Any change to the Events page's own `EventTypeFilter`.
- Analytics event renames. `filters_changed` and `search_performed` keep firing as they do.

## Where things are today

- `src/components/filter-bar.tsx` — the bar. Desktop: `.desktop-filters` with a `When`
  `<details>` picker plus `FilterControls` for `venue`, `genre`, `year`; `WatchlistsButton`;
  `.all-filters` button labelled "More filters" (desktop) / "All filters" (phone); the
  `dialog.filter-sheet`. Phone: `.mobile-filters` buttons are hidden by CSS in the current
  theme; the phone shows the `quickFilters` slot (a `QuickFilterTrigger`) and the All filters
  button.
- `src/components/quick-filters.tsx` — `QuickFilters` (desktop inline + phone dialog) and
  `QuickFilterTrigger` ("Quick filters ▾"). Both go.
- `src/app.tsx` ~lines 590–676 — the `shortcuts` JSX: Today, Tomorrow, Evening, This weekend,
  This week, Next week (via `dateShortcut` / `eveningShortcut`), My watchlist, My cinemas,
  Near me, Under 2 hours. Handlers to reuse: `change(dateShortcut(state, id))`,
  `change(eveningShortcut(state))`, the My cinemas block (sets `myCinemas` and the `venue`
  filter from `cinemas.venues`), `setNearbyOpen(true)`, `change({ short: !state.short })`.
  Active-state predicates: `isEvening(state)`, `myCinemasActive`, `state.watchlist`,
  `state.short`, and the day check (`state.filters.day` is exactly `[id]`, no exclusions,
  `!state.tonight`).
- `src/app.tsx` ~lines 527–530 `closeQuickFilters()` and its callers (`openCinemas`,
  `openAccount`, the Near me handler) — remove once the dialog is gone.
- `src/app.tsx` ~lines 930–970 — `FilterBar` is rendered with `quickFilters={<QuickFilterTrigger …/>}`,
  then `.filter-summary` renders `QuickFilters` around `shortcuts`.
- `src/components/filter-controls.tsx` — the sheet body: `FILTERS` pickers, the watchlist
  checkbox, "Hide sold-out screenings", "Reset all filters", "Show N films".
- `src/lib/filters.ts` — `FILTERS`, `CLEAR_FILTERS`, `dateShortcut`, `eveningShortcut`,
  `isEvening`. Verify that "next-week" and "this-week" are selectable inside the sheet's Day
  picker (`FilterPicker` builds the day list from `["today","tomorrow","weekend","week","beyond"]`
  plus dated facets; if "next-week" is only reachable from the shortcut button today, add it to
  that list so dropping it from the strip loses nothing).
- `src/lib/cinemas.ts` — `useCinemas(account)` → `venues`, `loading`.
- Account state: `account.user`, `account.user.username`, `account.watchlist?.fetchedAt`.
- Styles: `src/styles/picturehouse.css` is the active theme (`:root` block near line 577 holds
  the tokens: `--shade`, `--muted`, `--line`, `--active-bg`, `--brass`). `base.css` holds the
  structural rules (`.filter-bar`, `.desktop-filters`, `.quick-days`, `.filter-sheet`);
  `discovery.css` has the phone rules for `.quick-filters-mobile` and `.quick-filters-desktop`.
  New rules go in `picturehouse.css` next to the existing `.filter-bar` block. Remove the
  `.quick-days`, `.quick-filters-*`, `.quick-filter-dialog`, `.when-picker` and `.when-content`
  rules from all three files once nothing references them (grep before deleting; the
  `.quick-filter-dialog` selector appears inside shared `:is(...)` dialog rules in `base.css`,
  just drop it from the list).
- Prior art: worktree `~/.codex/worktrees/compact-filter-designs/london-cine-info` (detached
  at `956e6d6`) holds an earlier comparison harness with `src/styles/compact-designs.css`. It is
  a throwaway design switcher, not mergeable. Borrow CSS ideas only.

## The strip

New component `src/components/shortcut-strip.tsx`, fed by a pure item builder
`shortcutItems({ account, cinemas, state, counts })` in `src/lib/shortcuts.ts` so the
visibility rules are unit-testable. Move the handler wiring out of the `shortcuts` JSX in
`app.tsx`.

Items, in order, with their visibility rule:

| Group    | Item         | Shown when                                       | Handler                           |
| -------- | ------------ | ------------------------------------------------ | --------------------------------- |
| when     | Today        | always                                           | `dateShortcut(state,"today")`     |
| when     | Tomorrow     | always                                           | `dateShortcut(state,"tomorrow")`  |
| when     | This weekend | always                                           | `dateShortcut(state,"weekend")`   |
| when     | This week    | always                                           | `dateShortcut(state,"this-week")` |
| when     | Evening      | always                                           | `eveningShortcut(state)`          |
| personal | My watchlist | `account.user && account.watchlist?.fetchedAt`   | existing watchlist toggle         |
| personal | My cinemas   | `cinemas.venues.length > 0 \|\| myCinemasActive` | existing My cinemas block         |
| personal | Near me      | always                                           | `setNearbyOpen(true)`             |

Dropped from the strip: Next week (sheet, Day picker) and Under 2 hours (sheet, new checkbox).
Do not render an empty personal group or its separator. A visitor with a watchlist but no
cinemas sees Today … Evening | My watchlist · Near me.

Markup: `<div class="shortcut-strip" role="group" aria-label="Shortcuts">` containing
`<button aria-pressed>` elements, with `<span class="strip-sep" aria-hidden>` between groups.
Each button carries a `title` with the count text ("114 films", from `counts.day` /
`counts.time`) so the count is still available on hover and to assistive tech, but is not
rendered inline. The My cinemas button keeps `disabled={cinemas.loading}`.

Rendering (picturehouse theme):

- Font 12px desktop, 13px phone; colour `var(--muted)`; no background, no border, no radius.
- Active: colour `var(--fg)`, `border-bottom: 1px solid var(--brass)`. Hover: colour `var(--fg)`.
- Focus-visible: the theme's existing outline. Keyboard order follows DOM order.
- Separator: 1px × 12px, `var(--line)`.
- Layout: `display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 2px 12px 8px`. On the phone
  gap `4px 12px`, and buttons get `min-height: 36px` with `padding-block` so the tap target is
  comfortable while the visual line stays thin. Never `overflow-x: auto`; never `white-space`
  tricks that let it widen the page.
- The row must take ≤ 1 line at 1280px and ≤ 2 lines at 390px with all eight items present.
  Measure this in the e2e spec rather than assuming.
- `.filter-summary` currently reserves `min-height: 68px` (picturehouse.css ~line 840) for the
  two chip rows. Recompute for the strip so the results do not jump when the personal group
  appears after sign-in; prefer reserving one line's height and letting a second line push.

## The bar

`FilterBar` becomes:

- Row 1 desktop: `.bar-search`, then `FilterControls` with `filterKeys={["venue","genre"]}`
  (Cinema and Genre pickers, as today), then the Filters button. The `When` `<details>`, the
  `year` picker and the row `WatchlistsButton` are deleted. `yearOpenRequest` (opened from the
  Year chip in the active-filters row) opens the sheet at the year section on every width, the
  way the phone path already does; delete the desktop branch.
- Row 1 phone: `.bar-search` and the Filters button on one line (search flexes, button
  `flex: none`). Delete the `.mobile-filters` buttons and their CSS; they are already hidden.
- The Filters button is labelled **Filters** on both widths (replaces "More filters" and
  "All filters"; drop the `.desktop-more` / `.mobile-more` spans). Keep `data-active` and the
  `shortcut-count` badge logic; the badge counts everything set through the sheet, including
  Under 2 hours and the day/time facets when they were set from inside the sheet rather than the
  strip (simplest: count the facets and toggles exactly as `moreCount` does today, plus `day`,
  `time`, `from`/`to`, `short`, and subtract nothing; a strip item that is active will then also
  show in the badge, which is acceptable and keeps the two surfaces honest).
- Remove the `quickFilters` prop. In `app.tsx`, render `<ShortcutStrip …/>` inside
  `.filter-summary` where `QuickFilters` was, above `cinema-context` and the results heading.
- The sheet's `.mobile-watchlists` block renders on every width (rename the class to
  `sheet-watchlists`).

`FilterControls`: add a checkbox "Under 2 hours" bound to `state.short`, rendered immediately
after "Hide sold-out screenings".

## Tests

Fixture data is required for `npm run e2e` (see HANDOVER.md):
`npm run build-data -- --fixture && npm run build`, then `npm run e2e`. The accounts suite is
`npm run e2e:accounts`.

Specs that drive the old controls and must be rewritten against the new bar:

- `tests/e2e/catalogue.spec.ts` — opens `/^(More filters|All filters)$/` and `/^Quick filters/`;
  use the "Filters" button and the strip group instead. Line ~160 asserts focus returns to the
  More filters button after the sheet closes; the same assertion applies to "Filters".
- `tests/e2e/discovery.spec.ts` — 24 references; the Quick filters dialog assertions become
  strip assertions (click the strip button, check `aria-pressed`), and the "All filters" opener
  becomes "Filters".
- `tests/e2e/filter-bar.spec.ts`, `tests/e2e/ux-flows.spec.ts`, `tests/e2e/hide-ratings.spec.ts`,
  `tests/e2e/picturehouse.spec.ts`, `tests/e2e/year-filter.spec.ts` — rename the opener and
  remove dialog expectations. `year-filter.spec.ts` likely asserts the desktop year picker opens
  from the Year chip; it now opens the sheet.
- Any accounts spec under `tests/auth` or `playwright.accounts.config.ts` that presses "My
  watchlist" or "My cinemas" from the Quick filters dialog now presses them on the strip, and
  must first create the precondition (connected watchlist, chosen cinemas) because the buttons
  are otherwise absent.

New `tests/e2e/filter-strip.spec.ts`, run at the desktop and phone projects the existing specs
use:

1. `getByRole("group", { name: "Shortcuts" })` is visible; no button named /Quick filters/
   exists; the Filters button is named exactly "Filters".
2. Signed out: the strip contains Today, Tomorrow, This weekend, This week, Evening, Near me,
   and does not contain My watchlist or My cinemas.
3. Clicking Today sets `aria-pressed="true"`, the result status updates to the fixture's count
   for today, and the Clear all chip appears; clicking again clears it.
4. Evening combines with Today (both pressed, count matches the fixture).
5. No horizontal overflow: `document.documentElement.scrollWidth <= clientWidth` at 390px.
6. Strip height with all eight items: seed guest cinemas in `localStorage` (`useCinemas` reads
   the guest record; see `cinemas.ts` for key and shape) to get My cinemas, and use the accounts
   harness for My watchlist. At 1280px the group's bounding box height is ≤ 30px; at 390px it is
   ≤ 80px. If the accounts harness is impractical in the e2e config, measure seven items there
   and the full eight in `e2e:accounts`.
7. The Filters sheet opens, contains "Under 2 hours", and toggling it changes the count and
   the Filters badge.
8. The Year chip in the active-filters row opens the sheet at the year section on desktop.

Unit: `src/lib/shortcuts.test.ts` for the visibility rules (signed out; watchlist connected;
cinemas chosen; both; `myCinemasActive` with zero venues still shows My cinemas).

Also run `npm run typecheck`, `npm run lint`, `npm test`. Grep for `quick-filter`, `quick-days`,
`QuickFilter`, `when-picker`, `mobile-more`, `desktop-more` at the end; all should be gone.

## Docs

- `docs/cinema-ux.md`: the sentence "**Edit cinemas** … remains outside the phone Quick
  filters dialog" needs rewording; there is no dialog. Edit cinemas stays in the
  `cinema-context` row under the strip.
- `docs/UX_REVIEW.md`: if it describes the shortcut rows or Quick filters, add a dated note
  pointing at this plan rather than rewriting history.

## Delivery

- Work in a new worktree off `origin/main`: branch `codex/filter-strip`. Do not build on the
  `compact-filter-designs` worktree.
- One PR titled "Replace filter bar with a quiet shortcut strip". Description: the Decision
  section above in two sentences, what was removed, and screenshots at 1280px and 390px of the
  signed-out and signed-in strip (seeded guest cinemas plus the accounts harness, or a manual
  connect on the Pages preview).
- Hand-off to dio: the Cloudflare Pages preview URL, to be opened on a phone. The question to
  answer is "does one-tap access to what you use from the get-go survive, and does the bar
  read as calm?". Merge only after that answer.

## Acceptance criteria

- One row of search and controls on both widths; one wrapping line of text shortcuts; no
  Quick filters dialog; no counts on the bar; no "When" picker on the row; no horizontal
  scroll at 390px; strip ≤ 2 lines at 390px with every item present.
- Every shortcut that exists today is still one tap on the strip or inside the Filters sheet:
  Next week and Under 2 hours in the sheet, the rest on the strip when they apply.
- My watchlist and My cinemas appear only when they apply, and appear without a reload once a
  watchlist is connected or cinemas are chosen.
- All e2e, accounts and unit suites pass after their updates; the new spec passes on desktop
  and phone projects.
- No change to shared URLs, analytics event names, or the Events page controls.
- No dead code: `quick-filters.tsx`, the `When` picker, the `.mobile-filters` buttons and their
  CSS are deleted, not hidden.
