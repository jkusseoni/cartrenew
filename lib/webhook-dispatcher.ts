import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

type WebhookEventPayload = {
  eventType: string;
  timestamp: string;
  // Public webhook payloads are intentionally open-ended.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventData: Record<string, any>;
};

const WEBHOOK_DELIVERY_TIMEOUT_MS = 5000;

export async function dispatchWebhookEvent(
  merchantId: string,
  eventType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventData: Record<string, any>
) {
  // Callers fire-and-forget this function (`void dispatchWebhookEvent(...)`),
  // so a DB failure here must never surface as an unhandled promise rejection.
  try {
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: {
        merchantId,
        eventType,
        isActive: true,
      },
      select: {
        id: true,
        url: true,
        secret: true,
      },
    });

    if (subscriptions.length === 0) {
      return;
    }

    const payload: WebhookEventPayload = {
      eventType,
      timestamp: new Date().toISOString(),
      eventData,
    };
    const serializedPayload = JSON.stringify(payload);

    for (const subscription of subscriptions) {
      const signature = createWebhookSignature(serializedPayload, subscription.secret);

      void sendWebhookDelivery(subscription.id, subscription.url, serializedPayload, eventType, signature);
    }
  } catch (error) {
    console.error("Webhook dispatch failed:", {
      merchantId,
      eventType,
      error: getLoggableError(error),
    });
  }
}

function createWebhookSignature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function sendWebhookDelivery(
  subscriptionId: string,
  url: string,
  payload: string,
  eventType: string,
  signature: string
) {
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CartRenew-Event": eventType,
        "X-CartRenew-Signature": signature,
      },
      body: payload,
      redirect: "error",
      signal: AbortSignal.timeout(WEBHOOK_DELIVERY_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("Webhook delivery failed:", {
      subscriptionId,
      url,
      error: getLoggableError(error),
    });
  }
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
