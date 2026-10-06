-- Existing accounts are a baseline, not newly completed signups. This is a deduplication
-- marker, not a historical verification timestamp. New accounts start at zero.
ALTER TABLE users ADD COLUMN analytics_signup_completed INTEGER NOT NULL DEFAULT 0;
UPDATE users SET analytics_signup_completed=1;
