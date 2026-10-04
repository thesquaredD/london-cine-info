import { syncQueries, failedSyncQueries } from "./lib/watchlist-store";
import { readFile } from "node:fs/promises";
import { letterboxdSlug } from "../src/shared/account";
import type { Film, DataManifest } from "../src/shared/data";
import { d1 } from "./lib/d1";
import { fetchWatchlist, politeGet } from "./lib/watchlist";
const target = process.env.WATCHLIST_USER_ID || null;
if (target && !/^[a-f0-9-]{36}$/.test(target)) throw new Error("Invalid user id");
const force = process.env.WATCHLIST_FORCE === "true";
const now = Math.floor(Date.now() / 1000);
const [users] = await d1<{ id: string; letterboxd_username: string }>([
  {
    sql: `SELECT u.id,u.letterboxd_username FROM users u LEFT JOIN watchlist_sync w ON w.user_id=u.id
 WHERE u.letterboxd_username IS NOT NULL AND (? IS NULL OR u.id=?) AND (?=1 OR COALESCE(w.completed_at,0)<?)`,
    params: [target, target, force ? 1 : 0, now - 86400],
  },
]);
let failed = 0;
for (const user of users!) {
  try {
    const list = await fetchWatchlist(user.letterboxd_username, politeGet);
    await d1(syncQueries(user.id, user.letterboxd_username, list.slugs, list.count, now));
  } catch (error) {
    failed++;
    const message = error instanceof Error ? error.message : "Watchlist refresh failed";
    await d1(failedSyncQueries(user.id, user.letterboxd_username, message, now));
  }
}
// No usernames or emails in public Actions logs.
console.log(
  `Watchlists attempted: ${users!.length}; failed: ${failed}. Failed imports retain the last good list.`,
);
await d1([
  { sql: "DELETE FROM auth_tokens WHERE expires_at<?", params: [now] },
  { sql: "DELETE FROM sessions WHERE expires_at<?", params: [now] },
  { sql: "DELETE FROM rate_limits WHERE expires_at<?", params: [now] },
]);
if (failed) process.exitCode = 1;

// Track the first absent day daily. A brief absence clears when a film returns;
// a 30-day absence remains until the next digest alerts the user again.
const manifest = JSON.parse(await readFile("src/generated/manifest.json", "utf8")) as DataManifest;
const films = JSON.parse(await readFile(`public${manifest.films}`, "utf8")) as Film[];
const present = JSON.stringify([
  ...new Set(
    films
      .filter((film) => film.sc.length)
      .map((film) => letterboxdSlug(film.ra.lb?.url))
      .filter(Boolean),
  ),
]);
await d1([
  {
    sql: "UPDATE alerts_sent SET absent_since=COALESCE(absent_since,?) WHERE slug NOT IN (SELECT value FROM json_each(?))",
    params: [now, present],
  },
  {
    sql: "UPDATE alerts_sent SET last_screening_at=?,absent_since=CASE WHEN absent_since>? THEN NULL ELSE absent_since END WHERE slug IN (SELECT value FROM json_each(?))",
    params: [now, now - 30 * 86400, present],
  },
]);
