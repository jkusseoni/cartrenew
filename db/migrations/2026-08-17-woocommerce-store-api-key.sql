-- Same as root woocommerce-store-api-key.sql — kept under db/migrations for npm run db:migrate.
-- See repo root file for comments.

alter table stores
  add column if not exists api_key text;

create unique index if not exists idx_stores_api_key
  on stores (api_key)
  where api_key is not null;

alter table abandoned_carts
  add column if not exists platform text not null default 'shopify';

alter table abandoned_carts
  add column if not exists external_cart_key text;

create unique index if not exists idx_abandoned_carts_external_cart_key
  on abandoned_carts (external_cart_key)
  where external_cart_key is not null;

alter table abandoned_carts
  alter column shopify_cart_token drop not null;

update abandoned_carts
set
  platform = coalesce(platform, 'shopify'),
  external_cart_key = 'shopify:' || store_id::text || ':' || shopify_cart_token
where external_cart_key is null
  and shopify_cart_token is not null;
