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
import { registerShopifyWebhooks } from "@/lib/shopify/webhooks";

const STATE_COOKIE = "shopify_oauth_state";

/**
 * GET /api/auth/shopify/callback
 *
 * Exchanges the temporary OAuth `code` for a permanent offline access token,
 * after validating the HMAC signature against the Shopify client secret. Persists
 * the store and registers the cart-recovery webhooks.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams;

    const shop = q.get("shop");
    const code = q.get("code");
    const state = q.get("state");

    if (!isValidShopDomain(shop) || !code) {
      return NextResponse.json(
        { error: "Missing or invalid shop/code parameters" },
        { status: 400 }
      );
    }

    // CSRF: state from the redirect must match the cookie we set on initiate.
    const cookieState = req.cookies.get(STATE_COOKIE)?.value;
    if (cookieState && state && cookieState !== state) {
      return NextResponse.json({ error: "OAuth state mismatch" }, { status: 401 });
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
      return NextResponse.json({ error: "Token exchange failed" }, { status: 502 });
    }

    const accessToken = (await tokenRes.json()).access_token as string | undefined;
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token" }, { status: 502 });
    }

    // Derive the Clerk user id from the leading segment of state when present.
    const clerkUserId =
      (state && !state.includes(".") ? null : state?.split(".")[0]) ||
      `webhook_${shop.replace(/[^a-z0-9]/gi, "_")}`;

    const upsertRes = await supabaseAdmin.from("stores").upsert(
      {
        shopify_domain: shop,
        shopify_access_token: accessToken,
        clerk_user_id: clerkUserId,
      },
      { onConflict: "shopify_domain" }
    );

    if (upsertRes.error) {
      console.error("Failed to upsert store", upsertRes.error);
      return NextResponse.json({ error: "Failed to save store" }, { status: 500 });
    }

    const { data: fetchedStore } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("shopify_domain", shop)
      .maybeSingle();

    const registered = await registerShopifyWebhooks(shop, accessToken);

    if (fetchedStore?.id && registered.length > 0) {
      await supabaseAdmin
        .from("stores")
        .update({ webhook_ids: registered })
        .eq("id", fetchedStore.id);
    }

    const response = NextResponse.redirect(`${getShopifyAppUrl()}/settings`);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Shopify OAuth callback error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
