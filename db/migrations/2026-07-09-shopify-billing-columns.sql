-- Shopify Billing API fields on stores
-- Run against Supabase after deploy (or via your migration runner).

alter table if exists stores
  add column if not exists billing_plan text,
  add column if not exists billing_status text default 'NONE',
  add column if not exists shopify_subscription_id text,
  add column if not exists billing_trial_ends_at timestamptz,
  add column if not exists billing_current_period_end timestamptz;

create index if not exists idx_stores_billing_status on stores (billing_status);
create index if not exists idx_stores_shopify_subscription_id on stores (shopify_subscription_id);
