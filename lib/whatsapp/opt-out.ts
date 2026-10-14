/**
 * WhatsApp opt-out (Pingza only). Pure helpers, no DB access.
 *
 * A recipient who replies STOP (or an equivalent keyword) is added to
 * email_suppressions as an HMAC of "whatsapp:+<E.164>", keyed with
 * SUPPRESSION_HASH_SECRET, so the clear number is never stored there.
 */

import { toE164 } from '@/lib/phone'
import { suppressionHmac } from '@/lib/privacy/suppression-hash'

export const WHATSAPP_OPTED_OUT_ERROR = 'whatsapp_opted_out'
export const WHATSAPP_OPT_OUT_CHECK_FAILED = 'opt_out_check_failed'

const OPT_OUT_KEYWORDS = new Set([
  'stop',
  'unsubscribe',
  'cancel',
  'opt out',
  'opt-out',
  'optout',
  'रोको',
])

const EDGE_PUNCTUATION = /^[\s.!?,;:'"।]+|[\s.!?,;:'"।]+$/g

/** True when the whole reply is an opt-out keyword ("Stop", " STOP! ", "रोको"). */
export function isOptOutReply(text: unknown): boolean {
  if (typeof text !== 'string') return false
  const normalized = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
  return OPT_OUT_KEYWORDS.has(normalized)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Text the customer sent: typed text, a quick-reply button, or an interactive reply. */
function inboundText(message: Record<string, unknown>): unknown {
  switch (message.type) {
    case 'text':
      return asRecord(message.text)?.body
    case 'button':
      return asRecord(message.button)?.text
    case 'interactive': {
      const interactive = asRecord(message.interactive)
      return (
        asRecord(interactive?.button_reply)?.title ?? asRecord(interactive?.list_reply)?.title
      )
    }
    default:
      return null
  }
}

/** E.164 senders of opt-out replies in entry[].changes[].value.messages[], deduplicated. */
export function extractOptOutSenders(body: unknown): string[] {
  const senders = new Set<string>()

  for (const entry of asArray(asRecord(body)?.entry)) {
    for (const change of asArray(asRecord(entry)?.changes)) {
      const value = asRecord(asRecord(change)?.value)
      for (const raw of asArray(value?.messages)) {
        const message = asRecord(raw)
        if (!message || typeof message.from !== 'string') continue
        if (!isOptOutReply(inboundText(message))) continue
        const phone = toE164(`+${message.from.replace(/\D/g, '')}`)
        if (phone.ok) senders.add(phone.e164)
      }
    }
  }

  return [...senders]
}

/** Suppression key for a WhatsApp number, or null without a secret or a valid number. */
export function whatsappSuppressionKey(phone: string, secret: string | undefined): string | null {
  const digits = phone.replace(/\D/g, '')
  const e164 = toE164(phone.trim().startsWith('+') ? phone : `+${digits}`)
  if (!e164.ok) return null
  return suppressionHmac(`whatsapp:${e164.e164}`, secret)
}

export type OptOutGateResult = 'clear' | 'opted_out' | 'error'

/**
 * Whether a send to `phone` may go out. CartRenew is never checked. Without
 * a secret no opt-out can have been recorded, so the send is clear.
 */
export async function whatsappOptOutGate({
  isDefaultBrand,
  phone,
  secret,
  lookup,
}: {
  isDefaultBrand: boolean
  phone: string
  secret: string | undefined
  lookup: (key: string) => Promise<boolean>
}): Promise<OptOutGateResult> {
  if (isDefaultBrand) return 'clear'
  const key = whatsappSuppressionKey(phone, secret)
  if (!key) return 'clear'
  try {
    return (await lookup(key)) ? 'opted_out' : 'clear'
  } catch {
    return 'error'
  }
}
