export const runtime = "nodejs";

import {
  GoogleGenerativeAI as GoogleGenAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import { trackServerEvent } from "@/lib/conversion-api";
import { getRazorpayClient } from "@/lib/razorpay";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { NextResponse } from "next/server";
import { z } from "zod";

// Production Security Layer: Validation Schema matching your data types
const generateMessageSchema = z.object({
  merchantId: z.string().min(1, "Merchant ID required"),
  customerName: z.string().optional().nullable(),
  customerEmail: z.string().email("Invalid email structure").optional().nullable(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Strict E.164 phone format required"),
  cartTotalAmount: z.number().nonnegative(),
  cartUrl: z.string().url().optional().nullable(),
  timeSpentOnCheckout: z.number().optional().nullable(),
  userHistory: z.array(z.any()).optional(),
  deliveryPincode: z.string().optional().nullable(),
  pickupPincode: z.string().optional().nullable(),
  pickup_pincode: z.string().optional().nullable(),
  weightInKg: z.number().optional().nullable(),
  cartValue: z.number().positive(),
  checkoutStep: z.string().optional().nullable(),
  dropOffStep: z.string().optional().nullable(),
  trackingParams: z.any().optional(),
});

type GenerateMessageBody = z.infer<typeof generateMessageSchema>;

type OfferType =
  | "Priority Callback from Support"
  | "10% Discount Code"
  | "Free Shipping";

type LegacyOfferType = OfferType | "10% Discount";

type GeminiMessageResponse = {
  success?: unknown;
  offerType?: unknown;
  message: string;
};

type CartRecoveryDetails = {
  merchantId: string;
  customerName: string;
  customerEmail?: string;
  phoneNumber: string;
  cartTotalAmount: number;
  cartUrl: string;
  timeSpentOnCheckout: number;
  userHistory: string[];
  deliveryPincode?: string;
  pickupPincode?: string;
  weightInKg?: number;
  cartValue?: number;
  checkoutStep?: string;
  dropOffStep?: string;
  trackingParams: Record<string, unknown>;
};

type ShippingRateContext = {
  lowestRate: number;
  courierName: string;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const HIGH_VALUE_CART_AMOUNT = 3000;
const AI_DISCOUNT_PERCENT = 10;
const PAYMENT_LINK_EXPIRY_SECONDS = 15 * 60;
const FALLBACK_SHIPPING_RATE = 59;
const FALLBACK_COURIER_NAME = "Standard Shipping";
const DEFAULT_MERCHANT_ID = "default";
const OFFER_TYPES = [
  "Priority Callback from Support",
  "10% Discount Code",
  "Free Shipping",
] as const;
const GEMINI_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    success: {
      type: SchemaType.BOOLEAN,
    },
    offerType: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...OFFER_TYPES],
    },
    message: {
      type: SchemaType.STRING,
    },
  },
  required: ["success", "offerType", "message"],
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateMessageBody;
    const cartDetails = parseCartRecoveryBody(body);
    const apiKey = process.env.GEMINI_API_KEY;
    const shippingRateContext = await getShippingRateContext(request, cartDetails);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is not configured",
        },
        { status: 500 }
      );
    }

    const client = new GoogleGenAI(apiKey);
    const model = client.getGenerativeModel({
      model: getGeminiModel(),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 240,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
      systemInstruction: buildSystemPrompt(shippingRateContext),
    });

    const result = await model.generateContent(buildUserPrompt(cartDetails));
    const rawText = result.response.text();
    const generated = parseGeminiResponseSafely(rawText, cartDetails);
    const paymentUrl = await getPaymentUrl(cartDetails, generated.offerType);
    const responsePayload = {
      success: true,
      offerType: generated.offerType,
      message: generated.message,
      paymentUrl,
    };

    void dispatchWebhookEvent(cartDetails.merchantId, "cart.recovered", {
      customerName: cartDetails.customerName,
      offerType: generated.offerType,
      paymentUrl,
      message: generated.message,
      cartTotalAmount: cartDetails.cartTotalAmount,
      cartUrl: cartDetails.cartUrl,
    });
    void trackServerEvent(
      "InitiateCheckout",
      {
        email: cartDetails.customerEmail,
        phone: cartDetails.phoneNumber,
        clientIp: getClientIp(request),
        clientUserAgent: request.headers.get("user-agent") ?? undefined,
      },
      {
        value: cartDetails.cartTotalAmount,
        currency: "INR",
        offer_type: generated.offerType,
        payment_url: paymentUrl,
        cart_url: cartDetails.cartUrl,
        time_spent_on_checkout: cartDetails.timeSpentOnCheckout,
      }
    );

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Cart recovery Gemini route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: getErrorStatus(error) }
    );
  }
}

function parseCartRecoveryBody(body: GenerateMessageBody): CartRecoveryDetails {
  const merchantId = parseOptionalString(body.merchantId, "merchantId") ?? DEFAULT_MERCHANT_ID;
  const customerName = parseRequiredString(body.customerName, "customerName");
  const customerEmail = parseOptionalString(body.customerEmail, "customerEmail");
  const phoneNumber = parseRequiredString(body.phoneNumber, "phoneNumber");
  const cartUrl = parseRequiredString(body.cartUrl, "cartUrl");
  const cartTotalAmount = parseRequiredNumber(body.cartTotalAmount, "cartTotalAmount");
  const timeSpentOnCheckout = parseRequiredNumber(
    body.timeSpentOnCheckout,
    "timeSpentOnCheckout"
  );
  const userHistory = parseUserHistory(body.userHistory);
  const trackingParams = parseTrackingParams(body.trackingParams);

  return {
    merchantId,
    customerName,
    customerEmail,
    phoneNumber,
    cartTotalAmount,
    cartUrl,
    timeSpentOnCheckout,
    userHistory,
    deliveryPincode: parseOptionalString(body.deliveryPincode, "deliveryPincode"),
    pickupPincode: parseOptionalString(body.pickupPincode ?? body.pickup_pincode, "pickupPincode"),
    weightInKg: parseOptionalNumber(body.weightInKg, "weightInKg"),
    cartValue: parseOptionalNumber(body.cartValue, "cartValue"),
    checkoutStep: parseOptionalString(body.checkoutStep, "checkoutStep"),
    dropOffStep: parseOptionalString(body.dropOffStep, "dropOffStep"),
    trackingParams,
  };
}

function parseRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RouteValidationError(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RouteValidationError(`${fieldName} must be a string`);
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function parseRequiredNumber(value: unknown, fieldName: string) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    throw new RouteValidationError(`${fieldName} must be a non-negative number`);
  }

  return parsedValue;
}

function parseOptionalNumber(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return parseRequiredNumber(value, fieldName);
}

function parseUserHistory(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new RouteValidationError("userHistory must be an array of strings");
  }

  return value.map((entry) => entry.trim()).filter(Boolean).slice(0, 20);
}

function parseTrackingParams(value: unknown) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RouteValidationError("trackingParams must be an object");
  }

  return value as Record<string, unknown>;
}

function buildSystemPrompt(shippingRateContext?: ShippingRateContext | null) {
  const promptLines = [
    "You write professional Hinglish WhatsApp cart-recovery copy for Indian ecommerce customers.",
    "Output structured valid JSON only. Do not output prose before or after the JSON.",
    "The JSON must exactly match this schema: {\"success\":true,\"offerType\":\"Free Shipping\" | \"10% Discount Code\" | \"Priority Callback from Support\",\"message\":\"Your Hinglish marketing message here\"}.",
    "The success key must be the boolean true.",
    "offerType must be exactly one of: Free Shipping, 10% Discount Code, Priority Callback from Support.",
    "message must be fully generated, highly engaging, and directly populated with the final customer-facing professional Hinglish WhatsApp copy.",
    "message must never be empty, blank, null, an empty string, a placeholder, a label, or a description of what the message should be.",
    "message must contain only the final customer-facing conversion text.",
    "message must not contain labels, headings, explanations, markdown, code fences, JSON examples, internal reasoning, or meta-intro phrases.",
    "Never include phrases such as Here is the JSON requested, Here is the response, Sure, Certainly, Output, JSON, Message, or Customer-facing message in message.",
    "Analyze customerName, phoneNumber, cartTotalAmount, cartUrl, timeSpentOnCheckout, and userHistory before choosing the offer.",
    "If timeSpentOnCheckout is greater than 10 seconds, choose Priority Callback from Support to resolve possible payment or checkout friction.",
    `If timeSpentOnCheckout is 10 seconds or less and cartTotalAmount is at least INR ${HIGH_VALUE_CART_AMOUNT}, choose either 10% Discount Code or Free Shipping based on userHistory.`,
    "Choose 10% Discount Code when userHistory suggests coupon searches, price sensitivity, repeated cart revisits, deal comparison, or promo intent.",
    "Choose Free Shipping when userHistory suggests delivery concerns, shipping hesitation, or high cart value without clear coupon intent.",
    "If cartTotalAmount is below the high-value threshold and checkout time is 10 seconds or less, choose 10% Discount Code or Free Shipping only when userHistory strongly supports it.",
    "Write one concise, polished Hinglish message under 480 characters.",
    "Mention customerName, cartTotalAmount, and cartUrl exactly once.",
    "Naturally include the selected offer without sounding pushy.",
  ];

  if (shippingRateContext) {
    promptLines.push(
      `Shipping setup context: Inform the customer that we found a cheaper shipping provider ${shippingRateContext.courierName} for their location and can fulfill it at an absolute discount rate of just INR ${shippingRateContext.lowestRate}. Integrate this pricing factor inside the Hinglish WhatsApp output message body string seamlessly to maximize conversions.`
    );
  }

  return promptLines.join("\n");
}

function buildUserPrompt(cartDetails: CartRecoveryDetails) {
  return [
    `customerName: ${cartDetails.customerName}`,
    `phoneNumber: ${cartDetails.phoneNumber}`,
    `cartTotalAmount: INR ${cartDetails.cartTotalAmount}`,
    `cartUrl: ${cartDetails.cartUrl}`,
    `timeSpentOnCheckout: ${cartDetails.timeSpentOnCheckout} seconds`,
    `userHistory: ${formatUserHistory(cartDetails.userHistory)}`,
  ].join("\n");
}

function formatUserHistory(userHistory: string[]) {
  if (userHistory.length === 0) {
    return "No user history provided";
  }

  return userHistory.map((entry, index) => `${index + 1}. ${entry}`).join("\n");
}

async function getShippingRateContext(request: Request, cartDetails: CartRecoveryDetails) {
  if (!isShippingSetupDropOff(cartDetails)) {
    return null;
  }

  if (!cartDetails.deliveryPincode) {
    return getFallbackShippingRateContext();
  }

  try {
    const response = await fetch(new URL("/api/integrations/shiprocket/rates", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deliveryPincode: cartDetails.deliveryPincode,
        pickupPincode: cartDetails.pickupPincode,
        weightInKg: cartDetails.weightInKg,
        cartValue: cartDetails.cartValue ?? cartDetails.cartTotalAmount,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ShipRocket rates endpoint responded with ${response.status}`);
    }

    const data = (await response.json()) as unknown;

    if (!isShippingRateResponse(data)) {
      throw new Error("ShipRocket rates endpoint returned an invalid response");
    }

    return {
      lowestRate: data.lowestRate,
      courierName: data.courierName,
    };
  } catch (error) {
    console.warn("ShipRocket rate context lookup failed; using fallback context:", getLoggableError(error));

    return getFallbackShippingRateContext();
  }
}

function isShippingSetupDropOff(cartDetails: CartRecoveryDetails) {
  const trackingText = [
    cartDetails.checkoutStep,
    cartDetails.dropOffStep,
    cartDetails.deliveryPincode,
    ...cartDetails.userHistory,
    ...Object.entries(cartDetails.trackingParams).flatMap(([key, value]) => [
      key,
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "",
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(shipping|shipment|delivery|courier|freight|pincode|pin code|serviceability|shipping_rate|shipping rate|delivery charge|shipping charge)\b/.test(
    trackingText
  );
}

function isShippingRateResponse(value: unknown): value is ShippingRateContext {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as ShippingRateContext).lowestRate === "number" &&
    typeof (value as ShippingRateContext).courierName === "string"
  );
}

function getFallbackShippingRateContext() {
  return {
    lowestRate: FALLBACK_SHIPPING_RATE,
    courierName: FALLBACK_COURIER_NAME,
  };
}

function parseGeminiResponseSafely(rawText: string, cartDetails: CartRecoveryDetails) {
  try {
    return parseGeminiResponse(rawText, cartDetails);
  } catch (error) {
    const offerType = chooseFallbackOfferType(cartDetails);
    const message = getFallbackMessage(rawText, cartDetails, offerType);

    console.warn("Gemini response parsing failed; returning fallback message:", {
      error: getLoggableError(error),
    });

    return {
      success: true,
      offerType,
      message,
    };
  }
}

function parseGeminiResponse(rawText: string, cartDetails: CartRecoveryDetails) {
  const parsed = tryParseJsonObject(rawText);

  if (isGeminiMessageResponse(parsed)) {
    const offerType = isOfferType(parsed.offerType)
      ? parsed.offerType
      : chooseFallbackOfferType(cartDetails);
    const message = extractMessagePayload(parsed.message);

    if (!message) {
      throw new Error("Gemini returned an empty WhatsApp message");
    }

    return {
      success: true,
      offerType,
      message,
    };
  }

  const message = extractMessagePayload(rawText);

  if (!message) {
    throw new Error("Gemini returned an empty WhatsApp message");
  }

  return {
    success: true,
    offerType: chooseFallbackOfferType(cartDetails),
    message,
  };
}

function tryParseJsonObject(rawText: string) {
  const jsonCandidate = extractJsonCandidate(rawText);

  try {
    return JSON.parse(jsonCandidate) as unknown;
  } catch {
    const objectMatch = jsonCandidate.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      return null;
    }

    try {
      return JSON.parse(objectMatch[0]) as unknown;
    } catch {
      return null;
    }
  }
}

function extractJsonCandidate(rawText: string) {
  const trimmedText = rawText.trim();
  const fencedJsonMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  return (fencedJsonMatch?.[1] ?? trimmedText).trim();
}

function extractMessagePayload(message: string) {
  const cleanedMessage = sanitizeGeneratedMessage(stripMarkdownFence(message));
  const nestedJson = tryParseJsonObject(cleanedMessage);

  if (isGeminiMessageResponse(nestedJson)) {
    return extractMessagePayload(nestedJson.message);
  }

  return cleanedMessage;
}

function stripMarkdownFence(value: string) {
  const trimmedValue = value.trim();
  const fenceMatch = trimmedValue.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return (fenceMatch?.[1] ?? trimmedValue).trim();
}

function isGeminiMessageResponse(value: unknown): value is GeminiMessageResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as GeminiMessageResponse).message === "string"
  );
}

function isOfferType(value: unknown): value is OfferType {
  return typeof value === "string" && OFFER_TYPES.some((offerType) => offerType === value);
}

function chooseFallbackOfferType(cartDetails: CartRecoveryDetails): OfferType {
  if (cartDetails.timeSpentOnCheckout > 10) {
    return "Priority Callback from Support";
  }

  const historyText = cartDetails.userHistory.join(" ").toLowerCase();

  if (cartDetails.cartTotalAmount >= HIGH_VALUE_CART_AMOUNT) {
    return hasCouponIntent(historyText) ? "10% Discount Code" : "Free Shipping";
  }

  return hasDeliveryIntent(historyText) ? "Free Shipping" : "10% Discount Code";
}

function hasCouponIntent(historyText: string) {
  return /\b(coupon|discount|deal|price|offer|promo|sale|cheap)\b/.test(historyText);
}

function hasDeliveryIntent(historyText: string) {
  return /\b(shipping|delivery|freight|courier|dispatch)\b/.test(historyText);
}

function sanitizeGeneratedMessage(message: string) {
  return message
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(
      /^(?:here(?:'s| is)(?: the)?(?: json requested| response| json| message)?|sure|certainly|output|json|message|customer-facing message)\s*:?\s*/i,
      ""
    )
    .trim();
}

function isPaymentLinkOffer(offerType: LegacyOfferType) {
  return isDiscountOffer(offerType) || offerType === "Free Shipping";
}

async function getPaymentUrl(cartDetails: CartRecoveryDetails, offerType: OfferType) {
  if (!isPaymentLinkOffer(offerType)) {
    return cartDetails.cartUrl;
  }

  try {
    return await createCartRecoveryPaymentLink(cartDetails, offerType);
  } catch (error) {
    console.warn("Razorpay payment link generation failed; falling back to cartUrl:", {
      offerType,
      error: getLoggableError(error),
    });

    return cartDetails.cartUrl;
  }
}

async function createCartRecoveryPaymentLink(cartDetails: CartRecoveryDetails, offerType: OfferType) {
  const razorpay = getRazorpayClient();
  const finalCartAmount = getFinalCartAmount(cartDetails.cartTotalAmount, offerType);
  const paymentLink = await razorpay.paymentLink.create({
    amount: toCurrencySubunits(finalCartAmount),
    currency: "INR",
    accept_partial: false,
    expire_by: Math.floor(Date.now() / 1000) + PAYMENT_LINK_EXPIRY_SECONDS,
    reference_id: `cart-recovery-${Date.now()}`,
    description: `${offerType} cart recovery payment`,
    customer: {
      name: cartDetails.customerName,
      contact: cartDetails.phoneNumber,
      ...(cartDetails.customerEmail ? { email: cartDetails.customerEmail } : {}),
    },
    notify: {
      sms: false,
      email: false,
      whatsapp: false,
    },
    reminder_enable: false,
    notes: {
      cart_url: cartDetails.cartUrl,
      original_amount: cartDetails.cartTotalAmount,
      discount_percent: getDiscountPercent(offerType),
      final_cart_amount: finalCartAmount,
      offer_type: offerType,
    },
  });

  if (!paymentLink.short_url) {
    throw new Error("Razorpay did not return a payment link URL");
  }

  return paymentLink.short_url;
}

function getFinalCartAmount(cartTotalAmount: number, offerType: LegacyOfferType) {
  return isDiscountOffer(offerType)
    ? applyDiscount(cartTotalAmount, AI_DISCOUNT_PERCENT)
    : cartTotalAmount;
}

function getDiscountPercent(offerType: LegacyOfferType) {
  return isDiscountOffer(offerType) ? AI_DISCOUNT_PERCENT : 0;
}

function isDiscountOffer(offerType: LegacyOfferType) {
  return offerType === "10% Discount" || offerType === "10% Discount Code";
}

function getFallbackMessage(rawText: string, cartDetails: CartRecoveryDetails, offerType: OfferType) {
  const sanitizedRawText = sanitizeGeneratedMessage(rawText);

  if (sanitizedRawText) {
    return sanitizedRawText;
  }

  const offerText =
    offerType === "Priority Callback from Support"
      ? "hamari support team priority par aapki help karegi"
      : offerType === "Free Shipping"
        ? "aapke order par free shipping available hai"
        : "aapke cart par 10% discount code available hai";

  return `Hi ${cartDetails.customerName}, aapka cart INR ${cartDetails.cartTotalAmount} abhi ready hai. ${offerText}. Order complete karne ke liye yahan checkout karein: ${cartDetails.cartUrl}`;
}

function applyDiscount(amount: number, discountPercent: number) {
  return amount * (1 - discountPercent / 100);
}

function toCurrencySubunits(amount: number) {
  return Math.round(amount * 100);
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

function getLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return String(error);
}

class RouteValidationError extends Error {}

function getGeminiModel() {
  return (process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
}
