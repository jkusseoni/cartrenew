export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Room for a slow Meta send to finish in after() once the 202 is returned.
export const maxDuration = 60;

import { after, NextRequest, NextResponse } from "next/server";

import { brand } from "@/lib/brand";
import { supabaseAdmin } from "@/lib/supabase";
import { sendRecoveryTemplate } from "@/lib/services/recovery-dispatch";
import { hasWhatsAppCredentials } from "@/lib/services/whatsapp-meta";
import {
  sendShopifyTestMessage,
  testMessageHttpResult,
  validateTestPhone,
} from "@/lib/shopify/test-message";
import { supabaseTestMessageLog } from "@/lib/shopify/test-message-log";
import {
  getBearerToken,
  verifySessionToken,
} from "@/lib/shopify/verifySessionToken";

/**
 * POST /api/shopify/test-message (Pingza only)
 *
 * Auth: Shopify session token. Shop tenant comes from JWT `dest`, not the body.
 * Body: { phone } in E.164. Sends one sample recovery template via the real
 * send path; no cart or messages row is created.
 */
export async function POST(req: NextRequest) {
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

  const body = (await req.json().catch(() => null)) as {
    phone?: unknown;
    shop?: string;
  } | null;

  if (body?.shop && body.shop !== shop) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phone = validateTestPhone(body?.phone);
  if (!phone.ok) {
    return NextResponse.json({ error: phone.error }, { status: 400 });
  }

  if (!hasWhatsAppCredentials()) {
    return NextResponse.json(
      { error: "WhatsApp sending isn't available right now. Try again later." },
      { status: 503 }
    );
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("shopify_domain", shop)
    .maybeSingle();

  if (storeError) {
    console.error("[api/shopify/test-message] store lookup failed", { shop });
    return NextResponse.json(
      { error: "Couldn't load your store. Try again in a moment." },
      { status: 503 }
    );
  }

  const storeId = (store as { id: string } | null)?.id;
  if (!storeId) {
    return NextResponse.json(
      { error: `Finish connecting your store to ${brand.name}, then try again.` },
      { status: 409 }
    );
  }

  const outcome = await sendShopifyTestMessage({
    storeId,
    shop,
    e164: phone.e164,
    log: supabaseTestMessageLog,
    send: sendRecoveryTemplate,
  });

  if (outcome.status === "pending") {
    after(() => outcome.completion);
  }

  const { status, body: responseBody } = testMessageHttpResult(outcome);
  return NextResponse.json(responseBody, { status });
}
