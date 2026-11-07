export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { brand } from "@/lib/brand";
import { supabaseAdmin } from "@/lib/supabase";
import { TEST_MESSAGE_LOG_CART_ID } from "@/lib/shopify/test-message-config";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

const STATUSES = new Set(["sent", "delivered", "read", "failed"]);

function readDelivery(payload: unknown): {
  delivery_status: string | null;
  delivery_error: string | null;
} {
  const row =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const status = typeof row.delivery_status === "string" ? row.delivery_status : null;
  return {
    delivery_status: status && STATUSES.has(status) ? status : null,
    delivery_error:
      typeof row.delivery_error === "string" && row.delivery_error
        ? row.delivery_error
        : null,
  };
}

/**
 * GET /api/shopify/test-message/status?id=... (Pingza only)
 *
 * Auth: Shopify session token. Returns Meta delivery for a test send that
 * belongs to this shop — never phones or other stores' rows.
 */
export async function GET(req: NextRequest) {
  if (brand.isDefault) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let shop: string;
  try {
    ({ shop } = await verifySessionToken(token));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("shopify_domain", shop)
    .maybeSingle();

  if (storeError) {
    console.error("[api/shopify/test-message/status] store lookup failed", { shop });
    return NextResponse.json(
      { error: "Couldn't load your store. Try again in a moment." },
      { status: 503 }
    );
  }

  const storeId = (store as { id: string } | null)?.id;
  if (!storeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("cart_delivery_metrics")
    .select("payload")
    .eq("id", id)
    .eq("merchant_id", storeId)
    .eq("cart_id", TEST_MESSAGE_LOG_CART_ID)
    .maybeSingle();

  if (error) {
    console.error("[api/shopify/test-message/status] lookup failed", { shop });
    return NextResponse.json(
      { error: "Couldn't load delivery status. Try again in a moment." },
      { status: 503 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...readDelivery((data as { payload: unknown }).payload) });
}
