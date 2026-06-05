export const LTD_TIERS = {
  SINGLE: {
    channels: ["whatsapp", "email"],
    label: "Single",
    monthlyRecoveryLimit: 500,
    priceEnv: "STRIPE_PRICE_SINGLE",
    prioritySupport: false,
    storeLimit: 1,
  },
  DOUBLE: {
    channels: ["whatsapp", "email", "sms"],
    label: "Double",
    monthlyRecoveryLimit: 2000,
    priceEnv: "STRIPE_PRICE_DOUBLE",
    prioritySupport: false,
    storeLimit: 3,
  },
  MULTIPLE: {
    channels: ["whatsapp", "email", "sms"],
    label: "Multiple",
    monthlyRecoveryLimit: null,
    priceEnv: "STRIPE_PRICE_MULTIPLE",
    prioritySupport: true,
    storeLimit: 999999,
  },
} as const;

export type LifetimeDealTierKey = keyof typeof LTD_TIERS;

export function parseLifetimeDealTier(value: unknown): LifetimeDealTierKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();

  return isLifetimeDealTier(normalizedValue) ? normalizedValue : null;
}

export function isLifetimeDealTier(value: string): value is LifetimeDealTierKey {
  return value === "SINGLE" || value === "DOUBLE" || value === "MULTIPLE";
}

export function getLifetimeDealRules(tier: LifetimeDealTierKey) {
  return LTD_TIERS[tier];
}

export function getStripePriceId(tier: LifetimeDealTierKey) {
  const priceId = process.env[LTD_TIERS[tier].priceEnv]?.trim();

  return priceId || "";
}

export function getLifetimeDealConfig(tier: LifetimeDealTierKey) {
  const rules = getLifetimeDealRules(tier);

  return {
    channels: [...rules.channels],
    isLifetimeDeal: true,
    monthlyRecoveryLimit: rules.monthlyRecoveryLimit,
    planLabel: rules.label,
    prioritySupport: rules.prioritySupport,
    storeLimit: rules.storeLimit,
    tier,
    unlimitedRecoveries: rules.monthlyRecoveryLimit === null,
    unlimitedStores: tier === "MULTIPLE",
  };
}
