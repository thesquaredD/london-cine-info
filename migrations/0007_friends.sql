ALTER TABLE users ADD COLUMN app_username TEXT;
ALTER TABLE users ADD COLUMN friends_digest INTEGER NOT NULL DEFAULT 1 CHECK(friends_digest IN (0,1));
CREATE UNIQUE INDEX users_app_username ON users(app_username COLLATE NOCASE) WHERE app_username IS NOT NULL;
CREATE TABLE friendships (
 user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
 created_at INTEGER NOT NULL, accepted_at INTEGER,
 PRIMARY KEY(user_low,user_high), CHECK(user_low < user_high),
 CHECK(requested_by IN (user_low,user_high))
);
CREATE INDEX friendships_high ON friendships(user_high,status);
CREATE INDEX friendships_low ON friendships(user_low,status);
CREATE TABLE public_watchlist_pages (
 username TEXT NOT NULL, page INTEGER NOT NULL,
 payload TEXT NOT NULL, expires_at INTEGER NOT NULL,
 PRIMARY KEY(username,page)
);
CREATE INDEX public_watchlist_expiry ON public_watchlist_pages(expires_at);
