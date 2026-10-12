-- Pingza only. Do not run this on CartRenew.
-- Adds abandoned_carts.status = 'skipped' for carts that can never be emailed
-- (no consent, suppressed address, invalid email). Temporary config misses stay
-- 'pending' and do not use this value.
--
-- The existing inline check is named abandoned_carts_status_check by Postgres.
-- If your database used a different name, drop that constraint first.

alter table public.abandoned_carts drop constraint if exists abandoned_carts_status_check;

alter table public.abandoned_carts
  add constraint abandoned_carts_status_check
  check (status in ('pending', 'messaged', 'recovered', 'lost', 'opted_out', 'skipped'));
