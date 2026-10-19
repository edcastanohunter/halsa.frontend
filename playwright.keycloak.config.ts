import { defineConfig } from '@playwright/test';

// Keycloak login theme spec (plan §11, M1.5 AC). Runs against the local Podman Keycloak, so start it
// first with `npm run kc:up`. No Angular dev server is needed. Serial on purpose: some tests flip
// realm settings or required actions through the admin API and put them back afterwards.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'keycloak-theme.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/keycloak' }]],
  outputDir: 'test-results/keycloak',
  expect: {
    // Font hinting differs slightly between runs; layout regressions are far above this.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: 'http://localhost:8180',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
    locale: 'es-CO',
  },
  projects: [
    { name: 'kc-mobile', use: { viewport: { width: 375, height: 812 } } },
    { name: 'kc-desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
