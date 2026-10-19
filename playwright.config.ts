import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The Keycloak theme spec has its own config (playwright.keycloak.config.ts, npm run e2e:theme).
  testIgnore: 'keycloak-theme.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: {
    // Visual baselines (e2e/*.spec.ts-snapshots/): font hinting differs slightly between runs,
    // layout regressions are far above this. Refresh them with `npm run e2e:update`.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    trace: 'on-first-retry',
  },
  // Starts the dev servers when they are not already running (shell smoke only needs the SPA).
  webServer: [
    {
      command: 'npx ng serve backoffice --port 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: 'npx ng serve portal --port 4300 --ssl',
      url: 'https://localhost:4300',
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'backoffice-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'backoffice-mobile',
      use: {
        viewport: { width: 375, height: 812 },
        baseURL: 'http://localhost:3000',
      },
    },
    {
      name: 'portal-mobile',
      use: {
        viewport: { width: 375, height: 812 },
        baseURL: 'https://localhost:4300',
        ignoreHTTPSErrors: true,
      },
    },
    {
      name: 'portal-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: 'https://localhost:4300',
        ignoreHTTPSErrors: true,
      },
    },
  ],
});
