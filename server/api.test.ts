import { digestAlertQuery } from "../scripts/lib/digest-store";
import type { DigestFilm } from "../scripts/lib/digest";
import { syncQueries, failedSyncQueries } from "../scripts/lib/watchlist-store";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { onRequest } from "../functions/api/[[path]]";
import type { Env } from "./types";
import { IMPORT_ERRORS, IMPORT_TIMEOUT, type Account, type Watchlist } from "../src/shared/account";
import { hash } from "./security";
let runtime: Miniflare, env: Env;
beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ["DB"],
      kvNamespaces: ["RATE_LIMITS"],
      compatibilityDate: "2026-10-02",
    }),
  );
  env = {
    DB: (await runtime.getD1Database("DB")) as unknown as D1Database,
    RATE_LIMITS: (await runtime.getKVNamespace("RATE_LIMITS")) as unknown as KVNamespace,
    SITE_URL: "https://public.example",
    RESEND_FROM: "test@example.com",
    DEV_MAGIC_LINK: "1",
  };
  const sql = (
    await Promise.all(
      (await readdir("migrations")).sort().map((file) => readFile(`migrations/${file}`, "utf8")),
    )
  ).join("\n");
  for (const statement of sql
    .replace(/^--.*$/gm, "")
    .split(";")
    .filter((value) => value.trim()))
    await env.DB.prepare(statement).run();
}, 30000);
afterAll(async () => {
  await runtime.dispose();
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  origin = "http://localhost",
) {
  return onRequest({
    request: new Request(`http://localhost${path}`, {
      method,
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  } as Parameters<typeof onRequest>[0]);
}
async function signIn(email: string) {
  const sent = await request("/api/auth/request", "POST", { email });
  expect(sent.status).toBe(200);
  const link = ((await sent.json()) as { link: string }).link;
  const token = new URL(link).searchParams.get("token")!;
  const response = await request("/api/auth/verify", "POST", { token });
  expect(response.status).toBe(200);
  return { cookie: response.headers.get("Set-Cookie")!.split(";")[0]!, token };
}
it("rejects cross-origin writes and invalid request bodies", async () => {
  expect(
    (
      await request(
        "/api/auth/request",
        "POST",
        { email: "synthetic@example.com" },
        "",
        "https://evil.example",
      )
    ).status,
  ).toBe(403);
  expect((await request("/api/auth/request", "POST", { email: "invalid" })).status).toBe(400);
  expect((await request("/api/auth/request", "POST", { email: "x".repeat(5000) })).status).toBe(
    413,
  );
});
it("magic links are hashed, expire and are redeemed once under concurrent requests", async () => {
  const { cookie, token } = await signIn("once@example.com");
  expect((await request("/api/auth/verify", "POST", { token })).status).toBe(400);
  const me = await request("/api/me", "GET", undefined, cookie);
  expect(((await me.json()) as { user: { email: string } }).user.email).toBe("once@example.com");
  expect(me.headers.get("Cache-Control")).toBe("no-store");
  const sessions = await env.DB.prepare("SELECT hash FROM sessions").all<{ hash: string }>();
  expect(sessions.results.some((row) => row.hash === cookie.split("=")[1])).toBe(false);
  const sent = await request("/api/auth/request", "POST", { email: "concurrent@example.com" });
  const concurrentToken = new URL(((await sent.json()) as { link: string }).link).searchParams.get(
    "token",
  )!;
  const attempts = await Promise.all([
    request("/api/auth/verify", "POST", { token: concurrentToken }),
    request("/api/auth/verify", "POST", { token: concurrentToken }),
  ]);
  expect(attempts.map((response) => response.status).sort()).toEqual([200, 400]);
  const expired = await request("/api/auth/request", "POST", { email: "expired@example.com" });
  const expiredToken = new URL(((await expired.json()) as { link: string }).link).searchParams.get(
    "token",
  )!;
  await env.DB.prepare("UPDATE auth_tokens SET expires_at=1 WHERE hash=?")
    .bind(await hash(expiredToken))
    .run();
  expect((await request("/api/auth/verify", "POST", { token: expiredToken })).status).toBe(400);
});
it("settings validate, refresh is throttled, username changes clear old data and deletion cascades", async () => {
  const { cookie } = await signIn("settings@example.com");
  expect((await request("/api/me", "PUT", { username: "../bad" }, cookie)).status).toBe(400);
  expect((await request("/api/me", "PUT", { digestWeekday: 8 }, cookie)).status).toBe(400);
  expect(
    (await request("/api/me", "PUT", { username: "synthetic", digestWeekday: 3 }, cookie)).status,
  ).toBe(200);
  const { user } = (await (await request("/api/me", "GET", undefined, cookie)).json()) as {
    user: { id: string };
  };
  await env.DB.prepare("INSERT INTO watchlist_items(user_id,slug,added_at) VALUES (?, ?, 1)")
    .bind(user.id, "invented-film")
    .run();
  expect(
    (
      (await (await request("/api/watchlist", "GET", undefined, cookie)).json()) as {
        slugs: string[];
      }
    ).slugs,
  ).toEqual(["invented-film"]);
  expect((await request("/api/watchlist/refresh", "POST", {}, cookie)).status).toBe(202);
  // A queued import blocks duplicates before the hourly limit is consulted.
  expect((await request("/api/watchlist/refresh", "POST", {}, cookie)).status).toBe(409);
  expect((await request("/api/me", "PUT", { username: "other-synthetic" }, cookie)).status).toBe(
    200,
  );
  expect(
    (
      (await (await request("/api/watchlist", "GET", undefined, cookie)).json()) as {
        slugs: string[];
      }
    ).slugs,
  ).toEqual([]);
  expect((await request("/api/me", "DELETE", {}, cookie)).status).toBe(200);
  for (const table of ["users", "sessions", "watchlist_items", "watchlist_sync"])
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM ${table} WHERE ${table === "users" ? "id" : "user_id"}=?`,
      )
        .bind(user.id)
        .first("count"),
    ).toBe(0);
  expect((await request("/api/watchlist", "GET", undefined, cookie)).status).toBe(401);
});
it("logout revokes the session; unsubscribe works while signed out", async () => {
  const { cookie } = await signIn("unsubscribe@example.com");
  const user = await env.DB.prepare("SELECT id,unsubscribe_token FROM users WHERE email=?")
    .bind("unsubscribe@example.com")
    .first<{ id: string; unsubscribe_token: string }>();
  await env.DB.prepare("UPDATE users SET digest_weekday=3 WHERE id=?").bind(user!.id).run();
  expect((await request("/api/auth/logout", "POST", {}, cookie)).status).toBe(200);
  expect(
    ((await (await request("/api/me", "GET", undefined, cookie)).json()) as { user: null }).user,
  ).toBeNull();
  expect(
    (await request("/api/unsubscribe", "POST", { token: user!.unsubscribe_token })).status,
  ).toBe(200);
  expect(
    await env.DB.prepare("SELECT digest_weekday FROM users WHERE id=?")
      .bind(user!.id)
      .first("digest_weekday"),
  ).toBeNull();
});
it("cannot expose development magic links on public hosts", async () => {
  const response = await onRequest({
    request: new Request("https://public.example/api/auth/request", {
      method: "POST",
      headers: { Origin: "https://public.example" },
      body: JSON.stringify({ email: "noleak@example.com" }),
    }),
    env,
  } as Parameters<typeof onRequest>[0]);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("link");
});

it("sync swaps complete snapshots, keeps stale lists and rejects late results for changed/deleted accounts", async () => {
  const { cookie } = await signIn("snapshot@example.com");
  await request("/api/me", "PUT", { username: "synthetic-snapshot" }, cookie);
  const { user } = (await (await request("/api/me", "GET", undefined, cookie)).json()) as {
    user: { id: string };
  };
  const apply = (queries: ReturnType<typeof syncQueries>) =>
    env.DB.batch(queries.map((q) => env.DB.prepare(q.sql).bind(...(q.params ?? []))));
  await apply(syncQueries(user.id, "synthetic-snapshot", ["first", "second"], 2, 100));
  await apply(failedSyncQueries(user.id, "synthetic-snapshot", "Markup changed", 101));
  const stale = (await (await request("/api/watchlist", "GET", undefined, cookie)).json()) as {
    slugs: string[];
    stale: boolean;
    count: number;
  };
  expect(stale).toMatchObject({ slugs: ["first", "second"], stale: true, count: 2 });
  await apply(syncQueries(user.id, "synthetic-snapshot", [], 0, 102));
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM watchlist_items WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
  await request("/api/me", "PUT", { username: "synthetic-changed" }, cookie);
  await apply(syncQueries(user.id, "synthetic-snapshot", ["late"], 1, 103));
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM watchlist_items WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
  await request("/api/me", "DELETE", {}, cookie);
  await apply(syncQueries(user.id, "synthetic-changed", ["deleted"], 1, 104));
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM watchlist_items WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
});

it("reports the import lifecycle: queued, importing, completed, failed codes, stalled jobs and refunds", async () => {
  const { cookie } = await signIn("lifecycle@example.com");
  const me = async () =>
    ((await (await request("/api/me", "GET", undefined, cookie)).json()) as { user: Account }).user;
  const list = async () =>
    (await (await request("/api/watchlist", "GET", undefined, cookie)).json()) as Watchlist;
  expect((await request("/api/watchlist/refresh", "POST", {}, cookie)).status).toBe(400);
  await request("/api/me", "PUT", { username: "synthetic-cycle" }, cookie);
  const idle = await me();
  expect(idle.sync).toMatchObject({ state: "idle", error: null, retryAt: null });
  expect(idle.pending).toBe(false);
  expect((await request("/api/watchlist/refresh", "POST", {}, cookie)).status).toBe(202);
  const queued = await me();
  expect(queued.sync).toMatchObject({ state: "queued", startedAt: null, error: null });
  expect(queued.pending).toBe(true);
  expect(queued.sync?.retryAt).toBe((queued.sync?.requestedAt ?? 0) + 3600);
  const row = await env.DB.prepare("SELECT attempt_id FROM watchlist_sync WHERE user_id=?")
    .bind(idle.id)
    .first<{ attempt_id: string }>();
  // The Actions importer claims the queued job.
  await env.DB.prepare("UPDATE watchlist_sync SET started_at=? WHERE user_id=?")
    .bind(Math.floor(Date.now() / 1000), idle.id)
    .run();
  expect((await me()).sync?.state).toBe("importing");
  expect((await list()).sync?.state).toBe("importing");
  const apply = (queries: ReturnType<typeof syncQueries>) =>
    env.DB.batch(queries.map((q) => env.DB.prepare(q.sql).bind(...(q.params ?? []))));
  const stamp = Math.floor(Date.now() / 1000);
  await apply(syncQueries(idle.id, "synthetic-cycle", ["one", "two"], 2, stamp, row!.attempt_id));
  const completed = await me();
  expect(completed).toMatchObject({ count: 2, stale: false, pending: false, fetchedAt: stamp });
  expect(completed.sync).toMatchObject({ state: "completed", error: null });
  await apply(
    failedSyncQueries(idle.id, "synthetic-cycle", "not_found", stamp + 1, row!.attempt_id),
  );
  const failed = await list();
  expect(failed).toMatchObject({ slugs: ["one", "two"], stale: true, count: 2 });
  expect(failed.sync).toMatchObject({ state: "failed", error: IMPORT_ERRORS.not_found });
  // Unknown codes never leak raw messages.
  await apply(
    failedSyncQueries(idle.id, "synthetic-cycle", "TypeError: boom", stamp + 2, row!.attempt_id),
  );
  expect((await list()).sync?.error).toBe(IMPORT_ERRORS.internal);
  // A job that never finishes is reported as failed after the timeout and can be re-queued.
  await env.DB.prepare(
    "UPDATE watchlist_sync SET requested_at=?,started_at=?,completed_at=NULL,error=NULL WHERE user_id=?",
  )
    .bind(stamp - IMPORT_TIMEOUT - 10, stamp - IMPORT_TIMEOUT - 5, idle.id)
    .run();
  const stalled = await me();
  expect(stalled.pending).toBe(false);
  expect(stalled.sync).toMatchObject({ state: "failed", error: IMPORT_ERRORS.stalled });
  await env.DB.prepare("DELETE FROM rate_limits").run();
  expect((await request("/api/watchlist/refresh", "POST", {}, cookie)).status).toBe(202);
  expect((await me()).sync?.state).toBe("queued");
  // A failed dispatch records the failure and refunds the hourly reservation.
  await env.DB.prepare("UPDATE watchlist_sync SET completed_at=?,error='dispatch' WHERE user_id=?")
    .bind(stamp + 3, idle.id)
    .run();
  const dispatch = await me();
  expect(dispatch.sync).toMatchObject({
    state: "failed",
    error: IMPORT_ERRORS.dispatch,
    retryAt: null,
  });
  // Changing usernames discards the old sync state entirely.
  await request("/api/me", "PUT", { username: "synthetic-other" }, cookie);
  expect((await me()).sync?.state).toBe("idle");
  expect((await list()).slugs).toEqual([]);
});

it("digest alerts store each film's announced epoch and cannot recreate a deleted account", async () => {
  const { cookie } = await signIn("digest-store@example.com");
  const { user } = (await (await request("/api/me", "GET", undefined, cookie)).json()) as {
    user: { id: string };
  };
  const apply = (entries: Pick<DigestFilm, "slug" | "lastScreeningAt">[], now: number) => {
    const query = digestAlertQuery(user.id, entries as DigestFilm[], now);
    return env.DB.prepare(query.sql)
      .bind(...query.params!)
      .run();
  };
  await apply(
    [
      { slug: "first", lastScreeningAt: 200 },
      { slug: "second", lastScreeningAt: 300 },
    ],
    100,
  );
  expect(
    (
      await env.DB.prepare(
        "SELECT slug,sent_at,last_screening_at FROM alerts_sent WHERE user_id=? ORDER BY slug",
      )
        .bind(user.id)
        .all()
    ).results,
  ).toEqual([
    { slug: "first", sent_at: 100, last_screening_at: 200 },
    { slug: "second", sent_at: 100, last_screening_at: 300 },
  ]);
  await env.DB.prepare("UPDATE alerts_sent SET absent_since=1 WHERE user_id=?").bind(user.id).run();
  await apply([{ slug: "first", lastScreeningAt: 400 }], 150);
  expect(
    await env.DB.prepare(
      "SELECT sent_at,last_screening_at,absent_since FROM alerts_sent WHERE user_id=? AND slug='first'",
    )
      .bind(user.id)
      .first(),
  ).toEqual({ sent_at: 150, last_screening_at: 400, absent_since: null });
  await request("/api/me", "DELETE", undefined, cookie);
  await apply([{ slug: "late", lastScreeningAt: 500 }], 160);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM alerts_sent WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
});
