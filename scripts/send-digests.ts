import { friendMatchesSql } from "../server/friend-queries";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { hash } from "../server/security";
import { d1 } from "./lib/d1";
import {
  attemptDigestQuery,
  pendingDigestQuery,
  pruneDigestQuery,
  queueDigestQuery,
  deliverDigest,
  type Delivery,
} from "./lib/digest-delivery";
import { londonDate } from "../src/lib/filters";
import { digestFilms, digestText, digestHtml, digestSubject, type Alert } from "./lib/digest";
import { sendEmailPayload, EmailDeliveryError } from "../server/email";
import type { Film, FilmShowtimes, DataManifest, DataMeta } from "../src/shared/data";
const key = process.env.RESEND_API_KEY;
if (!key) {
  console.log("Digest delivery pending: RESEND_API_KEY is not configured.");
  process.exit(0);
}
const now = Math.floor(Date.now() / 1000),
  date = new Date();
const londonDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Europe/London",
}).format(date);
const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(londonDay);
// Run after the second daily rebuild; catches up after failed deployments on the same day.
if (date.getUTCHours() * 60 + date.getUTCMinutes() < 11 * 60 + 45) process.exit(0);
const manifest = JSON.parse(await readFile("src/generated/manifest.json", "utf8")) as DataManifest;
const films = JSON.parse(await readFile(`public${manifest.films}`, "utf8")) as Film[];
const meta = JSON.parse(await readFile(`public${manifest.meta}`, "utf8")) as DataMeta;
if (now - Date.parse(meta.generatedAt) / 1000 > 2 * 86400)
  throw new Error("Refusing digest from stale screening data");
const day = londonDate(date);
// Payloads are removed on completion; discard old, no-longer-eligible daily records.
await d1([pruneDigestQuery(now)]);
const [users] = await d1<{
  id: string;
  email: string;
  unsubscribe_token: string;
  letterboxd_username: string;
  friends_digest: number;
}>([
  {
    sql: `SELECT u.id,u.email,u.unsubscribe_token,u.letterboxd_username,u.friends_digest FROM users u JOIN watchlist_sync w ON w.user_id=u.id WHERE digest_weekday=? AND letterboxd_username IS NOT NULL AND w.error IS NULL AND w.fetched_at>?`,
    params: [weekday, now - 2 * 86400],
  },
]);
const showtimesCache = new Map<string, Promise<FilmShowtimes>>();
function loadShowtimes(id: string): Promise<FilmShowtimes> {
  let data = showtimesCache.get(id);
  if (!data) {
    data = readFile(`public${manifest.showtimes}${id}.json`, "utf8").then(
      (text) => JSON.parse(text) as FilmShowtimes,
    );
    showtimesCache.set(id, data);
  }
  return data;
}
let sent = 0,
  failed = 0;
for (const user of users!) {
  const [existing] = await d1<Delivery>([
    pendingDigestQuery(user.id, day, user.letterboxd_username),
  ]);
  let delivery = existing![0];
  if (
    delivery?.delivered_at != null ||
    (delivery && delivery.username !== user.letterboxd_username)
  )
    continue;
  if (!delivery) {
    const [items, alerts] = await d1<{ slug: string } | Alert>([
      { sql: "SELECT slug FROM watchlist_items WHERE user_id=?", params: [user.id] },
      {
        sql: "SELECT slug,sent_at,last_screening_at,absent_since FROM alerts_sent WHERE user_id=?",
        params: [user.id],
      },
    ]);
    const digest = await digestFilms(
      films,
      new Set(items!.map((row) => row.slug)),
      alerts as Alert[],
      now,
      loadShowtimes,
    );
    if (user.friends_digest) {
      const slugs = items!.map((row) => row.slug);
      const [matches] = await d1<{ slug: string; count: number; usernames: string }>([
        { sql: friendMatchesSql, params: [user.id, now - 2 * 86400, JSON.stringify(slugs)] },
      ]);
      if (matches!.length) {
        const bySlug = new Map(matches!.map((m) => [m.slug, m]));
        const current = await digestFilms(films, new Set(bySlug.keys()), [], now, loadShowtimes);
        digest.shared = [...current.cards, ...current.also].map((entry) => ({
          entry,
          usernames: JSON.parse(bySlug.get(entry.slug)!.usernames) as string[],
          friendCount: bySlug.get(entry.slug)!.count,
        }));
      }
    }
    if (!digest.count && !digest.shared?.length) continue;
    const base = process.env.SITE_URL ?? "https://london-cine.info";
    const unsubscribe = `${base}/unsubscribe?token=${user.unsubscribe_token}`;
    const [queued] = await d1<Delivery>([
      queueDigestQuery(
        user.id,
        user.letterboxd_username,
        weekday,
        day,
        randomUUID(),
        {
          from: process.env.RESEND_FROM ?? "London Ciné Info <hello@mail.london-cine.info>",
          to: [user.email],
          subject: digestSubject(digest),
          text: digestText(digest, meta.venues, base, unsubscribe),
          html: digestHtml(digest, meta.venues, base, unsubscribe),
          headers: { "List-Unsubscribe": `<${unsubscribe}>` },
        },
        [...digest.cards, ...digest.also],
        now,
      ),
    ]);
    delivery = queued![0];
  }
  if (delivery && delivery.delivered_at === null) {
    if (delivery.attempted_at !== null && delivery.attempted_at <= now - 86400) {
      failed++;
      console.error(
        "A pending digest is outside Resend's 24-hour retry window; no resend attempted.",
      );
      continue;
    }
    const [eligible] = await d1<{ count: number }>([
      {
        sql: `INSERT INTO rate_limits(key,count,expires_at) SELECT ?,1,? WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND digest_weekday=?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`,
        params: [await hash("email-daily"), now + 86400, user.id, weekday, now, now],
      },
    ]);
    if (!eligible!.length) continue;
    if (eligible![0]!.count > 90) {
      console.log("Email daily quota reached; remaining subscribers wait for next week.");
      break;
    }
    const [attempted] = await d1<Delivery>([attemptDigestQuery(delivery, weekday, now)]);
    if (!attempted!.length) continue;
    try {
      await deliverDigest(
        attempted![0]!,
        (payload, id) => sendEmailPayload(key, payload, id),
        d1,
        now,
      );
      sent++;
    } catch (error) {
      failed++;
      // Only expose safe delivery categories, never provider bodies or account data.
      console.error(
        error instanceof EmailDeliveryError
          ? `Digest delivery failed: HTTP ${error.status}, ${error.code}. Stored message retained for retry.`
          : "Digest delivery or confirmation failed. Stored message retained for retry.",
      );
    }
    // Resend's free API limit is shared with other email sends.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
console.log(`Weekly digests sent: ${sent}; failed: ${failed}`);
if (failed) throw new Error(`${failed} digest deliveries need retry or review`);
