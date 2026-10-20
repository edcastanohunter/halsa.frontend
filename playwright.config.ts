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
  // Starts the dev servers when they are not already running. The backoffice runs in the `mock`
  // configuration (local Podman Keycloak on :8180 + mock API; `npm run kc:up` first) unless
  // HALSA_E2E_REAL=1, which targets the backend's Keycloak and the real API (and BFF) through the
  // proxies.
  webServer: [
    {
      command: `npx ng serve backoffice --port 3000${process.env['HALSA_E2E_REAL'] ? '' : ' --configuration mock'}`,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    // The portal runs against the mock BFF (gap G3: the BFF can't log in from :4300 yet).
    {
      command: `npx ng serve portal --port 4300 --ssl${process.env['HALSA_E2E_REAL'] ? '' : ' --configuration mock'}`,
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
