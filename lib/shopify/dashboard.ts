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

export type ShopifyDashboardMetrics = {
  trackedCarts: number;
  recovered: number;
  recoveredValue: number;
};

export type ShopifyDashboardData = {
  store: ShopifyStoreRow | null;
  carts: ShopifyCartRow[];
  metrics: ShopifyDashboardMetrics;
};

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

async function ensureDevStore(shop: string): Promise<ShopifyStoreRow | null> {
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
    .select("id, shopify_domain, billing_plan, billing_status")
    .maybeSingle();

  if (error) {
    const message = describeSupabaseError(error);
    if (message) {
      console.warn(`[CartRenew] Could not auto-provision store for ${shop}: ${message}`);
    }
    return null;
  }

  return (data as ShopifyStoreRow | null) ?? null;
}

export async function loadShopifyStoreDashboard(
  shop: string,
  options?: { autoProvision?: boolean }
): Promise<ShopifyDashboardData> {
  const empty: ShopifyDashboardData = {
    store: null,
    carts: [],
    metrics: { trackedCarts: 0, recovered: 0, recoveredValue: 0 },
  };

  try {
    const { data: storeRow, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, shopify_domain, billing_plan, billing_status")
      .eq("shopify_domain", shop)
      .maybeSingle();

    if (storeError) {
      const message = describeSupabaseError(storeError);
      if (message) {
        console.warn(`[CartRenew] Supabase store lookup failed for ${shop}: ${message}`);
      }
      return empty;
    }

    let store = (storeRow as ShopifyStoreRow | null) ?? null;

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

    const carts = (cartsRes.data ?? []) as ShopifyCartRow[];
    const analytics = analyticsRes.data ?? [];

    const metrics = analytics.reduce<ShopifyDashboardMetrics>(
      (acc, row) => ({
        trackedCarts: acc.trackedCarts + (row.carts_created ?? 0),
        recovered: acc.recovered + (row.carts_recovered ?? 0),
        recoveredValue: acc.recoveredValue + Number(row.revenue_recovered ?? 0),
      }),
      { trackedCarts: 0, recovered: 0, recoveredValue: 0 }
    );

    if (metrics.trackedCarts === 0 && carts.length > 0) {
      console.log(
        "🔍 DEBUG CARTS DATA:",
        JSON.stringify(
          carts.map((c) => ({
            status: c.status,
            val1: (c as { cartValue?: number }).cartValue,
            val2: c.cart_value,
            raw: c,
          })),
          null,
          2
        )
      );

      // Case-insensitive: accepts "recovered" | "RECOVERED" | mixed
      const recoveredCarts = carts.filter(
        (cart) => cart.status && cart.status.toLowerCase() === "recovered"
      );
      metrics.trackedCarts = carts.length;
      metrics.recovered = recoveredCarts.length;
      // Revenue mapping — support cart_value (Supabase) and cartValue (camelCase)
      metrics.recoveredValue = recoveredCarts.reduce(
        (sum, cart) =>
          sum + Number((cart as { cartValue?: number }).cartValue ?? cart.cart_value ?? 0),
        0
      );
    }

    return { store, carts, metrics };
  } catch (err) {
    const message = describeSupabaseError(err);
    if (message) {
      console.warn(`[CartRenew] Dashboard load failed for ${shop}: ${message}`);
    }
    return empty;
  }
}
