-- Pingza recovery email (V1). Schema only. Do not put secrets in this file.
-- Apply on the Pingza Supabase project before deploying the email code.
-- Do not run this against CartRenew.
--
-- messages.phone findings before dropping NOT NULL:
--   No unique constraint and no unique index on messages.phone.
--   Indexes are cart_id, store_id, status, partial whatsapp_message_id,
--   and partial pending next_retry_at. None include phone.
--   WhatsApp inserts always pass a phone string. Making the column
--   nullable does not change those inserts. Email rows store phone null
--   and set channel = 'email'.
--
-- Existing rows keep channel 'whatsapp' via the column default.
-- Suppression is global by lowercase email. store_id is informational.

alter table public.messages alter column phone drop not null;

alter table public.messages
  add column if not exists channel text not null default 'whatsapp';

alter table public.messages
  drop constraint if exists messages_channel_check;

alter table public.messages
  add constraint messages_channel_check check (channel in ('whatsapp', 'email'));

alter table public.messages
  add column if not exists email text;

alter table public.abandoned_carts
  add column if not exists email_marketing_consent boolean not null default false;

alter table public.stores
  add column if not exists email_from_name text,
  add column if not exists reply_to_email text;

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  store_id uuid references public.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint email_suppressions_email_key unique (email)
);

create unique index if not exists email_suppressions_lower_email_idx
  on public.email_suppressions (lower(email));

alter table public.email_suppressions enable row level security;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
