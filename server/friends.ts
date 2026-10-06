import type { AnalyticsEvent, AnalyticsProperties } from "../src/shared/analytics";
import type { Env, User } from "./types";
import {
  MAX_FRIENDS,
  MAX_SELECTED_WATCHLISTS,
  normalizeUsername,
  validAppUsername,
  type Friend,
  type FriendWatchlist,
} from "../src/shared/friends";
import { acceptedFriendsSql, friendMatchesSql } from "./friend-queries";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const isId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
export async function friendsApi(
  path: string,
  method: string,
  body: Record<string, unknown>,
  user: User,
  env: Env,
  track?: (event: AnalyticsEvent, properties?: AnalyticsProperties) => void,
): Promise<Response | null> {
  const now = Math.floor(Date.now() / 1000);
  if (path === "/api/friends/profile" && method === "PUT") {
    const username =
      typeof body.username === "string" ? normalizeUsername(body.username) : user.app_username;
    if (!username || !validAppUsername(username))
      return json(
        {
          error:
            "Choose an app username of 3–30 letters, numbers, underscores or hyphens, starting with a letter or number.",
        },
        400,
      );
    if (body.friendsDigest !== undefined && typeof body.friendsDigest !== "boolean")
      return json({ error: "Choose a valid email preference." }, 400);
    // The unique index arbitrates concurrent claims without replacing another user's username.
    try {
      const result = await env.DB.prepare(
        "UPDATE users SET app_username=?,friends_digest=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM users WHERE app_username=? COLLATE NOCASE AND id<>?)",
      )
        .bind(
          username,
          body.friendsDigest === undefined ? user.friends_digest : Number(body.friendsDigest),
          user.id,
          username,
          user.id,
        )
        .run();
      if (!result.meta.changes)
        return json({ error: "That username is already taken. Choose another." }, 409);
    } catch (e) {
      if (e instanceof Error && /UNIQUE constraint/.test(e.message))
        return json({ error: "That username is already taken. Choose another." }, 409);
      throw e;
    }
    if (username !== user.app_username)
      track?.("app_username_saved", { first_setup: !user.app_username });
    if (typeof body.friendsDigest === "boolean" && body.friendsDigest !== !!user.friends_digest)
      track?.("friends_digest_preference_changed", { enabled: body.friendsDigest });
    return json({ ok: true });
  }
  if (path === "/api/friends" && method === "GET") {
    const rows = await env.DB.prepare(
      `WITH relationships AS (SELECT f.*,CASE WHEN f.user_low=?1 THEN f.user_high ELSE f.user_low END AS other_id FROM friendships f WHERE f.user_low=?1 OR f.user_high=?1)
   SELECT u.id,u.app_username AS username,u.letterboxd_username AS letterboxdUsername,r.status,CASE WHEN r.requested_by=?1 THEN 'outgoing' ELSE 'incoming' END AS direction,w.fetched_at AS fetchedAt,COALESCE(w.count_parsed,0) AS count,CASE WHEN w.error IS NOT NULL OR w.fetched_at IS NULL OR w.fetched_at<?2 THEN 1 ELSE 0 END AS stale
   FROM relationships r JOIN users u ON u.id=r.other_id LEFT JOIN watchlist_sync w ON w.user_id=u.id ORDER BY u.app_username LIMIT ${MAX_FRIENDS}`,
    )
      .bind(user.id, now - 2 * 86400)
      .all<Omit<Friend, "stale"> & { stale: number }>();
    return json({
      appUsername: user.app_username,
      friendsDigest: !!user.friends_digest,
      friends: rows.results.map((r) => ({ ...r, stale: !!r.stale })),
    });
  }
  if (path === "/api/friends" && method === "POST") {
    if (!user.app_username)
      return json({ error: "Choose your app username before adding friends." }, 400);
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    if (!validAppUsername(username)) return json({ error: "Enter a valid app username." }, 400);
    const target = await env.DB.prepare("SELECT id FROM users WHERE app_username=? COLLATE NOCASE")
      .bind(username)
      .first<{ id: string }>();
    if (!target) return json({ error: "No user has that app username." }, 404);
    if (target.id === user.id) return json({ error: "Choose someone other than yourself." }, 400);
    const [low, high] = [user.id, target.id].sort() as [string, string];
    const added = await env.DB.prepare(
      `INSERT OR IGNORE INTO friendships(user_low,user_high,requested_by,status,created_at) SELECT ?,?,?,'pending',? WHERE
   (SELECT COUNT(*) FROM friendships WHERE user_low=? OR user_high=?)<${MAX_FRIENDS} AND (SELECT COUNT(*) FROM friendships WHERE user_low=? OR user_high=?)<${MAX_FRIENDS}`,
    )
      .bind(low, high, user.id, now, user.id, user.id, target.id, target.id)
      .run();
    if (!added.meta.changes)
      return json(
        {
          error:
            "A connection already exists, or one of you has reached the 1,000 connection limit.",
        },
        409,
      );
    track?.("friend_request_sent");
    return json({ ok: true }, 201);
  }
  if (path === "/api/friends" && ["PUT", "DELETE"].includes(method)) {
    if (!isId(body.id) || body.id === user.id)
      return json({ error: "Choose a valid friend request." }, 400);
    const [low, high] = [user.id, body.id].sort();
    if (method === "DELETE") {
      const removed = await env.DB.prepare(
        "DELETE FROM friendships WHERE user_low=? AND user_high=? RETURNING status,requested_by",
      )
        .bind(low, high)
        .first<{ status: string; requested_by: string }>();
      if (removed)
        track?.(
          removed.status === "accepted"
            ? "friend_removed"
            : removed.requested_by === user.id
              ? "friend_request_cancelled"
              : "friend_request_declined",
        );
      return json({ ok: true });
    }
    const result = await env.DB.prepare(
      "UPDATE friendships SET status='accepted',accepted_at=? WHERE user_low=? AND user_high=? AND status='pending' AND requested_by<>?",
    )
      .bind(now, low, high, user.id)
      .run();
    if (!result.meta.changes)
      return json(
        { error: "That incoming request is no longer available. Reload your friends." },
        409,
      );
    track?.("friend_request_accepted");
    return json({ ok: true });
  }
  if (path === "/api/friends/watchlists" && method === "POST") {
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > MAX_SELECTED_WATCHLISTS ||
      !body.ids.every(isId)
    )
      return json({ error: "Select up to 20 valid friends." }, 400);
    const rows = await env.DB.prepare(
      `WITH friend_ids AS (${acceptedFriendsSql}) SELECT u.id,u.app_username AS username,w.fetched_at AS fetchedAt,CASE WHEN w.error IS NOT NULL OR w.fetched_at IS NULL OR w.fetched_at<?2 THEN 1 ELSE 0 END AS stale,
   COALESCE((SELECT json_group_array(slug) FROM watchlist_items i WHERE i.user_id=u.id),'[]') AS slugs FROM friend_ids f JOIN users u ON u.id=f.id LEFT JOIN watchlist_sync w ON w.user_id=u.id WHERE u.id IN (SELECT value FROM json_each(?3))`,
    )
      .bind(user.id, now - 2 * 86400, JSON.stringify([...new Set(body.ids)]))
      .all<Omit<FriendWatchlist, "slugs" | "stale"> & { slugs: string; stale: number }>();
    if (rows.results.length !== new Set(body.ids).size)
      return json({ error: "A selected friendship changed. Reload your friends." }, 409);
    return json({
      watchlists: rows.results.map((r) => ({ ...r, slugs: JSON.parse(r.slugs), stale: !!r.stale })),
    });
  }
  if (path === "/api/friends/matches" && method === "POST") {
    if (
      !Array.isArray(body.slugs) ||
      body.slugs.length > 6000 ||
      !body.slugs.every((s) => typeof s === "string" && /^[a-z0-9-]{1,200}$/.test(s))
    )
      return json({ error: "Choose valid films to match." }, 400);
    const rows = await env.DB.prepare(friendMatchesSql)
      .bind(user.id, now - 2 * 86400, JSON.stringify([...new Set(body.slugs)]))
      .all<{ slug: string; count: number; usernames: string }>();
    return json({
      matches: rows.results.map((r) => ({ ...r, usernames: JSON.parse(r.usernames) })),
    });
  }
  return null;
}
