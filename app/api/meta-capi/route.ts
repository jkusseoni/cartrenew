import { hashDataUnlessAlreadyHashed } from "@/lib/crypto-utils";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MetaCapiRequestBody = {
  eventName?: string;
  eventUrl?: string;
  eventId?: string;
  userEmail?: string;
  userEmailHash?: string;
  userPhone?: string;
  userPhoneHash?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  currency?: string;
  value?: number | string;
  contentIds?: string[];
  contentName?: string;
  contentType?: string;
  contents?: Array<{
    id: string;
    quantity?: number;
    item_price?: number;
    title?: string;
  }>;
  cartId?: string;
  checkoutUrl?: string;
  numItems?: number;
};

export async function POST(request: NextRequest) {
  try {
    let body: MetaCapiRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON format." }, { status: 400 });
    }

    const pixelId = getEnvValue(process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID);
    const accessToken = getEnvValue(process.env.META_ACCESS_TOKEN || process.env.META_CAPI_ACCESS_TOKEN);

    if (!pixelId || !accessToken) {
      console.error("Meta CAPI environment variables missing", {
        pixelId: pixelId ? "Found" : "Missing",
        accessToken: accessToken ? "Found" : "Missing",
      });
      return NextResponse.json(
        { success: false, error: "Environment variables missing hain bhai. Check Meta CAPI mapping." },
        { status: 400 }
      );
    }

    const hashedEmail = getHashedEmail(body);
    const hashedPhone = getHashedPhone(body);
    const clientIp = getClientIp(request, body);

    const metaPayload = {
      data: [
        {
          event_name: body.eventName || "AddToCart",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: body.eventUrl || getRequestOrigin(request),
          ...(body.eventId ? { event_id: body.eventId } : {}),
          user_data: {
            ...(hashedEmail ? { em: [hashedEmail] } : {}),
            ...(hashedPhone ? { ph: [hashedPhone] } : {}),
            ...(clientIp ? { client_ip_address: clientIp } : {}),
            client_user_agent: body.clientUserAgent || request.headers.get("user-agent") || "",
            ...(body.fbp ? { fbp: body.fbp } : {}),
            ...(body.fbc ? { fbc: body.fbc } : {}),
          },
          custom_data: {
            currency: body.currency || "INR",
            value: parseMoneyValue(body.value),
            ...(body.contentIds?.length ? { content_ids: body.contentIds } : {}),
            ...(body.contentName ? { content_name: body.contentName } : {}),
            content_type: body.contentType || "product",
            ...(body.contents?.length ? { contents: body.contents } : {}),
            ...(body.cartId ? { cart_id: body.cartId } : {}),
            ...(body.checkoutUrl ? { checkout_url: body.checkoutUrl } : {}),
            ...(body.numItems ? { num_items: body.numItems } : {}),
          },
        },
      ],
      ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE.trim() } : {}),
    };

    const metaUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
    const response = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaPayload),
    });

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Meta API rejected the event", details: result },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event successfully sent to Meta CAPI",
      metaResponse: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Meta CAPI route error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function getHashedEmail(body: MetaCapiRequestBody) {
  return hashDataUnlessAlreadyHashed(body.userEmailHash || body.userEmail);
}

function getHashedPhone(body: MetaCapiRequestBody) {
  return hashDataUnlessAlreadyHashed(body.userPhoneHash || body.userPhone);
}

function getEnvValue(value: string | undefined) {
  return value?.replace(/['"]+/g, "").trim() || null;
}

function parseMoneyValue(value: MetaCapiRequestBody["value"]) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getClientIp(request: NextRequest, body: MetaCapiRequestBody) {
  return (
    body.clientIpAddress ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined
  );
}

function getRequestOrigin(request: NextRequest) {
  return request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://cartrenew.com";
}
