import {
  buildLanguageGuardRail,
  isLanguageAllowedForStrategy,
  normalizeLanguageName,
  resolveLanguageStrategy,
  shouldUseLanguageFallback,
  type LanguageFallback,
  type LanguageStrategy,
  type LanguageStrategyInput,
  type RegionalLanguage,
} from "@/lib/lang-policy";

export type AIProvider = "endpointai" | "deepseek" | "openai" | "fallback";

export type CartItemContext = {
  name?: string;
  price?: number;
  quantity?: number;
  title?: string;
};

export type CartRecoveryStoreContext = {
  brandVoice?: string;
  merchantId?: string;
  supportPhone?: string | null;
  whatsappNumber?: string | null;
  storeName: string;
};

export type CartRecoveryCustomerContext = {
  customerStateCode?: string | null;
  customerName?: string | null;
  phoneNumber?: string | null;
  userHistory?: string[];
};

export type AICartRecoveryContext = CartRecoveryStoreContext &
  CartRecoveryCustomerContext & {
    abandonedReason?: string | null;
    cartId?: string;
    checkoutUrl: string;
    currency?: string;
    items?: CartItemContext[];
    itemsCount?: number;
    languageStrategy?: LanguageStrategyInput | null;
    shippingStateCode?: string | null;
    stateCode?: string | null;
    timeSpentOnCheckout?: number | null;
    totalAmount: number;
  };

export type AICartRecoveryMessageResult = {
  cta: string;
  fallbackReason?: string;
  fallbackUsed: boolean;
  language: RegionalLanguage;
  languageConfidence: number;
  languageFallbackReason?: string;
  languageFallbackUsed: boolean;
  languageStrategy: LanguageStrategy;
  message: string;
  model: string;
  offerType: OfferType;
  prompt: string;
  provider: AIProvider;
};

type OfferType =
  | "Priority Callback from Support"
  | "10% Discount Code"
  | "Free Shipping"
  | "Friendly Reminder";

type ProviderConfig = {
  apiKey: string;
  endpoint: string;
  model: string;
  provider: Exclude<AIProvider, "fallback">;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

type GeneratedCartRecoveryMessage = {
  cta: string;
  language: RegionalLanguage;
  languageConfidence: number | null;
  message: string;
  offerType: OfferType;
};

const DEFAULT_ENDPOINTAI_MODEL = "deepseek-r1-7b";
const ENDPOINTAI_BASE_URL = "https://api.endpointai.in/v1";
const ENDPOINTAI_CHAT_COMPLETIONS_URL = `${ENDPOINTAI_BASE_URL}/chat/completions`;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEEPSEEK_CHAT_COMPLETIONS_URL = "https://api.deepseek.com/v1/chat/completions";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const HIGH_VALUE_CART_AMOUNT = 3000;
const AI_TIMEOUT_MS = 10000;
const MAX_MESSAGE_LENGTH = 700;

export async function generateAICartRecoveryMessage(
  context: AICartRecoveryContext
): Promise<AICartRecoveryMessageResult> {
  const normalizedContext = normalizeContext(context);
  const systemPrompt = buildSystemPrompt(normalizedContext.languageStrategy);
  const userPrompt = buildUserPrompt(normalizedContext);
  const prompt = formatStoredPrompt(systemPrompt, userPrompt);
  const providerConfig = getProviderConfig();

  if (!providerConfig) {
    return buildFallbackResult(normalizedContext, prompt, "AI provider API key is not configured");
  }

  try {
    const generated = await requestStructuredMessage(providerConfig, systemPrompt, userPrompt);
    const message = finalizeMessage(generated.message, normalizedContext);
    const languageFallbackReason = getLanguageFallbackReason(
      generated,
      message,
      normalizedContext
    );

    if (!message) {
      return buildFallbackResult(normalizedContext, prompt, "AI provider returned an empty message");
    }

    if (languageFallbackReason) {
      return buildFallbackResult(normalizedContext, prompt, languageFallbackReason);
    }

    const languageFallbackUsed =
      generated.language !== normalizedContext.languageStrategy.primaryLanguage;

    return {
      cta: generated.cta,
      fallbackUsed: false,
      language: generated.language,
      languageConfidence: generated.languageConfidence ?? 1,
      languageFallbackReason: languageFallbackUsed
        ? `Provider selected ${generated.language} from the configured fallback order.`
        : undefined,
      languageFallbackUsed,
      languageStrategy: normalizedContext.languageStrategy,
      message,
      model: providerConfig.model,
      offerType: generated.offerType,
      prompt,
      provider: providerConfig.provider,
    };
  } catch (error) {
    return buildFallbackResult(normalizedContext, prompt, getErrorMessage(error));
  }
}

async function requestStructuredMessage(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string
) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      max_tokens: 320,
      messages: [
        {
          content: systemPrompt,
          role: "system",
        },
        {
          content: userPrompt,
          role: "user",
        },
      ],
      model: config.model,
      response_format: { type: "json_object" },
      stream: false,
      temperature: 0.65,
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => null)) as ChatCompletionResponse | null;

  if (!response.ok) {
    throw new Error(data?.error?.message || `${config.provider} request failed with ${response.status}`);
  }

  const rawText = data?.choices?.[0]?.message?.content?.trim();

  if (!rawText) {
    throw new Error(`${config.provider} returned no message content`);
  }

  return parseProviderJson(rawText);
}

function parseProviderJson(rawText: string): GeneratedCartRecoveryMessage {
  const parsed = parseJsonObject(rawText);

  if (!isRecord(parsed)) {
    throw new Error("AI provider did not return a JSON object");
  }

  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
  const cta = typeof parsed.cta === "string" ? parsed.cta.trim() : "Complete checkout";
  const language = normalizeLanguageName(parsed.language);
  const languageConfidence = normalizeLanguageConfidence(parsed.languageConfidence);
  const offerType = normalizeOfferType(parsed.offerType);

  return {
    cta,
    language,
    languageConfidence,
    message,
    offerType,
  };
}

function buildFallbackResult(
  context: NormalizedAICartRecoveryContext,
  prompt: string,
  fallbackReason: string
): AICartRecoveryMessageResult {
  const offerType = chooseFallbackOfferType(context);
  const fallbackLanguage = getRuleBasedFallbackLanguage(context.languageStrategy);

  return {
    cta: "Complete checkout",
    fallbackReason,
    fallbackUsed: true,
    language: fallbackLanguage,
    languageConfidence: 1,
    languageFallbackReason: fallbackReason,
    languageFallbackUsed:
      fallbackLanguage !== context.languageStrategy.primaryLanguage,
    languageStrategy: context.languageStrategy,
    message: generateFallbackMessage(context, offerType, fallbackLanguage),
    model: "rule-based-fallback",
    offerType,
    prompt,
    provider: "fallback",
  };
}

function generateFallbackMessage(
  context: NormalizedAICartRecoveryContext,
  offerType: OfferType,
  language: RegionalLanguage
) {
  if (language === "ENGLISH") {
    return generateFallbackEnglishMessage(context, offerType);
  }

  return generateFallbackHinglishMessage(context, offerType);
}

function generateFallbackHinglishMessage(
  context: NormalizedAICartRecoveryContext,
  offerType: OfferType
) {
  const customerName = context.customerName || "there";
  const amount = formatAmount(context.totalAmount, context.currency);
  const itemText =
    context.itemsCount === 1 ? "item" : `${context.itemsCount} items`;
  const offerText = getFallbackOfferText(context, offerType, "HINGLISH");

  return cleanMessage(
    `Hi ${customerName}, ${context.storeName} par aapka ${amount} ka cart (${itemText}) abhi saved hai. ${offerText} Order complete karne ke liye yahan tap karein: ${context.checkoutUrl}`
  );
}

function generateFallbackEnglishMessage(
  context: NormalizedAICartRecoveryContext,
  offerType: OfferType
) {
  const customerName = context.customerName || "there";
  const amount = formatAmount(context.totalAmount, context.currency);
  const itemText =
    context.itemsCount === 1 ? "item" : `${context.itemsCount} items`;
  const offerText = getFallbackOfferText(context, offerType, "ENGLISH");

  return cleanMessage(
    `Hi ${customerName}, your ${amount} cart with ${itemText} is still saved at ${context.storeName}. ${offerText} Complete your order here: ${context.checkoutUrl}`
  );
}

function getFallbackOfferText(
  context: NormalizedAICartRecoveryContext,
  offerType: OfferType,
  language: LanguageFallback
) {
  const isEnglish = language === "ENGLISH";

  if (offerType === "Priority Callback from Support") {
    const phone = context.supportPhone || context.whatsappNumber;

    if (isEnglish) {
      return phone
        ? `Need checkout help? Our team can assist you quickly at ${phone}.`
        : "Need checkout help? Our team can assist you quickly.";
    }

    return phone
      ? `Checkout me help chahiye toh team priority par assist karegi: ${phone}.`
      : "Checkout me help chahiye toh team priority par assist karegi.";
  }

  if (offerType === "10% Discount Code") {
    return isEnglish
      ? "A 10% discount code is ready for you."
      : "Aapke liye 10% discount code ready hai.";
  }

  if (offerType === "Free Shipping") {
    return isEnglish
      ? "Free shipping is available on your order."
      : "Aapke order par free shipping available hai.";
  }

  return isEnglish
    ? "We have kept your picks ready."
    : "Humne aapke picks safe rakhe hain.";
}

function buildSystemPrompt(languageStrategy: LanguageStrategy) {
  return [
    "You are CartRenew's AI Message Agent for Indian ecommerce WhatsApp cart recovery.",
    "Return only one valid JSON object. No markdown, no code fences, no prose around JSON.",
    'JSON shape: {"message":"final recovery message","offerType":"Priority Callback from Support | 10% Discount Code | Free Shipping | Friendly Reminder","cta":"short CTA","language":"HINGLISH | ENGLISH | configured regional language","languageConfidence":0.0}',
    buildLanguageGuardRail(languageStrategy),
    `Target language for this request: ${languageStrategy.primaryLanguage}.`,
    `Supported regional language set for this state: ${languageStrategy.supportedLanguages.join(", ")}.`,
    "Keep the message warm, credible, and under 520 characters.",
    "Mention the customer name, store name, cart value, and checkout link naturally.",
    "Use one clear conversion angle based on cart value, checkout friction, and user history.",
    "If checkout time is above 10 seconds or abandonment reason suggests payment/checkout friction, choose Priority Callback from Support.",
    `If cart value is at least INR ${HIGH_VALUE_CART_AMOUNT}, choose Free Shipping or 10% Discount Code based on user history.`,
    "Choose 10% Discount Code for coupon, price, deal, comparison, or repeated revisit signals.",
    "Choose Free Shipping for shipping, delivery, pincode, courier, or high-value hesitation signals.",
    "Choose Friendly Reminder when there is no strong discount, shipping, or support signal.",
    "Set languageConfidence to your honest confidence from 0 to 1 for the final rendered message language.",
    "Do not include placeholders, internal reasoning, labels, or multiple message options.",
  ].join("\n");
}

function buildUserPrompt(context: NormalizedAICartRecoveryContext) {
  return [
    `cartId: ${context.cartId || "not provided"}`,
    `storeName: ${context.storeName}`,
    `merchantId: ${context.merchantId || "not provided"}`,
    `brandVoice: ${context.brandVoice || "friendly, helpful, concise"}`,
    `customerName: ${context.customerName || "not provided"}`,
    `customerStateCode: ${context.customerStateCode || context.stateCode || "not provided"}`,
    `phoneNumber: ${context.phoneNumber || "not provided"}`,
    `languagePrimary: ${context.languageStrategy.primaryLanguage}`,
    `languageFallback: ${context.languageStrategy.fallbackLanguage}`,
    `languageFallbackOrder: ${context.languageStrategy.primaryLanguage} -> ${context.languageStrategy.fallbackLanguage} -> ${context.languageStrategy.secondaryFallbackLanguage}`,
    `languageConfidenceThreshold: ${context.languageStrategy.confidenceThreshold}`,
    `languageTargetLocale: ${context.languageStrategy.targetLocale}`,
    `totalAmount: ${formatAmount(context.totalAmount, context.currency)}`,
    `itemsCount: ${context.itemsCount}`,
    `items: ${formatItems(context.items)}`,
    `checkoutUrl: ${context.checkoutUrl}`,
    `timeSpentOnCheckout: ${formatCheckoutTime(context.timeSpentOnCheckout)}`,
    `abandonedReason: ${context.abandonedReason || "not provided"}`,
    `supportPhone: ${context.supportPhone || "not provided"}`,
    `whatsappNumber: ${context.whatsappNumber || "not provided"}`,
    `userHistory: ${formatUserHistory(context.userHistory)}`,
  ].join("\n");
}

function formatStoredPrompt(systemPrompt: string, userPrompt: string) {
  return [`System:\n${systemPrompt}`, `User:\n${userPrompt}`].join("\n\n");
}

function getEndpointAIChatCompletionsUrl(): string {
  const explicitUrl = process.env.ENDPOINTAI_CHAT_COMPLETIONS_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = (process.env.ENDPOINTAI_BASE_URL?.trim() || ENDPOINTAI_BASE_URL).replace(/\/$/, "");
  return `${baseUrl}/chat/completions`;
}

function getEndpointAIProviderConfig(): ProviderConfig | null {
  const apiKey = process.env.ENDPOINTAI_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    endpoint: getEndpointAIChatCompletionsUrl(),
    model: process.env.ENDPOINTAI_MODEL?.trim() || DEFAULT_ENDPOINTAI_MODEL,
    provider: "endpointai",
  };
}

function getProviderConfig(): ProviderConfig | null {
  const preferredProvider = process.env.AI_AGENT_PROVIDER?.trim().toLowerCase();
  const endpointAIConfig = getEndpointAIProviderConfig();
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const openAIApiKey = process.env.OPENAI_API_KEY?.trim();

  if (preferredProvider === "openai" && openAIApiKey) {
    return {
      apiKey: openAIApiKey,
      endpoint: process.env.OPENAI_CHAT_COMPLETIONS_URL?.trim() || OPENAI_CHAT_COMPLETIONS_URL,
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      provider: "openai",
    };
  }

  if (
    (preferredProvider === "endpointai" ||
      preferredProvider === "deepseek" ||
      !preferredProvider) &&
    endpointAIConfig
  ) {
    return endpointAIConfig;
  }

  if (deepSeekApiKey) {
    return {
      apiKey: deepSeekApiKey,
      endpoint: process.env.DEEPSEEK_CHAT_COMPLETIONS_URL?.trim() || DEEPSEEK_CHAT_COMPLETIONS_URL,
      model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
      provider: "deepseek",
    };
  }

  if (openAIApiKey) {
    return {
      apiKey: openAIApiKey,
      endpoint: process.env.OPENAI_CHAT_COMPLETIONS_URL?.trim() || OPENAI_CHAT_COMPLETIONS_URL,
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      provider: "openai",
    };
  }

  return endpointAIConfig;
}

function parseJsonObject(rawText: string) {
  const cleanedText = rawText
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanedText) as unknown;
  } catch {
    const match = cleanedText.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      return null;
    }
  }
}

function finalizeMessage(message: string, context: NormalizedAICartRecoveryContext) {
  const cleanedMessage = cleanMessage(message);

  if (!cleanedMessage) {
    return "";
  }

  if (!cleanedMessage.includes(context.checkoutUrl)) {
    return cleanMessage(
      `${cleanedMessage} ${getCheckoutContinuation(context.languageStrategy)} ${context.checkoutUrl}`
    );
  }

  return cleanedMessage;
}

function cleanMessage(message: string) {
  return message
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(
      /^(?:message|whatsapp message|output|json|here is the message|sure|certainly)\s*:?\s*/i,
      ""
    )
    .replace(/\s+/g, " ")
    .slice(0, MAX_MESSAGE_LENGTH)
    .trim();
}

function normalizeOfferType(offerType: unknown): OfferType {
  const normalizedOfferType = typeof offerType === "string" ? offerType.trim() : "";
  const allowedOfferTypes: OfferType[] = [
    "Priority Callback from Support",
    "10% Discount Code",
    "Free Shipping",
    "Friendly Reminder",
  ];

  return allowedOfferTypes.includes(normalizedOfferType as OfferType)
    ? (normalizedOfferType as OfferType)
    : "Friendly Reminder";
}

function normalizeLanguageConfidence(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value.trim());

    if (Number.isFinite(parsedValue)) {
      return Math.min(1, Math.max(0, parsedValue));
    }
  }

  return null;
}

function getLanguageFallbackReason(
  generated: GeneratedCartRecoveryMessage,
  message: string,
  context: NormalizedAICartRecoveryContext
) {
  if (!isLanguageAllowedForStrategy(generated.language, context.languageStrategy)) {
    return `Language ${generated.language} is outside the configured fallback order for ${context.languageStrategy.stateCode}.`;
  }

  if (
    shouldUseLanguageFallback({
      languageConfidence: generated.languageConfidence,
      outputLanguage: generated.language,
      renderedMessage: message,
      strategy: context.languageStrategy,
    })
  ) {
    return `Language guard rail fallback triggered for ${context.languageStrategy.primaryLanguage}.`;
  }

  return "";
}

function getRuleBasedFallbackLanguage(strategy: LanguageStrategy): LanguageFallback {
  if (strategy.primaryLanguage === "ENGLISH") {
    return "ENGLISH";
  }

  if (strategy.primaryLanguage === "HINGLISH" || strategy.primaryLanguage === "HINDI") {
    return "HINGLISH";
  }

  return strategy.fallbackLanguage;
}

function getCheckoutContinuation(strategy: LanguageStrategy) {
  const fallbackLanguage = getRuleBasedFallbackLanguage(strategy);

  return fallbackLanguage === "ENGLISH"
    ? "Complete checkout here:"
    : "Checkout yahan complete karein:";
}

type NormalizedAICartRecoveryContext = Required<
  Pick<AICartRecoveryContext, "checkoutUrl" | "currency" | "itemsCount" | "storeName" | "totalAmount">
> &
  Omit<
    AICartRecoveryContext,
    "checkoutUrl" | "currency" | "itemsCount" | "storeName" | "totalAmount"
  > & {
    items: CartItemContext[];
    languageStrategy: LanguageStrategy;
    userHistory: string[];
  };

function normalizeContext(context: AICartRecoveryContext): NormalizedAICartRecoveryContext {
  const storeName = context.storeName?.trim();
  const checkoutUrl = context.checkoutUrl?.trim();
  const totalAmount = Number(context.totalAmount);
  const languageStrategy = resolveLanguageStrategy(
    context.languageStrategy ??
      context.stateCode ??
      context.customerStateCode ??
      context.shippingStateCode
  );

  if (!storeName) {
    throw new Error("storeName is required for AI cart recovery generation");
  }

  if (!checkoutUrl) {
    throw new Error("checkoutUrl is required for AI cart recovery generation");
  }

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error("totalAmount must be a non-negative number");
  }

  const items = Array.isArray(context.items) ? context.items : [];

  return {
    ...context,
    checkoutUrl,
    currency: context.currency?.trim() || "INR",
    customerName: context.customerName?.trim() || null,
    items,
    itemsCount: normalizeItemsCount(context.itemsCount, items),
    languageStrategy,
    phoneNumber: context.phoneNumber?.trim() || null,
    storeName,
    totalAmount,
    userHistory: normalizeUserHistory(context.userHistory),
  };
}

function normalizeItemsCount(itemsCount: number | undefined, items: CartItemContext[]) {
  if (Number.isFinite(itemsCount) && Number(itemsCount) > 0) {
    return Math.floor(Number(itemsCount));
  }

  if (items.length > 0) {
    return items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
  }

  return 1;
}

function normalizeUserHistory(userHistory: string[] | undefined) {
  if (!Array.isArray(userHistory)) {
    return [];
  }

  return userHistory
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function chooseFallbackOfferType(context: NormalizedAICartRecoveryContext): OfferType {
  const signalText = [
    context.abandonedReason,
    ...context.userHistory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if ((context.timeSpentOnCheckout ?? 0) > 10 || hasCheckoutFriction(signalText)) {
    return "Priority Callback from Support";
  }

  if (hasDeliveryIntent(signalText)) {
    return "Free Shipping";
  }

  if (hasCouponIntent(signalText)) {
    return "10% Discount Code";
  }

  if (context.totalAmount >= HIGH_VALUE_CART_AMOUNT) {
    return "Free Shipping";
  }

  return "Friendly Reminder";
}

function hasCheckoutFriction(signalText: string) {
  return /\b(payment|checkout|failed|error|otp|cod|card|upi|stuck|issue|problem)\b/.test(signalText);
}

function hasCouponIntent(signalText: string) {
  return /\b(coupon|discount|deal|price|offer|promo|sale|cheap|compare|revisit)\b/.test(signalText);
}

function hasDeliveryIntent(signalText: string) {
  return /\b(shipping|delivery|freight|courier|dispatch|pincode|pin code|charge)\b/.test(signalText);
}

function formatItems(items: CartItemContext[]) {
  if (items.length === 0) {
    return "No item-level context provided";
  }

  return items
    .slice(0, 8)
    .map((item) => {
      const title = item.title || item.name || "Cart item";
      const quantity = Number(item.quantity) || 1;
      const price = Number.isFinite(item.price) ? `, ${formatAmount(Number(item.price), "INR")}` : "";

      return `${title} x${quantity}${price}`;
    })
    .join("; ");
}

function formatUserHistory(userHistory: string[]) {
  if (userHistory.length === 0) {
    return "No behavior history provided";
  }

  return userHistory.map((entry, index) => `${index + 1}. ${entry}`).join("\n");
}

function formatCheckoutTime(timeSpentOnCheckout: number | null | undefined) {
  return Number.isFinite(timeSpentOnCheckout)
    ? `${Number(timeSpentOnCheckout)} seconds`
    : "not provided";
}

function formatAmount(amount: number, currency: string) {
  if (currency.toUpperCase() === "INR") {
    return `Rs. ${amount.toLocaleString("en-IN")}`;
  }

  return `${currency.toUpperCase()} ${amount.toLocaleString("en-IN")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
