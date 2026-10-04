CREATE TABLE saved_screenings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX saved_screenings_by_start ON saved_screenings(user_id, start_at);
