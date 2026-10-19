# Plan: Account, Friends and Settings become pages

Written 11 October 2026 for the next agent. Base: `origin/main` at `ee242c3` (PR #29, the
shortcut strip). Design discussion and mockups: https://claude.ai/artifact/1BSkJDNnsFwfikCsrj4RCg

## Decision

dio's verdict after reviewing the mockups:

- **All three become pages**: `/account`, `/friends`, `/settings`. The sidebar then opens
  nothing modal. The Watchlists picker and the My cinemas picker stay dialogs because they act
  on the catalogue you are looking at.
- **Both usernames stay.** The app username (friends add you by it) and the Letterboxd username
  (watchlist import) remain two fields, now side by side under Account › Profile with one label
  each saying what it is for. No change to the friends API or data model.
- **"Find a film together" is the top card on `/friends`**, and the whole page when signed out.
- **Magic-link sign-in still lands on `/watchlist`.** No onboarding redirect.
- **Sign in and Sign out stay in the sidebar.** Signed out, the Preferences link reads "Sign
  in" and leads to `/account`. Signed in, it reads "Account" and a quiet "Sign out" button sits
  under it. The Account page has no Sign out of its own.
- **The Friends link shows the number of waiting requests as a small numeric badge**, not a
  "New request" tag.
- The toggle that hides the friends list ("Keep friends for next time") is removed. Sections
  that are empty are not rendered.
- The app username form and the "films in common" email checkbox move out of Friends into
  Account (Profile and Emails respectively).
- One pull request per page, in the order Account, Friends, Settings. Each PR rewrites the
  specs that drove the dialog it removes; nothing is kept alive for a dialog.

## Scope

In scope:

- Three routes added to the path whitelist, the page-title map and the render switch.
- Sidebar: Sign in / Account, Settings and Friends become links with `aria-current`, like
  About and Privacy. Sign out stays in the sidebar as a button under Account. Friends shows a
  numeric badge for waiting requests. The phone `.menu-button` shows a brass dot while a
  request is waiting.
- `src/components/account.tsx`: `AccountDialogs` becomes `AccountPage`. `AccountPanel` is
  deleted. `AccountFeedback`, `ImportStatus`, `RefreshButton`, `TokenPage`, `Privacy` stay.
- `src/components/friends.tsx`: split. The watchlists panel of `FriendsDialogs` stays in this
  file as `WatchlistsDialog`; the friends panel moves to a new `src/components/friends-page.tsx`
  as `FriendsPage`. `FriendsButton` is deleted. `WatchlistsButton`, `FilmFriends`,
  `WatchlistSelections`, `FriendsFeedback` stay.
- New `src/components/settings-page.tsx` wrapping `DisplayControls` plus a one-row preview.
- `src/app.tsx`: delete `settingsOpen`, `accountOpen`, `openSettings`, `openAccount`,
  `returnToAccount`, the `fromAccount` argument of `openCinemas`, the reopen in
  `closeCinemas`, the `restoreTo` selectors, the Settings `<Dialog>` and the two page-level
  dialog renders. Every `onAccount` callback becomes a navigation to `/account`.
- Digest email: "Change the day" links to `/account#emails` instead of `/watchlist`.
- Privacy page: "in Account" sentences link to `/account#profile` and `/account#emails`.
- Docs: README (Settings modal sentence), ACCOUNT_SETUP.md ("Account dialogs and import
  status" section), docs/cinema-ux.md (Preferences sentence), docs/analytics.md if the
  `account_opened` trigger changes wording.

Out of scope (do not do these):

- Merging the two username fields or changing `/api/me` and `/api/friends/profile`.
- Any change to the Watchlists picker's contents, the My cinemas picker, or the screening
  calendar dialog beyond where their Sign in / Manage friends buttons lead.
- A redirect after magic-link verification.
- Analytics event renames.
- The Flutter/dealer or any other client. This is a web-only change.

## Where things are today

Line numbers are for `ee242c3`.

- `src/lib/catalogue.ts:110-120` — `readView` whitelists `/about`, `/privacy`, `/auth/verify`,
  `/unsubscribe` on top of `PAGES`. Add `/account`, `/friends`, `/settings` there. Do not add
  them to `PAGES`; `PAGES` drives the Discover / For you navigation and the sort defaults.
- `src/app.tsx:235-240` — `pageTitle` falls back through a `{ "/privacy": "Privacy", … }` map
  then "About". Add `"/account": "Account"`, `"/friends": "Friends"`, `"/settings": "Settings"`.
- `src/app.tsx:740-770` — the render switch on `state.path` (`/privacy`, `/auth/verify`,
  `/unsubscribe`, `/my-calendar`, `/about`, else catalogue). Add the three branches here.
- `src/app.tsx:179` `settingsOpen`, `:229` `accountOpen`, `:265` `returnToAccount`,
  `:524-534` `openCinemas(fromAccount)` / `closeCinemas`, `:542-556` `openSettings` /
  `openAccount` (`openAccount` captures `account_opened`, closes the screening calendar and the
  drawer), `:557-566` `sidebarProps` (`onFriends` sets `friends.setPanel("friends")`),
  `:614` `<FriendsDialogs onAccount onNavigate>`, `:654-680` the Settings `<Dialog>` with
  `DisplayControls` and the `HIDE_RATINGS_STORAGE` write, `:682-695` `<AccountDialogs …
restoreTo>`, `:697-713` the two `<MyCinemas>` renders, `:717-726`
  `<ScreeningCalendarDialog onAccount={openAccount}>`, `:728-737` `.page-notices` rendering
  `AccountFeedback` only when `!accountOpen`, `:761` `MyCalendar onAccount={openAccount}`.
- `src/components/sidebar.tsx` — `Sidebar` takes `onSettings`, `onFriends`, `onAccount`.
  Renders `FriendsButton` under For you (line 73), `AccountPanel` and a `.settings-button`
  under Preferences (78-81), then `.about-link` and `.privacy-link` anchors in
  `.sidebar-bottom`, each repeating the modifier-key check before `onChange({ path }, true)`.
- `src/components/account.tsx` — `AccountPanel` (sidebar button, with the "Import queued…"
  status line), `AccountDialogs` (sign-in form; signed-in: email line, Profile form with
  Letterboxd username + weekly email select + Save account, `ImportStatus`, `RefreshButton`,
  "View your watchlist" link, Sign out, Delete account with a `deleting` confirmation view
  driven through `Dialog`'s `focusKey`; a "Favourite cinemas" section with "Manage my
  cinemas" calling `onManageCinemas`). `useNow()` and `time()` helpers at the top.
- `src/components/friends.tsx` — `FriendsButton` (with the "New request" tag), `FilmFriends`,
  `WatchlistSelections`, `FriendsFeedback`, `FriendsDialogs` (one `Dialog` whose title and
  body switch on `m.panel`, `"friends"` or `"watchlists"`; the friends panel holds the compare
  form, the `manageFriends` toggle, the app-username form, Add a friend, incoming requests,
  Your friends with search and `PAGE_SIZE = 6` paging, inline Remove confirmation, outgoing
  requests, and the `friendsDigest` checkbox; the watchlists panel ends with a "Manage friends"
  button calling `m.setPanel("friends")` at line 683).
- `src/lib/friends.ts` — `useFriendsModel`: `panel` / `setPanel` (line 91), a 30 s request
  refresh that runs while `panel === "friends"` (line 210-218), `perform(path, method, body,
notice)`, `addTemporary`, `update`, `toggle`, `accepted`, `value` (`FriendsResponse`:
  `friends`, `appUsername`, `friendsDigest`). `FriendsContext` / `useFriendContext`.
- `src/lib/account.ts` — `useAccount` → `user`, `loading`, `error`, `notice`, `busy`,
  `perform(kind, fn, successNotice)`, `reload`, `clear`, `dismissNotice`. `accountApi`.
- `src/components/dialog.tsx` — `Dialog` with `restoreTo` and `focusKey`. Still used by the
  Watchlists picker, My cinemas, the screening calendar, mobile sort and the filter sheet.
- `src/components/display-controls.tsx` — `DisplayControls` with its own `<h2
class="section-label">Display</h2>`; the first select carries `data-initial-focus`.
- `src/components/film-table.tsx` — `FilmTable` renders `<tr class="film-row">` inline (line
  146 onward); there is no row component. The phone layout is CSS over the same markup
  (`mobile-hidden`, `mobile-sort-score`), so one component renders both.
- `functions/api/[[path]].ts:412` — `PUT /api/me` accepts `username` (Letterboxd) and
  `digestWeekday`; `:277-` `PUT /api/friends/profile` accepts `username` (app) and
  `friendsDigest`. Both are partial updates; omitted fields keep their value.
- `scripts/lib/digest.ts:237` and `:301` — the text and HTML digest footers link "Change the
  day" to `${base}/watchlist`.
- `src/components/account.tsx` `Privacy` — four sentences say "in Account".
- Styles: `base.css:1436-1450` `.account-panel`, `:2078-2081` `.settings-button,
.friends-button`, `:1452-1500` the shared `:is(.account-dialog, …, .settings-dialog)` dialog
  rules, `:632-650` `.about-page` (the page container used by About, Privacy and `TokenPage`:
  `max-width: 750px; padding: 30px 24px; margin: 0 auto`). `friends.css` holds
  `.social-dialog`, `.social-section`, `.social-person`, `.social-list-toolbar`,
  `.social-pagination`, `.watchlist-option`, `.social-plan`, `.social-manage-toggle`.
  `picturehouse.css` is the active theme (`--brass`, `--muted`, `--line`, `--shade`,
  `--active-bg`).
- Analytics: `account_opened` is captured in `openAccount` (`app.tsx:548`); listed in
  `docs/analytics.md:27`.

## Shared page chrome

All three pages render inside `<article class="pref-page">` (new class, same metrics as
`.about-page` but `max-width: 640px`; add it to `base.css` next to `.about-page`). Structure:

```
<article class="pref-page" aria-labelledby="pref-title">
  <h2 id="pref-title">Account</h2>          <!-- the masthead already shows pageTitle -->
  <p class="pref-lede">Signed in as … · <a>Sign out</a></p>
  <section class="pref-section" id="profile" aria-labelledby="profile-h">
    <h3 id="profile-h">Profile</h3> …
  </section>
  …
</article>
```

- `.pref-section` is separated by `border-top: 1px solid var(--line)` and `padding: 16px 0`;
  the first has no top border. `h3` is 11px uppercase, letter-spaced, `var(--brass)`, matching
  `.section-label`. Nothing is a card except the compare card on `/friends`.
- Section anchors: on mount and on `hashchange`, if `location.hash` names a section id,
  `scrollIntoView({ block: "start" })` and focus it (`tabIndex={-1}`). `change()` in `app.tsx`
  calls `scrollTo({ top: 0 })` on navigation; the anchor effect runs after it. `viewUrl` does
  not emit a hash and `readView` ignores it, so in-app navigation never carries one; only
  direct loads from an email or the privacy page do, which is the intent.
- Each form section has its own Save button with a status line beside it: "No unsaved
  changes" / "Unsaved changes" (`role="status"`), replacing the dialog's single "You have
  unsaved changes" paragraph. Section-level notices (`account.notice`) render inside the
  section that performed the action; `AccountFeedback` at the top of the page renders
  `account.error` and any notice whose `action` is not owned by a section.
- Focus on navigation: the page heading receives focus (`tabIndex={-1}`) when the route
  changes into one of these pages, the same way a screen reader expects a page change. There
  is no `data-initial-focus` on a field; a page is not a dialog.

## `/account`

`AccountPage({ account, matches, onManageCinemas, onNavigate, cinemas, meta })` in
`src/components/account.tsx`, replacing `AccountDialogs`.

Signed out (`!account.user`):

1. Heading "Sign in". Lede: "A link in your email signs you in. No password."
2. The existing email form (`accountApi("/api/auth/request")`), unchanged copy for the success
   notice, rendered inline below the button via `AccountFeedback`.
3. Section "With an account": three sentences on watchlist import, friends and the weekly
   email (copy in the mockup).
4. Section "Favourite cinemas": "Chosen for this browser. Sign in to keep them on your
   account." and the Manage cinemas button.

`account.loading` renders "Checking sign-in…" in place of 1-3.

Signed in, sections in this order, with ids `profile`, `watchlist`, `emails`, `cinemas`,
`delete`:

1. **Lede line**: "Signed in as {email}". No Sign out here; it is in the sidebar.
2. **Profile**: two fields side by side on desktop, stacked on the phone. "App username"
   (`maxLength 30`, hint "Friends add you by this name.") bound to `friends.value.appUsername`
   via `normalizeUsername`; "Letterboxd username" (hint "Your public profile name, not a URL.
   Changing it removes the previous imported list.") bound to `account.user.username`. One
   "Save profile" button. On submit, call only the endpoints whose value changed, in sequence:
   `PUT /api/friends/profile { username }` through `friends.perform`, then `PUT /api/me
{ username }` through `account.perform("save", …)`. If the first fails, stop and show its
   error in the section; the second field keeps its draft. Success notice: "Profile saved." or,
   when the Letterboxd username was just set and nothing has been imported, the existing
   "Account saved. Choose Import watchlist to fetch your public list." adapted to "Profile
   saved. Choose Import watchlist below to fetch your public list."
3. **Watchlist**: `ImportStatus` (unchanged states and copy, minus "You can close Account and
   keep browsing" in the queued message, which becomes "You can keep browsing."), then
   `RefreshButton` (disabled while Profile has unsaved changes, as today), then the "View your
   watchlist" link when `fetchedAt`. The section heading carries the small label "Public
   Letterboxd list".
4. **Emails**: "Weekly screening email" select (Off, Sunday…Saturday) bound to
   `digestWeekday`; checkbox "Include films in common with friends" bound to
   `friends.value.friendsDigest`, disabled without an app username with the hint "Choose an app
   username above to enable this."; one "Save emails" button that calls `PUT /api/me
{ digestWeekday }` and/or `PUT /api/friends/profile { friendsDigest }` for whichever
   changed. Footer hint: "Sent to {email}. Every email has an unsubscribe link."
5. **Favourite cinemas**: the venue names from `cinemas.venues` resolved through
   `meta.venues` (first three, then "and N more"), the count, and "Manage cinemas" →
   `onManageCinemas()` which opens the existing `MyCinemas` dialog over the page. Closing it
   returns focus to the button through `Dialog`'s normal previous-element restore; no
   `returnToAccount` needed.
6. **Delete account**: the warning sentence, a "Delete account…" button. Clicking swaps the
   section body for the confirmation: the sentence, "Cancel" and "Confirm deletion"
   (`danger-action`), focus moved to the confirmation paragraph. On success `account.clear()`,
   `friends` resets through its identity epoch, `onNavigate("/")`, notice "Your account and
   watchlist were deleted." shown through `.page-notices`.

Keyboard: every control is in DOM order; no focus trapping. `useNow()` stays for the cooling
labels.

## `/friends`

`FriendsPage({ onNavigate })` in new `src/components/friends-page.tsx`, built from the friends
panel of `FriendsDialogs`. Reads the model through `useFriendContext()`; returns null without
it (friends are behind the same flag as today).

Signed out:

1. Heading "Friends".
2. Compare card (`.social-plan` markup reused, rendered as a bordered card): "Find a film
   together", two Letterboxd fields, "Find films in common". Submit behaviour unchanged
   (`addTemporary` both, `update({ selected, mode: "all" })`, then `onNavigate()` to `/` with
   the lists applied). (The `VITE_UX_PREVIEW` design-preview notice was later removed.)
3. Section "Keep friends for next time": one paragraph and a "Sign in" link to `/account`.

Signed in:

1. Heading, then the lede line "You are @{appUsername} · Change in Account" (link to
   `/account#profile`). Without an app username: "Choose a username in Account to add friends"
   linking to `/account#profile`, and the Add a friend form is not rendered.
2. Compare card, own field prefilled from `account.user.username` as today.
3. **Requests** (`id="requests"`): incoming pending, Accept / Decline. Rendered only when
   non-empty. Heading "Requests · N waiting".
4. **Your friends** (`id="friends"`): heading "Your friends · N"; search and the six-per-page
   pagination exactly as today; rows with `@username`, the Letterboxd line, "See shared films"
   (disabled with `title` when `!letterboxdUsername`) and "Remove" which expands the inline
   confirmation row in place of the row. Empty state: "Add a friend below to find films in
   common."
5. **Add a friend** (`id="add"`): the input and "Send request"; hint "They find you as
   @{appUsername}. Accepted friends can filter films by each other's watchlist."
6. **Sent requests**: outgoing pending with "Cancel request". Rendered only when non-empty.

Removed from this page: the app-username form and the `friendsDigest` checkbox (both now in
Account), the `manageFriends` toggle and `.social-manage-toggle`.

Model changes in `src/lib/friends.ts`:

- `panel` narrows to `"watchlists" | null`. Replace the `panel === "friends"` condition on the
  30 s refresh with a new `watching` boolean the page sets through `setWatching(true)` on
  mount and `false` on unmount. Keep the focus-refresh unconditional as today.
- Add `pendingIncoming` (count) to the returned model so the sidebar and the phone menu button
  read one value.

Watchlists dialog (`WatchlistsDialog`, the remaining half of `friends.tsx`): the "Manage
friends" button at the bottom calls `close()` then `onNavigate("/friends")`; it needs an
`onNavigate(path)` prop, which `app.tsx` already passes for the compare flow. Its `restoreTo`
falls back to the strip's Watchlists trigger as today.

## `/settings`

`SettingsPage({ display, onChange, error, catalogue, state })` in new
`src/components/settings-page.tsx`.

1. Heading "Settings". Lede: "Saved in this browser. Changes apply straight away." When
   `error` (the storage failure message from `app.tsx`) is set, it replaces the lede with
   `role="status"`.
2. `DisplayControls` as is, but drop its internal `<h2 class="section-label">Display</h2>` and
   let the page supply the section headings "Display" and "Rating column order" (split the
   component's two halves with the `.pref-section` wrapper; the `ol` and its `move()` logic
   are untouched). Remove `data-initial-focus` from the select.
3. **Preview** (`id="preview"`): "One row from the programme, drawn with your choices." then
   `FilmTable` rendered with `films={[catalogue.films[0]]}`, the current `display`, a minimal
   `state` (`{ ...state, path: "/", page: 1, sort: defaultSort("/") }`), `showEmpty={false}`,
   `onExpand` and `onCalendar` as no-ops, `expanded={null}`. Wrap in `<div class="pref-preview"
inert>` so the row is not interactive. Pick the first film with an original title that
   differs from the title and at least three ratings, so the preview shows what the controls
   change; fall back to `films[0]`. Skip the section while the catalogue is loading. On the
   phone the same component renders the phone row; no second component.

`app.tsx` keeps `display`, `setDisplay` and the `HIDE_RATINGS_STORAGE` write; move that
`onChange` body into a `changeDisplay(value)` function and pass it to the page. The
`change({ page: 1 })` call inside it stays.

## Sidebar and navigation

`src/components/sidebar.tsx`:

- Extract the repeated anchor into a local `NavLink({ path, children, className })` that does
  the modifier-key check and calls `onChange({ path, page: 1 }, true)`; use it for About,
  Privacy and the three new links. The Discover / For you links keep their own handler
  because they also reset `eventType`, `director` and sort.
- For you group: after My calendar, `<NavLink path="/friends">Friends{count > 0 && <span
class="nav-badge" aria-label={`${count} friend request${s}`}>{count}</span>}</NavLink>`,
  count from `useFriendContext()?.pendingIncoming`. Render the link only when the friends
  context exists. The badge is the number only: a brass pill, 16px tall, `var(--brass)`
  background, dark ink, 11px, right-aligned in the link. Cap the display at "9+".
- Preferences group: `<NavLink path="/account">{account.user ? "Account" : "Sign in"}</NavLink>`,
  then, only when signed in, `<button class="signout-button">Sign out</button>` which runs the
  existing logout (`account.perform("logout", …)`, `account.clear()`, notice "You are signed
  out.") and then, if `state.path` is `/account`, `/friends`, `/watchlist` or `/my-calendar`,
  `onChange({ path: "/", page: 1 }, true)`. Style it as a quiet text button in `var(--muted)`
  at the link's indent, not a boxed button. Then `<NavLink path="/settings">Settings</NavLink>`.
  The import status line from `AccountPanel` ("Importing watchlist…" / "Import queued…")
  becomes a `<small>` under the Account link while `account.user?.pending`. While
  `account.loading`, render the link as "Account" with no Sign out, to avoid a label flip.
- Props `onSettings`, `onFriends`, `onAccount` are removed; `account` stays for the label, the
  pending line and Sign out.
- Phone: in `app.tsx`, the `.menu-button` gets `data-requests={pendingIncoming > 0}` and its
  `aria-label` becomes "Toggle pages, N friend requests" when non-zero. CSS: a 6px
  `var(--brass)` dot top-right of the button when `data-requests="true"`.
- Styles: `.nav-badge` (above) replaces `.friends-count`; `.signout-button` is new. Delete
  `.account-panel`, `.settings-button`, `.friends-button`. `.watchlists-trigger` stays.

`app.tsx` after the change:

- `sidebarProps` loses the three callbacks. `openAccount` becomes
  `goToAccount()`: `closeScreeningCalendar(); change({ path: "/account", page: 1 }, true)`. It
  no longer captures `account_opened`; instead a `useEffect` on `state.path` captures
  `account_opened` when the path becomes `/account` (keep the event name; update the
  description in `docs/analytics.md` to "Account page viewed").
- The `.page-notices` block renders when `state.path !== "/account"`; the Account page renders
  `AccountFeedback` itself.
- `MyCalendar onAccount`, `ScreeningCalendarDialog onAccount`, the "Sign in" button in the
  My watchlist prompt (`view-note account-prompt`) and the sign-in prompt on `/watchlist` all
  call `goToAccount`. Where the prompt is a button today it becomes an `<a href="/account">`
  with the same click handling as `NavLink`, so middle-click works.
- `closeCinemas` just sets `cinemasOpen` false. `openCinemas()` takes no argument.
- Delete the Settings `<Dialog>`, `<AccountDialogs>`, `<FriendsDialogs>`; render
  `<WatchlistsDialog onNavigate=…/>` where `FriendsDialogs` was.
- `drawer` handling: `change()` already closes the drawer on navigation
  (`setDrawerOpen(false)`); also close the native `<dialog>` drawer there if `drawer.current?.open`,
  since the drawer is a modal `<dialog>` and `setDrawerOpen(false)` alone does not call
  `close()` (check how the drawer effect reacts to `drawerOpen`; if it already closes the
  element, nothing to add).

## Links into the pages

- `scripts/lib/digest.ts:237` and `:301`: "Change the day" → `${base}/account#emails`.
  `scripts/lib/digest.test.ts` asserts the footer; update it.
- `Privacy` in `account.tsx`: "turn them off in Account" → link `/account#emails`; "change
  your username or email preferences in Account" → links `/account#profile` and
  `/account#emails`; "You can sign out or delete your account there" → link `/account#delete`.
  Use the `NavLink` behaviour (the privacy page is inside the app shell, so `onNavigate` is
  available; pass it to `Privacy`).

## Tests

Fixture data is required for `npm run e2e`: `npm run build-data -- --fixture && npm run build`,
then `npm run e2e`. The accounts suite is `npm run e2e:accounts` (local Functions + local D1).
`npm run typecheck`, `npm run lint`, `npm test` as always.

Specs that drive the dialogs and must be rewritten. The pattern in every case: replace
"open the drawer, click the button, scope to `getByRole("dialog", { name })`" with
`page.goto("/account")` (or a sidebar link click when the test is about navigation) and scope
to `page.getByRole("article", { name: "Account" })` (the `aria-labelledby` heading). Close
steps (`Close account`, `Close settings`, `Escape`, focus-restore assertions) are deleted.

Account PR:

- `tests/auth/accounts.spec.ts` (12 refs): `openAccount` helper → navigate; the sidebar
  button regex `/^(Sign in|Account)$/` becomes a link with the same names; "Sign out" is
  clicked in the sidebar (open the drawer first on the phone project); "Signed in as",
  "Save account" → "Save profile"; the weekly email select and its save now live in the Emails
  section with "Save emails"; the "You have unsaved changes." assertion becomes the Profile
  section's status text; "Close account" steps go; "Import watchlist" / "Refresh now" stay.
- `tests/auth/import-states.spec.ts` (9 refs): same helper swap; `toHaveAccessibleName("Account")`
  on the dialog becomes the article heading; the 503 "Settings could not be saved" path now
  asserts the alert inside the Profile section.
- `tests/auth/cinemas.spec.ts` (5 refs): "Manage my cinemas" is opened from `/account`; the
  reopen-Account-after-close assertion becomes "focus returns to the Manage cinemas button".
- `tests/auth/calendar.spec.ts`: "Sign in to save" now navigates; assert `page.url()` ends
  with `/account` and the sign-in form is visible.
- `tests/e2e/discovery.spec.ts` (3 refs): the guest-favourites test opens Account from the
  drawer; change to the link and assert the page.
- `tests/analytics/events.spec.ts`: if it asserts `account_opened` on button click, assert it
  on navigation to `/account` instead.
- New `tests/auth/account-page.spec.ts`: (1) `/account` signed out shows the sign-in form and
  the guest cinemas section, the sidebar link is named "Sign in" with `aria-current="page"`,
  and no Sign out button exists; after sign-in the link is named "Account" and Sign out is
  visible under it; Sign out from `/account` lands on `/` with the "You are signed out."
  notice; (2) signed in, the
  five sections exist in order with the ids `profile`, `watchlist`, `emails`, `cinemas`,
  `delete`; (3) `/account#emails` on a direct load scrolls the Emails section into view and
  focuses it; (4) saving the app username from Profile is reflected on `/friends` ("You are
  @…"); (5) the Delete flow is inline: no `dialog[open]` at any point; after confirming, the
  URL is `/` and the notice shows; (6) phone project: no horizontal overflow at 390px and the
  two Profile fields stack.

Friends PR:

- `tests/auth/friends.spec.ts` (5 refs): the dialog opener and "Keep friends for next time"
  go; `/friends` is navigated directly; "Your app username" is saved on `/account`;
  "Your friends · 501", search, paging and Accept flows stay with the new scope; "Close find a
  film together" steps go; the Watchlists dialog assertions are unchanged.
- `tests/e2e/ux-flows.spec.ts` (2 refs): the `/^Friends/` button becomes the link.
- `tests/auth/filter-strip.spec.ts` (3 refs): only opens Account to connect a watchlist;
  helper swap.
- New `tests/auth/friends-page.spec.ts`: (1) signed out, the compare card and the "Keep friends
  for next time" section are the only sections, and Sign in links to `/account`; (2) signed in
  without a username, the Add form is absent and the lede links to `/account#profile`; (3) an
  incoming request shows the count in the sidebar link ("1 request") and the phone menu dot,
  and the Requests section is first after the compare card; accepting it removes the count
  without a reload; (4) Remove is inline (no `dialog[open]`); (5) Watchlists picker › Manage
  friends closes the picker and lands on `/friends`.

Settings PR:

- `tests/e2e/catalogue-polish.spec.ts` (7 refs): `settings()` → `page.goto("/settings")` or the
  sidebar link; `closeSettings()` → navigate back to the catalogue (`goBack()` or the All
  movies link) before asserting on `.film-title` and the table header; the screenshot step
  captures the page; the `dialog[open]` count assertion goes.
- `tests/e2e/hide-ratings.spec.ts` (6 refs): same swap; the checkbox is on the page.
- `tests/e2e/catalogue.spec.ts`, `tests/e2e/filter-bar.spec.ts` (2 refs each): check whether
  they only reference "Toggle pages"; if so, no change.
- New `tests/e2e/settings-page.spec.ts`: (1) the preview row reflects the title mode and the
  first rating column without leaving the page; (2) the preview is `inert` (clicking it expands
  nothing); (3) a reload keeps `hideWatchlistRatings` and resets the others, as today.

At the end of each PR grep for the removed names: `AccountDialogs`, `AccountPanel`,
`FriendsDialogs`, `FriendsButton`, `openAccount`, `openSettings`, `returnToAccount`,
`settingsOpen`, `accountOpen`, `account-dialog`, `settings-dialog`, `social-dialog`,
`social-manage-toggle`, `friends-count`, `account-panel`, `settings-button`,
`friends-button`. Each should be gone after its PR.

## Docs

- `README.md:271` "Display preferences now open in a Settings modal" → "Display preferences
  live on the Settings page (`/settings`)".
- `ACCOUNT_SETUP.md` "Account dialogs and import status" → "Account page and import status";
  rewrite the first paragraph to describe the page and its sections; keep the import lifecycle
  text.
- `docs/cinema-ux.md:7`: the Preferences sentence still holds; add that Account and Settings
  are pages.
- `docs/analytics.md:27`: `account_opened` fires on viewing `/account`.
- `docs/UX_REVIEW.md`: add a dated note pointing at this plan.

## Delivery

- Work in a new worktree off `origin/main`: branches `codex/account-page`,
  `codex/friends-page`, `codex/settings-page`, each PR based on the previous one's merge.
- PR titles: "Move Account into a page", "Move Friends into a page", "Move Settings into a
  page". Description: the Decision bullets that apply, what was removed, and screenshots at
  1280px and 390px of the signed-out and signed-in page.
- Hand-off to dio after each PR: the Cloudflare Pages preview URL, opened on a phone. The
  question for Account is "can you find both usernames and the email day without hunting?";
  for Friends "does a waiting request get to you?"; for Settings "does the preview row tell
  you what you changed?". Merge only after that answer.

## Acceptance criteria

- `/account`, `/friends`, `/settings` load directly, appear in the sidebar with
  `aria-current`, and the masthead shows their name. No sidebar control opens a dialog.
- No `dialog[open]` appears during sign-in, profile save, delete, friend add, accept, remove,
  or any settings change. The Watchlists picker, My cinemas picker and screening calendar
  still open as dialogs from their own triggers.
- `/account#emails` from the digest email and `/account#profile` from the privacy page scroll
  to and focus the section.
- The app username and the films-in-common checkbox are editable only on `/account`;
  `/friends` reads them.
- A pending incoming request shows a numeric badge on the sidebar Friends link and a dot on
  the phone menu button, and the Requests section is the first section after the compare card.
- Sign in (signed out) and Account plus Sign out (signed in) are in the sidebar Preferences
  group; the Account page itself has no Sign out.
- The Settings preview row changes with the title mode and the rating order without
  navigation.
- No horizontal scroll at 390px on any of the three pages; the two Profile fields stack.
- All e2e, accounts, analytics and unit suites pass after their updates; the three new specs
  pass on desktop and phone projects.
- No change to shared URLs other than the three new paths, no analytics event renames, no
  API changes.
- No dead code: the dialog components, their open-state, focus-restore selectors and CSS are
  deleted, not hidden.
