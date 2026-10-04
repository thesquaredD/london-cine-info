import type { EmailPayload } from "../../server/email";
import type { Query } from "./d1";
import type { DigestFilm } from "./digest";
import { digestAlertQuery } from "./digest-store";
export type Delivery = {
  user_id: string;
  london_day: string;
  username: string;
  idempotency_key: string;
  payload: string | null;
  announced: string | null;
  created_at: number;
  attempted_at: number | null;
  delivered_at: number | null;
};
export function pendingDigestQuery(userId: string, day: string, username: string): Query {
  return {
    sql: `SELECT * FROM digest_deliveries WHERE user_id=? AND
      (london_day=? OR (delivered_at IS NULL AND attempted_at IS NOT NULL AND username=?))
      ORDER BY london_day LIMIT 1`,
    params: [userId, day, username],
  };
}
export function pruneDigestQuery(now: number): Query {
  return {
    sql: "DELETE FROM digest_deliveries WHERE created_at<? AND (delivered_at IS NOT NULL OR attempted_at IS NULL)",
    params: [now - 7 * 86400],
  };
}
export function queueDigestQuery(
  userId: string,
  username: string,
  weekday: number,
  day: string,
  id: string,
  payload: EmailPayload,
  announced: DigestFilm[],
  now: number,
): Query {
  return {
    // A concurrent/repeated run returns the original immutable delivery.
    sql: `INSERT INTO digest_deliveries(user_id,london_day,username,idempotency_key,payload,announced,created_at)
      SELECT id,?,?,?,?,?,? FROM users WHERE id=? AND letterboxd_username=? AND digest_weekday=?
      ON CONFLICT(user_id,london_day) DO UPDATE SET idempotency_key=digest_deliveries.idempotency_key RETURNING *`,
    params: [
      day,
      username,
      `digest-v2/${id}`,
      JSON.stringify(payload),
      JSON.stringify(announced.map(({ slug, lastScreeningAt }) => ({ slug, lastScreeningAt }))),
      now,
      userId,
      username,
      weekday,
    ],
  };
}
export function attemptDigestQuery(delivery: Delivery, weekday: number, now: number): Query {
  return {
    // The provider retains idempotency keys for 24h. Never retry outside that guarantee.
    sql: `UPDATE digest_deliveries SET attempted_at=COALESCE(attempted_at,?)
      WHERE user_id=? AND london_day=? AND idempotency_key=? AND delivered_at IS NULL
      AND (attempted_at IS NULL OR attempted_at>?)
      AND EXISTS(SELECT 1 FROM users WHERE id=? AND letterboxd_username=? AND digest_weekday=?) RETURNING *`,
    params: [
      now,
      delivery.user_id,
      delivery.london_day,
      delivery.idempotency_key,
      now - 86400,
      delivery.user_id,
      delivery.username,
      weekday,
    ],
  };
}
export function completeDigestQueries(delivery: Delivery, now: number): Query[] {
  const alerts = digestAlertQuery(
    delivery.user_id,
    JSON.parse(delivery.announced!) as DigestFilm[],
    now,
    delivery.username,
  );
  // Don't restore old-watchlist alerts after a username change during delivery.

  return [
    alerts,
    {
      // D1 executes this with the alert writes atomically. Drop mail contents after completion.
      sql: `UPDATE digest_deliveries SET delivered_at=?,payload=NULL,announced=NULL WHERE user_id=? AND london_day=? AND idempotency_key=?`,
      params: [now, delivery.user_id, delivery.london_day, delivery.idempotency_key],
    },
  ];
}
export async function deliverDigest(
  delivery: Delivery,
  send: (payload: EmailPayload, key: string) => Promise<void>,
  complete: (queries: Query[]) => Promise<unknown>,
  now: number,
): Promise<boolean> {
  if (delivery.delivered_at !== null) return false;
  if (!delivery.payload || !delivery.announced)
    throw new Error("Digest delivery contents are missing");
  if (delivery.attempted_at === null || delivery.attempted_at <= now - 86400)
    throw new Error(
      "Digest delivery cannot be retried outside the provider's 24-hour deduplication window",
    );
  await send(JSON.parse(delivery.payload) as EmailPayload, delivery.idempotency_key);
  await complete(completeDigestQueries(delivery, now));
  return true;
}
