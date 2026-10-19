# Plan: one full-width row of film links under the poster (B2)

Written 19 October 2026 for the next agent. Base: branch `claude/film-links-tidy` at `ed8fe59`
(draft PR #59, on top of `origin/main` at `131ac83`, PR #57). Line numbers below refer to that
branch, not to `main`. Design review and mockups:
https://claude.ai/artifact/U7boKbXzWzm3ZiUGh9rArQ (variant **B2**).

## Decision

dio's verdict after the review page:

- The opened film's actions (trailer, Letterboxd, IMDb, share, report) were three different
  treatments stacked over five lines: tall boxed buttons, underlined links, a lone link. The
  draft on PR #59 made them one wrapping row of chips, but the chips take their natural
  widths, so the right edges of the two rows do not line up, and the row sits in the 192px text
  column beside the poster for no reason other than where the markup put it.
- **B2**: a two-column grid of equal-width chips that spans the whole info column _under_ the
  poster, so each chip gets 136px on desktop instead of 92px. Every chip carries a mark:
  the YouTube mark on Trailer (every trailer is a YouTube link, built from a stored video id),
  the Letterboxd and IMDb marks on their chips, and a link icon on Share. Report a listing
  problem stays a quiet muted text link beneath the row.
- Labels are the short ones: **Trailer**, **Letterboxd**, the IMDb wordmark alone (the mark
  is the name), **Share**. Accessible names stay the full ones: `Watch trailer`,
  `Open on Letterboxd` / `Find on Letterboxd`, `Open on IMDb` / `Find on IMDb`, `Share film`.
  Each visible label is contained in its accessible name, so voice control still works.
- Brand marks are reproduced unaltered in their own colours. They are never passed through
  the ivory CSS filter the welcome page uses for cinema logos, and never recoloured on hover.

## Scope

In scope:

- Move the actions out of the text block so they become direct children of `.film-info`
  and span both grid columns under the poster, on every breakpoint.
- Replace the wrapping flex row with a fixed two-column grid of equal chips.
- Three inline SVG marks (YouTube, Letterboxd, IMDb) and one link icon (Share) in a new
  component file. The external-link arrow stays on Book, Details and event links.
- Extend the non-affiliation sentence so it covers Letterboxd, IMDb and YouTube.
- Update the unit test for `filmProviderLinks`, the `ux-flows` e2e spec, and the changelog
  fragment already on the branch.

Out of scope (do not do these):

- Any change to the ratings line (`.rating-cards`), the More details block, or the
  screenings list.
- Changing the share behaviour or the reserved share-status line.
- Adding provider links for Metacritic or Rotten Tomatoes.
- A Share icon in the screening rows (they have their own icon Share, PR #46 era).

## Where things are today (branch `claude/film-links-tidy`)

- `src/components/expanded-row.tsx`
  - 176–297: `.film-info` → `figure.poster` (177) and `div.film-description` (192). Inside the
    description: title, facts, genres, `.rating-cards` (205–240), then the draft's
    `div.film-actions` (241–284: trailer link 242–251, provider links 253–263, share button
    264–283), `div.film-links` with the report button (285–294), and the `role="status"`
    `.share-status` (295–297). All three must move out of `.film-description`.
  - 1–2: imports `ExternalLinkIcon` and `filmProviderLinks`.
  - 453: the screening row's Book/Details link also uses `ExternalLinkIcon`; leave it.
- `src/lib/film-links.ts` — `filmProviderLinks(film)` returns `{ name, href, label }` for
  Letterboxd and IMDb (`label` is `Open on …` or `Find on …`). `src/lib/film-links.test.ts`
  asserts the exact objects with `toEqual`, so adding a field means updating four
  expectations.
- `src/components/external-link-icon.tsx` — 16px, 1.5px stroke, `aria-hidden`. Keep as is.
- `src/styles/discovery.css`
  - 46–51 `:root .film-info { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 16px }`.
    At 800–1099px the poster column is 70px (390–397). On the phone (≤799px, 235–239) it is
    64px with an 8px gap.
  - 263: inside the ≤799px block,
    `:is(.film-synopsis, .synopsis-toggle, .film-cast, .rating-cards, .film-actions, .film-links) { grid-column: 1 / -1 }`.
    This only applies to direct grid children, which the actions are not yet; once moved it
    does the phone layout for free. Mirror it for desktop (see spec).
  - 366–385: ≥800px, `.film-expanded` is a grid `minmax(280px, 30%) minmax(0, 1fr)` with
    `.film-info` in the `info` area. That 280px is the width the new row spans.
  - 570–622: the draft's `.film-actions` rules (flex-wrap, chip anatomy, hover, 14px icon,
    phone 44px block at 604–609), `.film-info .film-links` (611–614), `.film-links :is(button, a)`
    (615–619), `.share-status { min-height: 24px }` (620–622).
  - 349–354: `.film-info .rating-cards { margin: 6px 0 0 }` and `.film-info .film-links { gap: 12px }`.
- `src/styles/feedback.css` 3–12 (`.feedback-link`: underlined, transparent, 14px) and 32–34
  (`.film-links .feedback-link { min-height: 32px }`); 124–128 give it 44px on the phone.
- `src/app.tsx` 239 and `src/components/cinema-landing.tsx` 175: "London Ciné Info is
  independent and not affiliated with any cinema. Names and logos belong …". `src/app.tsx`
  159–167 is the TMDB attribution; leave it.
- `tests/e2e/ux-flows.spec.ts` 12–41: opens Fixture Classic A, expects the group
  "Film links" with links "Open on Letterboxd" and "Open on IMDb", clicks "Share film"
  (exact) twice and asserts `.share-status` text and that `.showtimes` does not move.
  43–60 shares again with a real clipboard. `tests/e2e/feedback.spec.ts` 61 clicks the
  button "Report a listing problem".
- `changelog/entries/film-links-row.json` — public, `improved`, written for the draft.

## Markup

In `expanded-row.tsx`, `.film-info` becomes:

```
div.film-info
  figure.poster
  div.film-description      (title, facts, genres, rating-cards — unchanged)
  div.film-actions          role="group" aria-label="Film links"
    a.trailer-link          aria-label="Watch trailer"        → <YouTubeMark/> Trailer
    a                       aria-label={provider.label}       → <LetterboxdMark/> Letterboxd
    a                       aria-label={provider.label}       → <ImdbMark/>   (no text)
    button.share-film       aria-label="Share film"           → <LinkIcon/> Share
  div.film-links
    button.feedback-link    Report a listing problem
  div.share-status          role="status"
```

- The trailer chip renders only when `film.tr` is set, as today. With three chips the grid
  leaves one cell empty on the second row; that is acceptable and matches the mock. Do not
  stretch the last chip across both columns.
- `filmProviderLinks` gains `key: "letterboxd" | "imdb"` so the component can pick the mark
  without matching on `name`. The IMDb chip's only content is the mark, so its accessible
  name comes entirely from `aria-label`.
- Every mark SVG is `aria-hidden="true" focusable="false"`.

New file `src/components/platform-marks.tsx` exporting `YouTubeMark`, `LetterboxdMark`,
`ImdbMark`, `LinkIcon`:

- `YouTubeMark`: `viewBox="0 0 24 17"`, a `rx=4` rounded rectangle filled `#ff0000` with a
  white play triangle (`M9.5 4.5v8l7-4z`). Rendered 14px tall.
- `LetterboxdMark`: `viewBox="0 0 26 14"`, three circles r=6.5 at x=7, 19, 13 (draw orange
  `#ff8000`, then blue `#40bcf4`, then green `#00e054` on top, so the overlaps read like the
  official mark). Rendered 14px tall.
- `ImdbMark`: `viewBox="0 0 40 18"`, a `rx=3` rectangle filled `#f5c518` with the text
  `IMDb` in black, Arial 700, 11.5px, centred. Rendered 16px tall. This is the wordmark, so a
  weight of 700 inside the SVG is the brand's, not ours.
- `LinkIcon`: `viewBox="0 0 24 24"`, 2px stroke `currentColor`, round caps, the two-arc
  chain-link path (`M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7` and
  `M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7`). Rendered 14px.

Brand colours are the only hex values allowed in that file; they must not be theme tokens
and must not change with the theme.

## Styles (`discovery.css`)

Replace the draft's `.film-actions` block (570–609) with:

- `:root .film-info > :is(.film-actions, .film-links, .share-status) { grid-column: 1 / -1 }`
  at every width. On the phone the existing line 263 already covers `.film-actions` and
  `.film-links`; add `.share-status` there too or rely on the new rule (the new rule is
  simpler; drop the duplicates from 263 once it exists).
- `:root .film-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px }`.
  The ratings already carry `margin: 6px 0 0`; the row's own top margin is small because the
  poster/description row above it ends with the ratings line.
- Chip anatomy, one rule for `:root .film-actions :is(a, button)`: `display: inline-flex;
align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 32px;
padding: 5px 8px; font-size: 14px; font-weight: 400; line-height: 1.25; color: var(--fg);
background: var(--panel); border: 1px solid var(--line); border-radius: 2px;
text-decoration: none; white-space: nowrap; cursor: pointer`. Hover: `border-color: var(--fg)`.
  Focus: the global `:focus-visible` outline in `base.css` 61–70, nothing extra.
- Marks: `:root .film-actions svg { flex: none; height: 14px; width: auto }` and
  `:root .film-actions .imdb-mark { height: 16px }`. The link icon takes `color: var(--muted)`.
- Phone (≤799px): `min-height: 44px; padding: 8px 10px; font-size: 15px` on the chips. Keep
  this block _after_ the desktop rules in the file, or it loses on equal specificity (the
  draft had this bug and shipped 32px chips on the phone until it was moved).
- `.film-links` (report): keep `gap: 4px 16px; margin-top: 4px` and the muted colour on the
  button; the 24px `.share-status` reservation stays.
- Delete the draft's `.external-link-icon` sizing inside `.film-actions` (598–603), since no
  chip uses the arrow any more. The generic `:root .external-link-icon` rule (565–568) stays
  for Book, Details and events.

Expected geometry, to be asserted rather than assumed:

| Viewport | Info column | Chip width | Chip height |
| -------- | ----------- | ---------- | ----------- |
| 1200px   | 280px       | 136px      | 32px        |
| 900px    | 280px       | 136px      | 32px        |
| 390px    | 366px       | 179px      | 44px        |

## Copy

- Non-affiliation sentence in `src/app.tsx` 239 and `cinema-landing.tsx` 175: extend to
  "not affiliated with any cinema, Letterboxd, IMDb or YouTube. Names and logos belong to
  their owners." Keep the two copies identical; `grep` for the sentence in tests before
  changing it (`text-content-plan.md` mentions a spec that matches the TMDB sentence, not
  this one).
- Changelog fragment `film-links-row.json`, body: "Trailer, Letterboxd, IMDb and Share now
  sit together in one row of equal buttons under the poster, each with its own mark, so an
  opened film is shorter and easier to scan. Report a listing problem stays as a plain link
  beneath them." Keep `visibility: public`, `type: improved`.

## Tests

- `src/lib/film-links.test.ts`: add `key` to the four expected objects.
- `tests/e2e/ux-flows.spec.ts`, first test: keep the group name "Film links" and the
  Letterboxd / IMDb link names; add `getByRole("link", { name: "Watch trailer" })` (Fixture
  Classic A has a trailer: check the fixture, and if it does not, add `tr` to it in
  `scripts/build-data.ts --fixture` data). Then assert geometry via `boundingBox()`:
  - all chips in `.film-actions` share one width (±1px) and one height;
  - the row's left edge equals `.poster`'s left edge, and its right edge equals
    `.film-info`'s right edge (it spans the column);
  - `document.documentElement.scrollWidth === clientWidth` (no horizontal overflow).
    The spec runs in both Playwright projects (1200 and 390), so this covers desktop and phone.
- The share assertions (status text, `.showtimes` not moving) stay as they are.
- `tests/e2e/feedback.spec.ts` 61 is unchanged; the report button keeps its text.
- Run `npm run typecheck`, `npm run lint`, `npx prettier --check .`, `npm test`,
  `npm run changelog:validate`, then `npx playwright test tests/e2e/ux-flows.spec.ts
tests/e2e/feedback.spec.ts tests/e2e/discovery.spec.ts tests/e2e/events-radar.spec.ts`.

## Docs

- No reader-facing text page changes, so `docs/reading-system.md`'s checklist does not
  apply. No existing doc describes the film panel's links (checked with grep), so there is
  nothing to update beyond the changelog fragment.

## Delivery

- Work on the existing branch `claude/film-links-tidy` in
  `~/.codex/worktrees/film-links-tidy/london-cine-info` (deps installed, fixture data built).
  Commit with `git -c user.name="Diogo Diogo" -c user.email="44315677+thesquaredD@users.noreply.github.com"`
  and the Co-Authored-By trailer; push with the `thesquaredD` token
  (`T=$(env -u GITHUB_TOKEN gh auth token --user thesquaredD)`).
- Update PR #59's title to "Show the film links as one row of equal chips under the poster"
  and rewrite its body for B2 (what changed, how it was checked, the two checkboxes). Mark it
  ready for review with `GH_TOKEN=$T gh pr ready 59`; do not merge. Merging deploys.
- End with a verification handoff: screenshots of the opened film at 1200 and 390px from
  the built app (`vite preview`, welcome page dismissed via the
  `london-cine.welcome-dismissed.v1` localStorage flag), plus the replay command, and an
  explicit "Please verify ✅/❌".

## Acceptance criteria

1. On an opened film at 1200px the four chips form a 2×2 grid whose left edge is the
   poster's left edge and whose right edge is the info column's right edge; all four are the
   same width and height.
2. At 390px the same 2×2 grid spans the panel width with 44px chips; no horizontal scroll.
3. Trailer shows the YouTube mark, Letterboxd its three circles, IMDb its yellow wordmark,
   Share a link icon; the marks keep their brand colours in the walnut theme and on hover.
4. Accessible names: Watch trailer, Open on Letterboxd / Find on Letterboxd, Open on IMDb /
   Find on IMDb, Share film. Existing tests that use those names pass unchanged.
5. Report a listing problem is a muted underlined text link under the row; copying a link
   does not move the screenings.
6. The non-affiliation sentence names Letterboxd, IMDb and YouTube in both places.
7. The changelog fragment describes B2 and `npm run changelog:validate` passes.
