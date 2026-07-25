/**
 * Client-side fetch helper for the Shopify embedded app.
 * Attaches a Shopify App Bridge session token as Authorization: Bearer <token>.
 */

type ShopifyIdTokenWindow = Window & {
  shopify?: {
    idToken?: () => Promise<string>;
  };
};

async function getSessionToken(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("authFetch can only run in the browser");
  }

  const shopify = (window as ShopifyIdTokenWindow).shopify;
  if (!shopify?.idToken) {
    throw new Error(
      "window.shopify.idToken is unavailable. Open the app inside Shopify Admin so App Bridge can issue a session token."
    );
  }

  const token = await shopify.idToken();
  if (!token || typeof token !== "string") {
    throw new Error("App Bridge returned an empty session token");
  }

  return token;
}

export async function authFetch(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
