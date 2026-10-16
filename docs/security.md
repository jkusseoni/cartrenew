# Security (Pingza / CartRenew)

One-page summary of what this codebase and its current hosting do today. Claims are limited to behaviour present in the repo and documented env/hosting assumptions — not aspirational controls.

## Protected customer data — where Pingza reads, exports, or deletes it

Pingza (`!brand.isDefault`) stores shopper **phone**, **email**, and **name** on `abandoned_carts` / `messages` (and email hashes on `email_suppressions`). CartRenew shares much of the same code paths; audit logging below is Pingza-only.

| Action | Location | Fields |
|--------|----------|--------|
| **Write (ingest)** | `POST /api/webhooks/shopify` (`checkouts/*`, `carts/*`) | phone, email, name from checkout payload → `abandoned_carts` |
| **Read (merchant UI)** | `GET /api/app/dashboard` → embedded App Home | name, phone on recent carts |
| **Read (admin)** | `GET /api/admin/messages/pending` | message `phone` (+ shop domain) |
| **Read + send** | `lib/services/recovery-dispatch.ts`, `POST /api/whatsapp/send`, email prepare/send | phone / email / name for WhatsApp or email recovery |
| **Export** | Shopify `customers/data_request` via `lib/shopify/compliance-webhook.ts` → `lib/privacy/compliance.ts` | carts + messages JSON emailed to the configured export recipient |
| **Delete / anonymize (customer)** | Shopify `customers/redact` | nulls phone/email/name/checkout on matching carts/messages; hashes suppressions |
| **Delete (shop)** | Shopify `shop/redact` | deletes store-scoped rows then the store |
| **Delete / anonymize (retention)** | `GET /api/cron/data-retention` → `lib/privacy/retention*.ts` | clears PII / checkout URLs by age (see Retention) |

Access events for admin / data_request / redact / export / send / retention anonymize are recorded for Pingza only (see Access logging). No phone, email, or name values are written into that log.

## Access logging

- Module: `lib/privacy/access-audit.ts` (no-op when `brand.isDefault`).
- Fields: `shop_domain`, `action`, `actor` (route or system name), `record_count`, `created_at`.
- Sink: structured `console.info('[access-audit]', …)` always; optional insert into `access_audit_logs` when [db/migrations/2026-10-17-access-audit-logs.sql](../db/migrations/2026-10-17-access-audit-logs.sql) has been applied.
- **Retention of audit rows:** 90 days (`ACCESS_AUDIT_RETENTION_MS`); purged by the data-retention cron (respects `RETENTION_DRY_RUN`).

## Test vs production data

- **Preview / Vercel `development` (Pingza):** if `PINGZA_PRODUCTION_SUPABASE_URL` is set and `NEXT_PUBLIC_SUPABASE_URL` points at the same host, the Supabase admin client is refused (`lib/supabase-env-guard.ts` + `lib/supabase.ts`). CartRenew skips this guard.
- **Production Pingza + Shopify development stores:** separate open work / PR #65 (`devStoreGuardActive`) blocks production writes from partner development stores when that guard is merged and enabled. That is not the same as the Preview↔production Supabase check above.
- Billing: Pingza production ignores `SHOPIFY_BILLING_TEST=true` (`isShopifyBillingTestFlagActive`).

## Backups / DLP

- **Backups:** Customer data lives in the configured Supabase Postgres project. This repository does not ship a custom backup agent; backup/restore is whatever the Supabase project plan provides in the Supabase dashboard.
- **DLP:** No third-party DLP product is integrated. Operational practice in code is to avoid logging raw PII (`maskPhone`, `redactSecrets`, compliance/retention logs that emit counts/codes only).

## Incident response

- No separate incident-response runbook lives in this repo.
- Merchant / operator contact for Pingza is the configured `NEXT_PUBLIC_SUPPORT_EMAIL` / brand support address on the legal pages.
- Security-sensitive routes fail closed when secrets are missing (e.g. webhook HMAC, `ADMIN_PROCESS_SECRET` on send/automation).

## Access control

- **Merchants (embedded app):** Shopify session token verification (`lib/shopify/verifySessionToken.ts`) for `/api/app/*`.
- **Dashboard / Clerk areas:** Clerk session where enabled; local development may bypass Clerk.
- **Admin APIs:** `requireAdmin` — Clerk user or `ADMIN_PROCESS_SECRET` (`x-admin-secret`).
- **Server-to-server send / cron:** `ADMIN_PROCESS_SECRET` or `CRON_SECRET` (Bearer), fail closed in production when unset.
- **Shopify webhooks:** HMAC with the app client secret; compliance topics on dedicated routes.

## Encryption

- **In transit:** HTTPS on Vercel deployments; Supabase client uses HTTPS.
- **At rest:** Relies on Supabase/Vercel provider defaults. The app does not implement field-level encryption for phone/email/name columns. Offline Shopify tokens and WhatsApp credentials are stored as database columns; treat the service-role key as full database access.

## Retention (customer data)

Implemented in `lib/privacy/retention.ts` / cron `/api/cron/data-retention` (daily in `vercel.json`):

| Rule | Window |
|------|--------|
| Clear checkout URL | 7 days after cart `created_at` |
| Anonymize terminal carts (`messaged` / `recovered` / `lost` / `skipped`) | 30 days after the relevant terminal timestamp |
| Anonymize any cart still holding PII | 90 days after `created_at` |

`RETENTION_DRY_RUN` defaults to **on** (no writes) unless set exactly to `false`. Pingza also clears message email columns when anonymizing; CartRenew skips suppression/email paths where brand-gated.
