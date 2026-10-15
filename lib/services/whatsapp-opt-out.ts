import { brand } from '@/lib/brand'
import { maskPhone } from '@/lib/phone'
import { redactSecrets } from '@/lib/services/redact-secrets'
import { supabaseAdmin } from '@/lib/supabase'
import {
  whatsappOptOutGate,
  whatsappSuppressionKey,
  type OptOutGateResult,
} from '@/lib/whatsapp/opt-out'

const TABLE = 'email_suppressions'

/**
 * Add a WhatsApp number to the suppression list. Idempotent. Throws when the
 * secret is missing or the write fails, so the webhook can ask Meta to retry.
 */
export async function recordWhatsAppOptOut(phone: string): Promise<void> {
  const key = whatsappSuppressionKey(phone, process.env.SUPPRESSION_HASH_SECRET)
  if (!key) throw new Error('SUPPRESSION_HASH_SECRET missing or number invalid')

  const { error } = await supabaseAdmin
    .from(TABLE)
    .upsert(
      { email: key, reason: 'unsubscribed', store_id: null },
      { onConflict: 'email', ignoreDuplicates: true }
    )
  if (error) throw new Error(redactSecrets(error.message))
}

async function suppressionExists(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from(TABLE).select('id').eq('email', key).limit(1)
  if (error) throw new Error(redactSecrets(error.message))
  return (data?.length ?? 0) > 0
}

/** Pre-send check used by sendWhatsAppMessage. Always 'clear' for CartRenew. */
export async function checkWhatsAppOptOut(phone: string): Promise<OptOutGateResult> {
  const result = await whatsappOptOutGate({
    isDefaultBrand: brand.isDefault,
    phone,
    secret: process.env.SUPPRESSION_HASH_SECRET,
    lookup: suppressionExists,
  })
  if (result === 'error') {
    console.error('WhatsApp opt-out lookup failed; send held for retry', { phone: maskPhone(phone) })
  }
  return result
}
