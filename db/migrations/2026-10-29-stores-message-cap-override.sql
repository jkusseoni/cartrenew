-- Per-store override for the WooCommerce free-message cap (see lib/woocommerce/trial-cap.ts).
--   null      -> use the default (env WOOCOMMERCE_FREE_MESSAGE_LIMIT, default 25)
--   0..n      -> that many free messages for this store
--   negative  -> unlimited (use this to lift the cap for a paying store)
-- Apply BEFORE deploying the route change. The route also works if this is not
-- applied yet (it just ignores the override), so the order is not breaking.

alter table public.stores
  add column if not exists message_cap_override integer;

comment on column public.stores.message_cap_override is
  'WooCommerce free-message cap override: null = default, negative = unlimited.';
