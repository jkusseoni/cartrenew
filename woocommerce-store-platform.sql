-- Paste into Supabase SQL editor (safe to re-run).
-- WooCommerce merchant onboarding columns on stores.

alter table stores
  add column if not exists platform text not null default 'shopify',
  add column if not exists site_url text,
  add column if not exists contact_email text,
  add column if not exists store_name text;

alter table stores
  alter column shopify_domain drop not null;

create unique index if not exists idx_stores_site_url
  on stores (site_url)
  where site_url is not null;

create index if not exists idx_stores_platform on stores (platform);
