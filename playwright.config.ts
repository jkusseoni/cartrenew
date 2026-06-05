import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', 
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000', // Port 3001 ko badalkar 3000 kar dein
    trace: 'on-first-retry',
  }, 
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});