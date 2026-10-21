-- Pingza only. Apply before deploying the matching application code.
--
-- Shopify checkout webhooks can be delayed, delivered out of order, or
-- retried. Keep a source timestamp per consent channel and compare-and-apply
-- both values while holding one row lock. Equal-timestamp conflicts fail
-- closed: false wins. A false value without a trustworthy source timestamp
-- revokes immediately and uses database receipt time as a replay barrier;
-- an unorderable true value is ignored.

alter table public.abandoned_carts
  add column if not exists shopify_sms_consent_updated_at timestamptz,
  add column if not exists shopify_email_consent_updated_at timestamptz;

-- Existing open carts have no trustworthy source watermark and may already
-- contain a stale opt-in written by the vulnerable handler. Revoke each
-- unversioned channel once and establish a database-time barrier. The
-- coalesce/case predicates make this safe to re-run.
with migration_barrier as (
  select clock_timestamp() as received_at
)
update public.abandoned_carts as cart
set
  sms_marketing_consent = case
    when cart.shopify_sms_consent_updated_at is null then false
    else cart.sms_marketing_consent
  end,
  email_marketing_consent = case
    when cart.shopify_email_consent_updated_at is null then false
    else cart.email_marketing_consent
  end,
  shopify_sms_consent_updated_at = coalesce(
    cart.shopify_sms_consent_updated_at,
    migration_barrier.received_at
  ),
  shopify_email_consent_updated_at = coalesce(
    cart.shopify_email_consent_updated_at,
    migration_barrier.received_at
  )
from migration_barrier
where lower(coalesce(cart.platform, 'shopify')) <> 'woocommerce'
  and cart.status in ('pending', 'messaged')
  and (
    cart.shopify_sms_consent_updated_at is null
    or cart.shopify_email_consent_updated_at is null
  );

-- Protect rolling deploys where an old application instance still writes the
-- boolean columns directly. Timestamp-less positive changes are discarded;
-- timestamp-less revocations remain fail-closed and establish a new barrier.
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

drop trigger if exists trg_abandoned_carts_consent_ordering on public.abandoned_carts;
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
