-- Zero-knowledge encryption migration.
--
-- Threat model: a database operator (or someone with a stolen D1 dump) must
-- not be able to read user notes or shot locations. Free-text "notes" fields
-- on every table and the GPS / place-name fields on `shots` are encrypted
-- client-side with a per-user key derived from the user's password +
-- `users.key_salt`. The server only ever sees opaque ciphertext.
--
-- Approach:
--   * Add `key_salt` to `users` (16 random bytes, base64 — stable per account,
--     re-rolling it would invalidate every existing ciphertext).
--   * For each table that held plaintext notes / locations: add a single
--     `*_encrypted` TEXT column for the ciphertext blob (base64 IV + AES-GCM
--     ciphertext). Drop the old plaintext columns so a snapshot of the DB
--     exposes nothing.
--
-- This drops existing plaintext rows' content; pre-launch that is acceptable.

ALTER TABLE users ADD COLUMN key_salt TEXT;

-- shots: notes, location_text, latitude, longitude, location_accuracy_m
-- collapse into two ciphertext blobs.
ALTER TABLE shots ADD COLUMN notes_encrypted TEXT;
ALTER TABLE shots ADD COLUMN location_encrypted TEXT;
ALTER TABLE shots DROP COLUMN notes;
ALTER TABLE shots DROP COLUMN location_text;
ALTER TABLE shots DROP COLUMN latitude;
ALTER TABLE shots DROP COLUMN longitude;
ALTER TABLE shots DROP COLUMN location_accuracy_m;

ALTER TABLE rolls ADD COLUMN notes_encrypted TEXT;
ALTER TABLE rolls DROP COLUMN notes;

ALTER TABLE developments ADD COLUMN notes_encrypted TEXT;
ALTER TABLE developments DROP COLUMN notes;

ALTER TABLE cameras ADD COLUMN notes_encrypted TEXT;
ALTER TABLE cameras DROP COLUMN notes;

ALTER TABLE lenses ADD COLUMN notes_encrypted TEXT;
ALTER TABLE lenses DROP COLUMN notes;

ALTER TABLE labs ADD COLUMN notes_encrypted TEXT;
ALTER TABLE labs DROP COLUMN notes;

-- Login rate limiting: one row per (username, hour) bucket. Login endpoint
-- increments and rejects when above threshold. Pruned by background task or
-- on demand; small enough to grow without harm.
CREATE TABLE IF NOT EXISTS login_attempts (
  username TEXT NOT NULL,
  bucket TEXT NOT NULL,    -- ISO 8601 hour string, e.g. '2026-04-25T22'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (username, bucket)
);
