export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type OrderWebhookBody = {
  shopifyOrderId?: unknown;
  id?: unknown;
  name?: unknown;
  order_number?: unknown;
  customerName?: unknown;
  customer?: unknown;
  billing_address?: unknown;
  shipping_address?: unknown;
  phoneNumber?: unknown;
  phone?: unknown;
  totalAmount?: unknown;
  total_price?: unknown;
  current_total_price?: unknown;
  paymentMethod?: unknown;
  payment_gateway_names?: unknown;
  gateway?: unknown;
};

type ParsedOrderPayload = {
  shopifyOrderId: string;
  customerName: string;
  phoneNumber: string;
  totalAmount: number;
  paymentMethod: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrderWebhookBody;
    const orderPayload = parseOrderWebhookBody(body);
    const verificationOtp = isCodPayment(orderPayload.paymentMethod) ? generateVerificationOtp() : null;

    const order = await prisma.order.upsert({
      where: {
        shopifyOrderId: orderPayload.shopifyOrderId,
      },
      update: {
        customerName: orderPayload.customerName,
        phoneNumber: orderPayload.phoneNumber,
        totalAmount: orderPayload.totalAmount,
        paymentMethod: orderPayload.paymentMethod,
        ...(verificationOtp ? { verificationOtp, status: "PENDING" as const } : {}),
      },
      create: {
        shopifyOrderId: orderPayload.shopifyOrderId,
        customerName: orderPayload.customerName,
        phoneNumber: orderPayload.phoneNumber,
        totalAmount: orderPayload.totalAmount,
        paymentMethod: orderPayload.paymentMethod,
        verificationOtp,
      },
    });

    if (verificationOtp) {
      void triggerCodWhatsAppLog(order.phoneNumber, order.customerName, order.shopifyOrderId, verificationOtp);
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Order webhook route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: getErrorStatus(error) }
    );
  }
}

function parseOrderWebhookBody(body: OrderWebhookBody): ParsedOrderPayload {
  const shopifyOrderId = parseShopifyOrderId(body);
  const customerName = parseCustomerName(body);
  const phoneNumber = parsePhoneNumber(body);
  const totalAmount = parseRequiredNumber(
    body.totalAmount ?? body.current_total_price ?? body.total_price,
    "totalAmount"
  );
  const paymentMethod = parsePaymentMethod(body);

  return {
    shopifyOrderId,
    customerName,
    phoneNumber,
    totalAmount,
    paymentMethod,
  };
}

function parseShopifyOrderId(body: OrderWebhookBody) {
  const value = body.shopifyOrderId ?? body.id ?? body.name ?? body.order_number;

  return parseRequiredString(value, "shopifyOrderId");
}

function parseCustomerName(body: OrderWebhookBody) {
  const directName = parseOptionalString(body.customerName);

  if (directName) {
    return directName;
  }

  const customer = getRecord(body.customer);
  const billingAddress = getRecord(body.billing_address);
  const shippingAddress = getRecord(body.shipping_address);
  const firstName = parseOptionalString(customer?.first_name ?? billingAddress?.first_name ?? shippingAddress?.first_name);
  const lastName = parseOptionalString(customer?.last_name ?? billingAddress?.last_name ?? shippingAddress?.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!fullName) {
    throw new RouteValidationError("customerName must be provided");
  }

  return fullName;
}

function parsePhoneNumber(body: OrderWebhookBody) {
  const customer = getRecord(body.customer);
  const billingAddress = getRecord(body.billing_address);
  const shippingAddress = getRecord(body.shipping_address);
  const phoneNumber = parseOptionalString(
    body.phoneNumber ??
      body.phone ??
      customer?.phone ??
      billingAddress?.phone ??
      shippingAddress?.phone
  );

  if (!phoneNumber) {
    throw new RouteValidationError("phoneNumber must be provided");
  }

  return phoneNumber;
}

function parsePaymentMethod(body: OrderWebhookBody) {
  const paymentGatewayNames = Array.isArray(body.payment_gateway_names)
    ? body.payment_gateway_names
        .map((gatewayName) => parseOptionalString(gatewayName))
        .filter(Boolean)
        .join(", ")
    : undefined;

  return parseRequiredString(
    body.paymentMethod ?? paymentGatewayNames ?? body.gateway,
    "paymentMethod"
  );
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

function parseRequiredNumber(value: unknown, fieldName: string) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RouteValidationError(`${fieldName} must be a non-negative number`);
  }

  return parsedValue;
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isCodPayment(paymentMethod: string) {
  return /\b(cod|cash on delivery)\b/i.test(paymentMethod);
}

function generateVerificationOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function triggerCodWhatsAppLog(
  phoneNumber: string,
  customerName: string,
  shopifyOrderId: string,
  verificationOtp: string
) {
  try {
    console.log("==================================================");
    console.log("COD VERIFICATION WHATSAPP LOG TRIGGERED");
    console.log(`TARGET PHONE : ${phoneNumber}`);
    console.log(`ORDER ID     : ${shopifyOrderId}`);
    console.log(`MESSAGE BODY : Hi ${customerName}, your COD verification OTP is ${verificationOtp}.`);
    console.log("==================================================");
  } catch (error) {
    console.warn("COD WhatsApp log failed:", error);
  }
}

function getErrorStatus(error: unknown) {
  return error instanceof RouteValidationError ? 400 : 500;
}

class RouteValidationError extends Error {}
