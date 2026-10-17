-- Pingza PCD access audit (no PII values). Apply on the Pingza Supabase project.
-- Rows: shop domain, action, actor/route, count, timestamp.
-- RLS on, no policies → PostgREST anon/authenticated cannot read/write.
-- Explicit service_role grants only (matches pingza-schema.sql pattern).

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

comment on table public.access_audit_logs is
  'PII-free access audit for protected customer data (Pingza). Retain 90 days.';

alter table public.access_audit_logs enable row level security;

revoke all on table public.access_audit_logs from public;
revoke all on table public.access_audit_logs from anon;
revoke all on table public.access_audit_logs from authenticated;
grant all on table public.access_audit_logs to service_role;
