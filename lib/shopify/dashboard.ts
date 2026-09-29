import { supabaseAdmin } from "@/lib/supabase";

export type ShopifyCartRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  cart_value: number;
  status: string;
  created_at: string;
};

export type ShopifyStoreRow = {
  id: string;
  shopify_domain: string;
  billing_plan?: string | null;
  billing_status?: string | null;
};

type ShopifyStoreRecord = ShopifyStoreRow & {
  shopify_access_token: string | null;
};

export type ShopifyDashboardMetrics = {
  trackedCarts: number;
  recovered: number;
  recoveredValue: number;
};

export type ShopifyDashboardData = {
  store: ShopifyStoreRow | null;
  hasOfflineAccessToken: boolean;
  carts: ShopifyCartRow[];
  metrics: ShopifyDashboardMetrics;
};

export function needsShopifyInstall(
  dashboard: Pick<ShopifyDashboardData, "store" | "hasOfflineAccessToken">,
  isDev: boolean
): boolean {
  return !isDev && (!dashboard.store || !dashboard.hasOfflineAccessToken);
}

function describeSupabaseError(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const row = error as Record<string, unknown>;
    return [row.message, row.code, row.details, row.hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  }
  return String(error);
}

async function ensureDevStore(shop: string): Promise<ShopifyStoreRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .upsert(
      {
        shopify_domain: shop,
        shopify_access_token: "dev-offline-token-placeholder",
        clerk_user_id: `sandbox_${shop.replace(/[^a-z0-9]/gi, "_")}`,
      },
      { onConflict: "shopify_domain" }
    )
    .select("id, shopify_domain, shopify_access_token, billing_plan, billing_status")
    .maybeSingle();

  if (error) {
    const message = describeSupabaseError(error);
    if (message) {
      console.warn(`[CartRenew] Could not auto-provision store for ${shop}: ${message}`);
    }
    return null;
  }

  return (data as ShopifyStoreRecord | null) ?? null;
}

export async function loadShopifyStoreDashboard(
  shop: string,
  options?: { autoProvision?: boolean }
): Promise<ShopifyDashboardData> {
  const empty: ShopifyDashboardData = {
    store: null,
    hasOfflineAccessToken: false,
    carts: [],
    metrics: { trackedCarts: 0, recovered: 0, recoveredValue: 0 },
  };

  try {
    const { data: storeRow, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, shopify_domain, shopify_access_token, billing_plan, billing_status")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (storeError) {
      const message = describeSupabaseError(storeError);
      if (message) {
        console.warn(`[CartRenew] Supabase store lookup failed for ${shop}: ${message}`);
      }
      return empty;
    }

    let store = (storeRow as ShopifyStoreRecord | null) ?? null;

    if (!store && options?.autoProvision) {
      store = await ensureDevStore(shop);
    }

    if (!store) {
      return empty;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split("T")[0];

    const [cartsRes, analyticsRes] = await Promise.all([
      supabaseAdmin
        .from("abandoned_carts")
        .select("id, customer_name, customer_phone, cart_value, status, created_at")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("analytics_daily")
        .select("carts_created, carts_recovered, revenue_recovered")
        .eq("store_id", store.id)
        .gte("date", startDateStr),
    ]);

    // Empty store / missing tables: treat query errors as zero rows, never throw.
    if (cartsRes.error) {
      console.warn(
        `[CartRenew] abandoned_carts query failed for ${shop}:`,
        describeSupabaseError(cartsRes.error)
      );
    }
    if (analyticsRes.error) {
      console.warn(
        `[CartRenew] analytics_daily query failed for ${shop}:`,
        describeSupabaseError(analyticsRes.error)
      );
    }

    const carts = (Array.isArray(cartsRes.data) ? cartsRes.data : []) as ShopifyCartRow[];
    const analytics = Array.isArray(analyticsRes.data) ? analyticsRes.data : [];

    const metrics = analytics.reduce<ShopifyDashboardMetrics>(
      (acc, row) => ({
        trackedCarts: acc.trackedCarts + Number(row?.carts_created ?? 0),
        recovered: acc.recovered + Number(row?.carts_recovered ?? 0),
        recoveredValue: acc.recoveredValue + Number(row?.revenue_recovered ?? 0),
      }),
      { trackedCarts: 0, recovered: 0, recoveredValue: 0 }
    );

    // Brand-new shops: zero analytics rows is normal — fall back to cart list counts.
    if (metrics.trackedCarts === 0 && carts.length > 0) {
      const recoveredCarts = carts.filter(
        (cart) =>
          typeof cart.status === "string" &&
          cart.status.trim().toLowerCase() === "recovered"
      );
      metrics.trackedCarts = carts.length;
      metrics.recovered = recoveredCarts.length;
      metrics.recoveredValue = recoveredCarts.reduce(
        (sum, cart) =>
          sum +
          Number(
            (cart as { cartValue?: number }).cartValue ?? cart.cart_value ?? 0
          ),
        0
      );
    }

    return {
      store: {
        id: store.id,
        shopify_domain: store.shopify_domain || shop,
        billing_plan: store.billing_plan,
        billing_status: store.billing_status,
      },
      hasOfflineAccessToken: Boolean(store.shopify_access_token?.trim()),
      carts,
      metrics,
    };
  } catch (err) {
    const message = describeSupabaseError(err);
    if (message) {
      console.warn(`[CartRenew] Dashboard load failed for ${shop}: ${message}`);
    }
    return empty;
  }
}
