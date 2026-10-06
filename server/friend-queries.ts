export const acceptedFriendsSql = `SELECT CASE WHEN f.user_low=?1 THEN f.user_high ELSE f.user_low END AS id FROM friendships f WHERE (f.user_low=?1 OR f.user_high=?1) AND f.status='accepted'`;
export const friendMatchesSql = `WITH friend_ids AS (${acceptedFriendsSql}), matches AS (
 SELECT i.slug,u.app_username AS username FROM friend_ids f JOIN users u ON u.id=f.id
 JOIN watchlist_sync w ON w.user_id=u.id JOIN watchlist_items i ON i.user_id=u.id
 WHERE w.error IS NULL AND w.fetched_at>?2 AND i.slug IN (SELECT value FROM json_each(?3))
), ranked AS (SELECT slug,username,COUNT(*) OVER (PARTITION BY slug) AS count,
 ROW_NUMBER() OVER (PARTITION BY slug ORDER BY username) AS rank FROM matches)
SELECT slug,MAX(count) AS count,json_group_array(username) AS usernames FROM ranked WHERE rank<=3 GROUP BY slug`;
