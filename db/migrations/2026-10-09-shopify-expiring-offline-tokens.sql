-- Expiring offline access tokens for the Shopify Admin API.
-- Access tokens last ~1 hour (expires_in); refresh tokens last 90 days and
-- rotate on every refresh. Rows with shopify_access_token_expires_at = null hold
-- a legacy non-expiring token and are re-exchanged the next time the app opens.
-- Idempotent. Apply before deploying the code that writes these columns.

alter table if exists stores
  add column if not exists shopify_access_token_expires_at timestamptz,
  add column if not exists shopify_refresh_token text,
  add column if not exists shopify_refresh_token_expires_at timestamptz,
  -- Short lease so only one request refreshes a store's token at a time.
  add column if not exists shopify_token_refresh_locked_until timestamptz;
