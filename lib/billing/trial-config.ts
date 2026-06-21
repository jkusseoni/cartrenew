export const TRIAL_DURATION_DAYS = 14;

export type SubscriptionStatus = "TRIAL" | "PAID" | "EXPIRED";

export type PlanType = "trial" | "starter" | "growth" | "scale";

export const PLAN_LABELS: Record<PlanType, string> = {
  trial: "14-Day Free Trial",
  starter: "Starter Plan",
  growth: "Growth Plan",
  scale: "Scale Plan",
};

/** Global $12/mo Starter tier — shared with PricingTable checkout routing. */
export const STARTER_TIER = {
  id: "gl-starter",
  name: "Starter",
  priceUsd: 12,
  paypalCheckoutUrl: "https://www.paypal.com/ncp/payment/Y8MTCQRFMU82G",
  stripeCheckoutPath: "/api/checkout?tier=starter",
} as const;

/** Landing-page anchor where PricingTable (PayPal / Stripe tiers) is mounted. */
export const PRICING_TABLE_HASH = "#pricing";

export function pricingTablePath(locale = "en") {
  return `/${locale}${PRICING_TABLE_HASH}`;
}
