import { test, expect } from '@playwright/test';

const DEFAULT_LOCALE = 'en';

test.describe('CartRenew Automated Handshake Flow', () => {
  test('Should validate landing UI and marketing hub automation templates', async ({ page }) => {
    // 1. Locale-prefixed landing page
    await page.goto(`/${DEFAULT_LOCALE}`);

    // 2. Hero + navigation copy from the current landing page
    await expect(page.locator('h1')).toContainText('CartRenew Public');
    await expect(
      page.getByRole('heading', {
        name: /Recover\s+68% of Abandoned Carts/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Start 14-Day Free Trial/i })).toBeVisible();

    // 3. Locale-prefixed marketing hub (cart recovery workflow templates)
    await page.goto(`/${DEFAULT_LOCALE}/marketing-hub`);

    await expect(page.getByRole('heading', { name: 'Automation Templates' })).toBeVisible();
    await expect(page.getByText('CartRenew', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Immediate Cart Drop (15 Mins)')).toBeVisible();
    await expect(page.getByText('WhatsApp AI Node').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '🟢 Active Node' }).first()).toBeVisible();

    // 4. Toggle a template node and verify paused/active state updates
    const activeNodeButton = page.getByRole('button', { name: '🟢 Active Node' }).first();
    await activeNodeButton.click();
    await expect(page.getByRole('button', { name: '🔴 Paused Node' }).first()).toBeVisible();
  });
});
