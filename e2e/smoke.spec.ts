import { test, expect } from '@playwright/test';

// M0: the empty shell boots (runtime config loaded, router outlet rendered) in both apps.
test.describe('Shell', () => {
  test('boots with the runtime config and renders the main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
    await expect(page.locator('app-root main')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
