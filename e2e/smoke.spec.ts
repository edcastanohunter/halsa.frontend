import { test, expect } from './fixtures';

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

  // The CSP fixture (fixtures.ts) only proves something if the policy is actually enforced.
  test('serves the production CSP with Trusted Types enforced', async ({ page }) => {
    const respuesta = await page.goto('/');
    const csp = respuesta?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toContain("script-src 'self';");
    expect(await page.evaluate(() => 'trustedTypes' in window)).toBe(true);
  });
});
