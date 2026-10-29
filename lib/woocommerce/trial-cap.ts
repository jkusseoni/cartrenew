// lib/woocommerce/trial-cap.ts
//
// Free-message cap for WooCommerce stores. WhatsApp templates are sent from
// CartRenew's own number, so every message costs money; stores created through
// /api/woocommerce/register-store start with billing_status "pending" and must
// not send unlimited messages for free.
//
// A store is exempt when:
//   - stores.billing_status is "active" (case-insensitive), or
//   - stores.message_cap_override is set (a number raises/lowers the cap for
//     that store; a negative number means unlimited — use it to lift the cap
//     manually for a paying store).

export const DEFAULT_FREE_MESSAGE_LIMIT = 25

export interface TrialCapInput {
  billingStatus: string | null | undefined
  /** stores.message_cap_override — null/undefined means "use the default". */
  messageCapOverride: number | null | undefined
  /** Messages already accepted by WhatsApp for this store. */
  used: number
  /** Default cap for stores without an override. */
  defaultLimit: number
}

export interface TrialCapDecision {
  allowed: boolean
  limit: number | null // null = unlimited
  used: number
  reason: 'billing_active' | 'override_unlimited' | 'under_limit' | 'limit_reached'
}

export function resolveFreeMessageLimit(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_FREE_MESSAGE_LIMIT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return DEFAULT_FREE_MESSAGE_LIMIT
  return Math.floor(parsed)
}

export function evaluateTrialCap(input: TrialCapInput): TrialCapDecision {
  const { billingStatus, messageCapOverride, used, defaultLimit } = input

  if ((billingStatus ?? '').toLowerCase() === 'active') {
    return { allowed: true, limit: null, used, reason: 'billing_active' }
  }

  if (typeof messageCapOverride === 'number') {
    if (messageCapOverride < 0) {
      return { allowed: true, limit: null, used, reason: 'override_unlimited' }
    }
    const allowed = used < messageCapOverride
    return {
      allowed,
      limit: messageCapOverride,
      used,
      reason: allowed ? 'under_limit' : 'limit_reached',
    }
  }

  // A negative default (env) disables the cap entirely.
  if (defaultLimit < 0) {
    return { allowed: true, limit: null, used, reason: 'override_unlimited' }
  }

  const allowed = used < defaultLimit
  return {
    allowed,
    limit: defaultLimit,
    used,
    reason: allowed ? 'under_limit' : 'limit_reached',
  }
}
