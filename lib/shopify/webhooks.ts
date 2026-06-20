import { getShopifyApiVersion, getShopifyAppUrl } from "@/lib/shopify/config";

export type RegisteredWebhook = {
  id: string | number;
  topic: string;
  address: string;
};

export const WEBHOOK_TOPICS = [
  "carts/create",
  "carts/update",
  "checkouts/create",
  "checkouts/update",
  "orders/create",
  "app/uninstalled",
] as const;

/**
 * Idempotently register the cart-recovery webhooks for a shop. All topics point
 * at the canonical `/api/webhooks/shopify` handler (the alias `/api/shopify/webhook`
 * re-exports the same handler), so incoming abandoned-cart events are verified and
 * processed in one place.
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
      const match = existing.find(
        (w) =>
          w.topic === topic &&
          String(w.address).replace(/\/$/, "") === address.replace(/\/$/, "")
      );

      if (match) {
        collected.push({ id: match.id, topic: match.topic, address: match.address });
        continue;
      }

      const res = await fetch(
        `https://${shop}/admin/api/${apiVersion}/webhooks.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        console.warn(`Failed to register webhook ${topic} for ${shop}: ${res.status} ${body}`);
        continue;
      }

      const created = (await res.json()).webhook;
      collected.push({ id: created.id, topic: created.topic, address: created.address });
    }

    return collected;
  } catch (err) {
    console.error("Error registering webhooks for shop", shop, err);
    return collected;
  }
}
