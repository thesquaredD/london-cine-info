-- Sign-in codes for the phone app. `code` holds a SHA-256 hash of the six-digit code, never
-- the code itself. Only the newest email for an account carries a code; earlier rows keep
-- their link but lose their code. Five wrong attempts delete the row.
ALTER TABLE auth_tokens ADD COLUMN code TEXT;
ALTER TABLE auth_tokens ADD COLUMN code_attempts INTEGER NOT NULL DEFAULT 0;
