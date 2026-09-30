import { expect, test } from "@playwright/test";

const MOCK_RESPONSE_DELAY_MS = 8_750;

test("billing POST waits for a later successful response", async ({ page }) => {
  const shop = "timeout-regression.myshopify.com";
  let subscriptionCreations = 0;

  await page.route("https://cdn.shopify.com/shopifycloud/app-bridge.js", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" })
  );
  await page.route(
    "https://admin.shopify.test/subscriptions/mock-1",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Mock Shopify confirmation</title>",
      })
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
    subscriptionCreations += 1;
    const request = route.request();

    expect(request.method()).toBe("POST");
    expect(request.headers().authorization).toBe("Bearer mock-session-token");
    expect(request.postDataJSON()).toMatchObject({ planId: "starter", shop });

    await new Promise((resolve) => setTimeout(resolve, MOCK_RESPONSE_DELAY_MS));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        confirmationUrl: "https://admin.shopify.test/subscriptions/mock-1",
        subscriptionId: "gid://shopify/AppSubscription/mock-1",
        planId: "starter",
        shop,
      }),
    });
  });

  await page.goto(`/app?shop=${shop}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Shopify Billing" })).toBeVisible();

  const subscriptionButton = page
    .getByRole("button", { name: "Subscribe via Shopify" })
    .first();
  await subscriptionButton.click();
  await page.waitForURL(
    "https://admin.shopify.test/subscriptions/mock-1",
    { timeout: 11_000 }
  );
  await expect(page).toHaveURL(
    "https://admin.shopify.test/subscriptions/mock-1"
  );
  expect(subscriptionCreations).toBe(1);
});
