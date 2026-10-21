-- Pingza / CartRenew â€” fresh Supabase schema (Shopify flow)
-- Schema only. No data. No secrets. No policies.
--
-- Derived from db/migrations/*.sql, root *.sql, lib/database.types.ts,
-- and every supabase .from() call. There are no .rpc() calls.
--
-- The app talks to these tables with the Supabase service role key
-- (lib/supabase.ts). Row level security is enabled on every table and
-- no policies are created, so the anon and authenticated roles cannot
-- read or write. The service role bypasses RLS.
--
-- Apply once on an empty public schema (Supabase SQL editor).
--
-- ============================================================================
-- Not created (WooCommerce-only â€” Pingza is Shopify-only)
-- ============================================================================
-- No WooCommerce-only tables exist. These columns and indexes are omitted:
--   stores.api_key            text, unique when not null
--   stores.site_url           text, unique when not null
--   stores.contact_email      text
--   stores.store_name         text
--   idx_stores_api_key
--   idx_stores_site_url
--   abandoned_carts.external_cart_key text, unique when not null
--   idx_abandoned_carts_external_cart_key
-- Kept: stores.platform, abandoned_carts.platform (text not null default
-- 'shopify'), and idx_stores_platform. shopify_domain is the store key
-- (text not null unique, upsert onConflict). shopify_cart_token is
-- text not null. unique (store_id, shopify_cart_token) stays.
--
-- message_templates is created below. The only caller today is the
-- WooCommerce abandoned-cart route (lib/services/messaging.ts). The
-- Shopify webhook and recovery dispatch hardcode template name
-- abandoned_cart_reminder and never read this table. See the caveat below.
--
-- ============================================================================
-- Not created (Clerk / Prisma â€” optional, not the Supabase Shopify pipeline)
-- ============================================================================
-- Prisma models in prisma/schema.prisma, applied via DATABASE_URL, not
-- the Supabase REST client. Shopify install calls Merchant upsert in the
-- background and ignores failure. DashboardListener.tsx selects "Cart"
-- but nothing imports that component. PascalCase "Cart" is not created.
--
--   "User"                 id, email unique, firstName, lastName,
--                          createdAt, updatedAt
--   "Merchant"             id, userId -> "User", storeName, shopDomain unique,
--                          whatsappNum, subscriptionTier (LifetimeDealTier),
--                          lifetimeDealActive, lifetimeDealPurchasedAt,
--                          storeLimit, monthlyRecoveryLimit,
--                          tempTwoFactorSecret, twoFactorSecret,
--                          twoFactorEnabled, stripeCustomerId,
--                          stripeCheckoutSessionId, stripePaymentIntentId,
--                          tierConfig jsonb, createdAt, updatedAt
--   "Cart"                 id, merchantId -> "Merchant", customerPhone,
--                          cartUrl, totalAmount, status default 'ABANDONED',
--                          customerName, phoneNumber, notified,
--                          recoveryMessage, recoveryMessageModel,
--                          recoveryMessagePrompt, recoveryMessageAt,
--                          detectedLang, confidenceScore, activeChannel,
--                          createdAt, updatedAt
--   "WebhookSubscription"  id, merchantId, url, eventType, secret, isActive,
--                          unique (merchantId, url, eventType)
--   "Order"                id, shopifyOrderId unique, customerName,
--                          phoneNumber, totalAmount, paymentMethod,
--                          status VerificationStatus, verificationOtp
--   enums                  VerificationStatus (PENDING, VERIFIED, CANCELLED,
--                          FAILED), LifetimeDealTier (SINGLE, DOUBLE, MULTIPLE)
--
-- ============================================================================
-- Not created (probes / stale names)
-- ============================================================================
--   _analytics   app/api/test-db/route.js selects * limit 1. No DDL anywhere.
--   analytics    name in lib/database.types.ts only. Every query uses
--                analytics_daily.
--
-- ============================================================================
-- Included with a caveat
-- ============================================================================
-- Present in db/migrations, never read or written by TypeScript:
--   abandoned_carts.attempts   integer not null default 0
--                              (2026-06-20-core-shopify-schema.sql)
--   messages.attempts          integer default 0
--                              (2026-05-29-add-attempts-processing-and-alerts.sql
--                              only). Live code uses messages.attempt_count.
--
-- Included, but no Shopify writer was found:
--   abandoned_carts.status value 'opted_out'
--       Check constraint and database.types.ts. Writers use pending,
--       messaged, recovered, lost only.
--   analytics_daily.messages_sent / messages_delivered / messages_read
--       Selected by /api/analytics. incrementAnalytics only updates
--       carts_created, carts_recovered, and revenue_recovered.
--   message_templates
--       Full table from the core Shopify SQL and database.types.ts.
--       Only app/api/woocommerce/abandoned-cart -> messaging.ts selects
--       body, name (filter store_id, is_active). No insert exists in the repo.
--   stores.whatsapp_phone_id / whatsapp_access_token
--       Inserted as null by the Shopify webhook. Admin store lists select
--       whatsapp_phone_id. No route updates them.
--   abandoned_carts.scheduled_message_at
--       Written on checkout upsert. No reader found.
--
-- idx_abandoned_carts_shopify_cart_token is a plain index for /r/[cartId],
-- which filters shopify_cart_token without store_id. The unique key
-- (store_id, shopify_cart_token) does not lead with the token.
--
-- billing_status is unconstrained text. Default is 'NONE' (billing
-- migration). Writers also store lowercase pending, active, declined,
-- cancelled, expired, frozen, and the callback matches both
-- 'pending' and 'PENDING'.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- stores  (keyed by shopify_domain)
-- ----------------------------------------------------------------------------
create table public.stores (
  id                         uuid primary key default gen_random_uuid(),
  shopify_domain                    text not null unique,
  shopify_access_token              text,
  -- Expiring offline tokens (origin/main, db/migrations/2026-10-09-shopify-expiring-offline-tokens.sql).
  -- Access token ~1h (expires_in). Refresh token ~90 days (refresh_token_expires_in), rotated on refresh.
  -- Null shopify_access_token_expires_at means a legacy non-expiring token.
  shopify_access_token_expires_at   timestamptz,
  shopify_refresh_token             text,
  shopify_refresh_token_expires_at  timestamptz,
  shopify_token_refresh_locked_until timestamptz,
  webhook_ids                       jsonb,
  clerk_user_id              text not null,
  platform                   text not null default 'shopify',
  whatsapp_phone_id          text,
  whatsapp_access_token      text,
  billing_plan               text,
  billing_status             text default 'NONE',
  shopify_subscription_id    text,
  billing_trial_ends_at      timestamptz,
  billing_current_period_end timestamptz,
  email_from_name            text,
  reply_to_email             text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index idx_stores_clerk_user_id on public.stores (clerk_user_id);
create index idx_stores_webhook_ids on public.stores using gin (webhook_ids);
create index idx_stores_billing_status on public.stores (billing_status);
create index idx_stores_shopify_subscription_id on public.stores (shopify_subscription_id);
create index idx_stores_platform on public.stores (platform);

create trigger trg_stores_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- abandoned_carts
-- unique (store_id, shopify_cart_token) is the webhook upsert conflict target
-- ----------------------------------------------------------------------------
create table public.abandoned_carts (
  id                    uuid primary key default gen_random_uuid(),
  store_id              uuid not null references public.stores (id) on delete cascade,
  shopify_cart_token    text not null,
  platform              text not null default 'shopify',
  customer_phone        text,
  customer_email        text,
  email_marketing_consent boolean not null default false,
  sms_marketing_consent boolean not null default false,
  shopify_email_consent_updated_at timestamptz,
  shopify_sms_consent_updated_at timestamptz,
  customer_name         text,
  cart_value            numeric not null default 0,
  items                 jsonb not null default '[]'::jsonb,
  checkout_url          text,
  status                text not null default 'pending'
                          check (status in ('pending', 'messaged', 'recovered', 'lost', 'opted_out', 'skipped')),
  scheduled_message_at  timestamptz,
  message_sent_at       timestamptz,
  message_delivered_at  timestamptz,
  message_read_at       timestamptz,
  last_send_error       text,
  last_send_failed_at   timestamptz,
  recovery_completed_at timestamptz,
  processing_started_at timestamptz,
  attempts              integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (store_id, shopify_cart_token)
);

create index idx_abandoned_carts_store_id on public.abandoned_carts (store_id);
create index idx_abandoned_carts_status on public.abandoned_carts (status);
create index idx_abandoned_carts_shopify_cart_token on public.abandoned_carts (shopify_cart_token);

create trigger trg_abandoned_carts_updated_at
  before update on public.abandoned_carts
  for each row execute function public.set_updated_at();

create or replace function public.guard_shopify_checkout_marketing_consent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_received_at timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    if new.sms_marketing_consent = true
      and new.shopify_sms_consent_updated_at is null
    then
      new.sms_marketing_consent := false;
      new.shopify_sms_consent_updated_at := v_received_at;
    end if;

    if new.email_marketing_consent = true
      and new.shopify_email_consent_updated_at is null
    then
      new.email_marketing_consent := false;
      new.shopify_email_consent_updated_at := v_received_at;
    end if;

    return new;
  end if;

  if new.sms_marketing_consent is distinct from old.sms_marketing_consent
    and new.shopify_sms_consent_updated_at is not distinct from old.shopify_sms_consent_updated_at
  then
    if new.sms_marketing_consent = false then
      new.shopify_sms_consent_updated_at := greatest(
        coalesce(old.shopify_sms_consent_updated_at, '-infinity'::timestamptz),
        v_received_at
      );
    else
      new.sms_marketing_consent := old.sms_marketing_consent;
      new.shopify_sms_consent_updated_at := old.shopify_sms_consent_updated_at;
    end if;
  end if;

  if new.email_marketing_consent is distinct from old.email_marketing_consent
    and new.shopify_email_consent_updated_at is not distinct from old.shopify_email_consent_updated_at
  then
    if new.email_marketing_consent = false then
      new.shopify_email_consent_updated_at := greatest(
        coalesce(old.shopify_email_consent_updated_at, '-infinity'::timestamptz),
        v_received_at
      );
    else
      new.email_marketing_consent := old.email_marketing_consent;
      new.shopify_email_consent_updated_at := old.shopify_email_consent_updated_at;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_abandoned_carts_consent_ordering
  before insert or update of
    sms_marketing_consent,
    email_marketing_consent,
    shopify_sms_consent_updated_at,
    shopify_email_consent_updated_at
  on public.abandoned_carts
  for each row execute function public.guard_shopify_checkout_marketing_consent();

revoke all on function public.guard_shopify_checkout_marketing_consent() from public;

create or replace function public.apply_shopify_checkout_marketing_consent(
  p_cart_id uuid,
  p_event_at timestamptz,
  p_sms_consent boolean,
  p_email_consent boolean
)
returns table (
  cart_id uuid,
  sms_marketing_consent boolean,
  email_marketing_consent boolean,
  shopify_sms_consent_updated_at timestamptz,
  shopify_email_consent_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_received_at timestamptz := clock_timestamp();
begin
  return query
  with current_cart as (
    select
      cart.id,
      cart.sms_marketing_consent,
      cart.email_marketing_consent,
      cart.shopify_sms_consent_updated_at,
      cart.shopify_email_consent_updated_at
    from public.abandoned_carts as cart
    where cart.id = p_cart_id
      and cart.status in ('pending', 'messaged')
    for update
  ),
  desired as (
    select
      current_cart.id,
      case
        when p_sms_consent is null then current_cart.sms_marketing_consent
        when p_event_at is null and p_sms_consent = false then false
        when p_event_at is null then current_cart.sms_marketing_consent
        when current_cart.shopify_sms_consent_updated_at is null
          or p_event_at > current_cart.shopify_sms_consent_updated_at
          then p_sms_consent
        when p_event_at = current_cart.shopify_sms_consent_updated_at
          and p_sms_consent = false
          then false
        else current_cart.sms_marketing_consent
      end as sms_marketing_consent,
      case
        when p_email_consent is null then current_cart.email_marketing_consent
        when p_event_at is null and p_email_consent = false then false
        when p_event_at is null then current_cart.email_marketing_consent
        when current_cart.shopify_email_consent_updated_at is null
          or p_event_at > current_cart.shopify_email_consent_updated_at
          then p_email_consent
        when p_event_at = current_cart.shopify_email_consent_updated_at
          and p_email_consent = false
          then false
        else current_cart.email_marketing_consent
      end as email_marketing_consent,
      case
        when p_sms_consent is null then current_cart.shopify_sms_consent_updated_at
        when p_event_at is null and p_sms_consent = false
          then greatest(
            coalesce(current_cart.shopify_sms_consent_updated_at, '-infinity'::timestamptz),
            v_received_at
          )
        when p_event_at is not null
          and (
            current_cart.shopify_sms_consent_updated_at is null
            or p_event_at > current_cart.shopify_sms_consent_updated_at
          )
          then p_event_at
        else current_cart.shopify_sms_consent_updated_at
      end as shopify_sms_consent_updated_at,
      case
        when p_email_consent is null then current_cart.shopify_email_consent_updated_at
        when p_event_at is null and p_email_consent = false
          then greatest(
            coalesce(current_cart.shopify_email_consent_updated_at, '-infinity'::timestamptz),
            v_received_at
          )
        when p_event_at is not null
          and (
            current_cart.shopify_email_consent_updated_at is null
            or p_event_at > current_cart.shopify_email_consent_updated_at
          )
          then p_event_at
        else current_cart.shopify_email_consent_updated_at
      end as shopify_email_consent_updated_at
    from current_cart
  )
  update public.abandoned_carts as cart
  set
    sms_marketing_consent = desired.sms_marketing_consent,
    email_marketing_consent = desired.email_marketing_consent,
    shopify_sms_consent_updated_at = desired.shopify_sms_consent_updated_at,
    shopify_email_consent_updated_at = desired.shopify_email_consent_updated_at
  from desired
  where cart.id = desired.id
    and (
      cart.sms_marketing_consent is distinct from desired.sms_marketing_consent
      or cart.email_marketing_consent is distinct from desired.email_marketing_consent
      or cart.shopify_sms_consent_updated_at is distinct from desired.shopify_sms_consent_updated_at
      or cart.shopify_email_consent_updated_at is distinct from desired.shopify_email_consent_updated_at
    )
  returning
    cart.id,
    cart.sms_marketing_consent,
    cart.email_marketing_consent,
    cart.shopify_sms_consent_updated_at,
    cart.shopify_email_consent_updated_at;
end;
$$;

revoke all on function public.apply_shopify_checkout_marketing_consent(
  uuid,
  timestamptz,
  boolean,
  boolean
) from public;

grant execute on function public.apply_shopify_checkout_marketing_consent(
  uuid,
  timestamptz,
  boolean,
  boolean
) to service_role;

-- ----------------------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------------------
create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  cart_id             uuid not null references public.abandoned_carts (id) on delete cascade,
  store_id            uuid not null references public.stores (id) on delete cascade,
  phone               text,
  email               text,
  channel             text not null default 'whatsapp'
                        check (channel in ('whatsapp', 'email')),
  template_name       text not null,
  body                text,
  status              text not null default 'pending'
                        check (status in ('sent', 'delivered', 'read', 'failed', 'queued', 'pending')),
  whatsapp_message_id text,
  error_message       text,
  attempt_count       integer not null default 0,
  attempts            integer default 0,
  next_retry_at       timestamptz,
  sent_at             timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index idx_messages_cart_id on public.messages (cart_id);
create index idx_messages_store_id on public.messages (store_id);
create index idx_messages_status on public.messages (status);
create index idx_messages_whatsapp_message_id
  on public.messages (whatsapp_message_id)
  where whatsapp_message_id is not null;
create index idx_messages_pending_retry
  on public.messages (next_retry_at)
  where status = 'pending';

-- ----------------------------------------------------------------------------
-- message_templates
-- ----------------------------------------------------------------------------
create table public.message_templates (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  name          text not null,
  body          text not null,
  variables     jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  delay_minutes integer not null default 60,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_message_templates_store_id on public.message_templates (store_id);

create trigger trg_message_templates_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- analytics_daily
-- ----------------------------------------------------------------------------
create table public.analytics_daily (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores (id) on delete cascade,
  date               date not null,
  carts_created      integer not null default 0,
  messages_sent      integer not null default 0,
  messages_delivered integer not null default 0,
  messages_read      integer not null default 0,
  carts_recovered    integer not null default 0,
  revenue_recovered  numeric not null default 0,
  created_at         timestamptz not null default now(),
  unique (store_id, date)
);

create index idx_analytics_daily_store_date on public.analytics_daily (store_id, date);

-- ----------------------------------------------------------------------------
-- cart_delivery_metrics
-- Written by /api/cart/automate (legacy geo router, not the Shopify webhook).
-- cart_id / merchant_id / user_id are text, not foreign keys.
-- ----------------------------------------------------------------------------
create table public.cart_delivery_metrics (
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
                          'SUCCESS_WHATSAPP',
                          'SUCCESS_WHATSAPP_WEB_LINK',
                          'SUCCESS_SMS',
                          'SUCCESS_EMAIL',
                          'FAILED',
                          'FAILED_POLICY'
                        )),
  provider            text,
  provider_message_id text,
  error_message       text,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index idx_cart_delivery_metrics_merchant on public.cart_delivery_metrics (merchant_id);
create index idx_cart_delivery_metrics_created on public.cart_delivery_metrics (created_at);
create index cart_delivery_metrics_cart_id_idx on public.cart_delivery_metrics (cart_id);
create index cart_delivery_metrics_status_idx on public.cart_delivery_metrics (status);
create index cart_delivery_metrics_created_at_idx on public.cart_delivery_metrics (created_at desc);

-- ----------------------------------------------------------------------------
-- alerts
-- Admin alerts UI, plus the cart/automate metric-write fallback.
-- alertEvent() in lib/monitoring.ts has no callers.
-- ----------------------------------------------------------------------------
create table public.alerts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  level        text not null,
  source       text,
  event_type   text,
  payload      jsonb,
  acknowledged boolean not null default false
);

create index alerts_event_type_idx on public.alerts (event_type);
create index alerts_created_at_idx on public.alerts (created_at);

-- ----------------------------------------------------------------------------
-- email_suppressions
-- Global by lowercase email. store_id is informational. No public policies.
-- ----------------------------------------------------------------------------
create table public.email_suppressions (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  reason     text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  store_id   uuid references public.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint email_suppressions_email_key unique (email)
);

create unique index email_suppressions_lower_email_idx
  on public.email_suppressions (lower(email));


-- ----------------------------------------------------------------------------
-- access_audit_logs  (Pingza PCD — see db/migrations/2026-10-17-access-audit-logs.sql)
-- shop, action, actor, count, timestamp — no PII values. Retain 90 days.
-- ----------------------------------------------------------------------------
create table if not exists public.access_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  shop_domain   text,
  action        text not null,
  actor         text not null,
  record_count  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_access_audit_logs_created_at
  on public.access_audit_logs (created_at);
create index if not exists idx_access_audit_logs_shop_created
  on public.access_audit_logs (shop_domain, created_at desc);

-- ----------------------------------------------------------------------------
-- Row level security, no policies
-- ----------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.abandoned_carts enable row level security;
alter table public.messages enable row level security;
alter table public.message_templates enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.cart_delivery_metrics enable row level security;
alter table public.alerts enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.access_audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- service_role only. No grants for anon or authenticated.
-- ----------------------------------------------------------------------------
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

