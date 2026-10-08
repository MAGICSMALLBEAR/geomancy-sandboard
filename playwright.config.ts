import { defineConfig, devices } from '@playwright/test';

// E2E always runs against the production build: service worker and offline only exist there.
// Own the server so an older preview cannot silently bypass the build and test stale code.
const port = 4183;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}/`,
    locale: 'zh-TW',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Installed Microsoft Edge; opt in with PW_EDGE=1 so machines without Edge still pass.
    ...(process.env.PW_EDGE ? [{ name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }] : []),
    // Other engines; opt in with PW_ENGINES=1 after `npx playwright install firefox webkit`.
    // WebKit here is Playwright's Windows build: close to Safari's engine, not a substitute for a real iPhone.
    ...(process.env.PW_ENGINES
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
