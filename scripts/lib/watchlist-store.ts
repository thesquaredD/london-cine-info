import type { Query } from "./d1";
export function syncQueries(
  id: string,
  username: string,
  slugs: string[],
  count: number,
  now: number,
): Query[] {
  return [
    {
      sql: "DELETE FROM watchlist_items WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND letterboxd_username=?)",
      params: [id, id, username],
    },
    {
      sql: "INSERT INTO watchlist_items(user_id,slug,added_at) SELECT u.id,j.value,? FROM users u,json_each(?) j WHERE u.id=? AND u.letterboxd_username=?",
      params: [now, JSON.stringify(slugs), id, username],
    },
    {
      sql: `INSERT INTO watchlist_sync(user_id,fetched_at,count_reported,count_parsed,error,completed_at) SELECT id,?,?,?,NULL,? FROM users WHERE id=? AND letterboxd_username=? ON CONFLICT(user_id) DO UPDATE SET fetched_at=excluded.fetched_at,count_reported=excluded.count_reported,count_parsed=excluded.count_parsed,error=NULL,completed_at=excluded.completed_at`,
      params: [now, count, slugs.length, now, id, username],
    },
  ];
}
export function failedSyncQueries(
  id: string,
  username: string,
  message: string,
  now: number,
): Query[] {
  return [
    {
      sql: `INSERT INTO watchlist_sync(user_id,error,completed_at) SELECT id,?,? FROM users WHERE id=? AND letterboxd_username=? ON CONFLICT(user_id) DO UPDATE SET error=excluded.error,completed_at=excluded.completed_at`,
      params: [message, now, id, username],
    },
  ];
}
