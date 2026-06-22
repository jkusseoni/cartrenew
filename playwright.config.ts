import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'html',
  use: {
    baseURL: 'http://localhost:3000', 
    trace: 'on-first-retry',
  }, 
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 🚀 Yeh block Playwright ko bolega ki test shuru karne se pehle 
     Next.js server ko background mein khud start kare */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI, // Local par chalte hue server ko reuse karega
    timeout: 120 * 1000,                  // Server start hone ke liye 2 mins ka wait karega
  },
});