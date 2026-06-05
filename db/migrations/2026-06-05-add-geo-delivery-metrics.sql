-- Migration: add geo-policy delivery metric logs
-- Run this against Supabase/Postgres before relying on cart_delivery_metrics dashboards.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS cart_delivery_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id text NOT NULL,
  merchant_id text NOT NULL,
  user_id text,
  store_name text,
  country text NOT NULL,
  country_code text,
  primary_channel text NOT NULL,
  attempted_channel text NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'SUCCESS_WHATSAPP',
      'SUCCESS_WHATSAPP_WEB_LINK',
      'SUCCESS_SMS',
      'SUCCESS_EMAIL',
      'FAILED',
      'FAILED_POLICY'
    )
  ),
  provider text,
  provider_message_id text,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cart_delivery_metrics_cart_id_idx
  ON cart_delivery_metrics (cart_id);

CREATE INDEX IF NOT EXISTS cart_delivery_metrics_merchant_id_idx
  ON cart_delivery_metrics (merchant_id);

CREATE INDEX IF NOT EXISTS cart_delivery_metrics_status_idx
  ON cart_delivery_metrics (status);

CREATE INDEX IF NOT EXISTS cart_delivery_metrics_created_at_idx
  ON cart_delivery_metrics (created_at DESC);
