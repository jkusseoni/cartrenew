/**
 * Shopify App Billing — recurring subscriptions via Admin GraphQL.
 *
 * Docs: https://shopify.dev/docs/apps/launch/billing
 * Mutation: appSubscriptionCreate
 */

import { getShopifyApiVersion, getShopifyAppUrl } from "@/lib/shopify/config";
import { TRIAL_DURATION_DAYS } from "@/lib/billing/trial-config";

export type ShopifyBillingPlanId = "starter" | "growth" | "scale";

export type ShopifyBillingPlan = {
  id: ShopifyBillingPlanId;
  name: string;
  amount: number;
  currencyCode: "USD";
  interval: "EVERY_30_DAYS";
  trialDays: number;
  description: string;
};

/** Monthly USD plans charged through Shopify Billing (App Store compliant). */
export const SHOPIFY_BILLING_PLANS: Record<ShopifyBillingPlanId, ShopifyBillingPlan> = {
  starter: {
    id: "starter",
    name: "CartRenew Starter",
    amount: 12,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: TRIAL_DURATION_DAYS,
    description: "1 store · 200 cart recoveries / month · WhatsApp + Email",
  },
  growth: {
    id: "growth",
    name: "CartRenew Growth",
    amount: 29,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: TRIAL_DURATION_DAYS,
    description: "3 stores · 1,000 recoveries / month · WhatsApp + Email + SMS",
  },
  scale: {
    id: "scale",
    name: "CartRenew Scale",
    amount: 69,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: TRIAL_DURATION_DAYS,
    description: "Unlimited stores · Unlimited recoveries · Priority support",
  },
};

export type BillingStatus =
  | "NONE"
  | "PENDING"
  | "ACTIVE"
  | "CANCELLED"
  | "DECLINED"
  | "EXPIRED"
  | "FROZEN";

type GraphQlError = { message: string };

type AppSubscriptionCreatePayload = {
  data?: {
    appSubscriptionCreate?: {
      appSubscription?: { id: string; status: string } | null;
      confirmationUrl?: string | null;
      userErrors?: Array<{ field: string[] | null; message: string }>;
    };
  };
  errors?: GraphQlError[];
};

type ActiveSubscriptionsPayload = {
  data?: {
    currentAppInstallation?: {
      activeSubscriptions?: Array<{
        id: string;
        name: string;
        status: string;
        currentPeriodEnd: string | null;
        trialDays: number | null;
      }>;
    };
  };
  errors?: GraphQlError[];
};

const APP_SUBSCRIPTION_CREATE = `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS_QUERY = `
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        currentPeriodEnd
        trialDays
      }
    }
  }
`;

async function shopifyAdminGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiVersion = getShopifyApiVersion();
  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${body}`);
  }

  return (await res.json()) as T;
}

export function isShopifyBillingPlanId(value: string): value is ShopifyBillingPlanId {
  return value in SHOPIFY_BILLING_PLANS;
}

/**
 * Create a recurring app subscription and return the Shopify confirmation URL
 * the merchant must approve (opens Shopify's charge approval screen).
 */
export async function createAppSubscription(options: {
  shop: string;
  accessToken: string;
  planId: ShopifyBillingPlanId;
  /** Pass host so the merchant returns to the embedded app after approval. */
  host?: string | null;
  /** Use test charges on development stores / Partner test shops. */
  test?: boolean;
}): Promise<{ confirmationUrl: string; subscriptionId: string }> {
  const plan = SHOPIFY_BILLING_PLANS[options.planId];
  const appUrl = getShopifyAppUrl();

  const returnParams = new URLSearchParams({
    shop: options.shop,
    plan: plan.id,
  });
  if (options.host) returnParams.set("host", options.host);

  const returnUrl = `${appUrl}/api/shopify/billing/callback?${returnParams.toString()}`;

  // Test charges: enabled in non-production, or when SHOPIFY_BILLING_TEST=true.
  const test =
    options.test ??
    (process.env.SHOPIFY_BILLING_TEST === "true" || process.env.NODE_ENV !== "production");

  const payload = await shopifyAdminGraphql<AppSubscriptionCreatePayload>(
    options.shop,
    options.accessToken,
    APP_SUBSCRIPTION_CREATE,
    {
      name: plan.name,
      returnUrl,
      trialDays: plan.trialDays,
      test,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.amount, currencyCode: plan.currencyCode },
              interval: plan.interval,
            },
          },
        },
      ],
    }
  );

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }

  const result = payload.data?.appSubscriptionCreate;
  const userErrors = result?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }

  const confirmationUrl = result?.confirmationUrl;
  const subscriptionId = result?.appSubscription?.id;

  if (!confirmationUrl || !subscriptionId) {
    throw new Error("Shopify did not return a confirmation URL for the subscription");
  }

  return { confirmationUrl, subscriptionId };
}

/** Read active subscriptions for the installed app on this shop. */
export async function getActiveAppSubscriptions(shop: string, accessToken: string) {
  const payload = await shopifyAdminGraphql<ActiveSubscriptionsPayload>(
    shop,
    accessToken,
    ACTIVE_SUBSCRIPTIONS_QUERY
  );

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }

  return payload.data?.currentAppInstallation?.activeSubscriptions ?? [];
}

export function mapShopifyStatusToBillingStatus(status: string): BillingStatus {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "PENDING":
      return "PENDING";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "DECLINED":
      return "DECLINED";
    case "EXPIRED":
      return "EXPIRED";
    case "FROZEN":
      return "FROZEN";
    default:
      return "NONE";
  }
}

/** Supabase stores lowercase status values (e.g. `active`) for webhook/UI consistency. */
export function toDbBillingStatus(status: string): string {
  return mapShopifyStatusToBillingStatus(status).toLowerCase();
}

export function inferPlanIdFromSubscriptionName(name: string | null | undefined): ShopifyBillingPlanId | null {
  if (!name) return null;
  const normalized = name.toLowerCase();
  if (normalized.includes("scale")) return "scale";
  if (normalized.includes("growth")) return "growth";
  if (normalized.includes("starter")) return "starter";
  return null;
}

/**
 * Resolve the locally persisted plan from Shopify-owned subscription data.
 * Callback query parameters are browser-controlled and must never grant entitlements.
 */
export function resolveBillingPlanFromActiveSubscription(
  subscriptionName: string | null | undefined,
  currentPlan: string | null | undefined
): string | null {
  return inferPlanIdFromSubscriptionName(subscriptionName) ?? currentPlan ?? null;
}

/**
 * Default post-install plan. Override with SHOPIFY_DEFAULT_BILLING_PLAN=starter|growth|scale.
 */
export function getDefaultInstallPlanId(): ShopifyBillingPlanId {
  const fromEnv = process.env.SHOPIFY_DEFAULT_BILLING_PLAN?.trim().toLowerCase();
  if (fromEnv && isShopifyBillingPlanId(fromEnv)) return fromEnv;
  return "starter";
}

/**
 * Create the default install subscription and return Shopify's confirmation URL.
 * Used immediately after OAuth so merchants land on the Billing approval page.
 */
export async function createInstallSubscription(options: {
  shop: string;
  accessToken: string;
  host?: string | null;
  planId?: ShopifyBillingPlanId;
}): Promise<{ confirmationUrl: string; subscriptionId: string; planId: ShopifyBillingPlanId }> {
  const planId = options.planId ?? getDefaultInstallPlanId();
  const result = await createAppSubscription({
    shop: options.shop,
    accessToken: options.accessToken,
    planId,
    host: options.host,
  });
  return { ...result, planId };
}
