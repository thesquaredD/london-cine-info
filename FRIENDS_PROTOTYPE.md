# Friends and watchlists prototype

This review build extends the current app from origin/main at eecf44d. It uses the existing sidebar, account dialogs, filter toolbar, film tables, Events agenda, Radar and calendar.

Start locally:

```sh
npm ci
npm run build-data
VITE_FRIENDS_PROTOTYPE=true npm run dev -- --host 127.0.0.1 --port 4317
```

Visit http://127.0.0.1:4317.

## Review flows

1. Open Watchlists on All movies, select Alice, and apply. Navigate through New releases, Classics, Retrospectives, Events, Release calendar, Watchlist, My calendar and Radar. The selection remains active and narrows the actual results.
2. Select another list and compare All selected with Any selected. Watchlist always stays within your own films.
3. Choose Use a Letterboxd watchlist. Enter a username. It becomes a temporary list, selected automatically, available across pages and removable from the session. It does not become a friend.
4. Open Friends beside Account and Settings. Accept Maya, send a sample request, cancel it, remove a friend, or open a friend's shared films.
5. Preview the weekly email from Friends or the prototype banner. It uses actual upcoming screenings and simulated accepted-friend overlaps. Temporary lists never appear in the email. Turn shared-film email content off in Friends to compare.
6. Repeat at phone width. Friends is in the Pages drawer and Watchlists remains directly available above results.

## Prototype boundaries

- The prototype flag activates a local account adapter; requests are never forwarded to the real account service. Account changes outside this feature show an explicit unsupported-action message.
- Films, screenings, venues, filters, Events and Radar use the generated catalogue. Sample watchlist membership is deterministic and intentionally simulated. Any valid temporary handle receives sample matches; there is no Letterboxd lookup.
- Friends, requests, temporary lists and selections live in session storage. This is not the production persistence model for friendships.
- Friend counts refer to catalogue films. The email preview is a selection of real next-ten-day screenings, not the delivery pipeline or its deduplication logic.
- My calendar contains sample saved screenings from the real catalogue so its filter can be reviewed. Unknown saved-film IDs are excluded when a watchlist filter is active.
- No backend migrations, production friendship endpoints, actual requests, emails or deployment are included.

Before implementation, decide production request lookup and privacy rules, handling stale/unavailable watchlists, durable friendship storage, guest comparison behavior, and how temporary selections interact with shared URLs. The design currently offers friend-list filtering throughout the catalogue and exposes catalogue matches; this must be reflected in the acceptance copy and production authorization model.
