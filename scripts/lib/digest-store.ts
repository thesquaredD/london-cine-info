import type { Query } from "./d1";
import type { DigestFilm } from "./digest";
export function digestAlertQuery(
  userId: string,
  announced: DigestFilm[],
  now: number,
  username?: string,
): Query {
  return {
    sql: `INSERT INTO alerts_sent(user_id,slug,sent_at,last_screening_at) SELECT ?,json_extract(j.value,'$.slug'),?,json_extract(j.value,'$.lastScreeningAt') FROM json_each(?) j WHERE EXISTS(SELECT 1 FROM users WHERE id=?${username ? " AND letterboxd_username=?" : ""}) ON CONFLICT(user_id,slug) DO UPDATE SET sent_at=excluded.sent_at,last_screening_at=excluded.last_screening_at,absent_since=NULL`,
    params: [
      userId,
      now,
      JSON.stringify(announced.map(({ slug, lastScreeningAt }) => ({ slug, lastScreeningAt }))),
      userId,
      ...(username ? [username] : []),
    ],
  };
}
