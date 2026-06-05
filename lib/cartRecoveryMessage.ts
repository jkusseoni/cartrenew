import type { Cart } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { whatsappQueue } from "@/lib/bullmq"; // 👈 BullMQ Queue Import Kiya

export const GEMINI_MODEL = process.env.GEMINI_MODEL;
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type CartItem = {
  title?: string;
  name?: string;
  quantity?: number;
  price?: number;
};

export type OfferType =
  | "Priority Callback from Support"
  | "10% Discount Code"
  | "Free Shipping"
  | "None";

export type GenerateMessageRequest = {
  cartId?: number | string;
  customerName?: string;
  phoneNumber?: string;
  phone?: string;
  totalAmount?: number | string;
  cartTotalAmount?: number | string;
  cartUrl?: string;
  abandonedCartUrl?: string;
  items?: CartItem[];
  userHistory?: string[];
  timeSpentOnCheckout?: number;
  merchantId?: string; // 👈 Multi-tenant tracking ke liye optional merchantId
};

export type GenerateMessageResult = {
  cart: Cart;
  message: string;
  offerType: OfferType;
  model: string;
  prompt: string;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type CartDetails = {
  customerName: string;
  phoneNumber: string;
  totalAmount: number;
  cartUrl: string;
  items: CartItem[];
  userHistory: string[];
  timeSpentOnCheckout?: number;
};

const FALLBACK_USER_ID = "local-dev";
const FALLBACK_USER_EMAIL = "local@localhost";
const FALLBACK_MERCHANT_ID = "default_store";
const FALLBACK_MERCHANT_NAME = "Default Store";

export class CartRecoveryMessageError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "CartRecoveryMessageError";
    this.status = status;
  }
}

export async function generateCartRecoveryMessageForCartId(cartId: string) {
  return generateCartRecoveryMessage({ cartId });
}

export async function generateCartRecoveryMessage(
  requestBody: GenerateMessageRequest
): Promise<GenerateMessageResult> {
  const cartId = getCartId(requestBody.cartId);
  const cartDetails = await getCartDetails(requestBody, cartId);

  validateCartDetails(cartDetails);

  const geminiModel = getConfiguredGeminiModel();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(cartDetails);
  const storedPrompt = formatStoredPrompt(systemPrompt, userPrompt);
  const recovery = await generateGeminiMessage(systemPrompt, userPrompt, geminiModel);

  // DB Operations
  const cart = cartId
      ? await prisma.cart.update({
        where: { id: cartId },
        data: {
          customerPhone: cartDetails.phoneNumber,
          customerName: cartDetails.customerName,
          phoneNumber: cartDetails.phoneNumber,
          totalAmount: cartDetails.totalAmount,
          cartUrl: cartDetails.cartUrl,
          recoveryMessage: recovery.message,
          recoveryMessageModel: geminiModel,
          recoveryMessagePrompt: storedPrompt,
          recoveryMessageAt: new Date(),
        },
      })
    : await prisma.cart.create({
        data: {
          merchant: getMerchantRelation(requestBody.merchantId),
          customerPhone: cartDetails.phoneNumber,
          customerName: cartDetails.customerName,
          phoneNumber: cartDetails.phoneNumber,
          totalAmount: cartDetails.totalAmount,
          cartUrl: cartDetails.cartUrl,
          status: "message_generated",
          recoveryMessage: recovery.message,
          recoveryMessageModel: geminiModel,
          recoveryMessagePrompt: storedPrompt,
          recoveryMessageAt: new Date(),
        },
      });

  // 👉 BULLMQ INTEGRATION: Message database me save hote hi task Queue me push karein
  try {
    await whatsappQueue.add(`whatsapp_send_${cart.id}`, {
      cartId: cart.id,
      storeId: requestBody.merchantId || "default_store",
      phoneNumber: cart.phoneNumber ?? cart.customerPhone,
      messagePayload: {
        text: recovery.message,
        customerName: cart.customerName ?? "Customer",
        cartUrl: cart.cartUrl,
        offerType: recovery.offerType,
      }
    });
    console.log(`🚀 [BullMQ] Successfully queued WhatsApp recovery job for Cart ID: ${cart.id}`);
  } catch (queueError) {
    // Fail-safe: Agar Redis pipeline down bhi ho, toh webhook flow na tute
    console.error("❌ [BullMQ] Failed to push job to WhatsApp Queue:", queueError);
  }

  return {
    cart,
    message: recovery.message,
    offerType: recovery.offerType,
    model: geminiModel,
    prompt: storedPrompt,
  };
}

// --- Baaki ke auxiliary functions bina kisi change ke as-is hain ---
function getConfiguredGeminiModel() {
  const model = process.env.GEMINI_MODEL?.trim();
  if (!model) throw new CartRecoveryMessageError("GEMINI_MODEL is not configured", 500);
  return model;
}

function getCartId(cartId: GenerateMessageRequest["cartId"]) {
  if (cartId === undefined || cartId === "") return undefined;
  const normalizedCartId = String(cartId).trim();
  if (!normalizedCartId) throw new CartRecoveryMessageError("cartId must be a non-empty string", 400);
  return normalizedCartId;
}

async function getCartDetails(body: GenerateMessageRequest, cartId?: string): Promise<CartDetails> {
  const existingCart = cartId !== undefined ? await prisma.cart.findUnique({ where: { id: cartId } }) : null;
  if (cartId !== undefined && !existingCart) throw new CartRecoveryMessageError(`Cart ${cartId} was not found`, 404);

  const totalAmount = Number(body.totalAmount ?? body.cartTotalAmount ?? existingCart?.totalAmount);
  const timeSpentOnCheckout = normalizeTimeSpentOnCheckout(body.timeSpentOnCheckout);

  return {
    customerName: body.customerName ?? existingCart?.customerName ?? "",
    phoneNumber: body.phoneNumber ?? body.phone ?? existingCart?.phoneNumber ?? existingCart?.customerPhone ?? "",
    totalAmount,
    cartUrl: body.cartUrl ?? body.abandonedCartUrl ?? existingCart?.cartUrl ?? "",
    items: Array.isArray(body.items) ? body.items : [],
    userHistory: normalizeUserHistory(body.userHistory),
    timeSpentOnCheckout,
  };
}

function validateCartDetails(cartDetails: CartDetails) {
  if (!cartDetails.customerName || !cartDetails.phoneNumber || !cartDetails.cartUrl || !Number.isFinite(cartDetails.totalAmount)) {
    throw new CartRecoveryMessageError("Missing required cart details: customerName, phoneNumber, totalAmount, and cartUrl", 400);
  }
}

function getMerchantRelation(merchantId: string | undefined) {
  const trimmedMerchantId = merchantId?.trim();

  if (trimmedMerchantId) {
    return {
      connect: {
        id: trimmedMerchantId,
      },
    };
  }

  return {
    connectOrCreate: {
      where: {
        id: FALLBACK_MERCHANT_ID,
      },
      create: {
        id: FALLBACK_MERCHANT_ID,
        storeName: FALLBACK_MERCHANT_NAME,
        user: {
          connectOrCreate: {
            where: {
              id: FALLBACK_USER_ID,
            },
            create: {
              id: FALLBACK_USER_ID,
              email: FALLBACK_USER_EMAIL,
              firstName: "Local",
              lastName: "Developer",
            },
          },
        },
      },
    },
  };
}

function buildSystemPrompt() {
  return [
    "You are an autonomous marketing manager for an Indian ecommerce cart recovery flow using Gemini 1.5 Flash.",
    "Analyze cartTotalAmount, userHistory, and timeSpentOnCheckout before writing the message.",
    "Return exactly one JSON object with string fields message and offerType.",
    "offerType must be exactly one of: Priority Callback from Support, 10% Discount Code, Free Shipping, None.",
    "If timeSpentOnCheckout is greater than 10 seconds, choose Priority Callback from Support to resolve likely payment or checkout friction.",
    "If timeSpentOnCheckout is 10 seconds or less and the cart is high-value, choose either 10% Discount Code or Free Shipping based on userHistory and cart context.",
    "Treat cartTotalAmount of INR 3000 or more, repeat visits, prior purchases, premium items, or strong buying intent in userHistory as high-value signals.",
    "Prefer 10% Discount Code when userHistory suggests price sensitivity, deal browsing, coupon searches, or repeated cart revisits.",
    "Prefer Free Shipping when userHistory suggests delivery/shipping hesitation, location friction, or cart value is high but price sensitivity is unclear.",
    "If no strong support, discount, or shipping signal exists, choose None and write a simple reminder.",
    "The message must be one finalized personalized Hinglish WhatsApp message under 480 characters.",
    "Mention customer name, cartTotalAmount, and checkout link exactly once.",
    "Do not include markdown, labels, quotation marks, emojis, multiple options, or internal reasoning inside message.",
  ].join("\n");
}

function buildUserPrompt(cart: CartDetails) {
  const itemSummary = cart.items.length > 0 ? cart.items.map((item) => {
    const title = item.title ?? item.name ?? "Cart item";
    const quantity = item.quantity ?? 1;
    const price = item.price === undefined ? "" : `, price ${item.price}`;
    return `${title} x${quantity}${price}`;
  }).join("; ") : "No item-level details provided";

  const userHistorySummary = formatUserHistory(cart.userHistory);
  const checkoutTimeSummary = formatCheckoutTime(cart.timeSpentOnCheckout);

  return [
    `Customer name: ${cart.customerName}`,
    `cartTotalAmount: INR ${cart.totalAmount}`,
    `Cart items: ${itemSummary}`,
    `Checkout link: ${cart.cartUrl}`,
    `Time spent on checkout: ${checkoutTimeSummary}`,
    `User history: ${userHistorySummary}`,
  ].join("\n");
}

function formatStoredPrompt(systemPrompt: string, userPrompt: string) {
  return [`System instruction:\n${systemPrompt}`, `User context:\n${userPrompt}`].join("\n\n");
}

function formatCheckoutTime(timeSpentOnCheckout: CartDetails["timeSpentOnCheckout"]) {
  if (timeSpentOnCheckout === undefined) return "Not provided";
  return `${timeSpentOnCheckout} seconds`;
}

// Data Normalization Functions
function normalizeUserHistory(userHistory: GenerateMessageRequest["userHistory"]) {
  if (userHistory === undefined) return [];
  if (!Array.isArray(userHistory)) throw new CartRecoveryMessageError("userHistory must be an array of strings", 400);
  if (userHistory.some((entry) => typeof entry !== "string")) throw new CartRecoveryMessageError("userHistory must contain only strings", 400);
  return userHistory;
}

function normalizeTimeSpentOnCheckout(timeSpentOnCheckout: GenerateMessageRequest["timeSpentOnCheckout"]) {
  if (timeSpentOnCheckout === undefined) return undefined;
  if (!Number.isFinite(timeSpentOnCheckout) || timeSpentOnCheckout < 0) throw new CartRecoveryMessageError("timeSpentOnCheckout must be a non-negative number of seconds", 400);
  return timeSpentOnCheckout;
}

function formatUserHistory(userHistory: string[]) {
  if (userHistory.length === 0) return "No prior behavior provided";
  return userHistory.slice(0, 12).map((entry, index) => `${index + 1}. ${entry}`).join("\n");
}

// Gemini Integration Engine
async function generateGeminiMessage(systemPrompt: string, userPrompt: string, geminiModel: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new CartRecoveryMessageError("GEMINI_API_KEY is not configured");

  const response = await fetch(`${GEMINI_API_BASE_URL}/${geminiModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 220,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = (await response.json()) as GeminiGenerateContentResponse;
  if (!response.ok) throw new CartRecoveryMessageError(data.error?.message || "Gemini API request failed");

  const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("").trim();
  if (!rawText) throw new CartRecoveryMessageError("Gemini API did not return a message");

  const parsedMessage = parseGeminiRecoveryMessage(rawText);
  if (!parsedMessage.message) throw new CartRecoveryMessageError("Gemini API did not return a finalized WhatsApp message");

  return parsedMessage;
}

function parseGeminiRecoveryMessage(rawText: string) {
  const parsed = parseJsonObject(rawText);
  if (!isJsonRecord(parsed)) throw new CartRecoveryMessageError("Gemini API did not return a JSON object");
  const offerType = normalizeOfferType(parsed.offerType);

  return {
    message: typeof parsed.message === "string" ? parsed.message.trim() : "",
    offerType,
  };
}

function parseJsonObject(rawText: string) {
  const cleanedText = rawText
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanedText);
  } catch {
    const match = cleanedText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOfferType(offerType: unknown): OfferType {
  const normalizedOfferType = typeof offerType === "string" ? offerType.trim() : "";
  const allowedOfferTypes: OfferType[] = [
    "Priority Callback from Support",
    "10% Discount Code",
    "Free Shipping",
    "None",
  ];

  return allowedOfferTypes.includes(normalizedOfferType as OfferType)
    ? (normalizedOfferType as OfferType)
    : "None";
}
