import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test, type TestInfo } from '@playwright/test';

// M2 (plan §4.2, §8.6): the error→UI mapping and the toasts mounted in each app shell, at 375 px
// and 1440 px, light and dark, in both apps. Each view must match its baseline in
// `e2e/errores.spec.ts-snapshots/`; after an intentional style change run `npm run e2e:update`
// and commit the new baselines together with the refreshed report copies in `docs/reportes/m2/`.
const REPORTE_DIR = 'docs/reportes/m2';
const TRAZA = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';

/** Same image as the baseline, kept as a readable JPEG for the milestone report. */
async function capturaReporte(page: Page, testInfo: TestInfo, nombre: string, fullPage = false) {
  const [app, dispositivo] = testInfo.project.name.split('-');
  const ancho = dispositivo === 'mobile' ? 375 : 1440;
  await page.screenshot({
    path: `${REPORTE_DIR}/${app}-${nombre}-${ancho}.jpg`,
    fullPage,
    type: 'jpeg',
    quality: 80,
    animations: 'disabled',
  });
}

async function abrir(page: Page) {
  await page.goto('/_ui/errores');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Errores y notificaciones' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`/_ui/errores · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('every error message renders, fits the viewport and passes axe', async ({
      page,
    }, testInfo) => {
      const errores: string[] = [];
      page.on('pageerror', (error) => errores.push(error.message));
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') errores.push(mensaje.text());
      });

      await abrir(page);
      await expect(page.getByRole('alert')).toHaveCount(14);
      // A 404 never claims the resource is missing, and 5xx details are never shown.
      await expect(page.getByText('No existe o no está disponible para tu usuario.')).toBeVisible();
      await expect(page.getByText('An unexpected error occurred.')).toHaveCount(0);

      const anchoPagina = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(anchoPagina).toBe(page.viewportSize()!.width);

      await expect(page).toHaveScreenshot(`mensajes-${colorScheme}.png`, { fullPage: true });
      await capturaReporte(page, testInfo, `mensajes-${colorScheme}`, true);

      const axe = await new AxeBuilder({ page }).analyze();
      const graves = axe.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
      expect(errores).toEqual([]);
    });

    for (const [boton, tipo, titulo] of [
      ['Éxito', 'exito', 'Plazo marcado como cumplido'],
      ['Información', 'info', 'Código de activación generado'],
      ['Aviso', 'aviso', 'El plazo vence hoy'],
      ['Error con código', 'error', 'No se pudo completar'],
      ['Error inesperado', 'error-inesperado', 'Error inesperado'],
    ] as const) {
      test(`toast · ${tipo}`, async ({ page }, testInfo) => {
        await abrir(page);
        await page.getByRole('button', { name: boton, exact: true }).click();
        const toast = page.locator('[data-sonner-toast]');
        await expect(toast).toHaveCount(1);
        await expect(toast).toContainText(titulo);
        // Hovering pauses the auto-dismiss timer while the screenshot settles.
        await toast.hover();

        await expect(page).toHaveScreenshot(`toast-${tipo}-${colorScheme}.png`);
        await capturaReporte(page, testInfo, `toast-${tipo}-${colorScheme}`);
      });
    }
  });
}

test('the error toast copies the trace id instead of printing it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await abrir(page);
  await page.getByRole('button', { name: 'Error con código', exact: true }).click();
  const toast = page.locator('[data-sonner-toast]').first();
  await expect(toast).not.toContainText(TRAZA);

  await toast.getByRole('button', { name: 'Copiar código' }).click();
  await expect(page.getByText('Código de seguimiento copiado')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(TRAZA);
});
