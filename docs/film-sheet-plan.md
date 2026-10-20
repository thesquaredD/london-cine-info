# Plan: a full film column, a content-sized dialog, a phone sheet and pagers top and bottom

Written 20 October 2026 for the implementing agent. Base: `origin/main` at `6a94134` (PR #61).
Design review and mockups (approved by dio, "great, implement"):
https://claude.ai/artifact/TpAPqNeJMBkVUpzx2gW8oh (version 3; versions 1–2 proposed a sticky
toolbar with a tiny ‹ › pager and scrolling rows, which dio rejected: "I said I don't want you
to scroll down", "you should have it on the top and bottom").

## Decision

Measured on main at 1280×900 and 390×844, with dio's verdicts:

- **The film column is empty beside the screenings, in both views.** List view: the opened
  row's film column (poster, facts, chips, Report, More details) ends about 520px down while
  twelve rows run to 950px. Dialog: the same column plus a fixed 85dvh box leaves ~450px
  blank. **Verdict: on desktop (≥ 800px) the film column shows the synopsis (clamped to six
  lines, Read more) and a Cast line, in the list view and the dialog alike. The `More details`
  disclosure remains only on phones (< 800px), where the column is full width and the
  screenings follow it.**
- **The poster view's dialog is a fixed 960×85dvh box with a 68px title bar.** Twelve rows do
  not fit, so the dialog scrolls and the pager is the last thing in it. **Verdict: `height:
  auto; max-height: 85dvh`, no title bar for this dialog, a floating close button in the top
  right corner, the dialog scrolls as one piece only when its content is taller than the
  window.**
- **On phones the dialog should read as a sheet.** It is already fixed to the bottom at 90dvh,
  but the title bar and the film block push the first screening 437px down and the film title
  appears twice. **Verdict: a grip at the top, no title bar, floating close button, `max-height:
  92dvh`, Date and Cinema on one line, Reset as a text link at the right of the count line
  when a choice is active.**
- **The Previous / Next screenings bar is 68px tall, only exists after the twelfth row, and
  pressing it scrolls the page back to the programme top (a 545px jump in the list view).**
  **Verdict: Previous and Next are labelled buttons in TWO places, on the count line above the
  first row and in a 44px bar after the last row, in both views. Pressing either swaps the
  rows and scrolls NOTHING. Focus moves to the count with `preventScroll`.**
- Labels: “‹ Previous” / “Next ›” visibly; accessible names stay “Previous screenings” /
  “Next screenings”. Phones show “1 / 151” between them, desktop “Page 1 of 151”.

## Scope

In scope:

1. Film column content on desktop in both views: synopsis + Read more + Cast line + Report
   link, replacing the `More details` disclosure at ≥ 800px. Phones keep `More details`.
2. The poster dialog: content-sized, no `.sheet-heading`, floating close button; phone sheet
   with grip. The generic `Dialog` keeps its heading for every other dialog.
3. Pager rendered twice (one component): on the `.programme-summary` line and in a bottom bar
   that replaces `.programme-pagination`. `turnPage` no longer scrolls.
4. Phone programme controls: Date and Cinema on one line (two half-width `ChoicePicker`s),
   Reset becomes a text link in the count line, shown only when a choice is active.
5. Tests: update the e2e specs that assert the dialog height, the title bar, the bottom pager,
   the page-turn scroll and the phone Reset button; add assertions for the new behaviour.
6. Changelog fragment (public, `improved`) and `docs/UX_REVIEW.md`.

Out of scope:

- The screening row itself (done in #61), the pickers' panels, sharing, analytics names.
- Changing the page size (stays 12).
- Any other dialog's heading or sizing.

## Where things are today

- `src/components/expanded-row.tsx`: `turnPage` L170–181 (scrolls the programme into view
  when its top is off screen or low; focus to `programmeStatus`); `.film-detail-title` L225;
  `.programme-controls` L369; `.programme-summary` + `.programme-count` + `.programme-page`
  L424–435; `.programme-pagination` nav L584–598; `details.film-about` with `More details`,
  `.film-synopsis`, `.synopsis-toggle`, `details.film-cast` L600–625. The synopsis comes from
  `data.details.overview`, cast from `data.details.actors` (loaded with the showtimes).
- `src/components/poster-grid.tsx` L227–245: `<Dialog className="modal-dialog
  poster-film-dialog" title=…>` wrapping `<table class="film-table poster-detail-table">` +
  `ExpandedRow columns={1}`.
- `src/components/dialog.tsx`: renders `.sheet-heading` (h2 + × button) then `.dialog-body`.
  Needs an opt-out (`heading={false}` or a `header` slot) so the poster dialog can render its
  own floating close button while keeping `aria-label`, focus handling and `onCancel`.
- CSS: `src/styles/base.css` L1368–1385 `.sheet-heading` (sticky, 68px with padding), L1457
  `.modal-dialog` (width 480px, `max-height: 85dvh`, overflow auto), L1571–1590 phone rules
  (`position: fixed; inset: auto 0 0; max-height: 90dvh; border-radius: 4px 4px 0 0`).
  `src/styles/posters.css` L336–360: `.poster-film-dialog[open]` fixed `height: 85dvh` /
  `90dvh`, `.dialog-body { padding: 0 }`. `src/styles/discovery.css`: L59–95 title / synopsis
  clamp / toggle / cast, L260–330 phone variants, L297–320 `.film-about` summary styling,
  L365–400 the ≥ 800px `.film-expanded` grid (`minmax(280px, 30%) minmax(0, 1fr)`, areas
  `"info screenings" "details screenings"`), L959–990 `.programme-summary`, `.programme-page`,
  `.programme-pagination`, L992+ the `(max-width: 30rem)` controls stacking.
- Tests: `tests/e2e/busy-programme.spec.ts` (pager, count, Reset, controls stacking),
  `tests/e2e/film-sharing.spec.ts` (dialog + row shape), `tests/e2e/screening-layout.spec.ts`,
  `tests/e2e/discovery.spec.ts` (More details / synopsis), `tests/e2e/welcome.spec.ts`
  (How to use example), and the poster-view spec(s) (`grep -l poster-film-dialog tests`).

## Spec

### Film column (≥ 800px, both views)

- Order: poster + facts (unchanged), chips row (unchanged), `p.film-synopsis` clamped to six
  lines with the existing `synopsis-toggle` “Read more” / “Less”, then `p.film-cast-line`
  (“Cast · A, B, C”, muted, first five names, the full list behind “Read more” is not
  needed), then the Report link. No `details.film-about` at this width.
- The column keeps `align-content: start`; it does not stretch rows. If the synopsis is
  missing, the column simply ends after the chips, as today.
- Phones (< 800px): unchanged `details.film-about` after the screenings.
- Grid areas: drop the `details` row from `.film-expanded` at ≥ 800px (two columns, one row).

### Poster dialog

- `Dialog` gains `heading?: boolean` (default true). With `false` it renders no
  `.sheet-heading` and the caller supplies the close control; the dialog still has
  `aria-label={title}`, Escape handling and backdrop click.
- `.poster-film-dialog[open]`: ≥ 800px `width: min(960px, 100vw - 32px); height: auto;
  max-height: 85dvh;` (remove the fixed height); the dialog scrolls as a whole. < 800px:
  bottom sheet, `max-height: 92dvh`, a 36×4px grip (`.sheet-grip`, `--line` colour) centred
  12px from the top, `aria-hidden`.
- Floating close: `button.dialog-close` 44×44, top 10px right 10px, `position: sticky` within
  the dialog so it stays visible while the dialog scrolls (or `position: absolute` on a
  non-scrolling wrapper; pick what keeps it visible), `aria-label="Close {title}"`,
  `data-initial-focus` stays wherever it is today. Leave 48px of right padding on the film
  facts so the title does not run under it.
- Loading state keeps `min-height: 240px` on `.showtimes` so the dialog does not grow in a
  jump when the list arrives.

### Pager, top and bottom

- One component `ProgrammePager({ page, pageCount, onTurn, compact })` rendering
  `nav[aria-label]` with two `button`s (`aria-label` “Previous screenings” / “Next screenings”,
  visible text “‹ Previous” / “Next ›”) and the page text between. Top instance: on the
  `.programme-summary` line, right of the count (`aria-label="Screening pages"`); bottom
  instance: `.programme-pagination` bar after the last day section, 44px buttons, `padding:
  10px 0 2px`, hairline above, hidden when `pageCount === 1` (`aria-label="Screening pages,
  bottom"` or `aria-hidden` on the duplicate text, pick what keeps screen-reader output
  sane). Both disabled at the ends.
- `turnPage(page)`: set the page, then `programmeStatus.current?.focus({ preventScroll: true })`.
  Remove the `scrollIntoView` and the top/margin check entirely. Nothing scrolls, in either
  view.
- Under 30rem (phones) the top pair takes its own line above the count: `“‹ Previous” · “1 /
  151” · “Next ›”`, then the count line below it.

### Phone programme controls (< 30rem container)

- `.programme-controls`: `grid-template-columns: 1fr 1fr`, both `ChoicePicker`s on one line;
  values ellipsise (already do). The Reset `button` is removed from the grid at this width and
  rendered as `button.programme-reset-link` (text link, underline, 44px tall tap target via
  padding) at the right end of the count line, only when `chosenDate || chosenVenue`.
- ≥ 30rem: unchanged (`1fr 1fr auto`, Reset button).

### Accessible names and tests

- Keep existing names where they exist (“Previous screenings”, “Next screenings”, “Find a
  screening”, the count `role="status"`).
- New assertions: pager present above the first row and below the last in the list view and
  the dialog at 1280px; pressing either Next changes the count and does not change
  `window.scrollY` (list view) or the dialog's `scrollTop`; bottom bar absent when one page;
  dialog height < 85dvh for a film with two screenings and == content height; no
  `.sheet-heading` in the poster dialog, close button visible and working; phone: grip
  present, Date and Cinema side by side, Reset absent until a choice then present as a link;
  desktop film column shows the synopsis without a `More details` summary; phone still has
  `More details`.
- Layout assertions compare within one run (CI is Linux with classic scrollbars).

## Tests

`npm run build-data -- --fixture`, then `npm run lint`, `npm run typecheck`, `npm test`,
`npm run changelog:validate`, the touched e2e specs one by one, the full `npm run e2e`, and
`npm run build && CI=1 npm run e2e:accounts` once (the accounts suite serves the prebuilt
`dist`, so build first).

## Docs and changelog

- `npm run changelog:new -- film-sheet-pagers`: public, `improved`, e.g. title “Turn screening
  pages from the top or the bottom”, body: the film's synopsis now sits beside its screenings,
  the poster view's film window fits its content and opens as a sheet on phones, and Previous
  / Next are available above and below the list without the page jumping.
- `docs/UX_REVIEW.md`: a dated section.

## Delivery

- Branch `claude/film-sheet` in `~/.codex/worktrees/film-sheet/london-cine-info`.
- Commit with `git -c user.name="Diogo Diogo" -c user.email="44315677+thesquaredD@users.noreply.github.com"`;
  end messages with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Push: `T=$(env -u GITHUB_TOKEN gh auth token --user thesquaredD)` then
  `git -c credential.helper= -c credential.helper='!f() { echo username=thesquaredD; echo password='"$T"'; }; f' push -u origin claude/film-sheet`
  (the blank helper first is required: the keychain holds a work account that is refused).
- `GH_TOKEN=$T gh pr create --draft --base main …`, body ending with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`, linking the review.
  Never merge: merging deploys.

## Acceptance criteria

1. At 1280×900 the film column in the list view and in the dialog shows the synopsis and cast;
   no `More details` summary at that width; phones still have it.
2. The poster dialog has no title bar, a visible floating close button, and its height equals
   its content up to 85dvh; a two-screening film gives a short dialog.
3. On a 390px phone the dialog is a bottom sheet with a grip, Date and Cinema side by side,
   Reset as a text link only when active.
4. Previous / Next appear above the first row and below the last in both views; pressing
   either changes the page and scrolls nothing; the bottom bar is absent with one page.
5. Lint, typecheck, unit, full e2e and the accounts suite pass; changelog validates.
