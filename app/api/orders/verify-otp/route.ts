export const runtime = "nodejs";

import { trackServerEvent } from "@/lib/conversion-api";
import { prisma } from "@/lib/prisma";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { NextResponse } from "next/server";

type VerifyOtpBody = {
  merchantId?: unknown;
  shopifyOrderId?: unknown;
  inputOtp?: unknown;
};

const DEFAULT_MERCHANT_ID = "default";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyOtpBody;
    const merchantId = parseOptionalString(body.merchantId) ?? DEFAULT_MERCHANT_ID;
    const shopifyOrderId = parseRequiredString(body.shopifyOrderId, "shopifyOrderId");
    const inputOtp = parseRequiredString(body.inputOtp, "inputOtp");
    const order = await prisma.order.findUnique({
      where: {
        shopifyOrderId,
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "Order not found",
        },
        { status: 404 }
      );
    }

    if (!order.verificationOtp || order.verificationOtp !== inputOtp) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid OTP",
        },
        { status: 400 }
      );
    }

    const verifiedOrder = await prisma.order.update({
      where: {
        shopifyOrderId,
      },
      data: {
        status: "VERIFIED",
      },
    });
    const responsePayload = {
      success: true,
      order: verifiedOrder,
    };

    void dispatchWebhookEvent(merchantId, "order.verified", {
      shopifyOrderId: verifiedOrder.shopifyOrderId,
      status: verifiedOrder.status,
      orderId: verifiedOrder.id,
      customerName: verifiedOrder.customerName,
      phoneNumber: verifiedOrder.phoneNumber,
      totalAmount: verifiedOrder.totalAmount,
    });
    void trackServerEvent(
      "Purchase",
      {
        phone: verifiedOrder.phoneNumber,
        clientIp: getClientIp(request),
        clientUserAgent: request.headers.get("user-agent") ?? undefined,
      },
      {
        value: verifiedOrder.totalAmount,
        currency: "INR",
        shopify_order_id: verifiedOrder.shopifyOrderId,
        order_id: verifiedOrder.id,
        payment_method: verifiedOrder.paymentMethod,
        status: verifiedOrder.status,
      }
    );

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Order OTP verification route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: getErrorStatus(error) }
    );
  }
}

function parseRequiredString(value: unknown, fieldName: string) {
  const parsedValue = parseOptionalString(value);

  if (!parsedValue) {
    throw new RouteValidationError(`${fieldName} must be a non-empty string`);
  }

  return parsedValue;
}

function parseOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsedValue = String(value).trim();

  return parsedValue.length > 0 ? parsedValue : undefined;
}

function getErrorStatus(error: unknown) {
  return error instanceof RouteValidationError ? 400 : 500;
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    undefined
  );
}

class RouteValidationError extends Error {}
