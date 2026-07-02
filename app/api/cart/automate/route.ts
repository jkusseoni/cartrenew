export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const fetchCache = "force-no-store";

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { generateAICartRecoveryMessage } from "@/lib/ai-agent";
import {
  type DeliveryChannel,
  type DeliveryStatus,
  type GeoStrategy,
  getDeliveryChannelOrder,
  getGeoDeliveryStrategy,
  getSuccessStatusForChannel,
} from "@/lib/geo-policy";
import { supabaseAdmin } from "@/lib/supabase";

type CartAutomatePayload = {
  cartUrl?: unknown;
  customerEmail?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  storeName?: unknown;
  totalAmount?: unknown;
  userId?: unknown;
};

type VercelLogLevel = "SUCCESS" | "CRITICAL" | "FATAL_CRASH";
type VercelLogContext = Record<string, unknown>;

type DeliveryAttempt = {
  channel: DeliveryChannel;
  error?: string | null;
  provider: string;
  providerMessageId?: string | null;
  skipped?: boolean;
  status: DeliveryStatus | "SKIPPED";
  statusCode?: number | null;
  success: boolean;
};

type DeliveryOutcome = {
  attempts: DeliveryAttempt[];
  channel: DeliveryChannel | "NONE";
  error?: string | null;
  provider: string;
  providerMessageId?: string | null;
  status: DeliveryStatus;
  success: boolean;
};

type DeliveryContext = {
  cartId: string;
  cartUrl: string;
  customerEmail?: string;
  customerName: string;
  customerPhone: string;
  geoStrategy: GeoStrategy;
  merchantId: string;
  message: string;
  storeName: string;
  totalAmount: number;
  userId: string;
};

const VERCEL_LOG_PREFIXES: Record<VercelLogLevel, string> = {
  CRITICAL: "[VERCEL LOGS] [CRITICAL]",
  FATAL_CRASH: "[VERCEL LOGS] [FATAL_CRASH]",
  SUCCESS: "[VERCEL LOGS] [SUCCESS]",
};

export async function GET() {
  return NextResponse.json(
    {
      healthy: true,
      message:
        "Automation pipeline is active and healthy. Send a POST request to process cart metrics.",
      pipeline: "active",
      requiredMethod: "POST",
      success: true,
    },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTags({
      integrationType: "auto_pilot",
      route: "/api/cart/automate",
    });
    scope.setContext("request", {
      method: "POST",
      route: "/api/cart/automate",
    });

    try {
      // Malformed JSON is a caller error — return 400 rather than a 500.
      let body: CartAutomatePayload;
      try {
        body = (await req.json()) as CartAutomatePayload;
      } catch {
        return NextResponse.json(
          { error: "Request body must be valid JSON" },
          { status: 400 }
        );
      }
      const customerPhone = getOptionalString(body.customerPhone);
      const customerEmail = getOptionalString(body.customerEmail);
      const customerName = getOptionalString(body.customerName) || "Customer";
      const totalAmount = getOptionalNumber(body.totalAmount);
      const cartUrl = getOptionalString(body.cartUrl);
      const userId = getOptionalString(body.userId);
      const requestedStoreName = getOptionalString(body.storeName) || "Unknown Store";

      scope.setTags({
        merchantId: userId || "unknown",
        storeName: requestedStoreName,
      });
      scope.setContext("cart_automation_payload", {
        cartUrl: cartUrl || "missing",
        customerEmail: customerEmail ? maskEmail(customerEmail) : "missing",
        customerPhone: customerPhone ? maskPhone(customerPhone) : "missing",
        hasCartUrl: Boolean(cartUrl),
        hasCustomerEmail: Boolean(customerEmail),
        hasCustomerPhone: Boolean(customerPhone),
        storeName: requestedStoreName,
        totalAmount: totalAmount ?? "missing",
        userId: userId || "missing",
      });

      if (!customerPhone || totalAmount === null || !cartUrl || !userId) {
        Sentry.captureMessage(
          "Cart automation webhook rejected: missing required parameters",
          "warning"
        );

        return NextResponse.json(
          { error: "Missing webhook parameters" },
          { status: 400 }
        );
      }

      const geoStrategy = getGeoDeliveryStrategy(customerPhone);
      const channelPlan = getDeliveryChannelOrder(geoStrategy);

      scope.setContext("geo_policy", {
        allowWhatsAppOfficial: geoStrategy.allowWhatsAppOfficial,
        country: geoStrategy.country,
        countryCode: geoStrategy.countryCode || "unknown",
        fallbackChannels: geoStrategy.fallbackChannels,
        primaryChannel: geoStrategy.primaryChannel,
        restrictionReason: geoStrategy.restrictionReason,
        whatsappPolicy: geoStrategy.whatsappPolicy,
      });

      writeVercelLog("SUCCESS", "Geo-routing engine selected channel plan", {
        country: geoStrategy.country,
        countryCode: geoStrategy.countryCode || "unknown",
        primaryChannel: geoStrategy.primaryChannel,
        channelPlan,
        whatsappPolicy: geoStrategy.whatsappPolicy,
      });

      const { prisma } = await import("@/lib/prisma");

      let merchant = await prisma.merchant.findFirst({ where: { userId } });

      if (!merchant) {
        merchant = await prisma.merchant.create({
          data: { storeName: requestedStoreName, userId },
        });
      }

      scope.setTags({
        merchantId: merchant.id,
        storeName: merchant.storeName,
      });
      scope.setContext("merchant", {
        merchantId: merchant.id,
        storeName: merchant.storeName,
        userId: merchant.userId,
      });

      const newCart = await prisma.cart.create({
        data: {
          cartUrl,
          customerName,
          customerPhone,
          merchantId: merchant.id,
          phoneNumber: geoStrategy.e164Phone || customerPhone,
          status: "ABANDONED",
          totalAmount,
        },
      });

      scope.setContext("cart", {
        cartId: newCart.id,
        status: newCart.status,
        totalAmount: newCart.totalAmount,
      });

      const aiResult = await generateAICartRecoveryMessage({
        checkoutUrl: cartUrl,
        customerName,
        itemsCount: 1,
        phoneNumber: geoStrategy.e164Phone || customerPhone,
        storeName: merchant.storeName,
        totalAmount: newCart.totalAmount,
      });

      scope.setContext("ai_message", {
        fallbackReason: aiResult.fallbackReason || null,
        fallbackUsed: aiResult.fallbackUsed,
        model: aiResult.model,
        provider: aiResult.provider,
      });

      const deliveryContext: DeliveryContext = {
        cartId: newCart.id,
        cartUrl,
        customerEmail: customerEmail || undefined,
        customerName,
        customerPhone,
        geoStrategy,
        merchantId: merchant.id,
        message: aiResult.message,
        storeName: merchant.storeName,
        totalAmount: newCart.totalAmount,
        userId,
      };

      const deliveryOutcome = await routeDelivery(deliveryContext);

      const updatedCart = await prisma.cart.update({
        data: {
          notified: deliveryOutcome.success,
          recoveryMessage: aiResult.message,
          recoveryMessageAt: new Date(),
          recoveryMessageModel: `${aiResult.provider}:${aiResult.model}`,
          recoveryMessagePrompt: aiResult.prompt,
          status: deliveryOutcome.status,
        },
        where: { id: newCart.id },
      });

      await saveSupabaseDeliveryMetric(deliveryContext, deliveryOutcome);

      scope.setContext("delivery", {
        attempts: deliveryOutcome.attempts,
        cartId: updatedCart.id,
        channel: deliveryOutcome.channel,
        status: deliveryOutcome.status,
      });

      if (deliveryOutcome.success) {
        writeVercelLog("SUCCESS", "Recovery delivery completed", {
          cartId: updatedCart.id,
          channel: deliveryOutcome.channel,
          merchantId: merchant.id,
          status: deliveryOutcome.status,
          storeName: merchant.storeName,
        });
      } else {
        writeVercelLog("CRITICAL", "Recovery delivery exhausted all fallbacks", {
          attempts: deliveryOutcome.attempts,
          cartId: updatedCart.id,
          merchantId: merchant.id,
          status: deliveryOutcome.status,
          storeName: merchant.storeName,
        });

        Sentry.captureMessage(
          "Cart automation delivery exhausted all geo-policy fallbacks",
          "error"
        );
      }

      return NextResponse.json(
        {
          cartId: updatedCart.id,
          channel: deliveryOutcome.channel,
          country: geoStrategy.country,
          message: deliveryOutcome.success
            ? "Auto-pilot message routed successfully"
            : "Safety fallback exhausted; payload preserved in delivery metrics",
          status: deliveryOutcome.status,
          success: deliveryOutcome.success,
        },
        { status: 200 }
      );
    } catch (error) {
      const fatalError = toError(error);

      scope.setContext("fatal_crash", {
        message: fatalError.message,
        route: "/api/cart/automate",
      });

      writeVercelLog("FATAL_CRASH", "Pipeline Isolation Failure", {
        error: fatalError.message,
        route: "/api/cart/automate",
      });

      Sentry.captureException(fatalError, { level: "fatal" });
      Sentry.captureMessage("Cart automation pipeline fatal crash", "fatal");

      return NextResponse.json(
        { error: "Internal Pipeline Isolation Failure" },
        { status: 500 }
      );
    }
  });
}

async function routeDelivery(context: DeliveryContext): Promise<DeliveryOutcome> {
  const attempts: DeliveryAttempt[] = [];

  for (const channel of getDeliveryChannelOrder(context.geoStrategy)) {
    const attempt = await dispatchToChannel(channel, context);
    attempts.push(attempt);

    if (attempt.success) {
      return {
        attempts,
        channel,
        provider: attempt.provider,
        providerMessageId: attempt.providerMessageId ?? null,
        status: attempt.status as DeliveryStatus,
        success: true,
      };
    }
  }

  return {
    attempts,
    channel: "NONE",
    error: attempts.at(-1)?.error ?? "No delivery channel accepted the payload",
    provider: attempts.at(-1)?.provider ?? "none",
    status: "FAILED",
    success: false,
  };
}

async function dispatchToChannel(
  channel: DeliveryChannel,
  context: DeliveryContext
): Promise<DeliveryAttempt> {
  switch (channel) {
    case "WHATSAPP_OFFICIAL":
      if (!context.geoStrategy.allowWhatsAppOfficial) {
        return skippedAttempt(
          channel,
          "geo_policy",
          "WhatsApp official API is blocked for this country policy"
        );
      }

      return sendTwilioWhatsApp(context);
    case "WHATSAPP_WEB_LINK":
      return prepareWhatsAppWebLink(context);
    case "SMS":
      return sendTwilioSms(context);
    case "EMAIL":
      return sendRecoveryEmail(context);
  }
}

async function sendTwilioWhatsApp(
  context: DeliveryContext
): Promise<DeliveryAttempt> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = formatTwilioWhatsAppFrom(
    process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_FROM
  );

  if (!accountSid || !authToken || !fromNumber) {
    return failedAttempt(
      "WHATSAPP_OFFICIAL",
      "twilio_whatsapp",
      "Twilio WhatsApp credentials are not configured"
    );
  }

  return sendTwilioMessage({
    accountSid,
    authToken,
    body: context.message,
    channel: "WHATSAPP_OFFICIAL",
    from: fromNumber,
    provider: "twilio_whatsapp",
    successStatus: getSuccessStatusForChannel("WHATSAPP_OFFICIAL"),
    to: `whatsapp:${context.geoStrategy.e164Phone}`,
  });
}

async function sendTwilioSms(context: DeliveryContext): Promise<DeliveryAttempt> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = formatTwilioSmsFrom(
    process.env.TWILIO_SMS_NUMBER ||
      process.env.TWILIO_PHONE_NUMBER ||
      process.env.TWILIO_FROM_NUMBER
  );

  if (!accountSid || !authToken || !fromNumber) {
    return failedAttempt("SMS", "twilio_sms", "Twilio SMS credentials are not configured");
  }

  return sendTwilioMessage({
    accountSid,
    authToken,
    body: context.message,
    channel: "SMS",
    from: fromNumber,
    provider: "twilio_sms",
    successStatus: getSuccessStatusForChannel("SMS"),
    to: context.geoStrategy.e164Phone,
  });
}

async function sendTwilioMessage({
  accountSid,
  authToken,
  body,
  channel,
  from,
  provider,
  successStatus,
  to,
}: {
  accountSid: string;
  authToken: string;
  body: string;
  channel: DeliveryChannel;
  from: string;
  provider: string;
  successStatus: DeliveryStatus;
  to: string;
}): Promise<DeliveryAttempt> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        body: new URLSearchParams({
          Body: body,
          From: from,
          To: to,
        }),
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString(
            "base64"
          )}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      }
    );

    const responseBody = await readProviderResponse(response);

    if (!response.ok) {
      return failedAttempt(
        channel,
        provider,
        `Twilio refused ${channel} delivery with status ${response.status}: ${responseBody.error}`,
        response.status
      );
    }

    return {
      channel,
      provider,
      providerMessageId: responseBody.providerMessageId,
      status: successStatus,
      statusCode: response.status,
      success: true,
    };
  } catch (error) {
    return failedAttempt(channel, provider, getErrorMessage(error));
  }
}

function prepareWhatsAppWebLink(context: DeliveryContext): DeliveryAttempt {
  if (!context.geoStrategy.normalizedPhone) {
    return failedAttempt(
      "WHATSAPP_WEB_LINK",
      "whatsapp_web_link",
      "Cannot prepare WhatsApp web link without a normalized phone number"
    );
  }

  return {
    channel: "WHATSAPP_WEB_LINK",
    provider: "whatsapp_web_link",
    providerMessageId: `wa.me/${context.geoStrategy.normalizedPhone}`,
    status: getSuccessStatusForChannel("WHATSAPP_WEB_LINK"),
    success: true,
  };
}

async function sendRecoveryEmail(context: DeliveryContext): Promise<DeliveryAttempt> {
  if (!context.customerEmail || !isValidEmail(context.customerEmail)) {
    return skippedAttempt("EMAIL", "resend", "Customer email is missing or invalid");
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = (
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.DEFAULT_FROM_EMAIL
  )?.trim();

  if (!apiKey || !fromEmail) {
    return failedAttempt("EMAIL", "resend", "Resend email credentials are not configured");
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: fromEmail,
        subject: `Complete your order at ${context.storeName}`,
        text: context.message,
        to: context.customerEmail,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const responseBody = await readProviderResponse(response);

    if (!response.ok) {
      return failedAttempt(
        "EMAIL",
        "resend",
        `Resend refused email delivery with status ${response.status}: ${responseBody.error}`,
        response.status
      );
    }

    return {
      channel: "EMAIL",
      provider: "resend",
      providerMessageId: responseBody.providerMessageId,
      status: getSuccessStatusForChannel("EMAIL"),
      statusCode: response.status,
      success: true,
    };
  } catch (error) {
    return failedAttempt("EMAIL", "resend", getErrorMessage(error));
  }
}

async function saveSupabaseDeliveryMetric(
  context: DeliveryContext,
  outcome: DeliveryOutcome
) {
  const payload = {
    attempts: outcome.attempts,
    cartUrl: context.cartUrl,
    customerEmail: context.customerEmail ? maskEmail(context.customerEmail) : null,
    customerPhone: maskPhone(context.customerPhone),
    totalAmount: context.totalAmount,
  };

  try {
    const { error } = await supabaseAdmin.from("cart_delivery_metrics").insert({
      attempted_channel: outcome.channel,
      cart_id: context.cartId,
      country: context.geoStrategy.country,
      country_code: context.geoStrategy.countryCode || null,
      error_message: outcome.error || null,
      merchant_id: context.merchantId,
      payload,
      primary_channel: context.geoStrategy.primaryChannel,
      provider: outcome.provider,
      provider_message_id: outcome.providerMessageId || null,
      status: outcome.status,
      store_name: context.storeName,
      user_id: context.userId,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Supabase delivery metric write failed:", getErrorMessage(error));

    try {
      await supabaseAdmin.from("alerts").insert({
        event_type: "cart_delivery_status",
        level: outcome.success ? "info" : "error",
        payload: {
          cartId: context.cartId,
          channel: outcome.channel,
          country: context.geoStrategy.country,
          status: outcome.status,
        },
        source: "cart_automate_geo_router",
      });
    } catch (alertError) {
      console.error(
        "Supabase delivery metric fallback alert failed:",
        getErrorMessage(alertError)
      );
    }
  }
}

async function readProviderResponse(response: Response) {
  const rawBody = await response.text();

  if (!rawBody) {
    return { error: "", providerMessageId: null };
  }

  try {
    const parsedBody = JSON.parse(rawBody) as {
      id?: string;
      message?: string;
      sid?: string;
      error?: { message?: string };
    };

    return {
      error:
        parsedBody.message ||
        parsedBody.error?.message ||
        rawBody.slice(0, 1000),
      providerMessageId: parsedBody.sid || parsedBody.id || null,
    };
  } catch {
    return {
      error: rawBody.slice(0, 1000),
      providerMessageId: null,
    };
  }
}

function failedAttempt(
  channel: DeliveryChannel,
  provider: string,
  error: string,
  statusCode?: number
): DeliveryAttempt {
  return {
    channel,
    error,
    provider,
    status: "FAILED",
    statusCode: statusCode ?? null,
    success: false,
  };
}

function skippedAttempt(
  channel: DeliveryChannel,
  provider: string,
  error: string
): DeliveryAttempt {
  return {
    channel,
    error,
    provider,
    skipped: true,
    status: "SKIPPED",
    success: false,
  };
}

function writeVercelLog(
  level: VercelLogLevel,
  message: string,
  context: VercelLogContext
) {
  const payload = JSON.stringify({
    context,
    message,
    timestamp: new Date().toISOString(),
  });
  const line = `${VERCEL_LOG_PREFIXES[level]} ${payload}`;

  if (level === "SUCCESS") {
    console.log(line);
    return;
  }

  console.error(line);
}

function getOptionalString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function getOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsedValue = Number(value.trim());

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatTwilioWhatsAppFrom(value?: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.startsWith("whatsapp:")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("+")) {
    return `whatsapp:${trimmedValue}`;
  }

  const digits = trimmedValue.replace(/\D/g, "");

  return digits ? `whatsapp:+${digits}` : "";
}

function formatTwilioSmsFrom(value?: string) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return "";
  }

  if (trimmedValue.startsWith("+")) {
    return trimmedValue;
  }

  const digits = trimmedValue.replace(/\D/g, "");

  return digits ? `+${digits}` : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return "invalid-email";
  }

  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
