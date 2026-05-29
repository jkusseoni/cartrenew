-- Migration: add attempt tracking and processing timestamps
-- Run this against your Postgres / Supabase database

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add attempts and processing_started_at to abandoned_carts
ALTER TABLE IF EXISTS abandoned_carts
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- Add attempts to messages table
ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0;

-- Create a simple alerts table for lightweight monitoring
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  level text NOT NULL,
  source text,
  event_type text,
  payload jsonb
);

-- Index common queries
CREATE INDEX IF NOT EXISTS alerts_event_type_idx ON alerts (event_type);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at);

-- Note: apply this migration using your preferred migration tool or psql.
