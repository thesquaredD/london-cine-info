# Plan: rename to Readograph, larger type, capitals on filters, a better Filters sheet

Written 10 November 2026 for the next agent. Base: `origin/main` at `f067dcc` (PR #62).
Design discussion and mock-ups: https://claude.ai/artifact/F8UGmsmCAiQTRovsEQYUWi (private,
dio's account). Use the boards from "Masthead" downwards. The top row of boards (Today, A, B,
C) was drawn from the stylesheet instead of the running app and its baseline is wrong; see
"Not decided" below. No code was changed while writing this plan.

## Decision

dio named three problems: the letters are too small, there is no app, and "London Ciné Info"
is too long. The answers, from the interview and the mock-ups:

- **Name.** The product becomes **Readograph**, after the letter board on a cinema canopy.
  It is always shown with a descriptor because most readers will not know the word:
  "Readograph" in the logo, "London cinema listings" in page titles, link previews and, later,
  the store listing.
- **Rename depth.** Display name **and** domain. The old domain answers with permanent
  redirects, and email is sent from the new domain. The repository, the npm package name, the
  Cloudflare project, the D1 databases and the `london-cine.*` browser storage keys keep
  their names.
- **Logo.** The masthead letter board stays exactly as it is: same board, same grooves, same
  Clash Display face. Only the words change. "LONDON CINÉ" becomes "READOGRAPH" and "INFO"
  becomes "LONDON". New logo concepts (letter tiles, a full-width canopy) were rejected.
- **Type.** One shared scale in `rem`, 16px body and nothing under 13px, replacing hardcoded
  pixel sizes. Not a per-page bump and not a reader setting.
- **Redesign depth.** A rebrand on the same layout. Pages keep their structure.
- **Quick filters.** Set in capitals. On the phone they sit on two centred rows by meaning:
  the dates on top, the reader's own shortcuts below, with no rule between the rows. To fit,
  "This weekend" becomes "Weekend" and "This week" becomes "Week".
- **Bar controls.** The bar keeps one Filters button; the nine filter titles are not put in
  the bar. On the phone the Filters button is an icon with its fill kept, plus a count badge
  when filters are active. The sort control loses the word "Sort:" and its fill: an up-down
  arrows icon and the current value. It and the film count beside it are in the muted colour.
- **Filters sheet.** Same filters, better inside: a real search field, rows grouped under
  When, Where and What, a line icon and a title in capitals on each row, the tick boxes
  together, a footer bar, and two columns on desktop.
- **Order.** Rename and redesign first. The mobile app (`docs/mobile-app-plan.md`) starts
  only after the redesign, so its identifiers are final.

Two details were proposed by the agent and not objected to, rather than chosen outright. Treat
them as the default and confirm at the preview: "LONDON" in the masthead at 13px (today
"INFO" is 10px on desktop and 8px on the phone), and the Filters icon keeping its fill with a
badge.

## Not decided

Do not build these until dio answers. Each has a default so the rest is not blocked.

1. **Which domain.** dio said a domain is already owned but did not say which. The agent
   recommended `readograph.com` as the main address with any other ending redirecting to it.
   This plan writes `readograph.com`; replace it everywhere if dio names another.
2. **Listings rows.** dio picked "C, two-line rows" from boards whose baseline was wrong.
   The live desktop row is already 56px with the original title on a second line, and the
   live phone row is already 96px with a 20px title. Rows are **out of scope** here. An
   accurate desktop mock-up at the new scale (sidebar, bar, rows, expanded film) is owed
   first, and PR 3 is gated on it.
3. **Sheet wording.** The mock-ups move the Watchlists control into the What group and
   reword the tick boxes ("Hide sold-out screenings" became "Screenings that are not sold
   out"). dio was told and did not answer. Default: move Watchlists, **keep today's tick box
   wording**, since the reworded one inverts a label readers already know.
4. **Badge style.** If the corner badge looks fussy on a phone, the fallback is a brass
   underline on the icon, the same mark an active quick filter uses, with no number.

## Scope

In scope, as five pull requests in this order:

1. Display name (PR 1).
2. Domain and sender (PR 2).
3. Type scale (PR 3, gated on a design review).
4. Quick filters, Filters button and sort control (PR 4).
5. Filters sheet (PR 5).

Out of scope (do not do these):

- Listings row layout, column changes, or a desktop sort menu. See "Not decided" 2.
- Any change to the sidebar structure, the film page, the expanded row or the poster grid
  beyond what the type scale touches.
- Renaming the repository, `package.json` `name`, the Cloudflare Pages project, D1 database
  names, KV namespaces, or any `london-cine.*` `localStorage` key. Renaming a storage key
  signs readers out of their saved cinemas and preferences.
- Renaming analytics events. Event names keep firing as they do.
- Any mobile app code. Only the identifiers in `docs/mobile-app-plan.md` are updated.
- New colours. The palette in `src/styles/picturehouse.css` stays.

## Where things are today

All line numbers are at `f067dcc`. Verify them before editing; `main` often lags `origin`.

Name:

- Masthead words: `src/app.tsx:810` (`.brand-name` "LONDON CINÉ", `.brand-info` "INFO").
- Tab title: `src/app.tsx:619`. Static title and description: `index.html:5-6`.
- Install name: `public/manifest.webmanifest:2-4`.
- Film pages for link previews: `scripts/lib/film-pages.ts:34` and `:46` (`og:site_name`).
- Body copy naming the product: `src/app.tsx:241`, `src/components/account.tsx:724`,
  `changelog-page.tsx:54`, `cinema-landing.tsx:113` and `:175`, `privacy.tsx:78`, `:124`,
  `:433`, `how-to-use.tsx:105`, `feedback.tsx:134`.
- Email: sign-in subject at `functions/api/[[path]].ts:214`, digest HTML at
  `scripts/lib/digest.ts:301`, sender fallback at `scripts/send-digests.ts:116`.
- Calendar files: `src/shared/ical.ts:32` (`PRODID`).
- `README.md`, `ACCOUNT_SETUP.md`, `docs/`.
- Tests asserting the name: `tests/e2e/{changelog,settings-page,welcome,film-sharing,filter-bar}.spec.ts`,
  `tests/auth/{account-page,friends-page}.spec.ts`, `src/lib/sharing.test.ts`.

Domain:

- `wrangler.toml`: `SITE_URL` and `RESEND_FROM` (production and preview).
- `src/shared/analytics.ts:3-4`: `POSTHOG_HOST` (`https://works.london-cine.info`, the managed
  reverse proxy) and `SITE_HOST`.
- `src/components/changelog-page.tsx:56`: a hostname check against `london-cine.info`.
- `src/shared/ical.ts:50`: event `UID` ends `@london-cine.info`.
- `scripts/preview-digest.ts:30`, `scripts/send-digests.ts:106`, `scripts/lib/film-pages.ts:27`.
- `server/public-watchlists.ts:57` and `scripts/lib/watchlist.ts:86`: the outbound
  `User-Agent` names the product and links `/about`.
- `.github/workflows/deploy.yml:61`: `VERIFY_URLS` for the deploy check.
- `docs/analytics.md`, `docs/changelog.md`, `docs/feedback.md`, `PLAN.md`, `ACCOUNT_SETUP.md`.
- There is no `public/_redirects`; only `public/_headers`.

Type:

- Only `src/styles/prose.css:3-12` has size tokens (`--prose-body: 15px` and so on).
- Hardcoded pixel `font-size` declarations, and how many are under 13px: `base.css` 105 (40),
  `picturehouse.css` 76 (19), `discovery.css` 36 (5), `friends.css` 13 (10), `posters.css`
  11 (3), `prose.css` 4 (0), `feedback.css` 1 (0). There are also `font:` shorthands with
  pixel sizes, for example `picturehouse.css:23-25`.
- Measured in the running app at 1280px: search 12px, quick filters 12px, column headers
  11px, cells 13px, film title 15px, masthead "INFO" 10px. At 390px the body is already 17px,
  the film title 20px and "INFO" 8px. The small text is mostly a desktop problem.
- Fonts: League Spartan for text, Clash Display 500 for the masthead, both self-hosted
  (`picturehouse.css:698-712`, files under `public/fonts/`).

Quick filters, Filters button, sort:

- Items and labels: `src/lib/shortcuts.ts:28-72`. Markup: `src/components/shortcut-strip.tsx`.
- Styles: `src/styles/picturehouse.css:1166-1199`, phone overrides at `:1222-1232`. The guide
  reuses the strip: `src/styles/welcome.css:187-194`, `src/styles/prose.css:610`.
- Filters button: `src/components/filter-bar.tsx:114-127` (`.all-filters`, a "Filters" label,
  `countLabel(moreCount)` and a caret).
- Sort trigger: `src/components/mobile-sort.tsx:58-72` ("Sort: {value}", an order suffix and
  a caret). Styles: `src/styles/discovery.css:11`, `:195`, `:331-348`, `base.css:796`.
- Specs that drive these: `tests/e2e/filter-strip.spec.ts`, `mobile-sort.spec.ts`,
  `filter-bar.spec.ts`, `catalogue.spec.ts`, `discovery.spec.ts`, `picturehouse.spec.ts`,
  `busy-programme.spec.ts`, `year-filter.spec.ts`, `hide-ratings.spec.ts`,
  `tests/auth/{accounts,friends}.spec.ts`.

Filters sheet:

- Dialog: `src/components/filter-bar.tsx:128-155` (`dialog.filter-sheet`, `.sheet-heading`,
  `.sheet-watchlists`, then `FilterControls`).
- Contents: `src/components/filter-controls.tsx` (search label at `:43`, the pickers from
  `FILTERS` in `src/lib/filters.ts:7-15`, the year picker at `:140`, tick boxes at `:160-177`,
  "Reset all filters" at `:180`, the "Show N films" button).
- One row: `src/components/filter-picker.tsx:90-95` (a `<details>` whose `<summary>` holds
  the title in a `<span>` and the value in a `<small>`).
- Styles: `src/styles/base.css:968-1000` and `:1355-1451`, `picturehouse.css:659-670`.
- Existing icons to match in weight: `src/components/platform-marks.tsx` (`CalendarIcon` and
  others), and the feedback icon in `src/app.tsx` (24 box, 1.6 stroke, round caps).

## PR 1: display name

- Masthead: "READOGRAPH" in `.brand-name`, "LONDON" in `.brand-info`. Nothing else about the
  board changes. Check the board still fits beside the menu and feedback buttons at 390px.
- Tab titles end "— Readograph". `index.html` title becomes "Readograph — London cinema
  listings"; keep the description sentence, which never names the product.
- Manifest: `name` "Readograph", `short_name` "Readograph".
- Film pages: `og:site_name` "Readograph"; page titles end "— Readograph".
- Body copy: replace "London Ciné Info" with "Readograph" in every file listed above. In
  `privacy.tsx` add one sentence saying the service was called London Ciné Info until this
  change, so the policy stays traceable.
- Email subject and digest text use "Readograph". The sender **display** name in
  `RESEND_FROM` changes here; the sender **address** changes in PR 2.
- `ical.ts` `PRODID` becomes `-//Readograph//Saved Screenings//EN`. Leave `UID` alone.
- `README.md`, `ACCOUNT_SETUP.md` and the docs that describe the product by name. Do not
  rewrite old plan documents; add nothing to them.
- Leave the outbound `User-Agent` product token for PR 2, where its URL changes too.
- Changelog fragment: public, type `improved`, saying the site has a new name and that
  nothing else changes for accounts, saved films or links.

## PR 2: domain and sender

Steps outside the repository are dio's; the agent prepares the code and the checklist.

For dio, before the PR merges:

1. Add `readograph.com` as a custom domain on the Cloudflare Pages project.
2. Verify `mail.readograph.com` in Resend (SPF, DKIM, DMARC) and wait for it to pass.
3. Create the PostHog managed reverse proxy host on the new domain, mirroring
   `works.london-cine.info`.
4. Keep `london-cine.info` attached and paying. It must redirect for at least a year.

In the PR:

- `wrangler.toml`: `SITE_URL = "https://readograph.com"`,
  `RESEND_FROM = "Readograph <hello@mail.readograph.com>"`.
- `SITE_HOST` and `POSTHOG_HOST` in `src/shared/analytics.ts`; the hostname check in
  `changelog-page.tsx:56`; the script defaults listed above; `VERIFY_URLS` in `deploy.yml`.
- Redirect every request on `london-cine.info` to the same path and query on
  `readograph.com` with status 301. Do it in the Pages function or middleware by hostname,
  since `_redirects` cannot match on host. Cover `/api/*` too, except endpoints that old
  emails call: sign-in and unsubscribe links already sent must keep working, so either
  serve them on both hosts or redirect them with the query intact and test it.
- Sessions: cookies are per host, so signed-in readers land signed out on the new domain.
  Say so in the changelog note. Do not try to carry sessions across.
- Browser storage is per origin too: saved cinemas, view preferences and the dismissed
  welcome page do not follow a reader who is not signed in. Say so in the changelog note.
- `ical.ts` `UID`: keep `@london-cine.info`. Changing it duplicates events in calendars
  that already subscribed.
- Outbound `User-Agent` in `server/public-watchlists.ts` and `scripts/lib/watchlist.ts`:
  new product token and the new `/about` URL.
- Add a canonical link to `index.html` and the generated film pages pointing at the new
  origin, if none exists.
- Docs: `docs/analytics.md`, `docs/changelog.md`, `docs/feedback.md`, `ACCOUNT_SETUP.md`.
- Changelog fragment: public, `improved`, with the new address and the two things readers
  must do (sign in again; choose cinemas again if not signed in).

## PR 3: type scale

Gate: publish an accurate desktop mock-up at the new scale, drawn from the running app, and
get dio's approval before writing code. Start the app (`npx vite`), set `localStorage`
`london-cine.welcome-dismissed.v1` to `true`, and screenshot at 1280px and 390px first.

- Add size tokens in `rem` to `:root` in `src/styles/base.css`, on this ladder:
  13, 14, 16, 18, 20, 25, 30px expressed as `rem` at a 16px root. Name them by step, not by
  use. Point the `--prose-*` tokens in `prose.css` at them so there is one scale.
- Replace every hardcoded pixel `font-size` and every pixel size inside a `font:` shorthand
  in `src/styles/*.css` with a token. Anything under 13px rises to 13px. Body text is 16px
  on desktop; the phone, already at 17px, must not shrink.
- Raise control heights where text would otherwise crowd them, keeping 44px touch targets on
  the phone.
- `docs/reading-system.md` forbids per-page sizes on text surfaces; this PR must leave those
  pages passing that document's checklist.
- Add a stylelint rule, or a unit test that scans `src/styles`, that fails on a pixel
  `font-size`, so the scale cannot erode.
- Changelog fragment: public, `improved`.

## PR 4: quick filters, Filters button, sort

Quick filters (`shortcut-strip.tsx`, `shortcuts.ts`, `picturehouse.css:1166-1232`):

- Capitals through CSS `text-transform`, not by changing the label strings' case, so the
  accessible names stay in sentence case. 13px, letter spacing about 0.03em on the date row
  and 0.06em on the personal row.
- Labels: "This weekend" becomes "Weekend", "This week" becomes "Week", in `shortcuts.ts`
  and the How to use guide. Keep the shortcut `id`s and the URL values unchanged.
- Desktop: one line, as today.
- Phone: two rows, each centred. Row one is the `when` group; row two is the `personal`
  group. Render the groups as two flex rows instead of one wrapping row with `.strip-sep`.
  No rule and no separator between the rows on the phone; the desktop separator stays.
- The date row must not look tight at 390px. The mock-up uses 24px gaps and comes to about
  363px of the 372px available by arithmetic; it was never rendered. Measure it in a
  browser. If it touches the edges, reduce the gap to 20px before reducing letter spacing.
- A signed-out reader has only "Near me" in the personal group; the second row still
  renders, centred.

Filters button (`filter-bar.tsx:114-127`):

- Desktop: unchanged apart from the type scale.
- Phone: the sliders icon only, 44 by 44, fill kept. `aria-label` stays "Filters" and
  includes the active count ("Filters, 2 active"). Keep `aria-haspopup="dialog"`.
- Active count: a small brass badge at the top right of the button, shown only when the
  count is above zero. See "Not decided" 4 for the fallback.
- The search field takes the width the label gave up.

Sort control (`mobile-sort.tsx:58-72`):

- Visible content: an up-down arrows icon, then the value ("Letterboxd"). No "Sort:" word,
  no fill, no caret. The order suffix (" · Highest first") is unchanged.
- `aria-label` stays "Sort: {value} · {order}" so nothing is lost for screen readers.
- Keep a 44px target height.
- The sort control and the film count beside it ("2,111 films") are both in the muted
  colour (`--muted`), regular weight, so the line reads as secondary to the listings. The
  count today is full ink; check the muted colour still passes 4.5:1 on the page ground.

Tests: update the specs listed under "Where things are today" for the two renamed labels,
the icon-only Filters button (select by role and name, not by text) and the sort trigger.
In `filter-strip.spec.ts` add a 390px check that the strip is exactly two rows, each row is
centred, every item is visible, and the page has no horizontal scroll.

Changelog fragment: public, `improved`.

## PR 5: Filters sheet

Follow the "Filters sheet" boards. Structure, top to bottom:

1. Heading bar: "Filters" and the close button.
2. Search: a bordered field with the placeholder "Film or director". Remove the visible
   "Search" heading; keep a label for screen readers.
3. Three groups, each under a small brass heading in capitals:
   - When: Day, Time.
   - Where: Cinema, Borough, Membership.
   - What: Watchlists, Genre, Format, Original language, Year, Accessibility.
4. "Only show": the tick boxes together, 22px boxes on 48px rows. Wording per "Not
   decided" 3.
5. Footer bar, always visible while the body scrolls: "Reset all" as a quiet text button on
   the left, "Show N films" as the filled curtain-red button.

Each filter row:

- A full-width 48px target: line icon, title in capitals (13px, medium weight), the value
  right-aligned at 16px, one chevron column at the far right.
- "Any …" values in the muted colour; a chosen value in the full ink colour.
- Icons, one per filter, 20px, 1.6 stroke, brass, `aria-hidden`: Day calendar, Time clock,
  Cinema screen, Borough map pin, Membership card, Watchlists bookmark, Genre tag, Format
  film strip, Original language globe, Year hourglass, Accessibility figure. Add them to
  `platform-marks.tsx` or a new `filter-icons.tsx`; reuse `CalendarIcon` if it matches.
  Genre and Year are the weakest fits; show dio alternatives at the preview if they read
  wrong.
- Keep the `<details>` picker behaviour and everything inside an opened picker as it is.

Desktop: the rows of each group sit in two columns; the tick boxes in two columns. The sheet
should not need to scroll at 900px tall with every picker closed.

Phone: one column. The body scrolls; the heading and footer bars do not.

`docs/reading-system.md` says dialogs end in a footer bar; this brings the sheet in line.
The desktop bar's Cinema and Genre pickers (`filter-bar.tsx:107-113`) are untouched.

Tests: update `filter-bar.spec.ts` and any spec that finds sheet controls by position. Add
checks that the footer stays in view while the body scrolls at 390px, that the three group
headings exist, and that every filter reachable today is still reachable.

Changelog fragment: public, `improved`.

## After these: the mobile plan

Before PR 0 of `docs/mobile-app-plan.md`, update that document in its own small PR
(internal changelog fragment):

- Title and branding lines: Readograph.
- Line 272: scheme `londoncine` and the identifier `info.londoncine.app` become final
  Readograph values. The bundle identifier cannot be changed after the first store
  submission, so dio confirms it.
- `@lci/core` (lines 174-191, 280): keep or rename. Recommendation: keep; it is internal and
  the repository name is not changing.
- The tokens file the app mirrors from `src/styles` should take the new size ladder from
  PR 3.

## Docs

- `README.md`, `ACCOUNT_SETUP.md`, `PLAN.md`: name in PR 1, URLs in PR 2.
- `docs/analytics.md`, `docs/changelog.md`, `docs/feedback.md`: URLs in PR 2.
- `docs/reading-system.md`: point its scale at the shared tokens in PR 3.
- `docs/cinema-ux.md`: update where it describes the strip or the sheet, in PRs 4 and 5.
- `AGENTS.md`: it names `london-cine` nowhere that needs changing; leave it.

## Delivery

- One worktree and branch per PR off `origin/main`, for example `claude/readograph-name`,
  `claude/readograph-domain`, `claude/type-scale`, `claude/quick-filters-caps`,
  `claude/filters-sheet`. Commit this plan with PR 1.
- Every PR adds a changelog fragment (`npm run changelog:new -- <stable-id>`) and passes
  `npm run changelog:validate`. Do not claim a change is live in a note.
- Merging to `main` deploys. PR 2 must not merge before dio's four steps are done.
- PRs 3, 4 and 5 change how the app looks: each PR description carries screenshots at 1280px
  and 390px, signed out and signed in, and the Cloudflare Pages preview URL for dio to open
  on a phone. Merge only after dio's answer.
- PR 3 has its design-review gate before any code.

## Acceptance criteria

- No visible "London Ciné Info" remains in the app, emails, link previews, calendar files or
  the manifest, except the one historical sentence in the privacy page.
- The masthead board is pixel-for-pixel the same apart from its two words and the size of
  the second one.
- Every path on the old domain returns a 301 to the same path and query on the new domain.
  Sign-in and unsubscribe links from emails sent before the move still work.
- No `localStorage` key, analytics event name, shared URL shape or calendar `UID` changed.
- No `font-size` in `src/styles` is in pixels, nothing renders under 13px at either width,
  and phone text is no smaller than before.
- At 390px the quick filters are two centred rows with no rule between them, every item
  visible, no horizontal scroll, and the date row does not touch the edges.
- On the phone the Filters button is an icon with an accessible name that includes the
  active count; the sort control shows an icon and the value with no fill.
- In the Filters sheet every filter available today is still available, grouped under When,
  Where and What with an icon each; the footer bar stays in view; desktop shows two columns.
- All e2e, accounts, analytics and unit suites pass after their updates.
- Listings rows, the sidebar structure and the film page are unchanged apart from type size.
