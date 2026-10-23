import { expect, type Page, test, type TestInfo } from './fixtures';
import {
  capturar as capturarEn,
  cargarDiferidos,
  esEscritorio,
  ingresar,
  sinViolacionesGraves,
  soloBackoffice,
} from './backoffice';

// M5 (plan §7.4, §7.8): the deadline board, the case tab and "cumplir", against the local Podman
// Keycloak and the mock API (state in memory until a reload: flows navigate inside the app).
// Baselines in `e2e/plazos.spec.ts-snapshots/` (dates masked), report copies in docs/reportes/m5/.
const REPORTE_DIR = 'docs/reportes/m5';
const CASO_VALIDADO = '0199a000-0000-7000-8000-00000000a002';

soloBackoffice();

const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa, [page.locator('time')]);

/** Rule titles of the visible list: grouped cards on mobile, table rows on desktop. */
function reglas(page: Page, testInfo: TestInfo) {
  return esEscritorio(testInfo)
    ? page.locator('table tbody tr td:nth-child(2)')
    : page.getByTestId('plazos-movil').locator('h3');
}

async function elegir(page: Page, campo: string, opcion: string) {
  await page.locator(campo).click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
}

test.describe('analista.arla (plan §7.8)', () => {
  test('filters sync to the URL both ways', async ({ page }, testInfo) => {
    await ingresar(page, 'analista.arla', '/plazos');
    await expect(page.getByRole('heading', { level: 1, name: 'Plazos' })).toBeVisible();
    // Default: ABIERTO, soonest first; an unknown rule renders as its raw code.
    await expect(reglas(page, testInfo)).toHaveText([
      'Reporte del accidente (FURAT)',
      'Controversia del dictamen',
      'Investigación del accidente',
      'REGLA_FUTURA_DESCONOCIDA',
    ]);
    if (!esEscritorio(testInfo)) {
      await expect(
        page.getByTestId('plazos-movil').getByRole('heading', { level: 2 }),
      ).not.toHaveCount(0);
    }

    await elegir(page, '#filtro-estado', 'Vencido');
    await expect(page).toHaveURL(/[?&]estado=VENCIDO/);
    await expect(reglas(page, testInfo)).toHaveText(['Tope de incapacidad temporal (180 días)']);

    await elegir(page, '#filtro-estado', 'Todos los estados');
    await elegir(page, '#filtro-regla', 'Reporte del accidente (FURAT)');
    await expect(page).toHaveURL(/estado=todos/);
    await expect(page).toHaveURL(/regla=REPORTE_FURAT/);
    // ARL_A's two FURAT deadlines (open and fulfilled late); ARL_B's never shows.
    await expect(reglas(page, testInfo)).toHaveCount(2);

    await page.locator('#filtro-fecha').fill('2000-01-01');
    await page.locator('#filtro-fecha').dispatchEvent('change');
    await expect(page).toHaveURL(/venceAntesDe=2000-01-01/);
    await expect(page.getByText('No hay plazos con estos filtros')).toBeVisible();

    // Back restores the previous filters and the controls follow the URL.
    await page.goBack();
    await expect(page).not.toHaveURL(/venceAntesDe/);
    await expect(reglas(page, testInfo)).toHaveCount(2);
    await expect(page.locator('#filtro-regla')).toContainText('Reporte del accidente (FURAT)');
    await expect(page.locator('#filtro-fecha')).toHaveValue('');
  });

  test('cumplir from the board: validation, then the deadline leaves the open list', async ({
    page,
  }, testInfo) => {
    await ingresar(page, 'analista.arla', '/plazos');
    const accion = esEscritorio(testInfo)
      ? 'Cumplir: Controversia'
      : 'Marcar como cumplido: Controversia';
    await page.getByRole('button', { name: new RegExp(`^${accion}`) }).click();

    const hoja = page.getByRole('dialog');
    await expect(hoja.getByRole('heading', { name: 'Marcar como cumplido' })).toBeVisible();
    await hoja.getByLabel('Nota').fill('Muy corta');
    await hoja.getByRole('button', { name: 'Marcar como cumplido' }).click();
    await expect(hoja.getByText('Escribe al menos 10 caracteres.')).toBeVisible();
    await expect(hoja.getByText('9/1000')).toBeVisible();

    await hoja.getByLabel('Nota').fill('Se radicó la respuesta a la controversia ante la junta.');
    await hoja.getByRole('button', { name: 'Marcar como cumplido' }).click();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByText('Plazo marcado como cumplido')).toBeVisible();
    await expect(reglas(page, testInfo)).toHaveCount(3);
    await expect(reglas(page, testInfo)).not.toContainText(['Controversia del dictamen']);
  });

  test('desktop sorts by venceEn', async ({ page }, testInfo) => {
    test.skip(!esEscritorio(testInfo), 'desktop table only');
    await ingresar(page, 'analista.arla', '/plazos');
    const encabezado = page.getByRole('columnheader', { name: /Vence/ });
    await expect(encabezado).toHaveAttribute('aria-sort', 'ascending');
    await encabezado.getByRole('button').click();
    await expect(encabezado).toHaveAttribute('aria-sort', 'descending');
    await expect(reglas(page, testInfo).first()).toHaveText('REGLA_FUTURA_DESCONOCIDA');
  });

  test('the case tab: timeline, extemporáneo and cumplir', async ({ page }) => {
    await ingresar(page, 'analista.arla', `/casos/${CASO_VALIDADO}/plazos`);
    const linea = page.getByTestId('plazos-caso');
    await expect(linea.getByRole('heading', { level: 3 })).toHaveText([
      'Reporte del accidente (FURAT)',
      'Investigación del accidente',
      'REGLA_FUTURA_DESCONOCIDA',
    ]);
    await expect(linea.getByText('Extemporáneo')).toBeVisible();

    await page.getByRole('button', { name: /^Marcar como cumplido: Investigación/ }).click();
    const hoja = page.getByRole('dialog');
    await hoja.getByLabel('Nota').fill('Investigación entregada por el empleador y revisada.');
    await hoja.getByRole('button', { name: 'Marcar como cumplido' }).click();
    await expect(hoja).toHaveCount(0);
    const investigacion = linea.getByRole('article', { name: 'Investigación del accidente' });
    await expect(investigacion.getByTitle(/^Vence:/)).toHaveText('Cumplido');
    await expect(investigacion.getByRole('button', { name: /^Marcar como cumplido/ })).toHaveCount(
      0,
    );
  });

  test('inicio shows the deadline widgets', async ({ page }) => {
    await ingresar(page, 'analista.arla');
    await cargarDiferidos(page);
    await expect(page.getByTestId('plazos-por-vencer').getByRole('link')).toHaveCount(2);
    const vencidos = page.getByTestId('plazos-vencidos');
    await expect(vencidos).toContainText('1');
    await vencidos.click();
    await expect(page).toHaveURL(/\/plazos\?estado=VENCIDO/);
  });
});

test('calificador.arla reads deadlines but cannot fulfil them', async ({ page }, testInfo) => {
  await ingresar(page, 'calificador.arla', '/plazos');
  await expect(reglas(page, testInfo)).toHaveCount(4);
  await expect(page.getByRole('button', { name: /Cumplir|Marcar como cumplido/ })).toHaveCount(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`plazos visuals · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('board, case timeline and the cumplir sheet', async ({ page }, testInfo) => {
      await ingresar(page, 'analista.arla', '/plazos');
      await expect(reglas(page, testInfo)).toHaveCount(4);
      await capturar(page, testInfo, `tablero-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: /^(Cumplir|Marcar como cumplido): Reporte/ }).click();
      // The CDK container is 0×0 (the sheet itself is `fixed`): look at its title.
      await expect(page.getByRole('heading', { name: 'Marcar como cumplido' })).toBeVisible();
      await page.mouse.move(0, 0);
      await capturar(page, testInfo, `cumplir-${colorScheme}`, false);
      await sinViolacionesGraves(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

      await page.getByRole('link', { name: '2026-ARLA-000102' }).first().click();
      await expect(page.getByTestId('plazos-caso')).toBeVisible();
      await capturar(page, testInfo, `caso-${colorScheme}`);
      await sinViolacionesGraves(page);
    });
  });
}
