import type { Env } from "./types";
import { parseWatchlist, WatchlistError } from "../scripts/lib/watchlist";
import { normalizeUsername, validLetterboxdUsername } from "../src/shared/friends";
import { safeImportError } from "../src/shared/account";
import { hash } from "./security";
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
export async function publicWatchlistApi(
  body: Record<string, unknown>,
  env: Env,
  ip: string,
): Promise<Response> {
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const page = body.page ?? 1;
  if (
    !validLetterboxdUsername(username) ||
    !Number.isInteger(page) ||
    Number(page) < 1 ||
    Number(page) > 500
  )
    return json({ error: "Enter a Letterboxd username, not a profile URL." }, 400);
  const now = Math.floor(Date.now() / 1000);
  const quota = await env.DB.prepare(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count,expires_at`,
  )
    .bind(await hash(`public-list:${ip}`), now + 3600, now, now)
    .first<{ count: number; expires_at: number }>();
  if (!quota || quota.count > 600)
    return json({ error: "Too many watchlist requests. Please try later." }, 429, {
      "Retry-After": String(Math.max(1, (quota?.expires_at ?? now + 3600) - now)),
    });
  const cached = await env.DB.prepare(
    "SELECT payload FROM public_watchlist_pages WHERE username=? AND page=? AND expires_at>?",
  )
    .bind(username, page, now)
    .first<{ payload: string }>();
  if (cached) return json({ username, page, ...JSON.parse(cached.payload) });
  // A database reservation spaces external fetch starts across Worker instances.
  const reserved = await env.DB.prepare(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES ('letterboxd-public-fetch',1,?) ON CONFLICT(key) DO UPDATE SET count=1,expires_at=excluded.expires_at WHERE expires_at<=? RETURNING count`,
  )
    .bind(now + 1, now)
    .first();
  if (!reserved)
    return json({ error: "Another watchlist is being read. Please retry shortly." }, 429, {
      "Retry-After": "1",
    });
  try {
    const response = await fetch(
      `https://letterboxd.com/${username}/watchlist/${Number(page) > 1 ? `page/${page}/` : ""}`,
      {
        headers: {
          "User-Agent":
            "London-Cine-Info/2.0 (+https://london-cine.info/about; public watchlist comparison)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new WatchlistError(
        response.status === 404
          ? "not_found"
          : response.status === 401 || response.status === 403
            ? "inaccessible"
            : "unavailable",
        "Upstream watchlist failed",
      );
    if (Number(response.headers.get("Content-Length") ?? 0) > 5_000_000)
      throw new WatchlistError("incomplete", "Response too large");
    const text = await response.text();
    if (text.length > 5_000_000) throw new WatchlistError("incomplete", "Response too large");
    const parsed = parseWatchlist(text);
    if (Number(page) > parsed.pages) throw new WatchlistError("incomplete", "Watchlist changed");
    await env.DB.prepare("DELETE FROM public_watchlist_pages WHERE expires_at<=?").bind(now).run();
    await env.DB.prepare(
      "INSERT INTO public_watchlist_pages(username,page,payload,expires_at) VALUES (?,?,?,?) ON CONFLICT(username,page) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at",
    )
      .bind(username, page, JSON.stringify(parsed), now + 3600)
      .run();
    return json({ username, page, ...parsed });
  } catch (error) {
    return json(
      { error: safeImportError(error instanceof WatchlistError ? error.code : "unavailable") },
      502,
    );
  }
}
