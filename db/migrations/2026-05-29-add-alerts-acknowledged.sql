-- Migration: add acknowledged flag to alerts
-- Run this against your Postgres / Supabase database

ALTER TABLE IF EXISTS alerts
  ADD COLUMN IF NOT EXISTS acknowledged boolean NOT NULL DEFAULT false;
