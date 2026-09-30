import { appendFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const DEBUG_LOG = "/opt/cursor/logs/debug.log";
const MOCK_RESPONSE_DELAY_MS = 8_750;

test("billing POST times out before a later successful response", async ({ page }) => {
  const shop = "timeout-regression.myshopify.com";
  const startedAt = Date.now();
  let requestStartedAt = 0;
  let resolveMockCompleted!: () => void;
  let rejectMockCompleted!: (error: unknown) => void;
  const mockCompleted = new Promise<void>((resolve, reject) => {
    resolveMockCompleted = resolve;
    rejectMockCompleted = reject;
  });

  await page.route("https://cdn.shopify.com/shopifycloud/app-bridge.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
  await page.addInitScript(() => {
    Object.defineProperty(window, "shopify", {
      configurable: true,
      value: { idToken: async () => "mock-session-token" },
    });
  });

  await page.route("**/api/app/dashboard**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shop,
        store: {
          id: "mock-store",
          shopify_domain: shop,
          billing_plan: null,
          billing_status: "pending",
        },
        metrics: { trackedCarts: 0, recovered: 0, recoveredValue: 0 },
        carts: [],
      }),
    })
  );

  await page.route("**/api/app/billing/subscribe", async (route) => {
    try {
      requestStartedAt = Date.now();
      const request = route.request();

      // #region agent log
      appendFileSync(DEBUG_LOG, `${JSON.stringify({ hypothesisId: "A,D", location: "tests/e2e/shopify-billing-timeout.spec.ts:49", message: "Mock billing server received request", data: { method: request.method(), authorizationPresent: Boolean(request.headers().authorization), elapsedMs: requestStartedAt - startedAt }, timestamp: Date.now() })}\n`);
      // #endregion

      expect(request.method()).toBe("POST");
      expect(request.headers().authorization).toBe("Bearer mock-session-token");
      expect(request.postDataJSON()).toMatchObject({ planId: "starter", shop });

      await new Promise((resolve) => setTimeout(resolve, MOCK_RESPONSE_DELAY_MS));
      const responseBody = {
        confirmationUrl: "https://admin.shopify.test/subscriptions/mock-1",
        subscriptionId: "gid://shopify/AppSubscription/mock-1",
        planId: "starter",
        shop,
      };

      // #region agent log
      appendFileSync(DEBUG_LOG, `${JSON.stringify({ hypothesisId: "B,C", location: "tests/e2e/shopify-billing-timeout.spec.ts:65", message: "Mock server completed subscription creation", data: { status: 200, hasConfirmationUrl: true, elapsedSinceRequestMs: Date.now() - requestStartedAt }, timestamp: Date.now() })}\n`);
      // #endregion

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseBody),
      });

      // #region agent log
      appendFileSync(DEBUG_LOG, `${JSON.stringify({ hypothesisId: "C", location: "tests/e2e/shopify-billing-timeout.spec.ts:75", message: "Mock server response fulfilled", data: { status: 200, hasConfirmationUrl: true, elapsedSinceRequestMs: Date.now() - requestStartedAt }, timestamp: Date.now() })}\n`);
      // #endregion
      resolveMockCompleted();
    } catch (error) {
      rejectMockCompleted(error);
      throw error;
    }
  });

  await page.goto(`/app?shop=${shop}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Shopify Billing" })).toBeVisible();

  const subscriptionButton = page
    .getByRole("button", { name: "Subscribe via Shopify" })
    .first();
  await subscriptionButton.click();
  await expect(page.getByText("Shopify request timed out")).toBeVisible({
    timeout: 10_000,
  });
  const clientTimeoutAt = Date.now();

  // #region agent log
  appendFileSync(DEBUG_LOG, `${JSON.stringify({ hypothesisId: "A,B", location: "tests/e2e/shopify-billing-timeout.spec.ts:98", message: "Billing UI observed client timeout", data: { elapsedSinceRequestMs: clientTimeoutAt - requestStartedAt, stillOnAppPage: new URL(page.url()).pathname === "/app" }, timestamp: Date.now() })}\n`);
  // #endregion

  await mockCompleted;
  expect(clientTimeoutAt - requestStartedAt).toBeLessThan(MOCK_RESPONSE_DELAY_MS);
  await expect(page).toHaveURL(/\/app\?/);
  await expect(subscriptionButton).toHaveText("Subscribe via Shopify");

  // #region agent log
  appendFileSync(DEBUG_LOG, `${JSON.stringify({ hypothesisId: "B,C,D", location: "tests/e2e/shopify-billing-timeout.spec.ts:108", message: "Client lost later successful confirmation", data: { clientTimedOutBeforeServer: clientTimeoutAt - requestStartedAt < MOCK_RESPONSE_DELAY_MS, serverReturnedConfirmationUrl: true, retryEnabled: await subscriptionButton.isEnabled(), stillOnAppPage: new URL(page.url()).pathname === "/app" }, timestamp: Date.now() })}\n`);
  // #endregion
});
