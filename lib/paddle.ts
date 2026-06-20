export const PADDLE_SCRIPT_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

/** Active Paddle sandbox client-side token — used when env injection is missing locally. */
export const PADDLE_SANDBOX_FALLBACK_TOKEN =
  "test_src_cl_01ktzmzh9vhm30h5vfb3q7hnm0";

export type GlobalPlanId = "gl-starter" | "gl-growth" | "gl-scale";

/** Sandbox Paddle price IDs for global monthly tiers. */
export const PADDLE_PRICE_IDS: Record<GlobalPlanId, string> = {
  "gl-starter": "pri_01ktzmth7rn7p4f3zq1n7hy7p4",
  "gl-growth":
    process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH?.trim() ||
    "pri_01ktzmth7rn7p4f3zq1n7hy7p4",
  "gl-scale":
    process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE?.trim() ||
    "pri_01ktzmth7rn7p4f3zq1n7hy7p4",
};

export type PaddleCheckoutSettings = {
  displayMode: "overlay";
  theme: "dark";
  locale: string;
};

export type PaddleGlobal = {
  Checkout: {
    open: (options: {
      items: Array<{ priceId: string; quantity: number }>;
      settings?: PaddleCheckoutSettings;
    }) => void;
  };
  Environment: {
    set: (environment: "sandbox" | "production") => void;
  };
  Initialize: (config: { token: string }) => void;
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

let scriptLoadPromise: Promise<void> | null = null;
let initPromise: Promise<boolean> | null = null;

export function resolvePaddleClientToken(clientToken?: string): string {
  const fromArg = clientToken?.trim();
  if (fromArg?.startsWith("test_src_cl_") || fromArg?.startsWith("live_")) {
    return fromArg;
  }

  const fromEnv = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();
  if (fromEnv?.startsWith("test_src_cl_") || fromEnv?.startsWith("live_")) {
    return fromEnv;
  }

  return PADDLE_SANDBOX_FALLBACK_TOKEN;
}

export function loadPaddleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.Paddle) {
    return Promise.resolve();
  }

  if (document.querySelector(`script[src="${PADDLE_SCRIPT_URL}"]`)) {
    return new Promise((resolve, reject) => {
      const poll = () => {
        if (window.Paddle) {
          resolve();
          return;
        }

        window.setTimeout(poll, 50);
      };

      poll();

      window.setTimeout(() => {
        if (!window.Paddle) {
          reject(new Error("Paddle script tag present but Paddle global missing."));
        }
      }, 10_000);
    });
  }

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PADDLE_SCRIPT_URL;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Paddle.js"));
      document.head.appendChild(script);
    });
  }

  return scriptLoadPromise;
}

export async function initializePaddle(clientToken?: string): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }

  const token = resolvePaddleClientToken(clientToken);

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await loadPaddleScript();

    if (!window.Paddle) {
      return false;
    }

    window.Paddle.Environment.set("sandbox");

    window.Paddle.Initialize({ token });

    return true;
  })();

  return initPromise;
}

export async function openPaddleCheckout(
  priceId: string,
  clientToken?: string
): Promise<boolean> {
  const ready = await initializePaddle(clientToken);

  if (!ready || !window.Paddle) {
    return false;
  }

  window.Paddle.Checkout.open({
    settings: {
      displayMode: "overlay",
      theme: "dark",
      locale: "en",
    },
    items: [{ priceId, quantity: 1 }],
  });

  return true;
}
