-- woocommerce-store-api-key.sql
-- Run in Supabase SQL editor (or via scripts). Safe to re-run.

-- 1. Per-store API key for authenticating the WooCommerce plugin webhook.
--    Generate one per store (e.g. `openssl rand -hex 24`) and paste into
--    WP Admin → Settings → CartRenew.
alter table stores
  add column if not exists api_key text;

create unique index if not exists idx_stores_api_key
  on stores (api_key)
  where api_key is not null;

-- 2. Generic columns on abandoned_carts so WooCommerce (and future platforms)
--    can share the table without colliding with shopify_cart_token.
alter table abandoned_carts
  add column if not exists platform text not null default 'shopify';

alter table abandoned_carts
  add column if not exists external_cart_key text;

create unique index if not exists idx_abandoned_carts_external_cart_key
  on abandoned_carts (external_cart_key)
  where external_cart_key is not null;

-- Allow non-Shopify rows: shopify_cart_token stays for legacy Shopify uniqueness,
-- but Woo inserts also set it to the external key for NOT NULL compatibility.
alter table abandoned_carts
  alter column shopify_cart_token drop not null;

-- Backfill existing Shopify rows so external_cart_key stays consistent.
update abandoned_carts
set
  platform = coalesce(platform, 'shopify'),
  external_cart_key = 'shopify:' || store_id::text || ':' || shopify_cart_token
where external_cart_key is null
  and shopify_cart_token is not null;
