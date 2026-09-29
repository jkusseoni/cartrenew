import { expect, test } from "@playwright/test";

import {
  loadShopifyStoreDashboard,
  needsShopifyInstall,
} from "../lib/shopify/dashboard";
import { supabaseAdmin } from "../lib/supabase";

const store = {
  id: "store-1",
  shopify_domain: "example.myshopify.com",
};

test.describe("Shopify managed install state", () => {
  test("detects a retained tokenless row without exposing token data", async () => {
    const originalFrom = supabaseAdmin.from;

    Object.defineProperty(supabaseAdmin, "from", {
      configurable: true,
      value: (table: string) => {
        if (table === "stores") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    ...store,
                    shopify_access_token: null,
                    billing_plan: "starter",
                    billing_status: "cancelled",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "abandoned_carts") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ data: [], error: null }),
            }),
          }),
        };
      },
    });

    try {
      const dashboard = await loadShopifyStoreDashboard(store.shopify_domain);

      expect(dashboard.store).toEqual({
        ...store,
        billing_plan: "starter",
        billing_status: "cancelled",
      });
      expect(dashboard.hasOfflineAccessToken).toBe(false);
      expect(dashboard.store).not.toHaveProperty("shopify_access_token");
    } finally {
      Object.defineProperty(supabaseAdmin, "from", {
        configurable: true,
        value: originalFrom,
      });
    }
  });

  test("requires token exchange for a retained store row without an offline token", () => {
    expect(
      needsShopifyInstall(
        {
          store,
          hasOfflineAccessToken: false,
        },
        false
      )
    ).toBe(true);
  });

  test("accepts an installed store and preserves the local development bypass", () => {
    expect(
      needsShopifyInstall(
        {
          store,
          hasOfflineAccessToken: true,
        },
        false
      )
    ).toBe(false);

    expect(
      needsShopifyInstall(
        {
          store,
          hasOfflineAccessToken: false,
        },
        true
      )
    ).toBe(false);
  });
});
