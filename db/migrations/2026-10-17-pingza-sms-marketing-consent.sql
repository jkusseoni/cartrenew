-- Pingza only. Do not run this on CartRenew.
-- Stores the Shopify checkout SMS marketing opt-in (buyer_accepts_sms_marketing,
-- the "Text me with news and offers" checkbox) on the cart. Pingza sends a
-- WhatsApp recovery message only when this is true.
--
-- Additive only. Existing carts get false, so they are not sent on WhatsApp
-- unless a later checkout webhook says the shopper opted in.
-- Apply before deploying the code that writes this column.

alter table public.abandoned_carts
  add column if not exists sms_marketing_consent boolean not null default false;
