import { syncQueries, failedSyncQueries } from "../scripts/lib/watchlist-store";
import { beforeAll, afterAll, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { onRequest } from "../functions/api/[[path]]";
import type { Env } from "./types";
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
  const sql =
    (await readFile("migrations/0001_accounts.sql", "utf8")) +
    (await readFile("migrations/0002_digest_departures.sql", "utf8"));
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
  expect((await request("/api/watchlist/refresh", "POST", {}, cookie)).status).toBe(429);
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
