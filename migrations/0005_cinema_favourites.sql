CREATE TABLE cinema_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  venues TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE cinema_reconciliations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  browser_id TEXT NOT NULL,
  PRIMARY KEY (user_id, browser_id)
);
