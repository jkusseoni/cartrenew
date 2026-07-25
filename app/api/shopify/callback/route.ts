export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import {
  getShopifyAppUrl,
  getShopifyClientId,
  getShopifyClientSecret,
  isValidShopDomain,
  verifyOAuthHmac,
} from "@/lib/shopify/config";
import { createInstallSubscription } from "@/lib/shopify/billing";
import { registerShopifyWebhooks } from "@/lib/shopify/webhooks";

/**
 * Legacy OAuth callback — same install → billing redirect as /api/auth/shopify/callback.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;

    const shop = q.get("shop");
    const code = q.get("code");
    const state = q.get("state");
    const host = q.get("host");

    if (!isValidShopDomain(shop) || !code) {
      return NextResponse.json({ error: "Missing or invalid shop/code" }, { status: 400 });
    }

    if (!verifyOAuthHmac(q)) {
      return NextResponse.json({ error: "HMAC validation failed" }, { status: 401 });
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: getShopifyClientId(),
        client_secret: getShopifyClientSecret(),
        code,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("Failed to exchange code for token", body);
      return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
    }

    const tokenJson = await tokenRes.json().catch(() => null);
    const accessToken = tokenJson?.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 502 });
    }

    const clerkUserId = state || `webhook_${shop.replace(/[^a-z0-9]/gi, "_")}`;

    const upsertRes = await supabaseAdmin
      .from("stores")
      .upsert(
        {
          shopify_domain: shop,
          shopify_access_token: accessToken,
          clerk_user_id: clerkUserId,
          billing_status: "pending",
        },
        { onConflict: "shopify_domain" }
      )
      .select("id")
      .maybeSingle();

    if (upsertRes.error) {
      console.error("Failed to upsert store", upsertRes.error);
      return NextResponse.json({ error: "Failed to save store" }, { status: 500 });
    }

    const storeId = upsertRes.data?.id;

    const registered = await registerShopifyWebhooks(shop, accessToken);

    if (storeId && registered.length > 0) {
      await supabaseAdmin.from("stores").update({ webhook_ids: registered }).eq("id", storeId);
    }

    try {
      const { confirmationUrl, subscriptionId, planId } = await createInstallSubscription({
        shop,
        accessToken,
        host,
      });

      if (storeId) {
        await supabaseAdmin
          .from("stores")
          .update({
            billing_plan: planId,
            billing_status: "pending",
            shopify_subscription_id: subscriptionId,
          })
          .eq("id", storeId);
      }

      return NextResponse.redirect(confirmationUrl);
    } catch (billingError) {
      console.error("[legacy oauth/callback] install billing failed", billingError);
    }

    const returnParams = new URLSearchParams({ shop, billing: "setup_failed" });
    if (host) returnParams.set("host", host);
    return NextResponse.redirect(`${getShopifyAppUrl()}/app?${returnParams.toString()}`);
  } catch (error) {
    console.error("Shopify OAuth callback error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
