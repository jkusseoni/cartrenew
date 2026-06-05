# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> auth routes >> sign-up submits credentials and redirects or shows auth feedback
- Location: tests\e2e\auth.spec.ts:35:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/sign-up
Call log:
  - navigating to "http://localhost:3000/sign-up", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | const signupPath = "/sign-up";
  4   | const loginPath = "/sign-in";
  5   | const testEmail = process.env.E2E_TEST_EMAIL ?? "testmerchant@cartrenew.com";
  6   | const testPassword = process.env.E2E_TEST_PASSWORD ?? "SecureDevPass123!";
  7   | 
  8   | const clerkReadySelector = [
  9   |   ".cl-rootBox",
  10  |   "form",
  11  |   'input[type="email"]',
  12  |   'input[name="emailAddress"]',
  13  |   'input[name="identifier"]',
  14  |   'input[type="password"]',
  15  | ].join(", ");
  16  | 
  17  | const authFeedbackSelector = [
  18  |   ".cl-rootBox .cl-errorMessage",
  19  |   ".cl-rootBox .cl-alert",
  20  |   ".cl-rootBox .cl-formFieldErrorText",
  21  |   '.cl-rootBox [data-localization-key*="error"]',
  22  |   '.cl-rootBox [data-localization-key*="formFieldError"]',
  23  |   '.cl-rootBox [role="alert"]',
  24  |   '.cl-rootBox [aria-live="assertive"]',
  25  |   "form .cl-errorMessage",
  26  |   "form .cl-alert",
  27  |   "form .cl-formFieldErrorText",
  28  |   'form [data-localization-key*="error"]',
  29  |   'form [data-localization-key*="formFieldError"]',
  30  |   'form [role="alert"]',
  31  |   'form [aria-live="assertive"]',
  32  | ].join(", ");
  33  | 
  34  | test.describe("auth routes", () => {
  35  |   test("sign-up submits credentials and redirects or shows auth feedback", async ({ page }) => {
> 36  |     await page.goto(signupPath, { waitUntil: "domcontentloaded" });
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/sign-up
  37  |     await fillAuthForm(page, {
  38  |       email: testEmail,
  39  |       password: testPassword,
  40  |       submitName: /sign up|continue|create account/i,
  41  |     });
  42  |     await expectDashboardRedirectOrAuthFeedback(page);
  43  |   });
  44  | 
  45  |   test("login submits credentials and redirects or shows auth feedback", async ({ page }) => {
  46  |     await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  47  |     await fillAuthForm(page, {
  48  |       email: testEmail,
  49  |       password: testPassword,
  50  |       submitName: /sign in|continue|log in/i,
  51  |     });
  52  |     await expectDashboardRedirectOrAuthFeedback(page);
  53  |   });
  54  | });
  55  | 
  56  | type AuthFormData = {
  57  |   email: string;
  58  |   password: string;
  59  |   submitName: RegExp;
  60  | };
  61  | 
  62  | type AuthSubmitResult = {
  63  |   clicked: boolean;
  64  |   submitted: boolean;
  65  |   buttonText: string;
  66  | };
  67  | 
  68  | async function fillAuthForm(page: Page, data: AuthFormData) {
  69  |   await expect(page.locator(clerkReadySelector).first()).toBeVisible({ timeout: 20_000 });
  70  | 
  71  |   for (let step = 0; step < 4; step += 1) {
  72  |     await injectAuthFields(page, data);
  73  | 
  74  |     const result = await submitAuthStep(page, data.submitName);
  75  |     expect(
  76  |       result.clicked || result.submitted,
  77  |       `Clerk auth submit control was not found on ${page.url()}`
  78  |     ).toBeTruthy();
  79  | 
  80  |     const outcome = await waitForAuthProgress(page);
  81  |     if (outcome === "done" || outcome === "feedback" || outcome === "loading") {
  82  |       return;
  83  |     }
  84  |   }
  85  | }
  86  | 
  87  | async function injectAuthFields(page: Page, data: AuthFormData) {
  88  |   await page.evaluate(
  89  |     ({ email, password }) => {
  90  |       const emailSelectors = [
  91  |         'input[name="identifier"]',
  92  |         'input[name="emailAddress"]',
  93  |         'input[type="email"]',
  94  |         'input[autocomplete="email"]',
  95  |       ];
  96  |       const passwordSelectors = [
  97  |         'input[name="password"]',
  98  |         'input[type="password"]',
  99  |         'input[autocomplete="current-password"]',
  100 |         'input[autocomplete="new-password"]',
  101 |       ];
  102 | 
  103 |       const setNativeValue = (input: HTMLInputElement, value: string) => {
  104 |         const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  105 |         setter?.call(input, value);
  106 |         input.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  107 |         input.dispatchEvent(new Event("change", { bubbles: true }));
  108 |       };
  109 | 
  110 |       const findVisibleInput = (selectors: string[]) => {
  111 |         for (const selector of selectors) {
  112 |           const input = Array.from(document.querySelectorAll<HTMLInputElement>(selector)).find(
  113 |             (candidate) => isVisible(candidate) && !candidate.disabled && !candidate.readOnly
  114 |           );
  115 | 
  116 |           if (input) {
  117 |             return input;
  118 |           }
  119 |         }
  120 | 
  121 |         return null;
  122 |       };
  123 | 
  124 |       const emailInput = findVisibleInput(emailSelectors);
  125 |       if (emailInput) {
  126 |         setNativeValue(emailInput, email);
  127 |       }
  128 | 
  129 |       const passwordInput = findVisibleInput(passwordSelectors);
  130 |       if (passwordInput) {
  131 |         setNativeValue(passwordInput, password);
  132 |       }
  133 | 
  134 |       function isVisible(element: HTMLElement) {
  135 |         const rect = element.getBoundingClientRect();
  136 |         const style = window.getComputedStyle(element);
```