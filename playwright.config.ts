import { defineConfig, devices } from '@playwright/test';

// E2E always runs against the production build: service worker and offline only exist there.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    locale: 'zh-TW',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Installed Microsoft Edge; opt in with PW_EDGE=1 so machines without Edge still pass.
    ...(process.env.PW_EDGE ? [{ name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }] : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
