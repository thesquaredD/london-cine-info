# Discovery and onboarding implementation plan

Status: proposed implementation plan. The local prototype establishes the direction;
the hover treatment remains provisional and requires design review.

## Scope

- A welcoming landing page featuring London cinemas and their logos.
- A clear, visually engaging How to use page covering watchlists, shared watchlists and My cinemas.
- A simple nearby-cinema flow with understandable location feedback.
- Compact poster browsing with a List / Posters switch and a 2×2 grid icon.
- Stable screening layouts and consistent hover, focus and selection behaviour.

Work in an isolated London Ciné Info worktree, using the project's existing components,
typography, colours and live catalogue integration. Keep the main checkout untouched.

## Responsive design is a requirement throughout

Every page, control, grid and dialog in this plan must work on mobile, tablet and desktop.
Responsive behaviour is part of each implementation stage, not a final desktop-to-mobile pass.

- Review representative widths of 320, 390, 768, 1024 and 1440 pixels, plus widths between
  breakpoints and phone landscape orientation.
- Use available space to determine poster columns and control wrapping. Preserve readable
  text and useful touch targets rather than shrinking a desktop layout.
- Keep primary actions reachable, including when the on-screen keyboard is open. Dialogs
  must fit the viewport and scroll internally when necessary.
- Support mouse, keyboard and touch. No essential information or action may depend on hover;
  a single tap on a poster opens its details and screenings.
- Verify 200% text enlargement and browser zoom/reflow. Avoid clipped labels, overlapping
  controls, inaccessible content and unintended horizontal page scrolling.
- Reserve image dimensions and suitable space for asynchronous feedback. Loading, errors,
  hover and selection must not unexpectedly move the control being used. Reserved areas
  must still accommodate wrapping and enlarged text without clipping.
- Respect reduced-motion preferences. Moving logos must have a pause control and pause
  on hover or keyboard focus.
- Use at least 44×44 CSS-pixel touch targets for interactive controls and maintain visible
  keyboard focus and readable contrast.

## 1. Review hover, focus and selection behaviour

Compare three restrained treatments in the actual app:

1. A subtle edge highlight.
2. A compact information strip inside the poster.
3. A refined detail overlay that obscures less artwork than the current prototype.

Review posters, cinema logos, navigation and buttons together. Assess light and dark artwork,
long titles, rapid pointer movement, keyboard focus and touch. Avoid blanket underlining,
scaling, moving controls and flickering overlays.

Present the alternatives for user review before applying the chosen treatment throughout.
The current prototype hover effects are not approved final styling. Keep the optional
single-line title beneath posters available for comparison during this review.

Acceptance: the selected treatment remains readable across responsive layouts, provides
equivalent keyboard and touch access, and causes no grid movement.

## 2. Finish the screening layout

Give Book a dedicated column. Keep format and accessibility tags beneath the cinema name,
with calendar actions positioned consistently. Keep the poster-detail sheet stable while
content loads.

Verify long venue names, multiple tags, sold-out screenings, phone widths and enlarged text.
Tags may increase a screening row's height; they must not displace its Book button within
that row. Adapt the layout to narrow screens without squeezing the venue name or action
into unreadable columns.

Acceptance: Book remains aligned with its venue, tags never overlap actions, and the sheet
fits and scrolls correctly on mobile, tablet and desktop.

## 3. Integrate the simplified nearby flow

Replace the existing nearby interface with one screen:

**Enter a postcode or use my location → choose a range → optionally uncheck cinemas → Show films.**

- Show all matching cinemas, initially selected and ordered by distance. Remove batches of
  five, a separate selection mode and additional confirmation steps.
- Preserve exclusions when adjusting the range, including when a venue temporarily falls
  outside it. Newly included venues are selected by default.
- Give clear feedback for checking a postcode, awaiting location permission, success,
  invalid input, permission denial, timeout, service failure and no matches.
- Keep feedback beside the controls without shifting them. Cancel or supersede outstanding
  requests safely so an older result cannot replace the latest location.
- Keep controls compact, with the results directly beneath them. Reflow controls on narrow
  screens and keep the selection count and Show films action easy to reach.
- Apply nearby choices as a cinema filter. Keep saved My cinemas preferences on the existing
  persistence system; a nearby search must not silently overwrite saved preferences.
- Show Edit cinemas only while My cinemas is selected.

Acceptance: the complete flow works with postcode entry and device location, with clear
recovery from errors. Applying the selection shows the matching catalogue results. Verify
guest and signed-in behaviour and all responsive layouts.

## 4. Integrate poster browsing with the real catalogue

Replace the 24-film demonstration with the same filtered and sorted results used by the list.

- Keep the List / Posters switch and small 2×2 icon, remembering the display preference.
- Default to artwork-only cards. Apply the hover treatment selected in stage 1; reveal details
  on keyboard focus and open details and screenings with one tap on touch screens.
- Preserve search, filters and sort when switching views. Keep the current film context
  where practical, without surprising jumps in the results.
- Respect existing title and rating-visibility preferences.
- Handle missing or failed artwork, reserve poster dimensions and load images efficiently.
- Use a responsive column count and consistent poster proportions. Do not add permanent
  metadata blocks beneath each poster. Keep Events as an agenda.

Acceptance: list and poster views show equivalent results; switching does not reset browsing
choices. Poster hover causes no layout shift. All information and actions remain available
on mobile and through the keyboard.

## 5. Build the landing and How to use pages

### Landing page

Lead with cinema identities and clear actions to browse films or find nearby cinemas.

- Finalise official logo assets and replace the Close-Up text placeholder.
- Review scrolling versus static presentation. Scrolling conveys breadth in less space;
  static logos make a particular cinema easier to find.
- Make each cinema entry lead to its programme and provide accessible names and asset fallbacks.
- Adapt the logo layout, heading and actions to mobile, tablet and desktop. Avoid clipped
  actions or a hero that dominates the phone viewport.
- Recommended entry behaviour: show the landing on a first unfiltered visit, remember
  dismissal, and preserve existing catalogue, bookmarked and shared links. Confirm this
  routing behaviour during the landing review before implementation.

### How to use page

Use short visual examples covering:

1. Finding a screening and booking on the cinema's website.
2. Setting up and using a watchlist.
3. Shared watchlists and choosing something to see together.
4. Setting up and using My cinemas.

Link each explanation to its real action. Verify examples against the actual account and
sharing behaviour. Keep the tone light, the guide optional and the content consistent with
the shared reading system in `docs/reading-system.md`.

On phones, stack examples in a clear reading order and avoid miniature desktop screenshots
or interactions that require hover. Keep the same information available at every size.

Acceptance: newcomers can understand the next action without completing a compulsory tour;
returning visitors can reach the catalogue directly. Both pages remain readable and usable
across responsive layouts and enlarged text.

## 6. Review the complete experience before release

Walk through first arrival, returning visits, nearby discovery, watchlist setup, shared
watchlists, poster browsing and booking on mobile, tablet and desktop.

Include a second dedicated hover review in the integrated app. Review artwork visibility,
contrast, reveal timing, pointer movement, focus, touch behaviour and consistency. This
review is required even if the initial alternatives passed; the current effects must not
be accepted simply because they already exist in the prototype.

- Check layout stability during loading, errors, selection and interaction, not just static
  screenshots. Exercise long content and multiple screening tags.
- Verify keyboard navigation, dialog focus restoration, one-tap touch behaviour, reduced
  motion, enlarged text, narrow widths and intermediate responsive breakpoints.
- Add targeted automated checks for location states, stale requests, range/exclusion
  handling, list/grid result parity and saved-preference behaviour. Reuse existing tests
  where they cover these flows.
- Run type checking, linting, relevant tests, the build and changelog validation.
- Present desktop and mobile visual evidence and clear replay steps for user review.
- Remove prototype controls, sample data, account bypasses and review-only styles from the
  production path. Add user-facing changelog entries for the final implemented scope.

Acceptance: responsive and interaction reviews are complete, the hover treatment has been
reviewed in context, and outstanding issues are resolved or explicitly recorded before
release. Merging must not be described as deployment.
