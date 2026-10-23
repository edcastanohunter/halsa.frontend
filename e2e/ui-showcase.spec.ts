import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

// M1 AC: the /_ui showcase in light and dark at 375 px and 1440 px, axe-clean, with screenshots
// for the milestone report (backoffice projects only, to keep the set small).
const SCREENSHOT_DIR = 'docs/reportes/m1';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`/_ui · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('renders every section without errors and passes axe', async ({ page }, testInfo) => {
      const errores: string[] = [];
      page.on('pageerror', (error) => errores.push(error.message));
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error') errores.push(mensaje.text());
      });

      await page.goto('/_ui');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Sistema de diseño' }),
      ).toBeVisible();
      await expect(page.locator('html')).toHaveClass(
        colorScheme === 'dark' ? /dark/ : /^(?!.*dark)/,
      );
      for (const titulo of [
        'Fundamentos',
        'Controles',
        'Navegación',
        'Superposiciones',
        'Datos',
        'Componentes Halsa',
      ]) {
        await expect(page.getByRole('heading', { level: 2, name: titulo })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);

      // No horizontal page scroll; wide content (tables, nav) scrolls inside its own container.
      const anchoPagina = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(anchoPagina).toBe(page.viewportSize()!.width);

      // Screenshot before axe: axe scrolls inner containers while it checks contrast.
      if (testInfo.project.name.startsWith('backoffice')) {
        const ancho = testInfo.project.name.endsWith('mobile') ? 375 : 1440;
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/ui-${ancho}-${colorScheme}.png`,
          fullPage: true,
        });
      }

      const axe = await new AxeBuilder({ page }).analyze();
      const graves = axe.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
      expect(errores).toEqual([]);
    });
  });
}

test('the UI font renders tabular figures', async ({ page }) => {
  await page.goto('/_ui');
  await page.evaluate(() => document.fonts.ready);
  const [unos, ceros] = await page.evaluate(() =>
    ['111111', '000000'].map((texto) => {
      const span = document.createElement('span');
      span.className = 'tabular-nums font-sans';
      span.textContent = texto;
      document.body.append(span);
      const ancho = span.getBoundingClientRect().width;
      span.remove();
      return ancho;
    }),
  );
  expect(unos).toBeCloseTo(ceros!, 1);
});

test('the theme selector switches and remembers the preference', async ({ page }) => {
  await page.goto('/_ui');
  await page.getByRole('radio', { name: 'Oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('radio', { name: 'Claro' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('emergency access dialog records the ASCII motivo without reloading the page', async ({
  page,
}) => {
  await page.goto('/_ui');
  await page.evaluate(() => ((window as unknown as { sinRecarga: boolean }).sinRecarga = true));

  await page.getByRole('button', { name: 'Acceso de emergencia' }).click();
  const dialogo = page.getByRole('dialog');
  const confirmar = dialogo.getByRole('button', { name: 'Acceder y registrar motivo' });
  await expect(confirmar).toBeDisabled();

  await dialogo
    .getByLabel('Motivo del acceso')
    .fill('Paciente inconsciente tras caída, señal de TCE');
  await expect(dialogo).toContainText(
    'Se registrará como: Paciente inconsciente tras caida, senal de TCE',
  );
  await dialogo.getByRole('checkbox', { name: 'Confirmo que es una urgencia clínica' }).click();
  await confirmar.click();

  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Acceso de emergencia activo')).toContainText(
    'Paciente inconsciente tras caida, senal de TCE',
  );
  expect(
    await page.evaluate(() => (window as unknown as { sinRecarga?: boolean }).sinRecarga),
  ).toBe(true);
});
