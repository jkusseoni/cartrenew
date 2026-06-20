-- ============================================================================
-- CartRenew core Shopify schema (Supabase / Postgres)
-- ----------------------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor of a live project, then set
-- NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local to point
-- at that project and run `npm run seed:shopify`.
--
-- Source of truth: lib/database.types.ts, reconciled with the runtime code in
-- app/api/webhooks/shopify/route.ts. Two deliberate reconciliations:
--   * Table is named `analytics_daily` (what the webhook handler queries),
--     not `analytics` (the older name in database.types.ts).
--   * `abandoned_carts.scheduled_message_at` is included (the handler inserts
--     it, though it is absent from database.types.ts).
-- ============================================================================

create extension if not exists "pgcrypto";

-- Shared trigger to keep updated_at fresh.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- stores
-- ----------------------------------------------------------------------------
create table if not exists stores (
  id                    uuid primary key default gen_random_uuid(),
  shopify_domain        text not null unique,
  shopify_access_token  text,
  webhook_ids           jsonb,
  clerk_user_id         text not null,
  whatsapp_phone_id     text,
  whatsapp_access_token text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_stores_clerk_user_id on stores (clerk_user_id);
create index if not exists idx_stores_webhook_ids on stores using gin (webhook_ids);

drop trigger if exists trg_stores_updated_at on stores;
create trigger trg_stores_updated_at before update on stores
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- abandoned_carts
-- ----------------------------------------------------------------------------
create table if not exists abandoned_carts (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references stores (id) on delete cascade,
  shopify_cart_token   text not null,
  customer_phone       text,
  customer_email       text,
  customer_name        text,
  cart_value           numeric not null default 0,
  items                jsonb not null default '[]'::jsonb,
  checkout_url         text,
  status               text not null default 'pending'
                         check (status in ('pending','messaged','recovered','lost','opted_out')),
  scheduled_message_at timestamptz,
  message_sent_at      timestamptz,
  message_delivered_at timestamptz,
  message_read_at      timestamptz,
  recovery_completed_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (store_id, shopify_cart_token)
);

create index if not exists idx_abandoned_carts_store_id on abandoned_carts (store_id);
create index if not exists idx_abandoned_carts_status on abandoned_carts (status);

drop trigger if exists trg_abandoned_carts_updated_at on abandoned_carts;
create trigger trg_abandoned_carts_updated_at before update on abandoned_carts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------------------
create table if not exists messages (
  id                 uuid primary key default gen_random_uuid(),
  cart_id            uuid not null references abandoned_carts (id) on delete cascade,
  store_id           uuid not null references stores (id) on delete cascade,
  phone              text not null,
  template_name      text not null,
  body               text,
  status             text not null default 'pending'
                       check (status in ('sent','delivered','read','failed','queued','pending')),
  whatsapp_message_id text,
  error_message      text,
  attempt_count      integer not null default 0,
  next_retry_at      timestamptz,
  sent_at            timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists idx_messages_cart_id on messages (cart_id);
create index if not exists idx_messages_store_id on messages (store_id);
create index if not exists idx_messages_status on messages (status);

-- ----------------------------------------------------------------------------
-- message_templates
-- ----------------------------------------------------------------------------
create table if not exists message_templates (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references stores (id) on delete cascade,
  name          text not null,
  body          text not null,
  variables     jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  delay_minutes integer not null default 60,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_message_templates_store_id on message_templates (store_id);

drop trigger if exists trg_message_templates_updated_at on message_templates;
create trigger trg_message_templates_updated_at before update on message_templates
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- analytics_daily  (queried by app/api/webhooks/shopify/route.ts)
-- ----------------------------------------------------------------------------
create table if not exists analytics_daily (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references stores (id) on delete cascade,
  date                date not null,
  carts_created       integer not null default 0,
  messages_sent       integer not null default 0,
  messages_delivered  integer not null default 0,
  messages_read       integer not null default 0,
  carts_recovered     integer not null default 0,
  revenue_recovered   numeric not null default 0,
  created_at          timestamptz not null default now(),
  unique (store_id, date)
);

create index if not exists idx_analytics_daily_store_date on analytics_daily (store_id, date);

-- ----------------------------------------------------------------------------
-- cart_delivery_metrics (geo/channel delivery telemetry)
-- ----------------------------------------------------------------------------
create table if not exists cart_delivery_metrics (
  id                  uuid primary key default gen_random_uuid(),
  cart_id             text not null,
  merchant_id         text not null,
  user_id             text,
  store_name          text,
  country             text not null,
  country_code        text,
  primary_channel     text not null,
  attempted_channel   text not null,
  status              text not null
                        check (status in (
                          'SUCCESS_WHATSAPP','SUCCESS_WHATSAPP_WEB_LINK',
                          'SUCCESS_SMS','SUCCESS_EMAIL','FAILED','FAILED_POLICY'
                        )),
  provider            text,
  provider_message_id text,
  error_message       text,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists idx_cart_delivery_metrics_merchant on cart_delivery_metrics (merchant_id);
create index if not exists idx_cart_delivery_metrics_created on cart_delivery_metrics (created_at);
