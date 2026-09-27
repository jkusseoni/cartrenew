import { expect, test } from "@playwright/test";

test("shows a retryable error when Shopify token exchange never succeeds", async ({
  page,
}) => {
  let exchangeAttempts = 0;

  await page.addInitScript(() => {
    Object.defineProperty(window, "shopify", {
      configurable: true,
      value: {
        idToken: async () => "test-session-token",
      },
    });
  });

  await page.route("https://cdn.shopify.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "",
    });
  });

  await page.route("**/api/app/dashboard?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shop: "broken-install.myshopify.com",
        needsInstall: true,
        store: null,
        metrics: {
          trackedCarts: 0,
          recovered: 0,
          recoveredValue: 0,
        },
        carts: [],
      }),
    });
  });

  await page.route("**/api/auth/token-exchange", async (route) => {
    exchangeAttempts += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Failed to save store" }),
    });
  });

  await page.goto("/app?shop=broken-install.myshopify.com");

  await expect(
    page.getByRole("heading", { name: "Something went wrong" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByText("You're all set — no abandoned carts yet")
  ).toHaveCount(0);
  expect(exchangeAttempts).toBe(4);
});
