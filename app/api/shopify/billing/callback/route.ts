export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { brand } from "@/lib/brand";
import { supabaseAdmin } from "@/lib/supabase";
import { getValidShopifyAccessToken } from "@/lib/shopify/access-token";
import {
  getActiveAppSubscriptions,
  toDbBillingStatus,
} from "@/lib/shopify/billing";
import { syncStoreBillingFromShopify } from "@/lib/shopify/billing-sync";
import { getShopifyAppUrl, isValidShopDomain } from "@/lib/shopify/config";

/**
 * GET /api/shopify/billing/callback
 *
 * Shopify redirects here after the merchant approves/declines the charge.
 * We re-query active subscriptions, persist status, then return to the embedded app.
 *
 * Pingza (!brand.isDefault): retrying sync helper + charge_id on the return URL.
 * CartRenew (default brand): same path as main — single poll, no billing-sync import use.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const plan = url.searchParams.get("plan");
  const chargeId = url.searchParams.get("charge_id");

  if (!isValidShopDomain(shop)) {
    return NextResponse.redirect(`${getShopifyAppUrl()}/app?billing=invalid_shop`);
  }

  try {
    if (!brand.isDefault) {
      const { data: store } = await supabaseAdmin
        .from("stores")
        .select("id, billing_plan, shopify_subscription_id")
        .eq("shopify_domain", shop)
        .maybeSingle();

      const token = store?.id ? await getValidShopifyAccessToken(store.id) : null;
      if (store && token && !token.ok) {
        console.warn("[billing/callback] no usable Shopify token:", shop, token.reason);
      }

      if (store && token?.ok) {
        const result = await syncStoreBillingFromShopify({
          storeId: store.id,
          shop,
          accessToken: token.accessToken,
          preferredPlan: plan,
          preferredSubscriptionId: store.shopify_subscription_id,
          existingPlan: store.billing_plan,
          reason: "callback",
        });

        if (!result.synced && chargeId) {
          // Merchant may have declined — mark pending as declined when no active sub.
          await supabaseAdmin
            .from("stores")
            .update({ billing_status: "declined" })
            .eq("id", store.id)
            .in("billing_status", ["pending", "PENDING", "none", "NONE"]);
        }
      }
    } else {
      // CartRenew — match main: read token from the row, single activeSubscriptions poll.
      const { data: store } = await supabaseAdmin
        .from("stores")
        .select("id, shopify_access_token, billing_plan, shopify_subscription_id")
        .eq("shopify_domain", shop)
        .maybeSingle();

      if (store?.shopify_access_token) {
        const active = await getActiveAppSubscriptions(shop, store.shopify_access_token);
        const match =
          active.find((sub) => sub.id === store.shopify_subscription_id) ||
          active.find((sub) => sub.status === "ACTIVE") ||
          active[0];

        if (match) {
          await supabaseAdmin
            .from("stores")
            .update({
              billing_status: toDbBillingStatus(match.status),
              shopify_subscription_id: match.id,
              billing_plan: plan || store.billing_plan || null,
              billing_current_period_end: match.currentPeriodEnd,
            })
            .eq("id", store.id);
        } else if (chargeId) {
          // Merchant may have declined — mark pending as declined when no active sub.
          await supabaseAdmin
            .from("stores")
            .update({ billing_status: "declined" })
            .eq("id", store.id)
            .in("billing_status", ["pending", "PENDING"]);
        }
      }
    }
  } catch (error) {
    console.error("[billing/callback] failed to sync subscription", error);
  }

  const returnParams = new URLSearchParams({ shop, billing: "ok" });
  if (host) returnParams.set("host", host);
  if (plan) returnParams.set("plan", plan);
  // Pingza only: forward charge_id so App Home / dashboard can prefer it.
  if (!brand.isDefault && chargeId) returnParams.set("charge_id", chargeId);

  return NextResponse.redirect(`${getShopifyAppUrl()}/app?${returnParams.toString()}`);
}
