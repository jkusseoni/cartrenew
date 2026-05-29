Migration & Alerting Setup
=========================

Purpose
-------
This document contains the SQL migration to add lightweight attempt-tracking and a simple `alerts` table, plus steps to apply it in Supabase or via psql. It also explains how to enable webhook alerting for the monitoring helper `lib/monitoring.ts`.

Files in this repo
- Migration SQL: [db/migrations/2026-05-29-add-attempts-processing-and-alerts.sql](db/migrations/2026-05-29-add-attempts-processing-and-alerts.sql#L1-L200)
- Monitoring helper: [lib/monitoring.ts](lib/monitoring.ts#L1-L200)

SQL (copy-paste into Supabase SQL editor)
-----------------------------------------
Run the following SQL in the Supabase SQL editor or your preferred Postgres client.

```sql
-- Migration: add attempt tracking and processing timestamps
-- Run this against your Postgres / Supabase database

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add attempts and processing_started_at to abandoned_carts
ALTER TABLE IF EXISTS abandoned_carts
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

-- Add attempts to messages table
ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0;

-- Create a simple alerts table for lightweight monitoring
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  level text NOT NULL,
  source text,
  event_type text,
  payload jsonb
);

-- Index common queries
CREATE INDEX IF NOT EXISTS alerts_event_type_idx ON alerts (event_type);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at);
```

Apply via Supabase SQL editor
-----------------------------
1. Open your Supabase project, go to "SQL Editor" → "New query".
2. Paste the SQL block above and run it.
3. Verify tables/columns were added:
   - `abandoned_carts` should have `attempts` and `processing_started_at` columns
   - `messages` should have `attempts` column
   - `alerts` table should exist

Apply via psql (optional)
-------------------------
If you prefer CLI, run:

```bash
PGCONN="$DATABASE_URL" psql "$PGCONN" -f db/migrations/2026-05-29-add-attempts-processing-and-alerts.sql
```

Note: replace `$DATABASE_URL` with your DB connection string.

Enable webhook alerting
-----------------------
`lib/monitoring.ts` writes alerts to the `alerts` table and will POST to an optional webhook when `ALERT_WEBHOOK_URL` is set.

- To receive webhook alerts (Slack, PagerDuty, or an incoming webhook endpoint), set the environment variable in your deployment platform (Vercel, Supabase Edge Functions, etc.):

```
ALERT_WEBHOOK_URL=https://example.com/your-webhook-path
```

- Restart the deployment (or redeploy) so the environment variable is picked up.

Verify alerting
---------------
- Trigger a test alert by creating a row in `alerts` via SQL or calling `alertEvent()` from server code.
- Check the `alerts` table and your webhook receiver for the event.

Notes & next steps
------------------
- This migration is additive and safe to re-run, but verify backups if you have custom constraints.
- Consider adding a small admin UI to surface `failed_permanently` carts and `alerts`.
- For production-grade monitoring, wire alerts to a dedicated service (Sentry/Datadog/PagerDuty) in addition to the webhook.

If you want, I can add an `npm` script that runs the SQL file via `psql` (requires `DATABASE_URL`) or create a small admin page to view `alerts`.
