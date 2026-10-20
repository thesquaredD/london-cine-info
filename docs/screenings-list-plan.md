# Plan: one screenings row, a share toast and real pickers

Written 20 October 2026 for the implementing agent. Base: `origin/main` at `9e8451f` (PR #59).
Design review and mockups (approved by dio, "go with your recommendation"):
https://claude.ai/artifact/2BzPsns1yVVuNSyyob1udn

## Decision

dio's complaints about the screenings list under an opened film, and the verdict:

- **The poster dialog's screening row looks "completely different"** from the list view. It is
  the same `ScreeningRow`; the list is 620px wide in the dialog and 722px in the list view, and
  the layout switches shape at `@container screenings (min-width: 44rem)` (704px). The dialog
  lands under the switch and gets the stacked column with the absolutely positioned share
  button. **Verdict: one row shape from 30rem (480px) up, the phone shape below it.**
- **The share button "sucks".** A tray-with-arrow glyph that swaps to a check, no visible
  confirmation, and a different icon from the film's Share chip (chain link). **Verdict: the
  chain-link `LinkIcon` everywhere, the icon never changes, and a visible toast "Screening link
  copied" / "Film link copied" shared by both share buttons.**
- **Type too small on the Date / Cinema controls, native pickers.** 15px labels, 14px selects
  and count, next to 17px venue names. **Verdict: the app's picker look (48px field, small
  label over a 16px value, caret) opening a floating panel; Cinema is a single-choice list with
  counts and a Find field; Date is a month grid with per-day counts. The panels are popovers,
  NOT inline `<details>` expansion that pushes the list down (dio: "make sure the filters are
  not inline").**
- **Spacing with many screenings.** Rows are baseline-aligned and vary in height; the count
  line floats. **Verdict: rows centre-aligned on a 60px minimum height, tags and the screen
  note on one meta line, count and page on one 15px line with 10px above and below.**
- Calendar action label becomes **Calendar** / **In calendar** (accessible names unchanged:
  "Add to calendar: …" / "View saved screening: …").
- Toast wording is specific: **Screening link copied**, **Film link copied**.

## Scope

In scope:

1. `ScreeningRow` layout: one shape ≥ 30rem, phone shape < 30rem. Applies to the film sheet
   (list view and poster dialog), the How to use example and the Events page rows.
2. Share: `LinkIcon` in `ShareScreening`, no swap; delete `share-icon.tsx` if nothing else uses
   it. One toast host in the app shell; `ShareScreening` and the film Share button call it.
   Remove the per-button `sr-only` status spans and the reserved `.share-status` line.
3. Programme controls: a new single-choice picker component with a popover panel, used for
   Date and Cinema in `expanded-row.tsx`. Native `<select>`s removed.
4. Count + page line restyled; Reset lights up when a choice is active.
5. Tests: update the e2e specs that drive the selects, the check icon and the calendar label
   (`tests/e2e/busy-programme.spec.ts`, `film-sharing.spec.ts`, `discovery.spec.ts`,
   `welcome.spec.ts`, `events-radar.spec.ts`, `tests/auth/calendar.spec.ts`). Add coverage for
   the toast and the pickers (open, choose, close on Escape, focus return, choice reflected in
   the count).
6. Changelog fragment (public, type `improved`), `docs/cinema-ux.md` / `docs/UX_REVIEW.md`
   where they describe these controls.

Out of scope:

- The main filter bar and the Filters sheet. They keep `FilterPicker` as is.
- Widening the poster dialog. The row fix removes the need.
- Any change to what Book / Details link to, analytics event names, or sharing URLs.

## Where things are today

- `src/components/screening-row.tsx` — the row markup (`li > time, .time-dot, .screening-info
  > .screening-details + .screening-actions`, optional `.screening-after`).
- `src/components/expanded-row.tsx` — the film sheet. Programme controls at ~L378–420 (two
  native `<select>`s, Reset, `.programme-count`); screening rows ~L470–560 with Book,
  `add-calendar` button ("Add to calendar" / "In my calendar") and `<ShareScreening>`; the film
  Share button ~L300–320 with `announceShare` and the `.share-status` div.
- `src/components/share-screening.tsx` — the icon button; `announce()` + `sr-only` status;
  `CopyFallback` when the clipboard refuses. `src/components/share-icon.tsx` — tray glyph /
  check swap. `src/components/platform-marks.tsx` L42 — `LinkIcon`.
- `src/components/events.tsx` ~L193 — the Events page uses `ShareScreening` too.
- `src/components/how-to-use.tsx` L148–180 — mirrors the row with spans (`span.add-calendar`,
  `span.share-screening` with `ShareIcon`). Must keep matching the real row.
- `src/components/filter-picker.tsx`, `date-calendar.tsx` — the multi-select pickers used by
  the main filters (`<details>` that expand inline). Their look (`dialog .filter-picker >
  summary` in `picturehouse.css` L1060–1130: grid label/value/caret, 48px) is what the new
  field should match; do not reuse their inline expansion.
- `src/components/dialog.tsx` — the modal `Dialog`, used by the poster view
  (`poster-grid.tsx`, `.poster-film-dialog`, 960px × 85dvh, `posters.css` L341).
- CSS: `src/styles/discovery.css` L429–520 (row grid, share positioning), L560–680 (the 799px
  media query, the 44rem and 26rem container queries), L690–760 (film actions, `.share-status`),
  L766–830 (`.programme-controls`, `.programme-count`, `.programme-pagination`).
  `src/styles/picturehouse.css` L255–300 and L985–1002 (theme row sizes), L1060–1130 (dialog
  picker look). `src/styles/base.css` L457 (`.badge`).
- Toast: nothing exists. `src/lib/feedback.ts` (`openFeedback`) shows the pattern for a module
  that any component can call and one component in `app.tsx` renders.

## Spec

### Row (`ScreeningRow` + CSS)

- Grid ≥ 30rem: `time dot details actions`, `align-items: center`, `min-height: 60px`,
  `padding: 8px 12px`, column gap 10px. Keep `time` at `min-width: 2.6em`, tabular.
- `.screening-details`: venue (17px, 16px under 800px) then **one** `.screening-meta` line:
  the tags (badges) followed by the screen/notes text, `display: flex; flex-wrap: wrap; gap:
  4px 6px; align-items: center;` 13px muted. The shared-screening label stays a badge-like
  element at the start of the meta line (keep its `tabIndex={-1}` focus behaviour and the
  sr-only time).
- `.screening-actions`: `display: flex; gap: 6px; align-items: center;` Book `width: 6em`,
  calendar `width: 7.9em`, share `44px`. Book keeps `--active-bg`; calendar and share share one
  quiet style: panel fill, 1px `--line` border, 2px radius, 44px tall. The calendar button
  carries a small calendar glyph (new 16px inline SVG in `platform-marks.tsx` or a sibling
  file) + "Calendar"; when saved, a check glyph + "In calendar", muted text.
- Grid < 30rem (`@container screenings (max-width: 30rem)`): `"time actions" "details
  details"`, row gap 6px, actions right-aligned; calendar and share are icon-only 44px squares
  (label visually hidden, `aria-label` unchanged); Book keeps its label.
- Delete: the `li:has(.share-screening) { position: relative }` + absolute share rules, the
  44rem container query block, the two-line calendar sizing, `span.add-calendar` special-casing
  (give the How to use spans the same classes/structure as the real buttons instead).
- Keep: `.sold-out`, `.shared-screening` tint, `.screening-after` for the `CopyFallback` row,
  the focus ring, 44px targets.

### Share + toast

- `src/lib/toast.ts`: `showToast(message: string)` with a tiny subscriber API (one listener).
- `src/components/toast.tsx`: `<ToastHost/>` rendered once in `app.tsx` near `FeedbackDialog`.
  Fixed, bottom centre, `bottom: calc(16px + env(safe-area-inset-bottom))`, ivory (`--fg`)
  on walnut (`--bg`) in the Picturehouse theme using tokens from `picturehouse.css` (no hex),
  2px radius, 15px, check glyph + text, `role="status"`, `aria-live="polite"`. Shows 3s, a new
  message replaces the old one (clear then set on the next frame so it re-announces), hover or
  focus-within pauses the timer, fade 150ms disabled under `prefers-reduced-motion`. Must sit
  above an open `<dialog>`: a modal dialog's top layer covers the page, so the host must be
  rendered inside the open dialog as well, or the toast rendered via the same top layer
  (`popover` attribute with `showPopover()` is the simplest; check support in Playwright's
  Chromium/WebKit/Firefox and fall back to in-dialog rendering if not available). Test it with
  the poster dialog open.
- `ShareScreening`: `LinkIcon` (size it 18px), no `copied` state, calls `showToast("Screening
  link copied")`; on clipboard failure keep the `CopyFallback` and call `showToast("Copy the
  screening link from the selected field.")`. Remove its `sr-only` status span and timers.
- Film Share in `expanded-row.tsx`: `showToast("Film link copied")`; remove `announceShare`,
  `shareMessage`, the `.share-status` div and its `min-height` CSS.
- Delete `share-icon.tsx` when unused (How to use imports it today).

### Programme controls

- New `src/components/choice-picker.tsx`: `<ChoicePicker label value onOpenChange>` renders a
  `button[aria-haspopup="dialog"][aria-expanded]` styled like the dialog picker summary (small
  uppercase label over a 16px value, caret, 48px, panel fill, 2px radius) and, when open, a
  popover panel positioned under the field (`position: absolute`, full field width, min 320px
  where the row allows, `z-index` above the rows). Close on Escape, on outside pointerdown, on
  choosing; focus goes into the panel on open and back to the button on close. The panel is
  **not** a `<details>` and does not push the list down. In the phone sheet check it is not
  clipped by the dialog's scroll container; if it is, open the same panel content in a `Dialog`
  sheet below 30rem instead.
- Cinema panel: Find field (`type="search"`, shown when > 8 cinemas), then a radio-style list
  (`role="listbox"`/`option` or real radios): "All cinemas · total", then cinemas grouped by
  borough as `FilterPicker` groups venues, each with its count; zero-count options dimmed and
  disabled. Arrow keys move, Enter/Space choose.
- Date panel: shortcut chips Today / Tomorrow / This weekend (only those with screenings in
  this programme), month header with previous/next, Mon–Sun grid; each day shows its number and
  its count; days without screenings dimmed and disabled; the chosen day ringed. One choice.
  Reuse `DateCalendar`'s grid and keyboard logic via a `single` mode if that is cleaner than a
  second grid; either way the CSS is shared, not copied.
- Field values: "All dates" / "Sat 10 Oct"; "All cinemas" / the cinema name (ellipsis).
- Reset: same 48px height; muted until a choice is active, then full ink with a hairline.
- Count line `.programme-count`: `1–12 of 1,802 screenings` left, `Page 1 of 151` right (hide
  the page when there is one), 15px muted, tabular, `padding: 10px 0 4px`. Keep the `role=
  "status"` and the focus target used by `turnPage`.
- Layout: `grid-template-columns: 1fr 1fr auto`, gap 8px; under 30rem the two fields stack
  with Reset spanning both rows at the right.

### How to use

The example rows must render with the same classes and the new shape. Replace `ShareIcon`
with `LinkIcon`, "Add to calendar" with the Calendar button markup.

## Tests

- `npm run build-data -- --fixture` before e2e. Run `npm run lint`, `npm run typecheck`,
  `npm test`, then the e2e specs touched (`npx playwright test tests/e2e/busy-programme.spec.ts
  tests/e2e/film-sharing.spec.ts tests/e2e/discovery.spec.ts tests/e2e/welcome.spec.ts
  tests/e2e/events-radar.spec.ts`), then the full suite once.
- New assertions: the share button has the link icon and no check after clicking; the toast
  appears with the exact text in the list view AND with the poster dialog open; the Date and
  Cinema pickers open a panel that does not change the list's `offsetTop`; choosing a cinema
  updates the count; Escape closes and returns focus; the row shape is identical (same
  `grid-template-areas`) in the list view and the poster dialog at 1280px.
- Layout tests compare within one run, never hard-coded pixels (CI runs Linux scrollbars).

## Docs and changelog

- `npm run changelog:new -- screenings-row-share-toast`: public, `improved`, title along the
  lines of "A steadier screenings list with a copy confirmation", body: the row is the same in
  every view, copying a link now shows a confirmation, and Date and Cinema open proper pickers.
- Update `docs/cinema-ux.md` / `docs/UX_REVIEW.md` wherever they describe the native selects
  or the share check.

## Delivery

- Branch `claude/screenings-list` in `~/.codex/worktrees/screenings-list/london-cine-info`.
- Commit with `git -c user.name="Diogo Diogo" -c user.email="44315677+thesquaredD@users.noreply.github.com"`.
- Open a **draft** PR against `main` with the personal token:
  `T=$(env -u GITHUB_TOKEN gh auth token --user thesquaredD)`; push with that token as a
  one-off credential helper and `GH_TOKEN=$T gh pr create --draft`. dio verifies visually
  before it leaves draft. Merge = deploy, so never merge.

## Acceptance criteria

1. At a 1280px window the screening row has the same grid areas and heights in the list view
   and in the poster dialog; no absolutely positioned share button remains.
2. Every share button shows the chain-link icon before and after a click; a toast with the
   exact wording appears at the bottom of the screen in both views and over the dialog.
3. Date and Cinema are 48px fields with 16px values; opening one shows a panel over the list
   (the first row's position does not change); choosing updates the count and the rows.
4. Rows with and without tags have the same height; Book buttons align down the page.
5. All e2e specs pass locally; lint, typecheck and unit tests pass; changelog fragment validates.
