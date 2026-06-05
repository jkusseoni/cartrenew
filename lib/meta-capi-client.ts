"use client";

export type MetaCartItem = {
  id: string;
  title?: string;
  price: number;
  quantity?: number;
};

export type TrackMetaCapiEventInput = {
  eventName: "AddToCart" | "InitiateCheckout" | "ViewContent" | "Purchase" | string;
  value: number;
  currency?: string;
  items?: MetaCartItem[];
  cartId?: string;
  checkoutUrl?: string;
  userEmail?: string;
  userPhone?: string;
  eventUrl?: string;
  contentName?: string;
};

export async function trackMetaCapiEvent(input: TrackMetaCapiEventInput) {
  const [userEmailHash, userPhoneHash] = await Promise.all([
    sha256(input.userEmail),
    sha256(input.userPhone),
  ]);

  const items = input.items || [];
  const response = await fetch("/api/meta-capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName: input.eventName,
      eventUrl: input.eventUrl || getCurrentUrl(),
      eventId: createEventId(input.eventName),
      userEmailHash,
      userPhoneHash,
      clientUserAgent: navigator.userAgent,
      fbp: getCookie("_fbp"),
      fbc: getCookie("_fbc"),
      currency: input.currency || "INR",
      value: input.value,
      contentIds: items.map((item) => item.id),
      contentName: input.contentName || items.map((item) => item.title).filter(Boolean).join(", "),
      contentType: "product",
      contents: items.map((item) => ({
        id: item.id,
        quantity: item.quantity || 1,
        item_price: item.price,
        ...(item.title ? { title: item.title } : {}),
      })),
      cartId: input.cartId,
      checkoutUrl: input.checkoutUrl,
      numItems: items.reduce((total, item) => total + (item.quantity || 1), 0),
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || `Meta CAPI request failed with ${response.status}`);
  }

  return response.json();
}

async function sha256(value: string | undefined) {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  const bytes = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCurrentUrl() {
  return typeof window === "undefined" ? undefined : window.location.href;
}

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;

  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function createEventId(eventName: string) {
  const randomPart = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${eventName}-${Date.now()}-${randomPart}`;
}
