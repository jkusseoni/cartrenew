/**
 * Retry policy for WhatsApp recovery sends (pure — no DB access).
 */

/** Total Graph API attempts per recovery message, including the first. */
export const MAX_SEND_ATTEMPTS = 3

/** Reminders older than this are not (re)sent — a late cart reminder is spam. */
export const RECOVERY_SEND_MAX_AGE_MS = 72 * 60 * 60 * 1000

const BASE_RETRY_DELAY_MS = 5 * 60 * 1000

/** Errors that will not succeed on retry (bad/unknown phone). */
const PERMANENT_SEND_ERRORS = new Set(['phone_missing', 'phone_invalid', 'phone_country_unknown'])

export function isPermanentSendError(error: string | null | undefined): boolean {
  return !!error && PERMANENT_SEND_ERRORS.has(error)
}

/** Delay before the next attempt after `attemptsMade` attempts: 5 min, then 15 min. */
export function retryDelayMs(attemptsMade: number): number {
  return BASE_RETRY_DELAY_MS * 3 ** Math.max(0, attemptsMade - 1)
}

export function isTooOldToSend(createdAt: string | null | undefined, now = Date.now()): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(created) && now - created > RECOVERY_SEND_MAX_AGE_MS
}

export type SendOutcomeDecision =
  | { kind: 'sent' }
  | { kind: 'retry'; nextRetryAt: string }
  | { kind: 'failed'; reason: string }

/** Decide what to record after an attempt (attemptsMade includes this one). */
export function decideAfterAttempt(
  accepted: boolean,
  error: string | null | undefined,
  attemptsMade: number,
  now = Date.now()
): SendOutcomeDecision {
  if (accepted) return { kind: 'sent' }
  const reason = error || 'send_failed'
  if (isPermanentSendError(reason) || attemptsMade >= MAX_SEND_ATTEMPTS) {
    return { kind: 'failed', reason }
  }
  return { kind: 'retry', nextRetryAt: new Date(now + retryDelayMs(attemptsMade)).toISOString() }
}
