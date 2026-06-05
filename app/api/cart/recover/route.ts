export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const fetchCache = "force-no-store";

import { NextResponse, type NextRequest } from "next/server";

import {
  generateAICartRecoveryMessage,
  type CartItemContext,
} from "@/lib/ai-agent";

type RecoverCartRequestBody = {
  abandonedReason?: unknown;
  cartId?: unknown;
  items?: unknown;
  itemsCount?: unknown;
  timeSpentOnCheckout?: unknown;
  userHistory?: unknown;
};

type WhatsAppTextPayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  text: {
    body: string;
    preview_url: boolean;
  };
  to: string;
  type: "text";
};

const PENDING_STATUS = "PENDING";
const ABANDONED_STATUS = "ABANDONED";

export async function POST(request: NextRequest) {
  try {
    const body = await readRequestBody(request);
    const cartId = parseCartId(body.cartId ?? request.nextUrl.searchParams.get("cartId"));
    const { prisma } = await import("@/lib/prisma");

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        merchant: {
          select: {
            id: true,
            storeName: true,
            whatsappNum: true,
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json(
        {
          error: "Cart record not found",
          success: false,
        },
        { status: 404 }
      );
    }

    if (!isAbandonedCartStatus(cart.status)) {
      return NextResponse.json(
        {
          currentStatus: cart.status,
          error: "Only abandoned carts can be moved into recovery",
          success: false,
        },
        { status: 409 }
      );
    }

    const phoneNumber = cart.phoneNumber || cart.customerPhone;

    if (!phoneNumber) {
      return NextResponse.json(
        {
          error: "Cart is missing a customer phone number",
          success: false,
        },
        { status: 400 }
      );
    }

    const aiResult = await generateAICartRecoveryMessage({
      abandonedReason: parseOptionalString(body.abandonedReason),
      cartId: cart.id,
      checkoutUrl: cart.cartUrl,
      customerName: cart.customerName,
      items: parseCartItems(body.items),
      itemsCount: parseOptionalNumber(body.itemsCount),
      merchantId: cart.merchant.id,
      phoneNumber,
      storeName: cart.merchant.storeName,
      supportPhone: cart.merchant.whatsappNum,
      timeSpentOnCheckout: parseOptionalNumber(body.timeSpentOnCheckout),
      totalAmount: cart.totalAmount,
      userHistory: parseStringArray(body.userHistory),
      whatsappNumber: cart.merchant.whatsappNum,
    });

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        recoveryMessage: aiResult.message,
        recoveryMessageAt: new Date(),
        recoveryMessageModel: `${aiResult.provider}:${aiResult.model}`,
        recoveryMessagePrompt: aiResult.prompt,
        status: PENDING_STATUS,
      },
      select: {
        id: true,
        recoveryMessageAt: true,
        status: true,
      },
    });

    const whatsappPayload = buildWhatsAppPayload(phoneNumber, aiResult.message);

    return NextResponse.json(
      {
        ai: {
          fallbackReason: aiResult.fallbackReason,
          fallbackUsed: aiResult.fallbackUsed,
          model: aiResult.model,
          offerType: aiResult.offerType,
          provider: aiResult.provider,
        },
        cart: {
          id: updatedCart.id,
          recoveryMessageAt: updatedCart.recoveryMessageAt,
          status: updatedCart.status,
        },
        success: true,
        whatsappPayload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cart AI recovery route failed:", error);

    return NextResponse.json(
      {
        error: getClientErrorMessage(error),
        success: false,
      },
      { status: getErrorStatus(error) }
    );
  }
}

async function readRequestBody(request: Request): Promise<RecoverCartRequestBody> {
  try {
    const rawBody = await request.text();

    if (!rawBody.trim()) {
      return {};
    }

    const body = JSON.parse(rawBody) as unknown;

    if (!isRecord(body)) {
      throw new RouteValidationError("Request body must be a JSON object", 400);
    }

    return body;
  } catch (error) {
    if (error instanceof RouteValidationError) {
      throw error;
    }

    throw new RouteValidationError("Invalid JSON request body", 400);
  }
}

function parseCartId(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RouteValidationError("cartId is required", 400);
  }

  return value.trim();
}

function parseOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RouteValidationError("Expected a string value", 400);
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RouteValidationError("Expected a non-negative number", 400);
  }

  return parsedValue;
}

function parseStringArray(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new RouteValidationError("userHistory must be an array of strings", 400);
  }

  return (value as string[]).map((entry) => entry.trim()).filter(Boolean).slice(0, 12);
}

function parseCartItems(value: unknown): CartItemContext[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new RouteValidationError("items must be an array", 400);
  }

  return value.slice(0, 20).map((item) => {
    if (!isRecord(item)) {
      throw new RouteValidationError("items must contain objects", 400);
    }

    return {
      name: parseLooseString(item.name),
      price: parseLooseNumber(item.price),
      quantity: parseLooseNumber(item.quantity),
      title: parseLooseString(item.title),
    };
  });
}

function parseLooseString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseLooseNumber(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined;
}

function isAbandonedCartStatus(status: string) {
  return status.trim().toUpperCase() === ABANDONED_STATUS;
}

function buildWhatsAppPayload(phoneNumber: string, message: string): WhatsAppTextPayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    text: {
      body: message,
      preview_url: true,
    },
    to: sanitizePhoneNumber(phoneNumber),
    type: "text",
  };
}

function sanitizePhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getClientErrorMessage(error: unknown) {
  if (error instanceof RouteValidationError) {
    return error.message;
  }

  return "Internal Server Error";
}

function getErrorStatus(error: unknown) {
  return error instanceof RouteValidationError ? error.status : 500;
}

class RouteValidationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RouteValidationError";
    this.status = status;
  }
}
