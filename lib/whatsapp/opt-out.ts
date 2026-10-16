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
  // Meta's standard marketing opt-out quick-reply button.
  'stop promotions',
  'रोको',
])

const EDGE_PUNCTUATION = /^[\s.!?,;:'"।]+|[\s.!?,;:'"।]+$/g
// Zero-width and BOM characters some keyboards insert around words.
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/g

/** True when the whole reply is an opt-out keyword ("Stop", " STOP! ", "रोको"). */
export function isOptOutReply(text: unknown): boolean {
  if (typeof text !== 'string') return false
  const normalized = text
    .normalize('NFC')
    .replace(INVISIBLE, '')
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

/** Inbound messages in entry[].changes[].value.messages[]. Replies to a template carry `context`. */
function* inboundMessages(body: unknown): Generator<Record<string, unknown>> {
  for (const entry of asArray(asRecord(body)?.entry)) {
    for (const change of asArray(asRecord(entry)?.changes)) {
      const value = asRecord(asRecord(change)?.value)
      for (const raw of asArray(value?.messages)) {
        const message = asRecord(raw)
        if (message) yield message
      }
    }
  }
}

/** E.164 senders of opt-out replies, deduplicated. */
export function extractOptOutSenders(body: unknown): string[] {
  const senders = new Set<string>()
  for (const message of inboundMessages(body)) {
    if (typeof message.from !== 'string') continue
    if (!isOptOutReply(inboundText(message))) continue
    const phone = toE164(`+${message.from.replace(/\D/g, '')}`)
    if (phone.ok) senders.add(phone.e164)
  }
  return [...senders]
}

export type InboundMessageSummary = {
  /** Meta message type ("text", "button", ...), or "other" if not a plain identifier. */
  type: string
  /** The customer replied to a specific message (e.g. a template) */
  isReply: boolean
  optOutKeyword: boolean
}

/** PII-free view of the inbound messages, for logging. */
export function summarizeInboundMessages(body: unknown): InboundMessageSummary[] {
  return [...inboundMessages(body)].map((message) => ({
    type:
      typeof message.type === 'string' && /^[a-z_]{1,32}$/.test(message.type)
        ? message.type
        : 'other',
    isReply: asRecord(message.context) !== null,
    optOutKeyword: isOptOutReply(inboundText(message)),
  }))
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
  onLookupError,
}: {
  isDefaultBrand: boolean
  phone: string
  secret: string | undefined
  lookup: (key: string) => Promise<boolean>
  /** Called with the thrown value when lookup fails (before returning 'error'). */
  onLookupError?: (error: unknown) => void
}): Promise<OptOutGateResult> {
  if (isDefaultBrand) return 'clear'
  const key = whatsappSuppressionKey(phone, secret)
  if (!key) return 'clear'
  try {
    return (await lookup(key)) ? 'opted_out' : 'clear'
  } catch (error) {
    onLookupError?.(error)
    return 'error'
  }
}
