-- WooCommerce plugin deactivation feedback (opt-in, no PII: no email, name or customer data).
-- Rows: selected reason, optional short comment, plugin/WP/WC versions.
-- RLS on, no policies → PostgREST anon/authenticated cannot read/write.
-- Explicit service_role grants only (same pattern as access_audit_logs).

create table if not exists public.woocommerce_plugin_feedback (
  id             uuid primary key default gen_random_uuid(),
  reason         text not null,
  comment        text,
  plugin_version text,
  wp_version     text,
  wc_version     text,
  connected      boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_woocommerce_plugin_feedback_created_at
  on public.woocommerce_plugin_feedback (created_at desc);

comment on table public.woocommerce_plugin_feedback is
  'Opt-in deactivation survey from the CartRenew for WooCommerce plugin. No PII.';

alter table public.woocommerce_plugin_feedback enable row level security;

revoke all on table public.woocommerce_plugin_feedback from public;
revoke all on table public.woocommerce_plugin_feedback from anon;
revoke all on table public.woocommerce_plugin_feedback from authenticated;
grant all on table public.woocommerce_plugin_feedback to service_role;
