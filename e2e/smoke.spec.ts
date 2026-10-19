import { test, expect } from '@playwright/test';

// M0: the shell boots (runtime config loaded, router outlet rendered) in both apps. Since M3 every
// backoffice route but `/sin-acceso` and `/auth/callback` needs a Keycloak session, so the
// backoffice boot check uses the public `/sin-acceso` page.
test.describe('Shell', () => {
  test('boots with the runtime config and renders the main landmark', async ({
    page,
  }, testInfo) => {
    await page.goto(testInfo.project.name.startsWith('backoffice') ? '/sin-acceso' : '/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
    await expect(page.locator('app-root main')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
