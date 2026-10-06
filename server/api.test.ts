import {
  queueDigestQuery,
  pendingDigestQuery,
  pruneDigestQuery,
  attemptDigestQuery,
  completeDigestQueries,
  type Delivery,
} from "../scripts/lib/digest-delivery";
import { digestAlertQuery } from "../scripts/lib/digest-store";
import type { DigestFilm } from "../scripts/lib/digest";
import { syncQueries, failedSyncQueries } from "../scripts/lib/watchlist-store";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
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

it("queued digests freeze retries, complete atomically and respect opt-out/deletion", async () => {
  const { cookie } = await signIn("digest-queue@example.com");
  await request("/api/me", "PUT", { username: "queue-test", digestWeekday: 0 }, cookie);
  const { user } = (await (await request("/api/me", "GET", undefined, cookie)).json()) as {
    user: { id: string };
  };
  const payload = {
    from: "test@example.com",
    to: ["recipient@example.com"],
    subject: "Frozen",
    text: "First version",
    html: "<p>First version</p>",
  };
  const entries = [{ slug: "frozen-film", lastScreeningAt: 3000 }] as DigestFilm[];
  const run = (q: ReturnType<typeof queueDigestQuery>) =>
    env.DB.prepare(q.sql)
      .bind(...q.params!)
      .all<Delivery>();
  const queue = (day: string, id: string, text: string) =>
    run(queueDigestQuery(user.id, "queue-test", 0, day, id, { ...payload, text }, entries, 1000));
  const first = (await queue("2026-10-04", "first-id", "First version")).results[0]!;
  const rerun = (await queue("2026-10-04", "second-id", "Changed build")).results[0]!;
  expect(rerun.payload).toBe(first.payload);
  expect(rerun.idempotency_key).toBe("digest-v3/first-id");
  const attempt = (await run(attemptDigestQuery(rerun, 0, 1100))).results[0]!;
  expect(attempt.attempted_at).toBe(1100);
  expect((await run(attemptDigestQuery(attempt, 0, 1200))).results[0]!.attempted_at).toBe(1100);
  // A failed second statement must roll back alert insertion too.
  const broken = [
    ...completeDigestQueries(attempt, 1300),
    { sql: "INSERT INTO missing_table VALUES (1)", params: [] },
  ];
  await expect(
    env.DB.batch(broken.map((q) => env.DB.prepare(q.sql).bind(...q.params!))),
  ).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM alerts_sent WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
  await env.DB.batch(
    completeDigestQueries(attempt, 1400).map((q) => env.DB.prepare(q.sql).bind(...q.params!)),
  );
  const completed = (await queue("2026-10-04", "third-id", "New template")).results[0]!;
  expect(completed).toMatchObject({ delivered_at: 1400, payload: null, announced: null });
  expect(
    await env.DB.prepare("SELECT last_screening_at FROM alerts_sent WHERE user_id=?")
      .bind(user.id)
      .first("last_screening_at"),
  ).toBe(3000);
  const next = (await queue("2026-10-11", "next-id", "Next week")).results[0]!;
  expect(next.idempotency_key).not.toBe(completed.idempotency_key);
  await request("/api/me", "PUT", { digestWeekday: null }, cookie);
  expect((await run(attemptDigestQuery(next, 0, 1500))).results).toHaveLength(0);
  await request("/api/me", "PUT", { digestWeekday: 0, username: "changed-queue" }, cookie);
  expect((await run(attemptDigestQuery(next, 0, 1600))).results).toHaveLength(0);
  // Late completion of the old watchlist doesn't reintroduce its alerts.
  await env.DB.batch(
    completeDigestQueries(next, 1700).map((q) => env.DB.prepare(q.sql).bind(...q.params!)),
  );
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM alerts_sent WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
  await request("/api/me", "DELETE", undefined, cookie);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM digest_deliveries WHERE user_id=?")
      .bind(user.id)
      .first("count"),
  ).toBe(0);
  expect((await queue("2026-10-04", "late-id", "Deleted")).results).toHaveLength(0);
});

it("an uncertain older delivery survives cleanup and blocks a later day's new send", async () => {
  const { cookie } = await signIn("digest-uncertain@example.com");
  await request("/api/me", "PUT", { username: "uncertain-test", digestWeekday: 0 }, cookie);
  const { user } = (await (await request("/api/me", "GET", undefined, cookie)).json()) as {
    user: { id: string };
  };
  const run = (q: ReturnType<typeof queueDigestQuery>) =>
    env.DB.prepare(q.sql)
      .bind(...q.params!)
      .all<Delivery>();
  const payload = {
    from: "test@example.com",
    to: ["test@example.com"],
    subject: "Frozen",
    text: "Frozen",
  };
  const queued = (
    await run(
      queueDigestQuery(
        user.id,
        "uncertain-test",
        0,
        "2026-10-04",
        "uncertain-key",
        payload,
        [],
        1000,
      ),
    )
  ).results[0]!;
  await run(attemptDigestQuery(queued, 0, 1100));
  await run(pruneDigestQuery(1100 + 8 * 86400));
  const pending = (await run(pendingDigestQuery(user.id, "2026-10-11", "uncertain-test")))
    .results[0]!;
  expect(pending.idempotency_key).toBe("digest-v3/uncertain-key");
  expect((await run(attemptDigestQuery(pending, 0, 1100 + 8 * 86400))).results).toHaveLength(0);
});

it("cinema preferences reconcile once, sync removals, guard concurrent edits and isolate accounts", async () => {
  const { cookie } = await signIn("cinemas@example.com");
  const browserId = "00000000-0000-4000-8000-000000000001";
  const merge = async (venues: string[]) =>
    request("/api/cinemas", "POST", { venues, browserId }, cookie);
  expect((await request("/api/cinemas", "PUT", { venues: [] })).status).toBe(401);
  expect(
    (await request("/api/cinemas", "POST", { venues: ["invalid/venue"], browserId }, cookie))
      .status,
  ).toBe(400);
  const first = (await (
    await merge(["bfi.org.uk", "bfi.org.uk", "princecharlescinema.com"])
  ).json()) as { venues: string[]; version: number };
  expect(first.venues.sort()).toEqual(["bfi.org.uk", "princecharlescinema.com"]);
  const removed = await request(
    "/api/cinemas",
    "PUT",
    { venues: [], version: first.version },
    cookie,
  );
  expect(removed.status).toBe(200);
  expect(((await (await merge(["bfi.org.uk"])).json()) as { venues: string[] }).venues).toEqual([]);
  expect(
    (
      await request(
        "/api/cinemas",
        "PUT",
        { venues: ["bfi.org.uk"], version: first.version },
        cookie,
      )
    ).status,
  ).toBe(409);
  const otherBrowser = await request(
    "/api/cinemas",
    "POST",
    { venues: ["new.cinema"], browserId: "00000000-0000-4000-8000-000000000002" },
    cookie,
  );
  expect(((await otherBrowser.json()) as { venues: string[] }).venues).toEqual(["new.cinema"]);
  const other = await signIn("other-cinemas@example.com");
  expect(
    (
      (await (await request("/api/cinemas", "GET", undefined, other.cookie)).json()) as {
        venues: string[];
      }
    ).venues,
  ).toEqual([]);
  const me = (await (await request("/api/me", "GET", undefined, cookie)).json()) as {
    user: Account;
  };
  expect((await request("/api/me", "DELETE", {}, cookie)).status).toBe(200);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM cinema_preferences WHERE user_id=?")
      .bind(me.user.id)
      .first("n"),
  ).toBe(0);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM cinema_reconciliations WHERE user_id=?")
      .bind(me.user.id)
      .first("n"),
  ).toBe(0);
});

it("saves deduplicated screenings per account, exports owned events and cascades deletion", async () => {
  const input = {
    filmId: "fixture",
    title: "Fixture film",
    venueId: "bfi.org.uk",
    venueName: "BFI Southbank",
    address: "London",
    start: Date.parse("2026-10-25T00:30:00Z"),
    end: null,
    bookingUrl: "https://cinema.example/booking",
    screen: null,
    notes: "Intro, Q&A",
    formats: ["35mm"],
  };
  expect((await request("/api/calendar", "POST", { screening: input })).status).toBe(401);
  const first = await signIn("calendar@example.com");
  const second = await signIn("calendar-other@example.com");
  const sent = await request("/api/calendar", "POST", { screening: input }, first.cookie);
  expect(sent.status).toBe(200);
  const { screening } = (await sent.json()) as { screening: { id: string } };
  expect((await request("/api/calendar", "POST", { screening: input }, first.cookie)).status).toBe(
    200,
  );
  expect(
    (
      (await (await request("/api/calendar", "GET", undefined, first.cookie)).json()) as {
        screenings: unknown[];
      }
    ).screenings,
  ).toHaveLength(1);
  expect(
    (
      (await (await request("/api/calendar", "GET", undefined, second.cookie)).json()) as {
        screenings: unknown[];
      }
    ).screenings,
  ).toHaveLength(0);
  const exported = await request("/api/calendar/export", "GET", undefined, first.cookie);
  expect(exported.headers.get("Content-Type")).toContain("text/calendar");
  expect(exported.headers.get("Cache-Control")).toContain("no-store");
  expect(await exported.text()).toContain("DTSTART:20261025T003000Z");
  expect(
    (await request(`/api/calendar/export?id=${screening.id}`, "GET", undefined, second.cookie))
      .status,
  ).toBe(404);
  expect(
    (await request("/api/calendar", "DELETE", { id: screening.id }, second.cookie)).status,
  ).toBe(200);
  expect(
    (
      (await (await request("/api/calendar", "GET", undefined, first.cookie)).json()) as {
        screenings: unknown[];
      }
    ).screenings,
  ).toHaveLength(1);
  expect(
    (
      await request(
        "/api/calendar",
        "POST",
        { screening: { ...input, bookingUrl: "javascript:evil()" } },
        first.cookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (await request("/api/calendar", "DELETE", { id: screening.id }, first.cookie)).status,
  ).toBe(200);
  expect(
    (
      (await (await request("/api/calendar", "GET", undefined, first.cookie)).json()) as {
        screenings: unknown[];
      }
    ).screenings,
  ).toHaveLength(0);
  await request("/api/calendar", "POST", { screening: input }, first.cookie);
  const { user } = (await (await request("/api/me", "GET", undefined, first.cookie)).json()) as {
    user: Account;
  };
  await env.DB.prepare(
    "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<999) INSERT INTO saved_screenings(user_id,id,start_at,payload) SELECT ?, printf('%064d',x), ?, ? FROM n",
  )
    .bind(user.id, input.start, JSON.stringify(input))
    .run();
  expect(
    (
      await request(
        "/api/calendar",
        "POST",
        { screening: { ...input, start: input.start + 60000 } },
        first.cookie,
      )
    ).status,
  ).toBe(400);
  // Existing screenings can still be updated when the list is at its limit.
  expect((await request("/api/calendar", "POST", { screening: input }, first.cookie)).status).toBe(
    200,
  );
  expect((await request("/api/me", "DELETE", {}, first.cookie)).status).toBe(200);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM saved_screenings WHERE user_id=?")
      .bind(user.id)
      .first("n"),
  ).toBe(0);
});

async function socialUser(username: string | null) {
  const id = crypto.randomUUID(),
    raw = crypto.randomUUID().replaceAll("-", "").padEnd(64, "a");
  await env.DB.prepare(
    "INSERT INTO users(id,email,app_username,letterboxd_username,unsubscribe_token,created_at) VALUES (?,?,?,?,?,?)",
  )
    .bind(
      id,
      `${id}@friends.test`,
      username,
      username,
      crypto.randomUUID(),
      Math.floor(Date.now() / 1000),
    )
    .run();
  await env.DB.prepare("INSERT INTO sessions(hash,user_id,expires_at) VALUES (?,?,?)")
    .bind(await hash(raw), id, Math.floor(Date.now() / 1000) + 3600)
    .run();
  return { id, cookie: `__Host-session=${raw}` };
}
async function socialImport(id: string, slugs: string[], error: string | null = null) {
  const timestamp = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO watchlist_sync(user_id,fetched_at,count_parsed,completed_at,error) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET fetched_at=excluded.fetched_at,count_parsed=excluded.count_parsed,error=excluded.error",
    ).bind(id, timestamp, slugs.length, timestamp, error),
    ...slugs.map((slug) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO watchlist_items(user_id,slug,added_at) VALUES (?,?,?)",
      ).bind(id, slug, timestamp),
    ),
  ]);
}
it("claims unique app usernames atomically, including case-insensitive conflicts", async () => {
  const a = await socialUser(null),
    b = await socialUser(null);
  const responses = await Promise.all([
    request("/api/friends/profile", "PUT", { username: "Cinema_Friend" }, a.cookie),
    request("/api/friends/profile", "PUT", { username: "cinema_friend" }, b.cookie),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await request(
        "/api/friends/profile",
        "PUT",
        { username: "https://letterboxd.com/test" },
        a.cookie,
      )
    ).status,
  ).toBe(400);
});
it("requires acceptance, protects third-party requests and revokes access after removal", async () => {
  const a = await socialUser("sender_test"),
    b = await socialUser("receiver_test"),
    other = await socialUser("outsider_test");
  await socialImport(b.id, ["shared-film", "their-film"]);
  expect(
    (await request("/api/friends", "POST", { username: "receiver_test" }, a.cookie)).status,
  ).toBe(201);
  expect((await request("/api/friends/watchlists", "POST", { ids: [b.id] }, a.cookie)).status).toBe(
    409,
  );
  expect((await request("/api/friends", "PUT", { id: b.id }, a.cookie)).status).toBe(409);
  expect((await request("/api/friends", "PUT", { id: a.id }, other.cookie)).status).toBe(409);
  expect((await request("/api/friends", "PUT", { id: a.id }, b.cookie)).status).toBe(200);
  const lists = (await (
    await request("/api/friends/watchlists", "POST", { ids: [b.id] }, a.cookie)
  ).json()) as { watchlists: { slugs: string[] }[] };
  expect(lists.watchlists[0]?.slugs).toEqual(["shared-film", "their-film"]);
  expect(
    (await request("/api/friends/watchlists", "POST", { ids: [b.id] }, other.cookie)).status,
  ).toBe(409);
  const overlaps = (await (
    await request("/api/friends/matches", "POST", { slugs: ["shared-film", "unwatched"] }, a.cookie)
  ).json()) as { matches: { slug: string; count: number; usernames: string[] }[] };
  expect(overlaps.matches).toEqual([
    { slug: "shared-film", count: 1, usernames: ["receiver_test"] },
  ]);
  expect((await request("/api/friends", "DELETE", { id: b.id }, other.cookie)).status).toBe(200);
  expect((await request("/api/friends/watchlists", "POST", { ids: [b.id] }, a.cookie)).status).toBe(
    200,
  );
  expect((await request("/api/friends", "DELETE", { id: a.id }, b.cookie)).status).toBe(200);
  expect((await request("/api/friends/watchlists", "POST", { ids: [b.id] }, a.cookie)).status).toBe(
    409,
  );
});
it("keeps pending and stale friends out of shared-film matches and cascades deletions", async () => {
  const a = await socialUser("stale_owner"),
    b = await socialUser("stale_friend");
  await socialImport(b.id, ["shared-film"], "unavailable");
  await request("/api/friends", "POST", { username: "stale_friend" }, a.cookie);
  await request("/api/friends", "PUT", { id: a.id }, b.cookie);
  expect(
    (
      (await (
        await request("/api/friends/matches", "POST", { slugs: ["shared-film"] }, a.cookie)
      ).json()) as { matches: unknown[] }
    ).matches,
  ).toEqual([]);
  expect((await request("/api/friends/matches", "POST", { slugs: ["shared-film"] })).status).toBe(
    401,
  );
  await request("/api/me", "DELETE", {}, b.cookie);
  expect(
    (
      (await (await request("/api/friends", "GET", undefined, a.cookie)).json()) as {
        friends: unknown[];
      }
    ).friends,
  ).toEqual([]);
});
it("reads public lists without creating friendships, caches pages and reports inaccessible lists", async () => {
  const external = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(
        '<span class="js-watchlist-count">2 films</span><div data-item-slug="shared-film" data-target-link="/film/shared-film/"></div><div data-item-slug="other-film" data-target-link="/film/other-film/"></div>',
      ),
    );
  try {
    expect((await request("/api/watchlists/public", "POST", { username: "../admin" })).status).toBe(
      400,
    );
    expect(external).not.toHaveBeenCalled();
    const first = await request("/api/watchlists/public", "POST", { username: "Public_Peer" });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      username: "public_peer",
      count: 2,
      pages: 1,
      slugs: ["shared-film", "other-film"],
    });
    expect(external).toHaveBeenCalledWith(
      "https://letterboxd.com/public_peer/watchlist/",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(
      (await request("/api/watchlists/public", "POST", { username: "public_peer" })).status,
    ).toBe(200);
    expect(external).toHaveBeenCalledTimes(1);
    await env.DB.prepare("UPDATE rate_limits SET expires_at=? WHERE key='letterboxd-public-fetch'")
      .bind(Math.floor(Date.now() / 1000) + 30)
      .run();
    const limited = await request("/api/watchlists/public", "POST", { username: "uncached_peer" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");
    await env.DB.prepare("DELETE FROM rate_limits WHERE key='letterboxd-public-fetch'").run();
    external.mockResolvedValue(new Response("private upstream detail", { status: 403 }));
    const denied = await request("/api/watchlists/public", "POST", { username: "private_peer" });
    expect(denied.status).toBe(502);
    expect(await denied.text()).not.toContain("private upstream detail");
    expect(
      await env.DB.prepare(
        "SELECT payload FROM public_watchlist_pages WHERE username='private_peer'",
      ).first(),
    ).toBeNull();
  } finally {
    external.mockRestore();
  }
});
it("handles 500 friends with bounded match summaries and selected-list reads", async () => {
  const owner = await socialUser("stress_owner");
  const timestamp = Math.floor(Date.now() / 1000);
  const ids: string[] = [];
  const stressSlugs = [
    "stress-shared-film",
    ...Array.from({ length: 99 }, (_, i) => `stress-film-${i}`),
  ];
  for (let offset = 0; offset < 500; offset += 50) {
    const statements: D1PreparedStatement[] = [];
    for (let i = offset; i < offset + 50; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      const username = `stress_friend_${String(i).padStart(3, "0")}`;
      const [low, high] = [owner.id, id].sort();
      statements.push(
        env.DB.prepare(
          "INSERT INTO users(id,email,app_username,letterboxd_username,unsubscribe_token,created_at) VALUES (?,?,?,?,?,?)",
        ).bind(id, `${id}@stress.test`, username, username, id, timestamp),
        env.DB.prepare(
          "INSERT INTO friendships(user_low,user_high,requested_by,status,created_at,accepted_at) VALUES (?,?,?,'accepted',?,?)",
        ).bind(low, high, id, timestamp, timestamp),
        env.DB.prepare(
          "INSERT INTO watchlist_sync(user_id,fetched_at,count_parsed,completed_at) VALUES (?,?,?,?)",
        ).bind(id, timestamp, stressSlugs.length, timestamp),
        env.DB.prepare(
          "INSERT INTO watchlist_items(user_id,slug,added_at) SELECT ?,value,? FROM json_each(?)",
        ).bind(id, timestamp, JSON.stringify(stressSlugs)),
      );
    }
    await env.DB.batch(statements);
  }
  const started = performance.now();
  const response = await request("/api/friends", "GET", undefined, owner.cookie);
  const friends = ((await response.json()) as { friends: unknown[] }).friends;
  expect(friends).toHaveLength(500);
  const result = (await (
    await request("/api/friends/matches", "POST", { slugs: stressSlugs }, owner.cookie)
  ).json()) as { matches: { count: number; usernames: string[] }[] };
  expect(result.matches).toHaveLength(100);
  expect(result.matches.every((m) => m.count === 500 && m.usernames.length === 3)).toBe(true);
  const lists = (await (
    await request("/api/friends/watchlists", "POST", { ids: ids.slice(0, 20) }, owner.cookie)
  ).json()) as { watchlists: { slugs: string[] }[] };
  expect(lists.watchlists).toHaveLength(20);
  expect(lists.watchlists.every((w) => w.slugs.length === 100)).toBe(true);
  expect(
    (await request("/api/friends/watchlists", "POST", { ids: ids.slice(0, 21) }, owner.cookie))
      .status,
  ).toBe(400);
  console.log(
    `500 friends / 50,000 watchlist entries: API reads and summary in ${Math.round(performance.now() - started)} ms`,
  );
}, 30000);
