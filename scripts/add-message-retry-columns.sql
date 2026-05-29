-- Run this against your database to add retry metadata to the messages queue.
ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL;
