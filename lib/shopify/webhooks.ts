import { getShopifyApiVersion, getShopifyAppUrl } from "@/lib/shopify/config";

export type RegisteredWebhook = {
  id: string | number;
  topic: string;
  address: string;
};

/** Primary abandonment signals — checkouts/* is more reliable than carts/* on many stores. */
export const ABANDONMENT_WEBHOOK_TOPICS = [
  "carts/create",
  "carts/update",
  "checkouts/create",
  "checkouts/update",
] as const;

export const WEBHOOK_TOPICS = [
  ...ABANDONMENT_WEBHOOK_TOPICS,
  "orders/create",
  "app/uninstalled",
  // Keep subscription status in sync when merchants change/cancel plans in Admin.
  "app_subscriptions/update",
] as const;

function normalizeWebhookAddress(value: string): string {
  return String(value).replace(/\/$/, "");
}

async function upsertShopifyWebhook(
  shop: string,
  accessToken: string,
  apiVersion: string,
  topic: string,
  address: string,
  existing: Array<{ id: string | number; topic: string; address: string }>
): Promise<RegisteredWebhook | null> {
  const normalizedAddress = normalizeWebhookAddress(address);
  const match = existing.find(
    (w) =>
      w.topic === topic &&
      normalizeWebhookAddress(w.address) === normalizedAddress
  );

  if (match) {
    return { id: match.id, topic: match.topic, address: match.address };
  }

  const stale = existing.find((w) => w.topic === topic);
  const method = stale ? "PUT" : "POST";
  const url = stale
    ? `https://${shop}/admin/api/${apiVersion}/webhooks/${stale.id}.json`
    : `https://${shop}/admin/api/${apiVersion}/webhooks.json`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      webhook: { topic, address: normalizedAddress, format: "json" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(
      `Failed to ${stale ? "update" : "register"} webhook ${topic} for ${shop}: ${res.status} ${body}`
    );
    return null;
  }

  const webhook = (await res.json()).webhook;
  if (stale) {
    console.info(
      `Updated webhook ${topic} for ${shop} → ${normalizedAddress} (was ${stale.address})`
    );
  }

  return {
    id: webhook.id,
    topic: webhook.topic,
    address: webhook.address,
  };
}

/**
 * Idempotently register abandonment + lifecycle webhooks for a shop.
 * Registers carts/* and checkouts/* (checkout events are the reliable
 * abandonment signal when carts/create does not fire). All topics point at
 * `/api/webhooks/shopify` (alias `/api/shopify/webhook` re-exports the same handler).
 * Stale webhook URLs (e.g. after ngrok restarts) are updated in place.
 */
export async function registerShopifyWebhooks(
  shop: string,
  accessToken: string
): Promise<RegisteredWebhook[]> {
  const apiVersion = getShopifyApiVersion();
  const address = `${getShopifyAppUrl()}/api/webhooks/shopify`;
  const collected: RegisteredWebhook[] = [];

  try {
    const listRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/webhooks.json`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const existing: Array<{ id: string | number; topic: string; address: string }> =
      listRes.ok ? await listRes.json().then((j) => j.webhooks || []) : [];

    for (const topic of WEBHOOK_TOPICS) {
      const registered = await upsertShopifyWebhook(
        shop,
        accessToken,
        apiVersion,
        topic,
        address,
        existing
      );
      if (registered) {
        collected.push(registered);
      }
    }

    return collected;
  } catch (err) {
    console.error("Error registering webhooks for shop", shop, err);
    return collected;
  }
}
