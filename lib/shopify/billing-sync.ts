/**
 * Sync stores.billing_* from Shopify currentAppInstallation.activeSubscriptions.
 * Used after charge approval (billing=ok) and when the DB still shows NONE.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  getActiveAppSubscriptions,
  inferPlanIdFromSubscriptionName,
  isShopifyBillingPlanId,
  toDbBillingStatus,
  type ShopifyBillingPlanId,
} from '@/lib/shopify/billing'

const LOG = '[billing-sync]'

/** DB / UI values that mean "no live plan" (schema default is uppercase NONE). */
export function isInactiveBillingStatus(status: string | null | undefined): boolean {
  if (status == null || status === '') return true
  const normalized = status.trim().toLowerCase()
  return (
    normalized === 'none' ||
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'declined' ||
    normalized === 'expired'
  )
}

/** Prefer ACTIVE (includes trial); accept common casings. */
export function pickActiveSubscription<
  T extends { id: string; name: string; status: string; currentPeriodEnd: string | null },
>(
  active: T[],
  preferredSubscriptionId?: string | null
): T | null {
  if (preferredSubscriptionId) {
    const byId = active.find((sub) => sub.id === preferredSubscriptionId)
    if (byId) return byId
  }
  const live = active.find((sub) => {
    const status = sub.status.toUpperCase()
    return status === 'ACTIVE' || status === 'ACCEPTED'
  })
  return live ?? active[0] ?? null
}

export function resolveBillingPlanId(options: {
  preferredPlan?: string | null
  subscriptionName?: string | null
  existingPlan?: string | null
}): ShopifyBillingPlanId | null {
  const preferred = options.preferredPlan?.trim().toLowerCase()
  if (preferred && isShopifyBillingPlanId(preferred)) return preferred
  const inferred = inferPlanIdFromSubscriptionName(options.subscriptionName)
  if (inferred) return inferred
  const existing = options.existingPlan?.trim().toLowerCase()
  if (existing && isShopifyBillingPlanId(existing)) return existing
  return null
}

export type BillingSyncResult = {
  synced: boolean
  source: 'shopify' | 'db_unchanged' | 'no_subscription' | 'error'
  status: string | null
  plan: string | null
  activeCount: number
}

/**
 * Re-query Shopify and write billing_plan / billing_status onto the store row.
 * Never throws — callers keep serving the dashboard on failure.
 */
export async function syncStoreBillingFromShopify(options: {
  storeId: string
  shop: string
  accessToken: string
  /** plan=starter from the return URL */
  preferredPlan?: string | null
  preferredSubscriptionId?: string | null
  existingPlan?: string | null
  /** Why this sync ran — logged only */
  reason: 'billing_ok' | 'db_none' | 'callback'
}): Promise<BillingSyncResult> {
  try {
    const active = await getActiveAppSubscriptions(options.shop, options.accessToken)
    const match = pickActiveSubscription(active, options.preferredSubscriptionId)

    if (!match) {
      console.info(`${LOG} shop=${options.shop} source=no_subscription reason=${options.reason} activeSubscriptions=0 status=none`)
      return { synced: false, source: 'no_subscription', status: null, plan: null, activeCount: 0 }
    }

    const status = toDbBillingStatus(match.status)
    const plan = resolveBillingPlanId({
      preferredPlan: options.preferredPlan,
      subscriptionName: match.name,
      existingPlan: options.existingPlan,
    })

    const { error } = await supabaseAdmin
      .from('stores')
      .update({
        billing_status: status,
        shopify_subscription_id: match.id,
        billing_plan: plan,
        billing_current_period_end: match.currentPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', options.storeId)

    if (error) {
      console.error(`${LOG} shop=${options.shop} source=error reason=${options.reason} activeSubscriptions=${active.length} status=${status}`)
      return { synced: false, source: 'error', status, plan, activeCount: active.length }
    }

    console.info(
      `${LOG} shop=${options.shop} source=shopify reason=${options.reason} activeSubscriptions=${active.length} status=${status} plan=${plan ?? 'null'}`
    )
    return { synced: true, source: 'shopify', status, plan, activeCount: active.length }
  } catch (error) {
    console.error(
      `${LOG} shop=${options.shop} source=error reason=${options.reason} activeSubscriptions=-1 status=error`,
      error instanceof Error ? error.message : 'unknown'
    )
    return { synced: false, source: 'error', status: null, plan: null, activeCount: -1 }
  }
}

/** Pingza dashboard: sync when returning from charge approval or DB still says NONE. */
export function shouldSyncBillingOnDashboard(options: {
  isDefaultBrand: boolean
  billingOk: boolean
  billingStatus: string | null | undefined
}): boolean {
  if (options.isDefaultBrand) return false
  if (options.billingOk) return true
  return isInactiveBillingStatus(options.billingStatus)
}
