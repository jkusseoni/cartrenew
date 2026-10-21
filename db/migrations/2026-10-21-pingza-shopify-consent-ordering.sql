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
