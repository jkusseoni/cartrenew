/**
 * CartRenew → Pingza forwarding of WhatsApp opt-out replies.
 *
 * Both brands share one Meta app and number, and Meta only calls the
 * CartRenew webhook. CartRenew forwards the original signed body of any
 * payload containing an opt-out reply to PINGZA_WEBHOOK_FORWARD_URL, where
 * Pingza verifies the Meta signature again and records the opt-out.
 */

import { after } from 'next/server'

import { extractOptOutSenders } from '@/lib/whatsapp/opt-out'

export const OPT_OUT_FORWARD_TIMEOUT_MS = 5_000

/** Set on forwarded requests; a request carrying it is never forwarded again. */
export const OPT_OUT_FORWARDED_HEADER = 'x-cartrenew-forwarded'

function forwardUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.toString()
  } catch {
    // fall through
  }
  console.error('PINGZA_WEBHOOK_FORWARD_URL is not a valid https URL; opt-out not forwarded')
  return null
}

/** URL to forward this webhook to, or null. Only CartRenew forwards. */
export function optOutForwardTarget({
  isDefaultBrand,
  configuredUrl,
  signatureVerified,
  alreadyForwarded,
  body,
}: {
  isDefaultBrand: boolean
  configuredUrl: string | undefined
  signatureVerified: boolean
  alreadyForwarded: boolean
  body: unknown
}): string | null {
  if (!isDefaultBrand || alreadyForwarded || !signatureVerified) return null
  if (!configuredUrl?.trim()) return null
  if (extractOptOutSenders(body).length === 0) return null
  return forwardUrl(configuredUrl)
}

/** POST the original body and signature. Never throws; logs carry no phone numbers. */
export async function forwardOptOutWebhook({
  url,
  rawBody,
  signature,
  fetchImpl = fetch,
  timeoutMs = OPT_OUT_FORWARD_TIMEOUT_MS,
}: {
  url: string
  rawBody: string
  signature: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): Promise<void> {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        [OPT_OUT_FORWARDED_HEADER]: '1',
      },
      body: rawBody,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      console.error('WhatsApp opt-out forward to Pingza failed', { status: res.status })
      return
    }
    console.log('WhatsApp opt-out forwarded to Pingza', { status: res.status })
  } catch (error) {
    console.error('WhatsApp opt-out forward to Pingza failed', {
      error: error instanceof Error ? error.name : 'Error',
    })
  }
}

/** Run after the response via next/server after(); outside a request scope, run detached. */
export function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task)
  } catch {
    void task()
  }
}
