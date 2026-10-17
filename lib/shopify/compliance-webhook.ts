import { randomUUID } from 'crypto'

import { NextRequest } from 'next/server'

import { brand } from '@/lib/brand'
import {
  auditActionForComplianceTopic,
  recordAccessAudit,
} from '@/lib/privacy/access-audit'
import { complianceErrorCode, runCompliance } from '@/lib/privacy/compliance'
import { createSupabasePrivacyDb } from '@/lib/privacy/compliance-db'
import { deliverPrivacyExportEmail, privacyExportRecipient } from '@/lib/privacy/export-mail'
import { PrivacyConfigError } from '@/lib/privacy/compliance-errors'
import { hasShopifyClientSecret, verifyWebhookHmac } from '@/lib/shopify/config'

function resolveTopic(req: NextRequest, topic?: string): string {
  if (topic) return topic

  const headerTopic = req.headers.get('x-shopify-topic')
  if (headerTopic) return headerTopic

  const marker = '/api/webhooks/'
  const pathname = req.nextUrl.pathname
  const idx = pathname.indexOf(marker)
  if (idx !== -1) {
    const suffix = pathname.slice(idx + marker.length).replace(/\/$/, '')
    if (suffix) return suffix
  }

  return 'unknown'
}

/**
 * Mandatory GDPR/compliance webhooks. Validates `X-Shopify-Hmac-SHA256` against
 * the raw body using SHOPIFY_API_SECRET (via getShopifyClientSecret).
 */
export async function handleShopifyComplianceWebhook(
  req: NextRequest,
  topic?: string
): Promise<Response> {
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  const shopDomain = req.headers.get('x-shopify-shop-domain') || 'unknown'
  const resolvedTopic = resolveTopic(req, topic)
  const rawBody = await req.text()

  if (!hasShopifyClientSecret()) {
    console.error(
      `[compliance-webhook] ${resolvedTopic} rejected: SHOPIFY_CLIENT_SECRET / SHOPIFY_API_SECRET is not configured`
    )
    return new Response('Webhook secret not configured', { status: 500 })
  }

  if (!verifyWebhookHmac(rawBody, hmac)) {
    console.error(
      `[compliance-webhook] ${resolvedTopic} HMAC verification failed for ${shopDomain} at ${req.nextUrl.pathname}`
    )
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: unknown = {}
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown
    } catch {
      return new Response('Bad request', { status: 400 })
    }
  }

  const requestId = randomUUID()
  try {
    await runCompliance({
      topic: resolvedTopic,
      shopDomain,
      body: payload,
      requestId,
      skipSuppressions: brand.isDefault,
      hashSecret: process.env.SUPPRESSION_HASH_SECRET ?? '',
      db: createSupabasePrivacyDb(),
      log: (entry) => {
        console.info('[compliance-webhook]', entry)
        const action = auditActionForComplianceTopic(entry.topic)
        if (action) {
          void recordAccessAudit({
            shop: entry.shopDomain,
            action,
            actor: `POST ${req.nextUrl.pathname}`,
            count: entry.carts + entry.messages + entry.suppressions,
          })
        }
      },
      deliverExport: async ({ requestId: exportId, body }) => {
        const recipient = privacyExportRecipient(brand.isDefault, brand.supportEmail)
        const from = (process.env.RESEND_FROM_EMAIL ?? '').trim()
        const apiKey = (process.env.RESEND_API_KEY ?? '').trim()
        if (!recipient || !from || !apiKey) {
          throw new PrivacyConfigError('export_not_configured')
        }
        await deliverPrivacyExportEmail({
          requestId: exportId,
          body,
          recipient,
          from,
          apiKey,
        })
      },
    })
  } catch (error) {
    console.error('[compliance-webhook] failed', {
      topic: resolvedTopic,
      shopDomain,
      requestId,
      code: complianceErrorCode(error),
    })
    return new Response('Retry', { status: 500 })
  }

  return new Response(null, { status: 200 })
}

export async function POST(req: NextRequest) {
  return handleShopifyComplianceWebhook(req)
}
