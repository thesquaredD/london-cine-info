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
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const path = new URL(request.url).pathname,
      method = request.method;
    if (!["GET", "POST", "PUT", "DELETE"].includes(method))
      return json({ error: "Method not allowed" }, 405);
    if (method !== "GET" && !sameOrigin(request))
      return json({ error: "Request origin rejected" }, 403);
    if (Number(request.headers.get("Content-Length") ?? 0) > 4096)
      return json({ error: "Request too large" }, 413);
    let body: Record<string, unknown> = {};
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const raw = await request.text();
      if (raw.length > 4096) return json({ error: "Request too large" }, 413);
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
          "INSERT INTO sessions(hash,user_id,expires_at) SELECT ?,user_id,? FROM auth_tokens WHERE hash=? AND expires_at>?",
        ).bind(sessionHash, now() + SESSION_SECONDS, authHash, now()),
        env.DB.prepare("DELETE FROM auth_tokens WHERE hash=?").bind(authHash),
      ]);
      if (!result[0]?.meta.changes)
        return json(
          { error: "This sign-in link has expired or was already used. Request a new one." },
          400,
        );
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(rawSession) });
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
    if (path === "/api/auth/logout" && method === "POST") {
      await env.DB.prepare("DELETE FROM sessions WHERE hash=?").bind(sessionHash).run();
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (path === "/api/me" && method === "DELETE") {
      await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run();
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
      return json({ ok: true }, 202);
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof RateLimit)
      return json({ error: error.message }, 429, { "Retry-After": String(error.seconds) });
    return json({ error: "The request could not be completed. Please try again later." }, 500);
  }
};
