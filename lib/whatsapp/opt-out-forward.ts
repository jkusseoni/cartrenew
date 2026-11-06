/**
 * CartRenew → Pingza forwarding of WhatsApp webhooks.
 *
 * Both brands share one Meta app and number, and Meta only calls the
 * CartRenew webhook. CartRenew forwards the original signed body of any
 * payload containing an opt-out reply (or an unknown status wamid) to
 * PINGZA_WEBHOOK_FORWARD_URL, where Pingza verifies the Meta signature again.
 */

import { after } from 'next/server'

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
  | 'no_unknown_status'
  | 'invalid_sender'
  | 'env_unset'
  | 'invalid_url'

export type ForwardDecision = { forward: true; url: string } | { forward: false; reason: ForwardSkipReason }

function skip(reason: ForwardSkipReason): ForwardDecision {
  return { forward: false, reason }
}

/** Shared CartRenew → Pingza guards (brand, loop, signature, env). */
function forwardTarget({
  isDefaultBrand,
  configuredUrl,
  signatureVerified,
  signatureHeader,
  alreadyForwarded,
}: {
  isDefaultBrand: boolean
  configuredUrl: string | undefined
  signatureVerified: boolean
  signatureHeader: string | null
  alreadyForwarded: boolean
}): ForwardDecision | { forward: true; url: string } {
  if (!isDefaultBrand) return skip('not_cartrenew')
  if (alreadyForwarded) return skip('already_forwarded')
  if (!signatureVerified) return skip('signature_unverified')
  if (!signatureHeader) return skip('signature_header_missing')
  const configured = configuredUrl?.trim()
  if (!configured) return skip('env_unset')
  const url = forwardUrl(configured)
  return url ? { forward: true, url } : skip('invalid_url')
}

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
  const target = forwardTarget({
    isDefaultBrand,
    configuredUrl,
    signatureVerified,
    signatureHeader,
    alreadyForwarded,
  })
  if (!target.forward) return target
  if (!summarizeInboundMessages(body).some((m) => m.optOutKeyword)) return skip('no_opt_out_keyword')
  if (extractOptOutSenders(body).length === 0) return skip('invalid_sender')
  return target
}

/**
 * Forward a verified status payload when CartRenew did not own the wamid
 * (`unknown_message`). Opt-out forwarding stays on optOutForwardDecision.
 */
export function statusForwardDecision({
  isDefaultBrand,
  configuredUrl,
  signatureVerified,
  signatureHeader,
  alreadyForwarded,
  unknownStatusCount,
}: {
  isDefaultBrand: boolean
  configuredUrl: string | undefined
  signatureVerified: boolean
  signatureHeader: string | null
  alreadyForwarded: boolean
  unknownStatusCount: number
}): ForwardDecision {
  const target = forwardTarget({
    isDefaultBrand,
    configuredUrl,
    signatureVerified,
    signatureHeader,
    alreadyForwarded,
  })
  if (!target.forward) return target
  if (!(unknownStatusCount > 0)) return skip('no_unknown_status')
  return target
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
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error'
    const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code
    const cause = typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? ` cause=${code}` : ''
    console.error(
      `${WEBHOOK_LOG_PREFIX} forward attempted error=${name}${cause} duration_ms=${Date.now() - started}`
    )
  }
}

/**
 * Run after the response via next/server after(). Outside a request scope it
 * runs detached, which a serverless platform may cut short.
 */
export function runAfterResponse(task: () => Promise<void>): 'after' | 'detached' {
  try {
    after(task)
    return 'after'
  } catch {
    void task()
    return 'detached'
  }
}
