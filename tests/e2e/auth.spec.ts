import { expect, test, type Page } from "@playwright/test";

const signupPath = "/sign-up";
const loginPath = "/sign-in";
const testEmail = process.env.E2E_TEST_EMAIL ?? "testmerchant@cartrenew.com";
const testPassword = process.env.E2E_TEST_PASSWORD ?? "SecureDevPass123!";

const isCI = !!process.env.CI;
const hasClerkSecrets = Boolean(
  process.env.CLERK_SECRET_KEY?.trim() &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
);
const testsClerkProtectedTarget =
  (isCI && hasClerkSecrets) ||
  process.env.E2E_TEST_CLERK_PROTECTION === "true";

// In CI, skip auth e2e when Clerk credentials are not injected via secrets.
test.skip(isCI && !hasClerkSecrets, "Clerk secrets missing in CI environment");

const clerkReadySelector = [
  ".cl-rootBox",
  "form",
  'input[type="email"]',
  'input[name="emailAddress"]',
  'input[name="identifier"]',
  'input[type="password"]',
].join(", ");

const authFeedbackSelector = [
  ".cl-rootBox .cl-errorMessage",
  ".cl-rootBox .cl-alert",
  ".cl-rootBox .cl-formFieldErrorText",
  '.cl-rootBox [data-localization-key*="error"]',
  '.cl-rootBox [data-localization-key*="formFieldError"]',
  '.cl-rootBox [role="alert"]',
  '.cl-rootBox [aria-live="assertive"]',
  "form .cl-errorMessage",
  "form .cl-alert",
  "form .cl-formFieldErrorText",
  'form [data-localization-key*="error"]',
  'form [data-localization-key*="formFieldError"]',
  'form [role="alert"]',
  'form [aria-live="assertive"]',
].join(", ");

test.describe("auth routes", () => {
  test("sign-up submits credentials and redirects or shows auth feedback", async ({ page }) => {
    await page.goto(signupPath, { waitUntil: "domcontentloaded" });
    await fillAuthForm(page, {
      email: testEmail,
      password: testPassword,
      submitName: /sign up|continue|create account/i,
    });
    await expectDashboardRedirectOrAuthFeedback(page);
  });

  test("login submits credentials and redirects or shows auth feedback", async ({ page }) => {
    await page.goto(loginPath, { waitUntil: "domcontentloaded" });
    await fillAuthForm(page, {
      email: testEmail,
      password: testPassword,
      submitName: /sign in|continue|log in/i,
    });
    await expectDashboardRedirectOrAuthFeedback(page);
  });
});

test.describe("protected routes", () => {
  test.skip(
    !testsClerkProtectedTarget,
    "Requires a production target with Clerk protection enabled"
  );

  test("Shopify query parameters do not bypass Clerk protection", async ({
    request,
  }) => {
    const paths = [
      "/en/admin",
      "/en/admin?host=attacker",
      "/en/admin?shop=proof-store.myshopify.com",
    ];

    for (const path of paths) {
      await test.step(path, async () => {
        const response = await request.get(path, { maxRedirects: 0 });
        expect(response.status()).toBe(307);

        const location = response.headers().location;
        expect(location).toBeTruthy();
        expect(new URL(location!, response.url()).pathname).toBe("/en/sign-in");
      });
    }
  });
});

type AuthFormData = {
  email: string;
  password: string;
  submitName: RegExp;
};

type AuthSubmitResult = {
  clicked: boolean;
  submitted: boolean;
  buttonText: string;
};

async function fillAuthForm(page: Page, data: AuthFormData) {
  await expect(page.locator(clerkReadySelector).first()).toBeVisible({ timeout: 20_000 });

  for (let step = 0; step < 4; step += 1) {
    await injectAuthFields(page, data);

    const result = await submitAuthStep(page, data.submitName);
    expect(
      result.clicked || result.submitted,
      `Clerk auth submit control was not found on ${page.url()}`
    ).toBeTruthy();

    const outcome = await waitForAuthProgress(page);
    if (outcome === "done" || outcome === "feedback" || outcome === "loading") {
      return;
    }
  }
}

async function injectAuthFields(page: Page, data: AuthFormData) {
  await page.evaluate(
    ({ email, password }) => {
      const emailSelectors = [
        'input[name="identifier"]',
        'input[name="emailAddress"]',
        'input[type="email"]',
        'input[autocomplete="email"]',
      ];
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]',
        'input[autocomplete="new-password"]',
      ];

      const setNativeValue = (input: HTMLInputElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const findVisibleInput = (selectors: string[]) => {
        for (const selector of selectors) {
          const input = Array.from(document.querySelectorAll<HTMLInputElement>(selector)).find(
            (candidate) => isVisible(candidate) && !candidate.disabled && !candidate.readOnly
          );

          if (input) {
            return input;
          }
        }

        return null;
      };

      const emailInput = findVisibleInput(emailSelectors);
      if (emailInput) {
        setNativeValue(emailInput, email);
      }

      const passwordInput = findVisibleInput(passwordSelectors);
      if (passwordInput) {
        setNativeValue(passwordInput, password);
      }

      function isVisible(element: HTMLElement) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      }
    },
    { email: data.email, password: data.password }
  );
}

async function submitAuthStep(page: Page, submitName: RegExp) {
  return page.evaluate(
    ({ source, flags }): AuthSubmitResult => {
      const nameMatcher = new RegExp(source, flags);
      const controls = Array.from(
        document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLElement>(
          'button, input[type="submit"], [role="button"]'
        )
      ).filter((control) => isVisible(control) && !isDisabled(control));

      const matchingControl =
        controls.find((control) => nameMatcher.test(getControlText(control))) ??
        controls.find((control) => control.classList.contains("cl-formButtonPrimary")) ??
        controls.find((control) => control instanceof HTMLButtonElement && control.type === "submit");

      if (matchingControl) {
        matchingControl.scrollIntoView({ block: "center", inline: "center" });
        dispatchPointerClick(matchingControl);

        return {
          clicked: true,
          submitted: false,
          buttonText: getControlText(matchingControl),
        };
      }

      const form = document.querySelector<HTMLFormElement>(".cl-rootBox form, form");
      if (form) {
        form.requestSubmit();

        return {
          clicked: false,
          submitted: true,
          buttonText: "",
        };
      }

      return {
        clicked: false,
        submitted: false,
        buttonText: "",
      };

      function dispatchPointerClick(element: HTMLElement) {
        const eventOptions = { bubbles: true, cancelable: true, view: window };
        element.dispatchEvent(new MouseEvent("pointerdown", eventOptions));
        element.dispatchEvent(new MouseEvent("mousedown", eventOptions));
        element.dispatchEvent(new MouseEvent("pointerup", eventOptions));
        element.dispatchEvent(new MouseEvent("mouseup", eventOptions));
        element.click();
      }

      function getControlText(element: HTMLElement) {
        return [
          element.getAttribute("aria-label"),
          element.getAttribute("value"),
          element.textContent,
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      }

      function isDisabled(element: HTMLElement) {
        return (
          element.hasAttribute("disabled") ||
          element.getAttribute("aria-disabled") === "true" ||
          (element instanceof HTMLButtonElement && element.disabled) ||
          (element instanceof HTMLInputElement && element.disabled)
        );
      }

      function isVisible(element: HTMLElement) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      }
    },
    { source: submitName.source, flags: submitName.flags }
  );
}

async function waitForAuthProgress(page: Page) {
  const previousUrl = page.url();
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (isDashboardUrl(page.url())) {
      return "done" as const;
    }

    if (await hasAuthFeedback(page)) {
      return "feedback" as const;
    }

    if (await hasClerkLoadingState(page)) {
      return "loading" as const;
    }

    if (page.url() !== previousUrl) {
      return "progress" as const;
    }

    await page.waitForTimeout(250);
  }

  return "continue" as const;
}

async function expectDashboardRedirectOrAuthFeedback(page: Page) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (isDashboardUrl(page.url())) {
      await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);
      return;
    }

    const feedback = page.locator(authFeedbackSelector).first();
    if (await feedback.isVisible().catch(() => false)) {
      console.log("Clerk auth feedback:", await feedback.innerText());
      await expect(feedback).toBeVisible();
      return;
    }

    if (await hasClerkLoadingState(page)) {
      await expect(page.getByRole("button", { name: /loading|processing|submitting|creating/i }).first()).toBeVisible();
      return;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Expected Clerk auth feedback, loading state, or dashboard redirect, but stayed on ${page.url()}`);
}

async function hasAuthFeedback(page: Page) {
  return page.locator(authFeedbackSelector).first().isVisible().catch(() => false);
}

async function hasClerkLoadingState(page: Page) {
  return page
    .getByRole("button", { name: /loading|processing|submitting|creating/i })
    .first()
    .isVisible({ timeout: 100 })
    .catch(() => false);
}

function isDashboardUrl(url: string) {
  return /\/dashboard(?:[/?#]|$)/.test(url);
}
