CREATE TABLE users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
 letterboxd_username TEXT, digest_weekday INTEGER CHECK(digest_weekday BETWEEN 0 AND 6),
 unsubscribe_token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE auth_tokens (
 hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE sessions (
 hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE watchlist_items (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 slug TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY(user_id, slug)
);
CREATE TABLE watchlist_sync (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 fetched_at INTEGER, count_reported INTEGER, count_parsed INTEGER,
 error TEXT, requested_at INTEGER, completed_at INTEGER
);
CREATE TABLE alerts_sent (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 slug TEXT NOT NULL, sent_at INTEGER NOT NULL, last_screening_at INTEGER NOT NULL,
 PRIMARY KEY(user_id, slug)
);
-- D1 makes quota reservations atomic; KV alone is eventually consistent.
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
