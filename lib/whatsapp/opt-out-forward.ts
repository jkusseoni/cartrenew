/**
 * CartRenew → Pingza forwarding of WhatsApp opt-out replies.
 *
 * Both brands share one Meta app and number, and Meta only calls the
 * CartRenew webhook. CartRenew forwards the original signed body of any
 * payload containing an opt-out reply to PINGZA_WEBHOOK_FORWARD_URL, where
 * Pingza verifies the Meta signature again and records the opt-out.
 */

import { extractOptOutSenders, summarizeInboundMessages } from '@/lib/whatsapp/opt-out'

export const OPT_OUT_FORWARD_TIMEOUT_MS = 5_000

/** Set on forwarded requests; a request carrying it is never forwarded again. */
export const OPT_OUT_FORWARDED_HEADER = 'x-cartrenew-forwarded'

export const WEBHOOK_LOG_PREFIX = '[whatsapp-webhook]'

export type ForwardSkipReason =
  | 'not_cartrenew'
  | 'already_forwarded'
  | 'signature_unverified'
  | 'signature_header_missing'
  | 'no_opt_out_keyword'
  | 'invalid_sender'
  | 'env_unset'
  | 'invalid_url'

export type ForwardDecision = { forward: true; url: string } | { forward: false; reason: ForwardSkipReason }

function forwardUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.toString()
  } catch {
    // fall through
  }
  return null
}

/** Whether to forward this webhook, and where. Only CartRenew forwards. */
export function optOutForwardDecision({
  isDefaultBrand,
  configuredUrl,
  signatureVerified,
  signatureHeader,
  alreadyForwarded,
  body,
}: {
  isDefaultBrand: boolean
  configuredUrl: string | undefined
  signatureVerified: boolean
  signatureHeader: string | null
  alreadyForwarded: boolean
  body: unknown
}): ForwardDecision {
  const skip = (reason: ForwardSkipReason): ForwardDecision => ({ forward: false, reason })
  if (!isDefaultBrand) return skip('not_cartrenew')
  if (alreadyForwarded) return skip('already_forwarded')
  if (!signatureVerified) return skip('signature_unverified')
  if (!signatureHeader) return skip('signature_header_missing')
  if (!summarizeInboundMessages(body).some((m) => m.optOutKeyword)) return skip('no_opt_out_keyword')
  if (extractOptOutSenders(body).length === 0) return skip('invalid_sender')
  const configured = configuredUrl?.trim()
  if (!configured) return skip('env_unset')
  const url = forwardUrl(configured)
  return url ? { forward: true, url } : skip('invalid_url')
}

/** POST the original body and signature. Returns whether Pingza accepted it. */
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
}): Promise<boolean> {
  const started = Date.now()
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
    const line = `${WEBHOOK_LOG_PREFIX} forward attempted status=${res.status}${
      res.redirected ? ' redirected=true' : ''
    } duration_ms=${Date.now() - started}`
    if (res.ok) console.log(line)
    else console.error(line)
    return res.ok
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error'
    const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code
    const cause = typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? ` cause=${code}` : ''
    console.error(
      `${WEBHOOK_LOG_PREFIX} forward attempted error=${name}${cause} duration_ms=${Date.now() - started}`
    )
    return false
  }
}
