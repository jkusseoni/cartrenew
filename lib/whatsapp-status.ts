import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Pure helpers for the Meta WhatsApp status webhook (no DB access).
 */

export type MessageStatus = 'queued' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export type MetaStatusEvent = {
  whatsappMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  /** Meta's event time (unix seconds) as ISO; null when absent/unparseable. */
  occurredAt: string | null
  /** "code: title" of the first error for failed statuses. */
  error: string | null
}

/**
 * Statuses a message may move *from* when Meta reports `next`.
 * Never downgrades: read > delivered > sent. `failed` only applies before
 * delivery; a later delivered/read report wins over failed.
 */
export const ALLOWED_PRIOR_STATUSES: Record<MetaStatusEvent['status'], MessageStatus[]> = {
  sent: ['queued'],
  failed: ['sent'],
  delivered: ['queued', 'pending', 'sent', 'failed'],
  read: ['queued', 'pending', 'sent', 'failed', 'delivered'],
}

export function canTransition(from: string, to: MetaStatusEvent['status']): boolean {
  return (ALLOWED_PRIOR_STATUSES[to] as string[]).includes(from)
}

/** Validates X-Hub-Signature-256 ("sha256=<hex HMAC of raw body>"). */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false
  const [scheme, received] = signatureHeader.split('=', 2)
  if (scheme !== 'sha256' || !received || !/^[0-9a-f]{64}$/i.test(received)) return false

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received.toLowerCase(), 'hex'))
}

const KNOWN_STATUSES = new Set(['sent', 'delivered', 'read', 'failed'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toIsoFromUnixSeconds(value: unknown): string | null {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

function describeFirstError(errors: unknown): string | null {
  const first = asRecord(asArray(errors)[0])
  if (!first) return null
  const code = first.code ?? 'unknown'
  const title = first.title ?? first.message ?? ''
  return `${code}: ${title}`.trim()
}

/** Flattens entry[].changes[].value.statuses[] from a webhook body. */
export function extractStatusEvents(body: unknown): MetaStatusEvent[] {
  const events: MetaStatusEvent[] = []

  for (const entry of asArray(asRecord(body)?.entry)) {
    for (const change of asArray(asRecord(entry)?.changes)) {
      const value = asRecord(asRecord(change)?.value)
      for (const rawStatus of asArray(value?.statuses)) {
        const status = asRecord(rawStatus)
        const id = typeof status?.id === 'string' ? status.id : null
        const state = typeof status?.status === 'string' ? status.status : null
        if (!id || !state || !KNOWN_STATUSES.has(state)) continue

        events.push({
          whatsappMessageId: id,
          status: state as MetaStatusEvent['status'],
          occurredAt: toIsoFromUnixSeconds(status?.timestamp),
          error: state === 'failed' ? describeFirstError(status?.errors) : null,
        })
      }
    }
  }

  return events
}
