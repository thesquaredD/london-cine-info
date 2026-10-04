import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { hash } from "../server/security";
import { d1 } from "./lib/d1";
import { digestFilms, digestText, type Alert } from "./lib/digest";
import { sendEmail } from "../server/email";
import { letterboxdSlug } from "../src/shared/account";
import type { Film, DataManifest, DataMeta } from "../src/shared/data";
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
const [users] = await d1<{ id: string; email: string; unsubscribe_token: string }>([
  {
    sql: `SELECT u.id,u.email,u.unsubscribe_token FROM users u JOIN watchlist_sync w ON w.user_id=u.id WHERE digest_weekday=? AND letterboxd_username IS NOT NULL AND w.error IS NULL AND w.fetched_at>?`,
    params: [weekday, now - 2 * 86400],
  },
]);
let sent = 0;
for (const user of users!) {
  const [items, alerts] = await d1<{ slug: string } | Alert>([
    { sql: "SELECT slug FROM watchlist_items WHERE user_id=?", params: [user.id] },
    {
      sql: "SELECT slug,sent_at,last_screening_at,absent_since FROM alerts_sent WHERE user_id=?",
      params: [user.id],
    },
  ]);
  const watchlist = new Set(items!.map((row) => row.slug));
  const chosen = digestFilms(films, watchlist, alerts as Alert[], now);
  // Deduplicate multiple combined movie ids sharing one Letterboxd slug.
  const unique = [
    ...new Map(chosen.map((film) => [letterboxdSlug(film.ra.lb?.url)!, film])).values(),
  ];
  if (unique.length) {
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
    const base = process.env.SITE_URL ?? "https://london-cine.info";
    const unsubscribe = `${base}/unsubscribe?token=${user.unsubscribe_token}`;
    const batchId = createHash("sha256")
      .update(user.id + date.toISOString().slice(0, 10))
      .digest("hex");
    await sendEmail(
      key,
      process.env.RESEND_FROM ?? "London Ciné Info <hello@mail.london-cine.info>",
      user.email,
      "Your watchlist is screening in London",
      digestText(unique, base, unsubscribe),
      batchId,
      { "List-Unsubscribe": `<${unsubscribe}>` },
    );
    await d1([
      {
        sql: `INSERT INTO alerts_sent(user_id,slug,sent_at,last_screening_at) SELECT ?,j.value,?,? FROM json_each(?) j WHERE EXISTS(SELECT 1 FROM users WHERE id=?) ON CONFLICT(user_id,slug) DO UPDATE SET sent_at=excluded.sent_at,last_screening_at=excluded.last_screening_at,absent_since=NULL`,
        params: [
          user.id,
          now,
          now,
          JSON.stringify(unique.map((film) => letterboxdSlug(film.ra.lb?.url))),
          user.id,
        ],
      },
    ]);
    sent++;
    // Resend's free API limit is shared with other email sends.
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
console.log(`Weekly digests sent: ${sent}`);
