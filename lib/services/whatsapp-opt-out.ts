import { brand } from '@/lib/brand'
import { redactSecrets } from '@/lib/services/redact-secrets'
import { isSupabaseAdminConfigured, supabaseAdmin } from '@/lib/supabase'
import {
  whatsappOptOutGate,
  whatsappSuppressionKey,
  type OptOutGateResult,
} from '@/lib/whatsapp/opt-out'

const TABLE = 'email_suppressions'
const LOG = '[whatsapp-opt-out]'
const LOOKUP_RETRY_MS = 200

/** PostgREST / Postgres codes that mean the suppressions table is not there. */
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

export type SupabaseErrorFields = {
  code?: string | null
  message?: string | null
  hint?: string | null
}

/**
 * Strip hashes and phone-shaped digits so a PostgREST message that echoes a
 * filter value never lands in logs. Also runs redactSecrets.
 */
export function sanitizeSupabaseLogText(text: string): string {
  return redactSecrets(
    text
      .replace(/hmac1:[0-9a-f]{64}/gi, 'hmac1:[redacted]')
      .replace(/\+?\d{10,15}/g, '[redacted-digits]')
  )
}

/** PII-free view of a Supabase/PostgREST error for logging. */
export function describeSupabaseError(error: unknown): {
  code: string
  message: string
  hint?: string
  missingTable: boolean
} {
  const fields =
    error && typeof error === 'object'
      ? (error as SupabaseErrorFields & { name?: string })
      : null
  const codeRaw =
    typeof fields?.code === 'string' && fields.code
      ? fields.code
      : error instanceof Error && error.name && error.name !== 'Error'
        ? error.name
        : 'unknown'
  const code = sanitizeSupabaseLogText(codeRaw).slice(0, 64)
  const message = sanitizeSupabaseLogText(
    (typeof fields?.message === 'string' && fields.message) ||
      (error instanceof Error ? error.message : String(error)) ||
      'unknown'
  ).slice(0, 300)
  const hintRaw = typeof fields?.hint === 'string' ? fields.hint : undefined
  const hint = hintRaw ? sanitizeSupabaseLogText(hintRaw).slice(0, 200) : undefined
  return {
    code,
    message,
    ...(hint ? { hint } : {}),
    missingTable: MISSING_TABLE.has(code),
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientLookupFailure(described: ReturnType<typeof describeSupabaseError>): boolean {
  if (described.missingTable) return false
  if (described.code === 'supabase_not_configured') return false
  const blob = `${described.code} ${described.message}`.toLowerCase()
  return (
    described.code === 'TimeoutError' ||
    described.code === 'AbortError' ||
    described.code === 'PGRST301' ||
    /timeout|timed out|network|fetch failed|econnreset|etimedout|503|502|500/.test(blob)
  )
}

/**
 * Add a WhatsApp number to the suppression list. Idempotent. Throws when the
 * secret is missing or the write fails, so the webhook can ask Meta to retry.
 */
export async function recordWhatsAppOptOut(phone: string): Promise<void> {
  const key = whatsappSuppressionKey(phone, process.env.SUPPRESSION_HASH_SECRET)
  if (!key) throw new Error('SUPPRESSION_HASH_SECRET missing or number invalid')
  if (!isSupabaseAdminConfigured()) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      { email: key, reason: 'unsubscribed', store_id: null },
      { onConflict: 'email', ignoreDuplicates: true }
    )
  if (error) {
    const described = describeSupabaseError(error)
    console.error(`${LOG} record failed`, described)
    throw new Error(described.message)
  }
}

async function suppressionExistsOnce(key: string): Promise<boolean> {
  if (!isSupabaseAdminConfigured()) {
    const err = Object.assign(new Error('Supabase is not configured'), {
      code: 'supabase_not_configured',
      hint: 'Set NEXT_PUBLIC_SUPABASE_URL (or DATABASE_URL) and SUPABASE_SERVICE_ROLE_KEY',
    })
    throw err
  }

  // Prefer `email` over `id` — same column other suppression lookups use.
  const { data, error } = await supabaseAdmin.from(TABLE).select('email').eq('email', key).limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/** Lookup with one retry on transient PostgREST/network failures. */
export async function suppressionExists(key: string): Promise<boolean> {
  try {
    return await suppressionExistsOnce(key)
  } catch (first) {
    const described = describeSupabaseError(first)
    if (!isTransientLookupFailure(described)) throw first
    await sleep(LOOKUP_RETRY_MS)
    return suppressionExistsOnce(key)
  }
}

/** Pre-send check used by sendWhatsAppMessage. Always 'clear' for CartRenew. */
export async function checkWhatsAppOptOut(phone: string): Promise<OptOutGateResult> {
  // CartRenew: never touch email_suppressions (brand freeze at import).
  if (brand.isDefault) return 'clear'

  const result = await whatsappOptOutGate({
    isDefaultBrand: false,
    phone,
    secret: process.env.SUPPRESSION_HASH_SECRET,
    lookup: suppressionExists,
    onLookupError: (error) => {
      const described = describeSupabaseError(error)
      if (described.missingTable) {
        console.error(`${LOG} lookup failed; send held for retry`, {
          ...described,
          fix: 'Apply pingza-email-migration.sql (email_suppressions) on this Supabase project',
        })
        return
      }
      console.error(`${LOG} lookup failed; send held for retry`, described)
    },
  })
  return result
}
