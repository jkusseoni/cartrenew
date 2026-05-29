-- Add webhook_ids JSON column to stores for tracking registered Shopify webhooks
ALTER TABLE IF EXISTS stores
ADD COLUMN IF NOT EXISTS webhook_ids jsonb;

-- No-op if column exists

-- Optionally, create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stores_webhook_ids ON stores USING gin (webhook_ids);
