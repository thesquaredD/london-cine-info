import {
  sendAnalytics,
  requestAnalyticsEnabled,
  requestAnalyticsId,
  requestAnalyticsContext,
} from "../../server/analytics";
import type { AnalyticsEvent, AnalyticsProperties } from "../../src/shared/analytics";
import { friendsApi } from "../../server/friends";
import { publicWatchlistApi } from "../../server/public-watchlists";
import {
  validCalendarInput,
  screeningKey,
  type CalendarScreening,
} from "../../src/shared/calendar";
import { calendarFile } from "../../src/shared/ical";
import type { Env, User } from "../../server/types";
import {
  hash,
  token,
  localDevelopment,
  sameOrigin,
  sessionCookie,
  SESSION_SECONDS,
} from "../../server/security";
import { sendEmail } from "../../server/email";
import {
  IMPORT_TIMEOUT,
  safeImportError,
  type Account,
  type SyncStatus,
} from "../../src/shared/account";
const now = () => Math.floor(Date.now() / 1000);
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
function syncStatus(user: User): SyncStatus {
  const activity = Math.max(user.requested_at ?? 0, user.started_at ?? 0);
  const pending = activity > (user.completed_at ?? 0);
  const stalled = pending && activity < now() - IMPORT_TIMEOUT;
  return {
    state:
      stalled || (!pending && user.error)
        ? "failed"
        : pending
          ? user.started_at
            ? "importing"
            : "queued"
          : user.fetched_at
            ? "completed"
            : "idle",
    requestedAt: user.requested_at,
    startedAt: user.started_at,
    completedAt: user.completed_at,
    // A failed dispatch refunds the hourly manual-refresh reservation.
    retryAt:
      user.requested_at && !(!pending && user.error === "dispatch")
        ? user.requested_at + 3600
        : null,
    error: stalled ? safeImportError("stalled") : pending ? null : safeImportError(user.error),
  };
}
function account(user: User): Account {
  const sync = syncStatus(user);
  return {
    id: user.id,
    email: user.email,
    appUsername: user.app_username,
    friendsDigest: !!user.friends_digest,
    username: user.letterboxd_username,
    digestWeekday: user.digest_weekday,
    fetchedAt: user.fetched_at,
    count: user.count_parsed ?? 0,
    stale: sync.state === "failed" || (!!user.fetched_at && user.fetched_at < now() - 2 * 86400),
    pending: sync.state === "queued" || sync.state === "importing",
    sync,
  };
}
class RateLimit extends Error {
  constructor(public seconds: number) {
    super("Too many requests. Please try again when the cooldown ends.");
  }
}
async function quota(env: Env, key: string, limit: number, seconds: number) {
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?)
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
 expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count,expires_at`,
  )
    .bind(await hash(key), now() + seconds, now(), now())
    .first<{ count: number; expires_at: number }>();
  if (!row || row.count > limit)
    throw new RateLimit(Math.max(1, (row?.expires_at ?? now() + seconds) - now()));
  return true;
}
async function userFor(
  request: Request,
  env: Env,
): Promise<{ user: User; sessionHash: string; rawSession: string } | null> {
  const value = /(?:^|;\s*)__Host-session=([a-f0-9]{64})(?:;|$)/.exec(
    request.headers.get("Cookie") ?? "",
  )?.[1];
  if (!value) return null;
  const sessionHash = await hash(value);
  const user = await env.DB.prepare(
    `SELECT u.*,w.fetched_at,w.count_parsed,w.error,w.requested_at,w.completed_at,w.started_at,w.attempt_id
 FROM sessions s JOIN users u ON s.user_id=u.id LEFT JOIN watchlist_sync w ON w.user_id=u.id
 WHERE s.hash=? AND s.expires_at>?`,
  )
    .bind(sessionHash, now())
    .first<User>();
  return user ? { user, sessionHash, rawSession: value } : null;
}
async function dispatch(env: Env, user: User) {
  const response = await fetch(
    "https://api.github.com/repos/thesquaredD/london-cine-info/actions/workflows/refresh.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "London-Cine-Info",
      },
      body: JSON.stringify({ ref: "main", inputs: { user_id: user.id, force: "true" } }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error("Refresh could not be scheduled");
}
const handleRequest: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const track = (event: AnalyticsEvent, id: string, properties: AnalyticsProperties = {}) => {
    const enabled =
      requestAnalyticsEnabled(request, env.POSTHOG_ENABLED) &&
      request.headers.get("X-Analytics-Enabled") !== "0";
    if (!enabled) return;
    const delivery = sendAnalytics(true, id, event, {
      ...requestAnalyticsContext(request),
      ...properties,
    });
    if (waitUntil) waitUntil(delivery);
  };
  try {
    const path = new URL(request.url).pathname,
      method = request.method;
    if (!["GET", "POST", "PUT", "DELETE"].includes(method))
      return json({ error: "Method not allowed" }, 405);
    if (method !== "GET" && !sameOrigin(request))
      return json({ error: "Request origin rejected" }, 403);
    const bodyLimit =
      path === "/api/friends/matches"
        ? 1_300_000
        : path === "/api/cinemas"
          ? 180_000
          : path === "/api/calendar"
            ? 12000
            : 4096;
    if (Number(request.headers.get("Content-Length") ?? 0) > bodyLimit)
      return json({ error: "Request too large" }, 413);
    let body: Record<string, unknown> = {};
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const raw = await request.text();
      if (raw.length > bodyLimit) return json({ error: "Request too large" }, 413);
      try {
        body = raw ? JSON.parse(raw) : {};
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json({ error: "Invalid request" }, 400);
      } catch {
        return json({ error: "Invalid request" }, 400);
      }
    }
    if (path === "/api/auth/request" && method === "POST") {
      const dev = localDevelopment(request, env.DEV_MAGIC_LINK);
      if (!dev && !env.RESEND_API_KEY)
        return json({ error: "Sign-in email is not configured yet" }, 503);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return json({ error: "Enter a valid email address" }, 400);
      const ip = request.headers.get("CF-Connecting-IP") ?? "local";
      if (
        !(await quota(env, `auth-ip:${ip}`, 10, 3600)) ||
        !(await quota(env, `auth-email:${email}`, 3, 900)) ||
        !(await quota(env, "email-daily", 90, 86400))
      )
        return json({ error: "Too many requests. Please try again later." }, 429);
      await env.DB.prepare(
        "INSERT INTO users(id,email,unsubscribe_token,created_at) VALUES (?,?,?,?) ON CONFLICT(email) DO NOTHING",
      )
        .bind(crypto.randomUUID(), email, token(), now())
        .run();
      const user = await env.DB.prepare("SELECT id FROM users WHERE email=?")
        .bind(email)
        .first<{ id: string }>();
      const rawToken = token(),
        tokenHash = await hash(rawToken);
      await env.DB.prepare("INSERT INTO auth_tokens(hash,user_id,expires_at) VALUES (?,?,?)")
        .bind(tokenHash, user!.id, now() + 900)
        .run();
      const base = dev ? new URL(request.url).origin : env.SITE_URL;
      const link = `${base}/auth/verify?token=${rawToken}`;
      try {
        if (!dev)
          await sendEmail(
            env.RESEND_API_KEY!,
            env.RESEND_FROM,
            email,
            "Sign in to London Ciné Info",
            `Use this link to sign in (expires in 15 minutes):\n\n${link}\n\nIf you did not request this, ignore this email.`,
            tokenHash,
          );
      } catch {
        await env.DB.prepare("DELETE FROM auth_tokens WHERE hash=?").bind(tokenHash).run();
        return json({ error: "Email could not be sent. Please try later." }, 503);
      }
      track("sign_in_requested", requestAnalyticsId(request) ?? `account:${user!.id}`);
      return json({ ok: true, ...(dev ? { link } : {}) });
    }
    // Confirmation POST keeps email scanners from consuming single-use links.
    if (path === "/api/auth/verify" && method === "POST") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
        return json({ error: "Invalid sign-in link" }, 400);
      const authHash = await hash(body.token),
        rawSession = token(),
        sessionHash = await hash(rawSession);
      const result = await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO sessions(hash,user_id,expires_at) SELECT ?,user_id,? FROM auth_tokens WHERE hash=? AND expires_at>? RETURNING user_id",
        ).bind(sessionHash, now() + SESSION_SECONDS, authHash, now()),
        env.DB.prepare(
          "UPDATE users SET analytics_signup_completed=1 WHERE analytics_signup_completed=0 AND id=(SELECT user_id FROM sessions WHERE hash=?)",
        ).bind(sessionHash),
        env.DB.prepare("DELETE FROM auth_tokens WHERE hash=?").bind(authHash),
      ]);
      if (!result[0]?.meta.changes)
        return json(
          { error: "This sign-in link has expired or was already used. Request a new one." },
          400,
        );
      const userId = (result[0]!.results[0] as { user_id: string }).user_id;
      track("sign_in_verified", `account:${userId}`);
      if (result[1]?.meta.changes) track("signup_completed", `account:${userId}`);
      return json({ ok: true, userId }, 200, { "Set-Cookie": sessionCookie(rawSession) });
    }
    if (path === "/api/unsubscribe" && method === "POST") {
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
        return json({ error: "Invalid unsubscribe link" }, 400);
      const result = await env.DB.prepare(
        "UPDATE users SET digest_weekday=NULL WHERE unsubscribe_token=?",
      )
        .bind(body.token)
        .run();
      return result.meta.changes
        ? json({ ok: true })
        : json({ error: "Invalid unsubscribe link" }, 400);
    }
    if (path === "/api/watchlists/public" && method === "POST")
      return publicWatchlistApi(body, env, request.headers.get("CF-Connecting-IP") ?? "local");
    const auth = await userFor(request, env);
    if (path === "/api/me" && method === "GET") {
      if (!auth) return json({ user: null });
      await env.DB.prepare("UPDATE sessions SET expires_at=? WHERE hash=?")
        .bind(now() + SESSION_SECONDS, auth.sessionHash)
        .run();
      return json({ user: account(auth.user) }, 200, {
        "Set-Cookie": sessionCookie(auth.rawSession),
      });
    }
    if (!auth) return json({ error: "Please sign in" }, 401);
    const { user, sessionHash } = auth;
    if (path.startsWith("/api/friends")) {
      if (["/api/friends", "/api/friends/profile"].includes(path) && method !== "GET")
        await quota(env, `friends:${user.id}`, 120, 3600);
      const response = await friendsApi(path, method, body, user, env, (event, properties) =>
        track(event, `account:${user.id}`, properties),
      );
      if (response) return response;
    }
    if (path === "/api/cinemas" && ["GET", "PUT", "POST"].includes(method)) {
      if (method !== "GET") {
        if (
          !Array.isArray(body.venues) ||
          body.venues.length > 1000 ||
          !body.venues.every(
            (id: unknown) => typeof id === "string" && /^[a-zA-Z0-9._:-]{1,160}$/.test(id),
          )
        )
          return json({ error: "Choose valid cinemas (up to 1000)." }, 400);
        const venues = JSON.stringify([...new Set(body.venues)]);
        await env.DB.prepare("INSERT OR IGNORE INTO cinema_preferences(user_id) VALUES (?)")
          .bind(user.id)
          .run();
        if (method === "PUT") {
          if (!Number.isInteger(body.version) || Number(body.version) < 0)
            return json({ error: "Reload your saved cinemas and try again." }, 400);
          const updated = await env.DB.prepare(
            "UPDATE cinema_preferences SET venues=?,version=version+1 WHERE user_id=? AND version=?",
          )
            .bind(venues, user.id, body.version)
            .run();
          if (!updated.meta.changes)
            return json(
              { error: "Your cinemas changed on another device. Reload them before saving." },
              409,
            );
        } else {
          if (typeof body.browserId !== "string" || !/^[a-f0-9-]{36}$/.test(body.browserId))
            return json({ error: "Invalid browser preferences." }, 400);
          // The receipt and union commit together, so removals can never be undone by retries.
          await env.DB.batch([
            env.DB.prepare(
              `UPDATE cinema_preferences SET venues=(SELECT json_group_array(value) FROM
              (SELECT DISTINCT value FROM json_each(cinema_preferences.venues) UNION SELECT value FROM json_each(?))),version=version+1
              WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM cinema_reconciliations WHERE user_id=? AND browser_id=?)`,
            ).bind(venues, user.id, user.id, body.browserId),
            env.DB.prepare(
              "INSERT OR IGNORE INTO cinema_reconciliations(user_id,browser_id) VALUES (?,?)",
            ).bind(user.id, body.browserId),
          ]);
        }
      }
      const prefs = await env.DB.prepare(
        "SELECT venues,version FROM cinema_preferences WHERE user_id=?",
      )
        .bind(user.id)
        .first<{ venues: string; version: number }>();
      return json({ venues: prefs ? JSON.parse(prefs.venues) : [], version: prefs?.version ?? 0 });
    }
    if (path === "/api/calendar" && ["GET", "POST", "DELETE"].includes(method)) {
      if (method === "POST") {
        if (!validCalendarInput(body.screening))
          return json(
            { error: "This screening could not be saved. Reload its details and try again." },
            400,
          );
        const input = body.screening;
        const id = await hash(screeningKey(input));
        const screening: CalendarScreening = { ...input, id };
        const saved = await env.DB.prepare(
          "INSERT INTO saved_screenings(user_id,id,start_at,payload) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM saved_screenings WHERE user_id=? AND id=?) OR (SELECT COUNT(*) FROM saved_screenings WHERE user_id=?) < 1000 ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload",
        )
          .bind(user.id, id, input.start, JSON.stringify(screening), user.id, id, user.id)
          .run();
        if (!saved.meta.changes)
          return json(
            {
              error:
                "Your calendar has reached 1,000 screenings. Remove a screening before adding another.",
            },
            400,
          );
        return json({ screening });
      }
      if (method === "DELETE") {
        if (typeof body.id !== "string" || !/^[a-f0-9]{64}$/.test(body.id))
          return json({ error: "Choose a saved screening to remove." }, 400);
        await env.DB.prepare("DELETE FROM saved_screenings WHERE user_id=? AND id=?")
          .bind(user.id, body.id)
          .run();
        return json({ ok: true });
      }
      const rows = await env.DB.prepare(
        "SELECT payload FROM saved_screenings WHERE user_id=? ORDER BY start_at,id",
      )
        .bind(user.id)
        .all<{ payload: string }>();
      return json({ screenings: rows.results.map((row) => JSON.parse(row.payload)) });
    }
    if (path === "/api/calendar/export" && method === "GET") {
      const id = new URL(request.url).searchParams.get("id");
      if (id && !/^[a-f0-9]{64}$/.test(id))
        return json({ error: "Choose a saved screening to export." }, 400);
      const rows = await env.DB.prepare(
        id
          ? "SELECT payload FROM saved_screenings WHERE user_id=? AND id=?"
          : "SELECT payload FROM saved_screenings WHERE user_id=? ORDER BY start_at,id",
      )
        .bind(...(id ? [user.id, id] : [user.id]))
        .all<{ payload: string }>();
      if (id && !rows.results.length)
        return json({ error: "That screening is no longer in your calendar." }, 404);
      return new Response(
        calendarFile(
          rows.results.map((row) => JSON.parse(row.payload)),
          Date.now(),
        ),
        {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="london-screenings.ics"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    if (path === "/api/auth/logout" && method === "POST") {
      await env.DB.prepare("DELETE FROM sessions WHERE hash=?").bind(sessionHash).run();
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (path === "/api/me" && method === "DELETE") {
      await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run();
      track("account_deleted", `account:${user.id}`);
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (path === "/api/me" && method === "PUT") {
      const username =
        body.username === undefined
          ? user.letterboxd_username
          : typeof body.username === "string"
            ? body.username.trim() || null
            : null;
      if (body.username !== undefined && typeof body.username !== "string")
        return json({ error: "Invalid Letterboxd username" }, 400);
      if (username && !/^[a-zA-Z0-9_-]{1,30}$/.test(username))
        return json({ error: "Enter a Letterboxd username, not a URL" }, 400);
      const day = body.digestWeekday === undefined ? user.digest_weekday : body.digestWeekday;
      if (day !== null && (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6))
        return json({ error: "Invalid digest day" }, 400);
      const changed = username?.toLowerCase() !== user.letterboxd_username?.toLowerCase();
      if (changed && !(await quota(env, `username:${user.id}`, 5, 3600)))
        return json({ error: "Please wait before changing usernames again" }, 429);
      const statements = [
        env.DB.prepare("UPDATE users SET letterboxd_username=?,digest_weekday=? WHERE id=?").bind(
          username,
          username ? day : null,
          user.id,
        ),
      ];
      if (changed)
        for (const table of ["watchlist_items", "watchlist_sync", "alerts_sent"])
          statements.push(env.DB.prepare(`DELETE FROM ${table} WHERE user_id=?`).bind(user.id));
      await env.DB.batch(statements);
      if (changed)
        track(username ? "watchlist_connected" : "watchlist_disconnected", `account:${user.id}`, {
          connected: !!username,
        });
      const nextDay = username ? day : null;
      if (nextDay !== user.digest_weekday)
        track("digest_preference_changed", `account:${user.id}`, {
          enabled: nextDay !== null,
          weekday: nextDay as number | null,
        });
      return json({ ok: true });
    }
    if (path === "/api/watchlist" && method === "GET") {
      const items = await env.DB.prepare(
        "SELECT slug FROM watchlist_items WHERE user_id=? ORDER BY slug",
      )
        .bind(user.id)
        .all<{ slug: string }>();
      return json({
        username: user.letterboxd_username,
        sync: syncStatus(user),
        slugs: items.results.map((item) => item.slug),
        fetchedAt: user.fetched_at,
        count: user.count_parsed ?? 0,
        stale: account(user).stale,
      });
    }
    if (path === "/api/watchlist/refresh" && method === "POST") {
      if (!user.letterboxd_username) return json({ error: "Set a Letterboxd username first" }, 400);
      if (!env.GITHUB_DISPATCH_TOKEN && !localDevelopment(request, env.DEV_MAGIC_LINK))
        return json(
          { error: "Manual refresh is not configured yet; daily sync will run automatically" },
          503,
        );
      if (account(user).pending)
        return json(
          { error: "An import is already queued or running. Please wait for it to finish." },
          409,
        );
      if (!(await quota(env, `refresh:${user.id}`, 1, 3600)))
        return json({ error: "Refresh is available once per hour" }, 429);
      const attempt = crypto.randomUUID();
      // Reserve the job atomically, guarding against settings changes and another importer.
      const reserved = await env.DB.prepare(
        `INSERT INTO watchlist_sync(user_id,requested_at,started_at,error,attempt_id)
         SELECT id,?,NULL,NULL,? FROM users WHERE id=? AND letterboxd_username=?
         ON CONFLICT(user_id) DO UPDATE SET requested_at=excluded.requested_at,started_at=NULL,error=NULL,attempt_id=excluded.attempt_id
         WHERE MAX(COALESCE(watchlist_sync.requested_at,0),COALESCE(watchlist_sync.started_at,0))<=COALESCE(watchlist_sync.completed_at,0)
         OR COALESCE(watchlist_sync.started_at,watchlist_sync.requested_at,0)<?`,
      )
        .bind(now(), attempt, user.id, user.letterboxd_username, now() - IMPORT_TIMEOUT)
        .run();
      if (!reserved.meta.changes)
        return json(
          {
            error:
              "Account settings changed or an import is already running. Reload and try again.",
          },
          409,
        );
      try {
        if (!localDevelopment(request, env.DEV_MAGIC_LINK)) await dispatch(env, user);
      } catch {
        track("watchlist_import_failed", `account:${user.id}`, {
          failure_kind: "dispatch",
          import_kind: "manual",
          $insert_id: attempt,
        });
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE watchlist_sync SET completed_at=?,error=? WHERE user_id=? AND attempt_id=?",
          ).bind(now(), "dispatch", user.id, attempt),
          env.DB.prepare("DELETE FROM rate_limits WHERE key=?").bind(
            await hash(`refresh:${user.id}`),
          ),
        ]);
        return json(
          {
            error:
              "The import could not be queued. You can retry now; daily sync will also try again.",
          },
          503,
        );
      }
      track("watchlist_import_requested", `account:${user.id}`, {
        import_kind: "manual",
        $insert_id: attempt,
      });
      return json({ ok: true }, 202);
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof RateLimit)
      return json({ error: error.message }, 429, { "Retry-After": String(error.seconds) });
    return json({ error: "The request could not be completed. Please try again later." }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await handleRequest(context);
  const id = requestAnalyticsId(context.request);
  const endpoint = new URL(context.request.url).pathname;
  const trackedEndpoints = [
    "/api/auth/request",
    "/api/auth/verify",
    "/api/me",
    "/api/watchlist",
    "/api/watchlist/refresh",
    "/api/friends",
    "/api/friends/profile",
    "/api/friends/watchlists",
    "/api/friends/matches",
    "/api/watchlists/public",
  ];
  if (
    response.status >= 400 &&
    id &&
    trackedEndpoints.includes(endpoint) &&
    requestAnalyticsEnabled(context.request, context.env.POSTHOG_ENABLED) &&
    context.request.headers.get("X-Analytics-Enabled") !== "0"
  ) {
    const delivery = sendAnalytics(true, id, "api_request_failed", {
      ...requestAnalyticsContext(context.request),
      endpoint,
      method: context.request.method,
      status: response.status,
      failure_kind:
        response.status === 429
          ? "rate_limited"
          : response.status >= 500
            ? "unavailable"
            : "rejected",
    });
    if (context.waitUntil) context.waitUntil(delivery);
  }
  return response;
};
