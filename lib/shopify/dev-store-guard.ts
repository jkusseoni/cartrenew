import { getShopifyApiVersion } from "@/lib/shopify/config";

export type ShopPlan = {
  displayName: string | null;
  partnerDevelopment: boolean;
};

export type DevStoreDecision = "allow" | "block" | "retry";

type GuardEnv = {
  isDefaultBrand: boolean;
  vercelEnv: string | undefined;
  allowDevStores: string | undefined;
  devShopList: string | undefined;
};

const SHOP_PLAN_NAME_QUERY = `
  query ShopPlanName {
    shop {
      plan {
        displayName
        partnerDevelopment
      }
    }
  }
`;

const PLAN_CACHE_MS = 10 * 60 * 1000;
const PLAN_CACHE_MAX = 1000;
const planDecisions = new Map<string, { decision: "allow" | "block"; expiresAt: number }>();

/** Shopify rejected the access token, so the app is not installed on that shop. */
export class ShopPlanUnauthorizedError extends Error {
  constructor() {
    super("plan_unauthorized");
  }
}

export function resetDevStoreGuardCacheForTests() {
  planDecisions.clear();
}

/**
 * Pingza production refuses development-store writes unless
 * PINGZA_ALLOW_DEV_STORES is exactly "true".
 * CartRenew and every non-production environment leave the flag unused.
 */
export function devStoreGuardActive(input: {
  isDefaultBrand: boolean;
  vercelEnv: string | undefined;
  allowDevStores: string | undefined;
}): boolean {
  if (input.isDefaultBrand) return false;
  if (input.vercelEnv !== "production") return false;
  if (input.allowDevStores === "true") return false;
  return true;
}

export function shopListedAsDev(shop: string, list: string | undefined): boolean {
  const domain = shop.trim().toLowerCase();
  if (!domain) return false;
  return (list ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(domain);
}

/** Shopify plan.displayName, plus the partnerDevelopment flag on that plan. */
export function planIsDevelopmentStore(plan: ShopPlan | null | undefined): boolean {
  if (!plan) return false;
  if (plan.partnerDevelopment) return true;
  const name = (plan.displayName ?? "").trim().toLowerCase();
  return name.includes("development") || name === "developer preview";
}

/**
 * allow: write as usual.
 * block: development store, unlisted plan with no usable token, or a token Shopify
 *   rejects — webhook callers return 200 and write nothing.
 * retry: the token or plan could not be read right now — write nothing, let Shopify retry.
 *
 * readAccessToken returns null when the shop has no usable token and throws when the
 * lookup is temporarily unavailable.
 */
export async function guardShopifyShopWrite(
  input: GuardEnv & {
    shop: string;
    readAccessToken: (shop: string) => Promise<string | null>;
    readPlan: (shop: string, accessToken: string) => Promise<ShopPlan>;
    now?: number;
  }
): Promise<DevStoreDecision> {
  if (!devStoreGuardActive(input)) return "allow";
  if (shopListedAsDev(input.shop, input.devShopList)) return "block";

  const key = input.shop.trim().toLowerCase();
  const now = input.now ?? Date.now();
  const cached = planDecisions.get(key);
  if (cached && cached.expiresAt > now) return cached.decision;

  let accessToken: string | null;
  try {
    accessToken = await input.readAccessToken(input.shop);
  } catch {
    return "retry";
  }
  if (!accessToken) return "block";

  let plan: ShopPlan;
  try {
    plan = await input.readPlan(input.shop, accessToken);
  } catch (error) {
    return error instanceof ShopPlanUnauthorizedError ? "block" : "retry";
  }

  const decision = planIsDevelopmentStore(plan) ? "block" : "allow";
  if (planDecisions.size >= PLAN_CACHE_MAX) planDecisions.clear();
  planDecisions.set(key, { decision, expiresAt: now + PLAN_CACHE_MS });
  return decision;
}

/**
 * app/uninstalled arrives after Shopify revokes the token, so the plan cannot be read.
 * Clean up an existing row unless the shop is listed. With no row, writing would insert one.
 */
export async function guardShopifyUninstallWrite(
  input: GuardEnv & {
    shop: string;
    storeExists: (shop: string) => Promise<boolean>;
  }
): Promise<DevStoreDecision> {
  if (!devStoreGuardActive(input)) return "allow";
  planDecisions.delete(input.shop.trim().toLowerCase());
  if (shopListedAsDev(input.shop, input.devShopList)) return "block";
  try {
    return (await input.storeExists(input.shop)) ? "allow" : "block";
  } catch {
    return "retry";
  }
}

type ShopPlanPayload = {
  data?: {
    shop?: {
      plan?: { displayName?: string | null; partnerDevelopment?: boolean | null } | null;
    } | null;
  };
  errors?: unknown[];
};

/** Admin API shop plan. Throws a generic error and does not include the response body. */
export async function readShopPlan(shop: string, accessToken: string): Promise<ShopPlan> {
  const apiVersion = getShopifyApiVersion();
  let response: Response;
  try {
    response = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: SHOP_PLAN_NAME_QUERY }),
    });
  } catch {
    throw new Error("plan_lookup_failed");
  }
  if (response.status === 401 || response.status === 403) throw new ShopPlanUnauthorizedError();
  if (!response.ok) throw new Error("plan_lookup_failed");

  const payload = (await response.json().catch(() => null)) as ShopPlanPayload | null;
  if (!payload || (payload.errors?.length ?? 0) > 0 || !payload.data?.shop?.plan) {
    throw new Error("plan_lookup_failed");
  }

  const plan = payload.data.shop.plan;
  return {
    displayName: typeof plan.displayName === "string" ? plan.displayName : null,
    partnerDevelopment: plan.partnerDevelopment === true,
  };
}
