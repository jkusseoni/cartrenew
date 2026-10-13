import { getShopifyApiVersion } from "@/lib/shopify/config";

export type ShopPlan = {
  displayName: string | null;
  partnerDevelopment: boolean;
};

export type DevStoreDecision = "allow" | "block" | "retry";

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
 * block: development store on Pingza production — webhook callers return 200 and write nothing.
 * retry: the plan could not be read — write nothing so a dev store cannot slip in.
 */
export async function guardShopifyShopWrite(input: {
  shop: string;
  isDefaultBrand: boolean;
  vercelEnv: string | undefined;
  allowDevStores: string | undefined;
  devShopList: string | undefined;
  readAccessToken: (shop: string) => Promise<string | null>;
  readPlan: (shop: string, accessToken: string) => Promise<ShopPlan>;
}): Promise<DevStoreDecision> {
  if (
    !devStoreGuardActive({
      isDefaultBrand: input.isDefaultBrand,
      vercelEnv: input.vercelEnv,
      allowDevStores: input.allowDevStores,
    })
  ) {
    return "allow";
  }
  if (shopListedAsDev(input.shop, input.devShopList)) return "block";

  let accessToken: string | null;
  try {
    accessToken = await input.readAccessToken(input.shop);
  } catch {
    return "retry";
  }
  if (!accessToken) return "retry";

  try {
    const plan = await input.readPlan(input.shop, accessToken);
    return planIsDevelopmentStore(plan) ? "block" : "allow";
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
