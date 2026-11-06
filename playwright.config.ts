import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://torat-tsion-web.onrender.com',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
