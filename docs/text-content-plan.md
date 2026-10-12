# Plan: one reading system for every text surface

Written 12 October 2026 for the next agent. Base: `origin/main` at `579015a` (PR #37).
Design canvas and mockups: https://claude.ai/artifact/XrtzgxorfQirUYVFPTfTnk (eight artboards:
reading system, Privacy, Feedback A, Feedback B, Feedback phone sheet, What's new, About,
Notices). Open it beside this document; the measurements below are taken from it.

## Decision

dio's verdict after reviewing the live site and the canvas:

- Text content across the site feels "slapped in": no delimiters, no hierarchy, no thought
  about how a reader moves through it. The cause is that every surface sets its own type and
  spacing rules. Privacy runs 14px at 1.7 leading with no rules between eleven sections and a
  loose wrapping row of underlined jump links. The feedback dialog puts lede, labels, a
  `<details>`, a three-line legal paragraph and the Send button into one grid with the same gap.
  About buries its most useful facts (update time, counts) under four equal paragraphs. Sign-in
  has a three-sentence "list" with no list.
- The fix is **app wide**: a shared reading scale and a small set of prose blocks, then each
  text surface rebuilt on them. Not a page-by-page restyle.
- Feedback takes **direction A** (message first, topic chips, email behind "I'd like a reply",
  one-line "Sent with it", footer bar with small print beside Send). Direction B's rail is
  dropped; its four-step content is what the Privacy "Feedback you send" section now says.
- Copy is **restructured, not rewritten**. Where the mockups turn a paragraph into a list,
  definition list or table, every fact in the original paragraph must still appear. Legal
  meaning in Privacy must survive; see "Privacy" for the facts the tests pin.

## Scope

In scope, as five PRs in this order (each self-contained, each with its own changelog
fragment):

1. **Reading system** — `src/styles/prose.css`, the tokens, the blocks, applied to the
   existing pages without restructuring them yet. Removes the per-page scale rules.
2. **Privacy** — restructure `privacy.tsx` on the blocks: In-short card, sticky map, numbered
   sections, definition lists and tables, analytics control card.
3. **Feedback dialog** — direction A on desktop and the phone sheet.
4. **What's new and About** — dated margin column; facts first.
5. **Notices, empty states, sign-in list** — the shared notice block, the empty state that names
   its filters, the benefits list.

Out of scope (do not do these):

- Any change to the film table, expanded rows, filter bar, sheets or calendar pages. Only text
  surfaces: `/privacy`, `/about`, `/changelog`, `/account` sign-in view, `/settings` lede, the
  feedback dialog, and the notice/empty-state blocks wherever they already appear.
- New fonts. League Spartan and Clash Display stay. The canvas uses Google's League Spartan as
  a stand-in only.
- Rewording the privacy policy beyond what restructuring requires. `docs/privacy-policy.md`
  records the sources; if a sentence must change, update that doc too.
- Changing what the feedback form sends, the PostHog payload, or the categories.
- Light theme work. `picturehouse.css` is the only active theme; the last `:root` token block
  wins. Prose rules use tokens so a future theme inherits them, but nothing is tested in light.

## Where things are today

- `src/styles/base.css` holds the structural rules for every text surface, each with its own
  scale: `.about-page` (~634–646: 750px, 30/24 padding, `line-height: 1.7`, h2 24, h3 18 with
  28px top margin); `.pref-page`, `.pref-lede`, `.pref-section` (~647–760: 640px, 1.5 leading,
  brass 11px caps h3, 16px section padding, hairline above each section but the first);
  `.privacy-*` (~2517–2559: updated line, `scroll-margin-top`, the checkbox row, the wrapping
  `.privacy-contents` row, 17px phone override); `.empty-state`/`.catalogue-status` (~617–622:
  centred, 70px padding, muted); `.account-notice`/`.import-status` (~1579–1603: shade box, 3px
  left edge coloured by role); `.source-status` (~793–805); `.sheet-heading`/`.dialog-body`
  (~1421–1440, ~1510–1560, phone variant ~1660–1680: bottom sheet, 4px top radius).
- `src/styles/picturehouse.css` is the active theme. Tokens: the **last** `:root` block (~530–560:
  `--bg #171310`, `--panel #211b17`, `--shade #2c231d`, `--fg #faf7ef`, `--muted #c4b8a8`,
  `--line #514335`, `--link #fff`, `--accent #c94451`, `--active-bg #8b2434`, `--brass #c3a771`).
  Earlier `:root` blocks (5, 332, 338, 406, 472) are superseded iterations; do not edit them,
  and do not add a sixth. Typography lives at ~724–760 (League Spartan on body and controls,
  body 15px, controls 14px, Clash Display for the wordmark). Dialog chrome at ~655–680
  (borderless, `#090705b3` backdrop, `--shade` heading, brass focus ring).
- `src/styles/feedback.css` — entry links, `.feedback-form` grid (14px gap), `.feedback-muted`,
  `.feedback-context` dl (9em columns), `.feedback-problem` (left edge in `--link`),
  `.feedback-fallback`, `.feedback-actions`, `.feedback-primary`; phone rules at the bottom.
- `src/styles/changelog.css` — `.changelog-preview`, `.changelog-day > h3` (muted 14px date),
  `.changelog-type` (brass caps), `.changelog-entry h4` (20px), `.changelog-more`, `.changelog-status`.
- `src/components/privacy.tsx` — the whole policy as JSX: `article.about-page.privacy-page`,
  `p.privacy-updated`, `nav.privacy-contents` (eleven `#id` links), eleven `section[id]`
  with `tabIndex={-1}` and `aria-labelledby`, the analytics `label.privacy-choice` with its
  `role="status"` lines, `PageLink`s into `/account#profile`, `#emails`, `#delete`.
  `usePreferenceFocus()` focuses the h2 on arrival and `section:focus-visible` is styled.
- `src/components/feedback.tsx` — `FeedbackDialog`: `Dialog` wrapper, `form.feedback-form`,
  lede `<p>`, `select` labelled "What is it about? (optional)", `textarea` labelled "Your
  feedback" with `data-initial-focus`, email `input` (only when `channel === "ready"`),
  `details` "What's sent with it" with `dl.feedback-context` from `describeContext`, the
  PostHog paragraph with the `/privacy#feedback` link, `p.feedback-problem[role=alert]`, the
  `fallback` block (Email feedback / Copy feedback), `.feedback-actions` with the Send button,
  the "sent" view. States: `editing | sending | failed | sent`; channel: `ready |
analytics-off | unavailable`. `feedbackProblem()` in `src/shared/feedback.ts` validates;
  `FEEDBACK_CATEGORIES` = problem, listing, idea, praise.
- `src/components/dialog.tsx` — `Dialog`: `<dialog aria-label>`, `.sheet-heading` with h2 and
  × button, `.dialog-body`. Focus goes to `[data-initial-focus]`.
- `src/components/changelog-page.tsx` — `article.pref-page.changelog-page`, lede, preview
  note, groups by `changeDate` as `div.changelog-day > h3` then `section.pref-section.changelog-entry[id]`
  with `span.changelog-type`, `h4`, `p`, `.changelog-actions` (optional `PageLink` + "Feedback
  on this change" button). `PAGE_SIZE` 20, "Show older changes".
- `src/app.tsx` ~74–130 — `About`: `article.about-page`, h2, TMDB logo link, four paragraphs,
  `dl.source-status` (Last updated, Programme counts, Screening release, Ratings release), the
  OS/London Datastore line below.
- `src/components/account.tsx` — `AccountFeedback` (~27–75: `div.account-notice` with `p`,
  retry/dismiss buttons and a "Report this problem" `button.feedback-link`); `ImportStatus`
  (~76–140: `section.import-status.import-<state>`); the sign-in view's
  `PreferenceSection id="benefits" title="With an account"` with three bare `<p>` (~551–555);
  `PreferenceSection` helper at ~187.
- `src/components/film-table.tsx` ~339–350 and `src/components/events.tsx` ~86–97 — the
  `div.empty-state`: h2, one `p`, "Clear filters" button, "Missing something? Tell us"
  `button.feedback-link`. `clearFilters(state.path)` from `src/lib/filters.ts`.
  `docs/UX_REVIEW.md` ("Empty results") says the table already suppresses a duplicate message;
  keep that.
- `src/components/sidebar.tsx` ~156–172 — the footer text links (Feedback, What's new, About &
  sources, Privacy). Unchanged by this plan except that `.feedback-entry` keeps working.
- Tests that pin these surfaces: `tests/e2e/privacy.spec.ts` (article named "Privacy", eleven
  `#id` sections, the "Privacy policy sections" navigation, "15 minutes", "90 days", "up to one
  hour", ICO link, `username`/`email preferences` links, checkbox "Allow site analytics in this
  browser", the three `role=status` strings); `tests/e2e/feedback.spec.ts` (dialog "Share
  feedback", textbox "Your feedback" focused on open, combobox "What is it about" value
  `listing`, text "What's sent with it", `.feedback-context` rows "Page/", "Film", "Results
  shown", "Change", "Error", link "Email feedback", status "isn't available here");
  `tests/e2e/changelog.spec.ts` (article "What's new", `heading level 3` day list, `#change-N`
  focus, `.changelog-entry` count 20 then 21, "Open Account →" link, "Show older changes",
  alert "could not be loaded"); `tests/analytics/events.spec.ts` ~273–300 (checkbox on
  `/privacy#analytics`); `tests/auth/account-page.spec.ts` (alerts and statuses inside
  sections); `tests/e2e/catalogue-polish.spec.ts` ("official TMDB attribution loads locally in
  About": the `img` named "The Movie Database (TMDB)" visible and loaded, and the article
  containing the "not endorsed or certified by TMDB" sentence); `events-radar.spec.ts` ("Clear
  filters").
- Docs that describe these surfaces: `docs/privacy-policy.md` (sources, operator),
  `docs/feedback.md` (form behaviour, what is sent, analytics-off rule), `docs/changelog.md`.

## PR 1: the reading system

New file `src/styles/prose.css`, imported in `src/main.tsx` after `base.css` and before
`picturehouse.css` so the theme can still override fonts. Everything is tokens from the active
theme; no new hex.

Tokens, declared on `:root` in `prose.css` so pages share one scale:

| Token             | Value                                        | Use                                       |
| ----------------- | -------------------------------------------- | ----------------------------------------- |
| `--prose-measure` | `62ch`                                       | max-width of any `p`, `li`, `dd`          |
| `--prose-body`    | `15px / 1.55`                                | body copy (phone: `16px / 1.5`)           |
| `--prose-small`   | `14px`                                       | caveats, small print, status; `--muted`   |
| `--prose-lede`    | `17px / 1.5`                                 | the one-sentence lede; `--fg`, not muted  |
| `--prose-h1`      | `30px / 1.15`, weight 500                    | page title, one per page                  |
| `--prose-h2`      | `20px / 1.3`, weight 500                     | section heading                           |
| `--prose-eyebrow` | `11px`, weight 500, `.12em`, caps, `--brass` | group label inside a section              |
| `--prose-gap`     | `12px`                                       | between paragraphs and list items' groups |
| `--prose-section` | `40px`                                       | between sections                          |

Blocks, as classes on an `article.prose` (keep the existing `about-page`/`pref-page` class
names on the elements for one PR so tests and other CSS keep matching, then remove in PR 2–4):

- `.prose` — measure, body size, `overflow-wrap: anywhere`, `padding: 40px 32px 64px`
  (phone `24px 16px 48px`), `max-width: 960px; margin: 0 auto`.
- `.prose-head` — flex, baseline, wraps: h1 then a `.prose-meta` line (`--prose-small`,
  muted, `·`-separated) for "Last updated", operator, contact.
- `.prose-lede`.
- `.prose-section` — `border-top: 1px solid var(--line); padding-top: 16px; scroll-margin-top:
16px`; consecutive sections separated by `--prose-section`. Heading `h2.prose-h2` with an
  optional `span.prose-num` (brass, 13px, 10px right margin). Sections keep `tabIndex={-1}` and
  `aria-labelledby`; the focus ring rule in `base.css` line ~67 gains `.prose-section`.
- `.prose-summary` — the In-short card: `background: var(--panel); border-top: 2px solid
var(--brass); padding: 18px 22px; max-width: 720px`; eyebrow then a `ul`.
- `.prose ul` — `padding-left: 20px`, items 6px apart, `::marker { color: var(--brass) }`.
  Two levels maximum.
- `.prose dl` — grid `11em minmax(0,1fr)`, gap `8px 20px`, `dt` muted, `dd` margin 0. Phone:
  one column, `dt` above `dd` with 2px gap, 10px between pairs.
- `.prose table` — collapse, `th` muted weight 500 with `--line` rule below, `td` 8px vertical
  padding with `--shade` rule, first column `11em`. Phone: wrap in `div.prose-scroll`
  (`overflow-x: auto`) only when three or more columns; two-column tables stack like the dl.
- `.prose-cols` — `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; max-width: 640px`
  for paired lists ("measured / never sent", "do it yourself / ask us"). Phone: one column.
- `.prose-control` — a setting inside prose: flex row, `background: var(--panel); border: 1px
solid var(--line); padding: 14px 18px`, label weight 500 with an 18px `accent-color:
var(--brass)` checkbox, a `role=status` span on the right in `--prose-small`. Min height 44px.
- `.prose-footer` — flex row, `border-top: 1px solid var(--line); padding: 16px 20px`, small
  print left (max 40ch), primary action right. Used by the dialog in PR 3.
- `.prose-map` — the sticky "On this page" list: eyebrow, then links as block, 5px vertical
  padding, muted, no underline, `box-shadow: inset 2px 0 var(--brass)` plus 10px left padding on
  the current one. `position: sticky; top: 24px`. Below 900px it goes static above the
  content; below 700px it becomes a `<details>` whose summary is "On this page" (44px tall).
- `.prose-two` — `grid-template-columns: 200px minmax(0, 1fr); gap: 40px; align-items: start`
  wrapping the map and the sections. Collapses to one column below 900px.

Apply in this PR, without restructuring markup:

- `privacy.tsx`: add `prose` to the article; the h2 becomes `h1.prose-h1`-styled (keep the
  element an `h2` if changing it breaks `getByRole("heading", { name: "Privacy" })`: it does
  not, the role query ignores level, but `aria-labelledby` must still resolve). Sections get
  `prose-section`. Delete the `.about-page` scale rules it relied on (`line-height: 1.7`, h3
  18/28) once nothing else uses them; `About` moves to `.prose` in the same PR.
- `changelog-page.tsx`, `settings-page.tsx`, the account page: add `prose` beside `pref-page`;
  `.pref-lede` adopts `--prose-lede`; `.pref-section h3` stays the brass eyebrow because those
  pages are forms, not reading pages. The only visible change on Settings and Account is the
  lede size and page padding.
- `About` in `app.tsx`: add `prose`; no restructuring yet.
- The dialog: `.dialog-body p` adopts `--prose-body`; nothing else yet.

Delete from `base.css` once replaced: `.about-page` (634–646), the 984 phone override, the
`.privacy-page` 17px phone rule (2555–2558). Keep `.pref-*` rules; PR 4 and 5 shrink them.

Acceptance for PR 1: every text page renders with the same body size, leading and paragraph
gap at 1280px and 390px; no page is narrower than before; all existing e2e specs pass
unchanged.

## PR 2: Privacy

Rebuild `privacy.tsx` on the blocks, following the "Privacy · structured policy" artboard.
Section ids, order and `aria-labelledby` wiring stay exactly as they are (the spec checks all
eleven ids and the navigation named "Privacy policy sections"); the nav moves into
`.prose-map` and keeps its `aria-label`.

Structure:

1. `.prose-head`: "Privacy" plus meta "Last updated 12 October 2026 · Operator Diogo Diogo ·
   Contact" (Contact is the `mailto:`).
2. `.prose-lede`: the current first paragraph, unchanged.
3. `.prose-summary` "In short", four bullets as on the artboard. The analytics bullet links to
   `#analytics`; the delete bullet links to `/account#delete` via `PageLink`. This is new copy:
   keep it to statements already made further down the page.
4. `.prose-two`: the map (numbered 1–11, same labels as today's `privacy-contents`) and the
   sections.

Per section, the shape to use (content is today's paragraphs, re-cut):

| #   | id            | Shape                                                                                                                                                                                                                                                                                   |
| --- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `operator`    | Two short `p`. Keep "Diogo Diogo" and the mailto in `#operator a`.                                                                                                                                                                                                                      |
| 2   | `information` | `dl`: When you sign in / If you use the features / Watchlist imports / What friends see / Automatically / Near me.                                                                                                                                                                      |
| 3   | `purposes`    | `dl`: To do what you ask / To keep the site working / Weekly screening emails (keeps the `/account#emails` link).                                                                                                                                                                       |
| 4   | `storage`     | 3-column table Where / What it holds / How long (session cookie, local storage, session storage, page URL) + one small-print `p`.                                                                                                                                                       |
| 5   | `analytics`   | `.prose-control` with the checkbox, `disabled` under Do Not Track, and the three `role=status` strings exactly as today (the spec and analytics spec match on them); then `.prose-cols` "PostHog EU measures" / "Never sent"; then two `p`. The storage-error `role=status` line stays. |
| 6   | `feedback`    | One `p`, then `dl`: Sent with it / Stored under / Who reads it / When it does not work.                                                                                                                                                                                                 |
| 7   | `sharing`     | `dl` with the four provider links as `dt` (Cloudflare, Resend, GitHub, PostHog) plus Letterboxd; two `p`.                                                                                                                                                                               |
| 8   | `retention`   | 2-column table Record / Kept until, then the deletion `p`. Must still contain "15 minutes", "90 days", "up to one hour".                                                                                                                                                                |
| 9   | `security`    | One `p` plus a small-print `p`.                                                                                                                                                                                                                                                         |
| 10  | `rights`      | `.prose-cols` "Do it yourself" (the three `PageLink`s named `username`, `email preferences`, `delete your account`, exact names) / "Ask us by email"; small-print `p` with the ICO link, exact name "Information Commissioner's Office".                                                |
| 11  | `changes`     | One `p`.                                                                                                                                                                                                                                                                                |

Rules:

- Every fact in today's paragraph appears in the new shape. Do a sentence-by-sentence diff
  against `origin/main:src/components/privacy.tsx` before opening the PR and list any sentence
  dropped in the PR description. None should be.
- The map's current item: observe sections with `IntersectionObserver` and set the class on
  the nearest heading above the viewport top; fall back to the hash. No scroll listener.
  Clicking a map link keeps today's behaviour: hash navigation, the section receives focus
  (`#rights` focused is asserted).
- Phone: map as `<details>`; tables as described in PR 1; `.prose-cols` single column.
- Delete `.privacy-contents`, `.privacy-updated`, `.privacy-choice` rules from `base.css`.
- `docs/privacy-policy.md`: add a line that the structure changed on this date and copy was
  re-cut, not rewritten.

## PR 3: Feedback dialog, direction A

Rebuild the editing view of `FeedbackDialog` to the "Feedback A" and "Feedback · phone sheet"
artboards. The sent view, failed/fallback view and analytics-off view keep their content; they
sit in the same frame.

Order inside the form:

1. **Message first.** `label` "What happened, or what would make this better?" over the
   textarea; placeholder "A problem, a wrong listing, an idea, or something you liked. No
   account needed." The lede paragraph is deleted (its content is now the placeholder). The
   textarea keeps `data-initial-focus`, `required`, `maxLength`, 5 rows, `font-size: 16px` on
   phone. Keep the accessible name **"Your feedback"** via `aria-label` on the textarea so
   `getByRole("textbox", { name: "Your feedback" })` still matches, while the visible label asks
   the question.
2. **Topic as chips.** `fieldset` with `legend` "Topic (optional)" and four
   `button[type=button][aria-pressed]` chips for `FEEDBACK_CATEGORIES`; pressing the active one
   clears the category. Chips: 36px tall (44 on phone), pill radius, `--panel` background,
   `--line` border; pressed = `--fg` background with `--bg` text (the inverted style the theme
   already uses for `dialog button[aria-pressed=true]`, picturehouse ~823). `feedback.spec.ts`
   line 67 asserts a combobox with value `listing`: change it to
   `getByRole("button", { name: "Listing correction", pressed: true })`.
3. **Reply box.** A bordered `.prose-control`-style group: checkbox "I'd like a reply"; when
   checked, the email `input` appears below with label "Email, used only to answer this"
   (`type=email`, `autocomplete=email`). Unchecking clears `draft.email`. Rendered only when
   `channel === "ready"`, as the email field is today. The draft state does not change shape;
   the checkbox is derived: checked when `draft.email !== ""` or a local `wantReply` flag is
   set.
4. **Sent with it.** One `p.feedback-context-line` in `--prose-small`: eyebrow "Sent with it",
   then `describeContext(context)` rendered as `Label value` pairs separated by `·`, then the
   sentence "Nothing else: not your watchlist, friends, searches or account email." Keep a
   `dl.feedback-context` for assistive tech? No: render the pairs as `<span>` with the label in
   muted and the value in `--fg`, inside an element with class `feedback-context` so the
   existing `.feedback-context` assertions (`toContainText(/Film\s*classic-a/)` etc.) still
   pass. The `<details>` and its summary "What's sent with it" go on desktop; on the phone
   sheet the same line sits inside a `<details>` because the sheet is short. Update the spec
   helper that clicks "What's sent with it" to click only when the summary is visible.
5. **Problem line** (`role=alert`), the fallback block on failure, unchanged.
6. **Footer bar** (`.prose-footer` inside the dialog, below the form grid): left, "Stored
   privately in PostHog under this browser's analytics ID." plus the `PageLink` "How feedback is
   handled" to `/privacy#feedback`; right, the Send / Sending… / Try again button, 44px tall,
   `--active-bg` background. The three-line PostHog paragraph is deleted; its remaining
   sentences now live in Privacy §6.

Analytics-off and unavailable: same frame, the message and chips still render (the draft is
reusable for email), the reply box is hidden, the footer bar's left side carries the existing
status sentence and the right side holds the `fallback` actions (Email feedback, Copy
feedback). The `role=status` text "isn't available here" / "uses analytics, which is off" is
unchanged.

Sent view: heading "Thank you", `role=status` "Received. Thank you for taking the time.", the
reply note, and "Back to browsing" in the footer bar position.

Phone (below 800px): the dialog is already a bottom sheet. Give it `border-radius: 12px 12px 0
0`, the × at 44px, the footer bar stacked (Send full width, then the small print centred), and
`padding-bottom: calc(16px + env(safe-area-inset-bottom))` as today.

CSS: rewrite `feedback.css` form section; keep the entry-link section. Delete
`.feedback-actions`, `.dialog-body .feedback-form p.feedback-muted`, `.feedback-form details`,
`.feedback-context div` grid rules.

`docs/feedback.md`: update the form description (order of fields, chips, reply checkbox).

## PR 4: What's new and About

What's new (`changelog-page.tsx`, `changelog.css`), per the "What's new · dated margin"
artboard:

- Article becomes `prose`; drop `pref-page` from it and the `pref-section` class from entries
  (keep `changelog-entry` and the `id`, `tabIndex`, `aria-labelledby`).
- Head: "What's new" plus a right-aligned link "Something missing? Tell us" that opens feedback
  with no context. Lede unchanged. Preview note unchanged (the spec asserts its text).
- Each day: `section.changelog-day` as a grid `150px minmax(0,1fr)` with the date as `h3`
  (the spec asserts `heading level 3` texts, so it stays an h3, styled muted 14px, no
  margin) in the left column and the entries in the right; `border-top: 1px solid var(--line)`,
  `padding: 20px 0 8px`. Phone: one column, date above.
- Entry: `span.changelog-type` eyebrow (Fixed in muted rather than brass, so the three types
  read differently), `h4` 19px/500 with 4px above and 6px below, body `p` at the measure,
  `.changelog-actions` as a 14px row: the optional `PageLink` first (keeps "Open Account →"),
  then "Feedback on this change" in muted. Entries 28px apart; no hairline between entries.
- "Show older changes" sits under a hairline, 44px tall, `--shade` background.

About (`app.tsx` `About`), per the "About · facts first" artboard:

- Head: existing h2 and the first paragraph as lede.
- `.about-facts`: four tiles in a `repeat(4, minmax(0,1fr))` grid (2 columns on phone), each
  `--panel` with a brass top rule: Last updated (date, "London time"), Films (count, "in the
  programme"), Screenings (count, "at N venues"), Releases (screening release id over ratings
  release id, 15px). Built from `meta` exactly as `dl.source-status` is today. Nothing in
  `tests/` references `.source-status`, so delete it.
- Section "Where the data comes from": `dl` with Screenings and film metadata (Clusterflick
  link, the licence sentence), Ratings, Posters and imagery (TMDB sentence; the TMDB logo link
  moves into this `dd`, 16px tall, same `alt` "The Movie Database (TMDB)" and the same
  sentence, both asserted by `catalogue-polish.spec.ts`), Borough boundaries (the OS / London Datastore /
  OGL line that is currently under the article).
- Section "Before you rely on it": four bullets (release dates, ratings, confirm with the
  cinema, booking happens on the cinema's site).
- Section "What stays on your device": the storage paragraph, then a `Privacy policy · What's
new · Share feedback` link row.
- Closing small print: "A personal, non-commercial project by Diogo Diogo. A London take on
  paris-cine.info."
- Delete `.about-page h2/h3`, `.tmdb-attribution` (if its only use moves), `.source-status`
  rules; add `.about-facts` to `prose.css` as `.prose-facts` since Account could use it later.

## PR 5: notices, empty states, sign-in list

Per the "Notices, empty states, sign-in" artboard.

Notice block, shared by `AccountFeedback`, `ImportStatus`, the catalogue-status alert and the
changelog load failure. New component `src/components/notice.tsx`:
`<Notice kind="error" | "status" | "success" title=… actions={…}>children</Notice>` rendering
`div.notice.notice-<kind>` with `role` from kind (`alert` for error, `status` otherwise), a
`strong.notice-title`, the children as `p`s at the measure, and `div.notice-actions` (flex,
`gap: 8px 20px`): primary actions as 36px `--shade` buttons, "Report this problem" and
"Dismiss" as muted text buttons. Styling: `background: var(--panel); border-left: 3px solid`
brass for status, `--link` (salmon) for error, `--rating` for success; `padding: 14px 18px`.
Replaces `.account-notice` and `.import-status` rules in `base.css` (~1579–1603).

Titles are new copy, one line each, and must not duplicate the first sentence of the body.
Map today's messages: account load error → "Your account didn't load"; notice with `retryAt` →
"Try again after HH:MM"; import `queued` → "Import queued"; `importing` → "Importing your
watchlist"; `completed` → "Imported N films" (or the matches sentence); `failed` → "The import
failed"; `idle` → "Watchlist not imported yet". Tests in `tests/auth/account-page.spec.ts` and
`import-states.spec.ts` match on body text with `toContainText`; keep the body sentences as
they are and add the title above them. Check each `getByRole("alert")`/`("status")` still
resolves to one element per section.

Empty state (`film-table.tsx`, `events.tsx`): title names what is on, e.g. "Nothing on
Thursday at the Rio" when the active filters resolve to one day and one cinema, otherwise "No
films match these filters" (keep this string as the fallback; nothing asserts the heading
text, but the Events spec clicks "Clear filters" exactly). Body: "The filters you have on are
X, Y and Z. Loosen one to see more." built from the active-filter labels already rendered in
`.active-filters`. Actions: one button per removable filter group ("Any day", "Any cinema",
"Any genre"; cap at three, derived from the same list as the active-filter chips), then
"Clear filters" (exact name kept), then the muted "Missing something? Tell us" (exact name
kept; `feedback.spec.ts` clicks it). Container: `border: 1px solid var(--line); border-radius:
4px; padding: 36px 24px`, centred, title 20px/500. Events keep their own body sentence.

Sign-in benefits (`account.tsx` ~551–555): the three paragraphs become a `ul` of three items,
each `strong` lead-in then a muted 14px sentence: "See your watchlist on screen." / "Find
films in common." / "Get a weekly email." with the current sentences as the explanation.
Section title stays "With an account" (the `PreferenceSection` id `benefits` stays). Add the
line "A link in your email signs you in. No password, no account needed to browse." under the
list, and delete the duplicate lede above the email field if it says the same thing.

## Tests

- Keep every existing spec green by preserving the accessible names, ids and status strings
  listed under "Where things are today". Where a shape changes (combobox → pressed buttons,
  `details` optional on desktop), change the spec in the same PR and say so in the PR body.
- PR 1: a unit-free visual check only; run the full e2e suite.
- PR 2: extend `privacy.spec.ts`: the In-short card lists four items and its analytics link
  focuses `#analytics`; the map marks the section in view after scrolling to `#retention`; at
  390px the map is a `details` whose summary is "On this page" and the storage table is
  horizontally scrollable without widening the page (`document.documentElement.scrollWidth ===
innerWidth`).
- PR 3: extend `feedback.spec.ts`: on open the textbox "Your feedback" is focused and no
  combobox exists; pressing "Idea" then "Idea" again leaves no chip pressed; checking "I'd like
  a reply" reveals the email field, unchecking clears it; the context line contains every
  `describeContext` label present; at 390px the Send button is at least 44px tall and the sheet
  does not exceed `90dvh`.
- PR 4: `changelog.spec.ts` continues to assert the h3 day list and `#change-N` focus; add
  that the date column is to the left of the entry at 1280px (`boundingBox().x` smaller) and
  above it at 390px. About: assert four `.prose-facts` tiles and the TMDB `alt` still present.
- PR 5: `account-page.spec.ts` and `import-states.spec.ts` assert titles exist and roles
  resolve once per section; `feedback.spec.ts` line 26 keeps `.empty-state`; add an e2e that a
  day+cinema filter with no results shows the "Any day" and "Any cinema" buttons and that "Any
  day" leaves the cinema filter on.
- Phone-width pass on every PR at 390px: no horizontal page scroll, all targets ≥ 44px, no
  console errors. Record it the way `docs/filter-strip-plan.md` describes.

## Docs

- `docs/privacy-policy.md` (PR 2), `docs/feedback.md` (PR 3), `docs/changelog.md` only if the
  entry shape changes (PR 4; it does not, so probably nothing).
- `docs/reading-system.md` and the "Text surfaces" section of `AGENTS.md` already exist
  (written 12 October 2026 alongside this plan). PR 1 commits both, removes the "until it
  lands" sentence from the reading-system doc, and keeps its token and block tables in step
  with `prose.css` if anything changes during implementation.

## Delivery

- One branch per PR, from `origin/main`, in the order above; each later PR rebases on the
  previous once merged. Do not combine them: PR 1 is the only one that touches every page, and
  it must land alone so visual regressions are attributable.
- Each PR adds a public changelog fragment (`npm run changelog:new -- <id>`):
  `reading-system` (improved: "Text pages are easier to read"), `privacy-structure`
  (improved), `feedback-form-layout` (improved), `whats-new-about-layout` (improved),
  `notices-empty-states` (improved). Bodies describe what the reader sees, one or two
  sentences, no design vocabulary.
- `npm run typecheck && npm run lint && npm run test && npm run e2e` before each PR; the
  accounts suite (`npm run e2e:accounts`) for PR 5 and for PR 2's `PageLink` targets.
- Push with the `thesquaredD` token as recorded in the workflow memory; open the PR against
  `main`.

## Acceptance criteria

1. One scale: body size, leading, paragraph gap, section spacing and heading sizes are
   identical on `/privacy`, `/about`, `/changelog`, the Account sign-in view and the feedback
   dialog, at 1280px and 390px.
2. Privacy: In-short card, sticky map with a current marker, eleven numbered sections with a
   hairline, no paragraph longer than five sentences, every fact from the previous version
   present, all `privacy.spec.ts` and analytics assertions green.
3. Feedback: the textarea is the first control and is focused on open; topic is a chip row;
   email is hidden until "I'd like a reply"; the "Sent with it" line is one paragraph; the
   privacy small print is one line in a footer bar beside Send; the analytics-off and failed
   views fit the same frame; the phone sheet has 44px targets and a full-width Send.
4. What's new: dates in a left column at desktop, above entries on the phone; entries read as
   eyebrow, title, body, quiet actions; 20 then 21 entries as before.
5. About: four fact tiles first, then sources as a definition list, caveats as bullets, the
   storage paragraph, and the TMDB and Ordnance Survey credits still present with their links.
6. Notices have a title, a sentence and an actions row; the empty state names the active
   filters and offers to drop one; sign-in benefits are a three-item list.
7. No new hex values anywhere; every colour is a token from the last `:root` block in
   `picturehouse.css`.
8. `docs/reading-system.md` exists and `AGENTS.md` points to it.
