/**
 * Client-side fetch helper for the Shopify embedded app.
 * Attaches a Shopify App Bridge session token as Authorization: Bearer <token>.
 */

const AUTH_TIMEOUT_MS = 8_000;

type ShopifyIdTokenWindow = Window & {
  shopify?: {
    idToken?: () => Promise<string>;
  };
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

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

  const token = await withTimeout(
    shopify.idToken(),
    AUTH_TIMEOUT_MS,
    "Shopify session token timed out"
  );
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

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller);

  const method = (options.method ?? "GET").toUpperCase();
  const canSafelyTimeout = method === "GET" || method === "HEAD";
  let timedOut = false;
  const timer = canSafelyTimeout
    ? window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, AUTH_TIMEOUT_MS)
    : null;

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error("Shopify request timed out");
    }
    throw error;
  } finally {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
