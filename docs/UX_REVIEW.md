# UX review — 4 October 2026

Scope: the catalogue, expanded screening programmes, date/facet controls, phone sheets, navigation, display settings, Radar, account/watchlist states, favourite cinemas and the new saved calendar. Reviewed the component/state code and fixture-based recorded desktop/390px browser flows. This is not a production usability study or a screen-reader audit.

## Findings resolved in this change

| Area                | Problem                                                                                        | Change                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dates               | A minus before an excluded date looked like part of the number; selection colour was weak.     | Selected dates invert foreground/background. Exclusions use strikethrough, with explicit mode, accessible labels and explanatory text. Numbers remain plain.                                                                                         |
| Phone quick filters | Nine shortcuts plus management filled multiple rows above results.                             | One Quick filters button opens a bottom sheet. Shortcuts use a two-column grid, clear pressed states and a Show films action. Escape/close restores focus. Opening cinema/account management closes the sheet first.                                 |
| Empty results       | Recovery suggestions and the table both offered empty messages/reset controls.                 | Show one recovery area with counted adjustments; suppress the duplicate table message and empty footer.                                                                                                                                              |
| Radar               | Long introductory caveats dominated the first phone screen.                                    | Keep a short introduction and section descriptions. Put coverage, freshness and qualification details in an expandable explanation.                                                                                                                  |
| Navigation          | Modifier-clicking a page link discarded filters that normal navigation retained.               | Link destinations now match in-app navigation, including filters and default sort.                                                                                                                                                                   |
| Cinema sync         | Reload guidance required closing and reopening the chooser.                                    | Reload saved choices directly into the open chooser, explicitly warning that it replaces unsaved edits. Failed saves retain choices.                                                                                                                 |
| Calendar naming     | The existing Calendar page lists film release dates, which conflicts with personal screenings. | Name it Release calendar; add a distinct My calendar page.                                                                                                                                                                                           |
| Screening plans     | Users could not keep individual screening times or export plans.                               | Each screening has Add to calendar. Guests can download an individual ICS; signed-in users can save/remove, revisit My calendar and export one screening or the full list. Show London dates, estimated ends and that saving does not book a ticket. |
| Account deletion    | The confirmation did not describe the newly saved data.                                        | Include saved screenings and favourite cinemas in deletion/privacy copy; database deletion cascades both.                                                                                                                                            |

## Behaviours retained and checked

- Search/facets, exclusions, sort and pagination have shareable URLs; shortcuts preserve unrelated choices. Cinema setup and cinema filtering remain separate actions.
- Expanded programmes load on demand, show loading/failure/retry states, distinguish sold-out screenings and booking fallback links, and retain exact UTC starts across the London clock change.
- Desktop filtering and phone sheets expose names, pressed states and keyboard controls. Shared dialogs trap focus through native modal behaviour and restore an available opener.
- Account failures do not interrupt ordinary catalogue browsing. Sign-in, import lifecycle, cooldowns, failed saves and destructive confirmation have explanatory states.
- Saved calendars stay account-scoped. Failed changes do not pretend to save/remove. Signing out or changing account hides the previous calendar. Reloading the page persists saved plans.
- Light/dark themes and 390px flows have no horizontal page overflow or application exceptions in the covered scenarios. Phone calendar actions have at least 44px height.

## Remaining product decisions

1. Saved screening details are a snapshot. Cancelled/rescheduled shows do not update automatically, and downloading an ICS is not a calendar subscription. The page/export explain this; a subscription or change-alert system would be separate work.
2. Magic-link sign-in currently returns to the watchlist page. Returning to the exact screening being saved would improve the first-save journey, but requires a validated return destination through the authentication flow.
3. Programme density can still be high for films with many screenings. A per-film cinema/day collapse could help, but should be evaluated with real usage before hiding available shows.
4. Export correctness is covered at the file level (UTC times, stable IDs, escaping and UTF-8 folding). Manual import into Apple/Google Calendar and a user visual review remain pending. Interactive production verification follows PLAN §11.5.

## Subsequent user refinements

Manage my cinemas now lives in Account. An active My cinemas filter with no
choices shows Set up my cinemas rather than all films or an automatic chooser.
The chooser shows removable selected choices above its search, with aligned
18px native checkboxes in 44px rows. Settings now contains the display controls
in its own modal. This week and Next week use adjacent rolling seven-day windows.
These requirements supersede the earlier calendar-week interpretation.

Opening sheets/sidebar use small transform/opacity entrances, and opening a film
uses a 110 ms opacity fade. The animation does not change internal layout or wait
before rendering/navigation; close is immediate. Reduced-motion preferences
suppress these animations. Existing populated cinema results remain visible
during background preference reloads.

10 October 2026: The shortcut rows and phone shortcut dialog above are superseded by the quiet, personalised shortcut strip. Search and Filters share one row; date and applicable personal shortcuts wrap beneath it. Next week and Under 2 hours remain in the Filters sheet. Implementation follows `docs/filter-strip-plan.md`.
