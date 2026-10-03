-- WhatsApp send-failure tracking on carts, plus indexes for the Meta status
-- webhook (lookup by whatsapp_message_id) and the retry worker (pending
-- messages by next_retry_at). Idempotent. Apply before deploying the code
-- that writes these columns.

alter table abandoned_carts
  add column if not exists last_send_error text,
  add column if not exists last_send_failed_at timestamptz,
  -- First-attempt claim used by /api/cart-recovery (also in the core schema,
  -- repeated here for databases created before it).
  add column if not exists processing_started_at timestamptz;

-- A queued message owns the provider send only while this claim is fresh.
-- Existing queued rows remain NULL and are reclaimed by created_at after the
-- same timeout, avoiding overlap with an active legacy deployment.
alter table messages
  add column if not exists processing_started_at timestamptz;

create index if not exists idx_messages_whatsapp_message_id
  on messages (whatsapp_message_id)
  where whatsapp_message_id is not null;

create index if not exists idx_messages_pending_retry
  on messages (next_retry_at)
  where status = 'pending';

create index if not exists idx_messages_queued_processing
  on messages (processing_started_at, created_at)
  where status = 'queued';
