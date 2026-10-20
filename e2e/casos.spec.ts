import { expect, type Page, test, type TestInfo } from '@playwright/test';
import {
  capturar as capturarEn,
  cargarDiferidos,
  esEscritorio,
  ingresar,
  sinViolacionesGraves,
  soloBackoffice,
} from './backoffice';

// M4 (plan §7.3, §7.4, §11): casos against the local Podman Keycloak and the mock API. The mock
// keeps its state in memory until a full reload, so each flow navigates inside the app after the
// login. Baselines in `e2e/casos.spec.ts-snapshots/` (dates masked: the fixtures are relative to
// now), report copies in `docs/reportes/m4/`.
const REPORTE_DIR = 'docs/reportes/m4';

const CASO = {
  radicado: { id: '0199a000-0000-7000-8000-00000000a001', radicado: '2026-ARLA-000101' },
  validado: { id: '0199a000-0000-7000-8000-00000000a002', radicado: '2026-ARLA-000102' },
  enCalificacion: { id: '0199a000-0000-7000-8000-00000000a003', radicado: '2026-ARLA-000103' },
  arlB: { id: '0199a000-0000-7000-8000-00000000b001' },
} as const;
const SUB_CALIFICADOR = '01999000-0000-7000-8000-000000000a02';
const SUB_MEDICO_IPS = '01999000-0000-7000-8000-000000000c01';
/** 4 scenario cases + 20 historic ones, all ARL_A (projects/backoffice/src/mocks/fixtures.ts). */
const TOTAL_ARL_A = 24;

soloBackoffice();

const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa, [page.locator('time')]);

const pestanas = (page: Page) =>
  page.getByRole('navigation', { name: 'Secciones del caso' }).getByRole('link');

/** The estado filter: chips below `md`, a select from `md` up. */
async function filtrarPorEstado(page: Page, testInfo: TestInfo, etiqueta: string) {
  if (esEscritorio(testInfo)) {
    await page.locator('#filtro-estado').click();
    await page.getByRole('option', { name: etiqueta, exact: true }).click();
  } else {
    await page
      .getByRole('group', { name: 'Filtrar por estado' })
      .getByRole('button', { name: etiqueta, exact: true })
      .click();
  }
}

/** The visible list: cards on mobile, table rows on desktop. */
const filas = (page: Page, testInfo: TestInfo) =>
  esEscritorio(testInfo)
    ? page.locator('table tbody tr')
    : page.getByRole('list', { name: 'Casos' }).getByRole('listitem');

test.describe('analista.arla (plan §11)', () => {
  test('list → case → team → remission → activation code', async ({ page }, testInfo) => {
    await ingresar(page, 'analista.arla', '/casos');
    await expect(page.getByRole('heading', { level: 1, name: 'Casos' })).toBeVisible();
    await expect(page.getByText(`${TOTAL_ARL_A} casos`)).toBeVisible();
    await expect(filas(page, testInfo)).toHaveCount(20);
    // No text search exists (gap G6).
    await expect(page.getByRole('searchbox')).toHaveCount(0);

    // The worker document is masked until revealed, per row.
    const primera = filas(page, testInfo).first();
    await expect(primera).toContainText('••••4050');
    await primera.getByRole('button', { name: 'Mostrar número de documento' }).click();
    await expect(primera).toContainText('1020304050');

    await filtrarPorEstado(page, testInfo, 'Validado');
    await expect(page).toHaveURL(/[?&]estado=Validado/);
    await expect(filas(page, testInfo).first()).toContainText(CASO.validado.radicado);
    await page.getByRole('link', { name: `Abrir caso ${CASO.validado.radicado}` }).click();

    await expect(page).toHaveURL(`/casos/${CASO.validado.id}/resumen`);
    await expect(page.getByText('Grave o mortal').first()).toBeVisible();
    // No clinical tab for the analyst (plan §6.3).
    await expect(pestanas(page)).toHaveText([
      'Resumen',
      'Equipo',
      'Plazos',
      'Incapacidades',
      'Portal paciente',
    ]);

    // Equipo: take the calificador off the case, then assign them back by identifier.
    await pestanas(page).filter({ hasText: 'Equipo' }).click();
    const equipo = page.getByTestId('equipo');
    await expect(equipo.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Retirar a 01999000…0a02 del caso' }).click();
    const confirmacion = page.getByRole('alertdialog');
    await expect(confirmacion).toContainText(SUB_CALIFICADOR);
    await confirmacion.getByRole('button', { name: 'Retirar' }).click();
    await expect(equipo.getByRole('listitem')).toHaveCount(1);

    await page.getByLabel('Asignar por identificador').fill('no-es-un-sub');
    await page.getByRole('button', { name: 'Asignar', exact: true }).click();
    await expect(page.getByText('El identificador tiene el formato')).toBeVisible();
    await page.getByLabel('Asignar por identificador').fill(SUB_CALIFICADOR);
    await page.getByRole('button', { name: 'Asignar', exact: true }).click();
    await expect(equipo.getByRole('listitem')).toHaveCount(2);
    await expect(equipo).toContainText('01999000…0a02');

    // "Asignarme" adds the own sub, shown as "Tú".
    await page.getByRole('button', { name: 'Asignarme' }).click();
    await expect(equipo.getByText('Tú', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Asignarme' })).toHaveCount(0);

    // Remisiones: the duplicate maps inline under the field, then a new IPS, then revoke it.
    const remisiones = page.getByTestId('remisiones');
    await page.getByLabel('Remitir a IPS').fill('110011234501');
    await page.getByRole('button', { name: 'Remitir', exact: true }).click();
    await expect(page.getByTestId('error-reps')).toHaveText('El caso ya está remitido a esa IPS.');
    await page.getByLabel('Remitir a IPS').fill('7600 1123 4501');
    await expect(page.getByLabel('Remitir a IPS')).toHaveValue('760011234501');
    await page.getByRole('button', { name: 'Remitir', exact: true }).click();
    await expect(remisiones.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Revocar la remisión a la IPS 760011234501' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Revocar' }).click();
    await expect(remisiones.getByRole('listitem')).toHaveCount(1);
    await expect(remisiones).not.toContainText('760011234501');

    // Portal paciente: a one-time code in a dialog an outside click can't close.
    await pestanas(page).filter({ hasText: 'Portal paciente' }).click();
    await page.getByRole('button', { name: 'Generar código' }).click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toContainText('No se volverá a mostrar');
    await expect(dialogo).toContainText(/Vence el \d{1,2} \w+/);
    // The visible groups; the element also holds the code spelled out for screen readers.
    const texto = (await dialogo.locator('.font-mono').first().textContent())!.replace(/\s/g, '');
    const codigo = /^[0-9A-Z]{6}-[0-9A-Z]{10}/.exec(texto)?.[0];
    expect(codigo).toBeTruthy();
    await page.mouse.click(5, 5);
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Ya lo guardé, cerrar' }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(page.getByText(codigo!.slice(0, 6))).toHaveCount(0);
  });

  test('a Radicado case does not offer the activation code', async ({ page }) => {
    await ingresar(page, 'analista.arla', `/casos/${CASO.radicado.id}/portal-paciente`);
    await expect(page.getByRole('button', { name: 'Generar código' })).toBeDisabled();
    await expect(page.getByTestId('aviso-estado')).toContainText('«Radicado»');
  });

  test('a clinical tab URL redirects to resumen with a notice', async ({ page }) => {
    await ingresar(page, 'analista.arla', `/casos/${CASO.validado.id}/historia-clinica`);
    await expect(page).toHaveURL(`/casos/${CASO.validado.id}/resumen`);
    await expect(page.getByText('No tienes acceso a esa sección del caso')).toBeVisible();
  });

  test('desktop pagination and mobile "Cargar más"', async ({ page }, testInfo) => {
    await ingresar(page, 'analista.arla', '/casos');
    await expect(filas(page, testInfo)).toHaveCount(20);
    if (esEscritorio(testInfo)) {
      await page.getByRole('link', { name: 'Página 2' }).click();
      await expect(page).toHaveURL(/[?&]page=2/);
      await expect(filas(page, testInfo)).toHaveCount(TOTAL_ARL_A - 20);
    } else {
      await page.getByRole('button', { name: 'Cargar más' }).click();
      await expect(filas(page, testInfo)).toHaveCount(TOTAL_ARL_A);
      await expect(page.getByRole('button', { name: 'Cargar más' })).toHaveCount(0);
    }
  });

  test('inicio shows the case widgets', async ({ page }) => {
    await ingresar(page, 'analista.arla');
    await cargarDiferidos(page);
    const porEstado = page.getByTestId('casos-por-estado');
    await expect(porEstado.getByRole('link', { name: 'Radicado: 1' })).toBeVisible();
    await expect(porEstado.getByRole('link', { name: 'Validado: 5' })).toBeVisible();
    await expect(page.getByTestId('casos-recientes').getByRole('link')).toHaveCount(5);
    await porEstado.getByRole('link', { name: 'Validado: 5' }).click();
    await expect(page).toHaveURL(/\/casos\?estado=Validado/);
  });
});

test('analista.arlb gets the neutral not-found page for an ARL_A case', async ({ page }) => {
  await ingresar(page, 'analista.arlb', `/casos/${CASO.validado.id}`);
  await expect(
    page.getByText('Caso no encontrado o no disponible para tu usuario').first(),
  ).toBeVisible();
  await expect(page.getByText(CASO.validado.radicado)).toHaveCount(0);
});

test('analista.arla gets the same page for an ARL_B case id', async ({ page }) => {
  await ingresar(page, 'analista.arla', `/casos/${CASO.arlB.id}`);
  await expect(
    page.getByText('Caso no encontrado o no disponible para tu usuario').first(),
  ).toBeVisible();
});

test('coordinador.ips sees only remitted cases and assigns medico.ips', async ({
  page,
}, testInfo) => {
  await ingresar(page, 'coordinador.ips', '/casos');
  await expect(filas(page, testInfo)).toHaveCount(1);
  await page.getByRole('link', { name: `Abrir caso ${CASO.validado.radicado}` }).click();
  await expect(pestanas(page)).toHaveText(['Resumen', 'Equipo']);
  await pestanas(page).filter({ hasText: 'Equipo' }).click();

  await page.getByRole('button', { name: 'Retirar a 01999000…0c01 del caso' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Retirar' }).click();
  await expect(page.getByTestId('equipo')).not.toContainText('01999000…0c01');
  await page.getByLabel('Asignar por identificador').fill(SUB_MEDICO_IPS);
  await page.getByRole('button', { name: 'Asignar', exact: true }).click();
  await expect(page.getByTestId('equipo')).toContainText('01999000…0c01');
  // An IPS coordinator can't remit (no casos:write).
  await expect(page.getByLabel('Remitir a IPS')).toHaveCount(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`casos visuals · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('analista: list, resumen, equipo and the activation code', async ({ page }, testInfo) => {
      await ingresar(page, 'analista.arla', '/casos');
      await expect(filas(page, testInfo)).toHaveCount(20);
      await capturar(page, testInfo, `lista-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.getByRole('link', { name: `Abrir caso ${CASO.enCalificacion.radicado}` }).click();
      await expect(page).toHaveURL(`/casos/${CASO.enCalificacion.id}/resumen`);
      await expect(page.getByRole('heading', { name: 'Calificación' })).toBeVisible();
      await expect(page.locator('main')).toContainText('23,45 %');
      await capturar(page, testInfo, `resumen-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.getByRole('link', { name: 'Volver a casos' }).click();
      await page.getByRole('link', { name: `Abrir caso ${CASO.validado.radicado}` }).click();
      await pestanas(page).filter({ hasText: 'Equipo' }).click();
      await expect(page.getByTestId('equipo').getByRole('listitem')).toHaveCount(2);
      await capturar(page, testInfo, `equipo-${colorScheme}`);
      await sinViolacionesGraves(page);

      await pestanas(page).filter({ hasText: 'Portal paciente' }).click();
      await page.getByRole('button', { name: 'Generar código' }).click();
      const dialogo = page.getByRole('alertdialog');
      await expect(dialogo).toBeVisible();
      // The click leaves the pointer over "Copiar código"; capture the resting state.
      await page.mouse.move(0, 0);
      await capturarEn(REPORTE_DIR, page, testInfo, `codigo-${colorScheme}`, false, [
        dialogo.locator('.font-mono'),
        dialogo.getByText(/^Vence el/),
      ]);
      await sinViolacionesGraves(page);
    });

    test('analista: inicio with the case widgets', async ({ page }, testInfo) => {
      await ingresar(page, 'analista.arla');
      await cargarDiferidos(page);
      await expect(page.getByTestId('casos-recientes').getByRole('link')).toHaveCount(5);
      await expect(page.getByTestId('casos-por-estado')).toContainText('5');
      await capturar(page, testInfo, `inicio-${colorScheme}`);
      await sinViolacionesGraves(page);
    });
  });
}
