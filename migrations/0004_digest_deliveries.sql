-- Freeze each daily digest before sending so retries use the same Resend payload/key.
CREATE TABLE digest_deliveries (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 london_day TEXT NOT NULL,
 username TEXT NOT NULL,
 idempotency_key TEXT NOT NULL UNIQUE,
 payload TEXT,
 announced TEXT,
 created_at INTEGER NOT NULL,
 attempted_at INTEGER,
 delivered_at INTEGER,
 PRIMARY KEY(user_id, london_day)
);
