-- WooCommerce merchant onboarding: platform + site_url on stores.
-- Safe to re-run in Supabase SQL editor.

alter table stores
  add column if not exists platform text not null default 'shopify',
  add column if not exists site_url text,
  add column if not exists contact_email text,
  add column if not exists store_name text;

alter table stores
  alter column shopify_domain drop not null;

-- One WooCommerce site → one store row.
create unique index if not exists idx_stores_site_url
  on stores (site_url)
  where site_url is not null;

create index if not exists idx_stores_platform on stores (platform);
