import { expect, type Locator, type Page, test, type TestInfo } from './fixtures';
import {
  capturar as capturarEn,
  cargarDiferidos,
  esEscritorio,
  ingresar,
  sinViolacionesGraves,
  soloBackoffice,
} from './backoffice';

// M9 (plan §7.2, §7.9–§7.11): the privacy officer's audit log, emergency-access reviews and
// clinical-record copy requests, as privacidad.arla against the local Podman Keycloak and the
// mock API (state in memory until a reload). Baselines in `e2e/privacidad.spec.ts-snapshots/`
// (relative dates, countdowns and the default date range masked), report copies in
// docs/reportes/m9/.
const REPORTE_DIR = 'docs/reportes/m9';
const USUARIO = 'privacidad.arla';
const CASO_NO_ASIGNADO = '0199a000-0000-7000-8000-00000000a004';
const SUB_CALIFICADOR = '01999000-0000-7000-8000-000000000a02';

soloBackoffice();

const volatiles = (page: Page): Locator[] => [
  page.locator('time'),
  page.locator('#filtro-desde'),
  page.locator('#filtro-hasta'),
  page.locator('header p[aria-live]'),
];
const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa, volatiles(page));

/** Audit rows: cards on mobile, table rows on desktop. */
const filas = (page: Page, testInfo: TestInfo) =>
  esEscritorio(testInfo)
    ? page.locator('table tbody tr')
    : page.getByTestId('accesos-movil').getByRole('listitem');

async function abrirFiltros(page: Page, testInfo: TestInfo) {
  if (!esEscritorio(testInfo)) await page.getByRole('button', { name: /^Filtros/ }).click();
}

async function elegir(page: Page, campo: string, opcion: string) {
  await page.locator(campo).click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
}

const vencimientos = (page: Page) => page.getByTestId('vencimiento-revision');
const revisiones = (page: Page) => page.getByTestId('revisiones').getByRole('article');
const solicitudes = (page: Page) => page.getByTestId('solicitudes').getByRole('article');
const pestanaSolicitudes = (page: Page, nombre: string) =>
  page.getByRole('navigation', { name: 'Estado de las solicitudes' }).getByRole('link', {
    name: new RegExp(`^${nombre}`),
  });

test.describe('privacidad.arla (plan §7.9–§7.11)', () => {
  test('audit log: filters and pages in the URL, the detail drawer, no export', async ({
    page,
  }, testInfo) => {
    await ingresar(page, USUARIO, '/auditoria/accesos');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Auditoría de accesos' }),
    ).toBeVisible();
    await expect(filas(page, testInfo)).toHaveCount(50);
    // Gap G8: auditoria:export has no endpoint.
    await expect(page.getByRole('button', { name: /Export/i })).toHaveCount(0);

    await abrirFiltros(page, testInfo);
    await elegir(page, '#filtro-resultado', 'Denegado');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).toHaveURL(/[?&]resultado=DENEGADO/);
    await expect(filas(page, testInfo).first()).toContainText('Denegado');
    const resultados = await filas(page, testInfo).locator('halsa-estado-badge').allTextContents();
    expect(new Set(resultados.map((r) => r.trim()))).toEqual(new Set(['Denegado']));

    // "Atrás" restores the unfiltered log; the second page comes from the server.
    await page.goBack();
    await expect(page).not.toHaveURL(/resultado/);
    await expect(filas(page, testInfo)).toHaveCount(50);
    await page.getByRole('link', { name: 'Página 2' }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(filas(page, testInfo).first()).toBeVisible();
    expect(await filas(page, testInfo).count()).toBeLessThan(50);

    await abrirFiltros(page, testInfo);
    await page.getByLabel('Caso (identificador)').fill('no-es-un-uuid');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByText('El identificador del caso tiene el formato')).toBeVisible();
    await page.getByLabel('Caso (identificador)').fill(CASO_NO_ASIGNADO);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page).toHaveURL(new RegExp(`casoId=${CASO_NO_ASIGNADO}`));
    await expect(page).not.toHaveURL(/page=/);
    await expect(filas(page, testInfo)).toHaveCount(3);
    await expect(filas(page, testInfo).filter({ hasText: /mergencia/ })).toHaveCount(3);

    await page
      .getByRole('button', { name: /^Ver detalle del acceso/ })
      .first()
      .click();
    const hoja = page.getByRole('dialog');
    await expect(hoja.getByRole('heading', { name: 'Detalle del acceso' })).toBeVisible();
    await expect(hoja).toContainText('Paciente en urgencias con sincope, se requiere antecedente');
    for (const campo of ['actor', 'identificador de correlación', 'IP', 'user agent']) {
      await expect(
        hoja.getByRole('button', { name: `Copiar ${campo}`, exact: true }),
      ).toBeVisible();
    }
    await hoja.locator('hlm-sheet-footer').getByRole('button', { name: 'Cerrar' }).click();
    await expect(hoja).toHaveCount(0);
  });

  test('emergency reviews: soonest deadline first, close one, then Cerradas', async ({ page }) => {
    await ingresar(page, USUARIO, '/auditoria/revisiones-emergencia');
    await expect(revisiones(page)).toHaveCount(3);
    await expect(vencimientos(page).first()).toHaveText('Vencida hace 8 h');
    await expect(revisiones(page).first()).toContainText('Valoracion urgente por trauma');

    await page
      .getByRole('button', { name: `Cerrar revisión del acceso de ${SUB_CALIFICADOR}` })
      .first()
      .click();
    const hoja = page.getByRole('dialog');
    await expect(hoja.getByRole('heading', { name: 'Cerrar revisión' })).toBeVisible();
    await hoja.getByRole('button', { name: 'Cerrar revisión' }).click();
    await expect(hoja.getByText('Elige la conclusión de la revisión.')).toBeVisible();
    await hoja.getByRole('radio', { name: /^Injustificado/ }).check();
    await hoja
      .getByLabel('Observaciones (opcional)')
      .fill('El turno no registró la urgencia; se remite al comité de ética.');
    await hoja.getByRole('button', { name: 'Cerrar revisión' }).click();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByText('Revisión cerrada')).toBeVisible();
    await expect(revisiones(page)).toHaveCount(2);
    await expect(vencimientos(page).first()).not.toHaveText(/^Vencida/);

    await page.getByRole('link', { name: /^Cerradas/ }).click();
    await expect(page).toHaveURL(/[?&]estado=cerradas/);
    await expect(revisiones(page)).toHaveCount(2);
    await expect(revisiones(page).first()).toContainText('Injustificado');
    await expect(revisiones(page).first()).toContainText('comité de ética');
  });

  test('copy requests: take one, then close it as delivered', async ({ page }) => {
    await ingresar(page, USUARIO, '/solicitudes-copia-hc');
    await expect(pestanaSolicitudes(page, 'Recibidas')).toHaveText(/Recibidas\s*2/);
    await expect(solicitudes(page)).toHaveCount(2);
    // The officer has no casos:read: no links into the case.
    await expect(page.locator('main a[href*="/casos/"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Pasar a trámite: 2026-ARLA-000102' }).click();
    await expect(page.getByText('Solicitud en trámite')).toBeVisible();
    await expect(pestanaSolicitudes(page, 'En trámite')).toHaveText(/En trámite\s*2/);

    await pestanaSolicitudes(page, 'En trámite').click();
    await expect(page).toHaveURL(/[?&]estado=en-tramite/);
    await page.getByRole('button', { name: 'Cerrar solicitud: 2026-ARLA-000102' }).click();
    const hoja = page.getByRole('dialog');
    await hoja.getByRole('radio', { name: /^Entregada/ }).check();
    await hoja.getByLabel('Nota', { exact: true }).fill('Corto');
    await hoja.getByRole('button', { name: 'Cerrar solicitud' }).click();
    await expect(hoja.getByText('Escribe al menos 10 caracteres.')).toBeVisible();
    await hoja
      .getByLabel('Nota', { exact: true })
      .fill('Copia enviada a paciente@example.com con firma digital.');
    await hoja.getByRole('button', { name: 'Cerrar solicitud' }).click();
    await expect(hoja).toHaveCount(0);
    await expect(page.getByText('Solicitud cerrada como entregada')).toBeVisible();
    await expect(pestanaSolicitudes(page, 'Cerradas')).toHaveText(/Cerradas\s*3/);

    await pestanaSolicitudes(page, 'Cerradas').click();
    await expect(solicitudes(page).first()).toContainText('Copia enviada a paciente@example.com');
  });

  test('inicio: the queues first, linked to their screens', async ({ page }) => {
    await ingresar(page, USUARIO);
    await cargarDiferidos(page);
    const widget = page.getByTestId('revisiones-pendientes');
    await expect(widget).toContainText('3');
    await expect(widget.getByTestId('vencimiento-revision').first()).toHaveText('Vencida hace 8 h');
    await expect(page.getByTestId('solicitudes-abiertas')).toContainText('Recibidas');
    await page
      .getByTestId('solicitudes-abiertas')
      .getByRole('link', { name: /En trámite/ })
      .click();
    await expect(page).toHaveURL(/\/solicitudes-copia-hc\?estado=en-tramite/);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`privacidad visuals · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('audit log and its detail drawer', async ({ page }, testInfo) => {
      await ingresar(page, USUARIO, `/auditoria/accesos?casoId=${CASO_NO_ASIGNADO}`);
      await expect(filas(page, testInfo)).toHaveCount(3);
      await capturar(page, testInfo, `accesos-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page
        .getByRole('button', { name: /^Ver detalle del acceso/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toContainText('Motivo registrado');
      await page.mouse.move(0, 0);
      await capturar(page, testInfo, `detalle-${colorScheme}`, false);
      await sinViolacionesGraves(page);
    });

    test('the full audit log page with filters', async ({ page }, testInfo) => {
      test.skip(!esEscritorio(testInfo), 'the mobile list is the same cards as above');
      await ingresar(page, USUARIO, '/auditoria/accesos');
      await expect(filas(page, testInfo)).toHaveCount(50);
      await capturar(page, testInfo, `accesos-completo-${colorScheme}`, false);
    });

    test('emergency reviews and the closing sheet', async ({ page }, testInfo) => {
      await ingresar(page, USUARIO, '/auditoria/revisiones-emergencia');
      await expect(revisiones(page)).toHaveCount(3);
      await capturar(page, testInfo, `revisiones-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page
        .getByRole('button', { name: `Cerrar revisión del acceso de ${SUB_CALIFICADOR}` })
        .first()
        .click();
      const hoja = page.getByRole('dialog');
      await hoja.getByRole('radio', { name: /^Justificado/ }).check();
      await page.mouse.move(0, 0);
      await capturar(page, testInfo, `cerrar-revision-${colorScheme}`, false);
      await sinViolacionesGraves(page);
    });

    test('copy requests and the closing sheet', async ({ page }, testInfo) => {
      await ingresar(page, USUARIO, '/solicitudes-copia-hc');
      await expect(solicitudes(page)).toHaveCount(2);
      await capturar(page, testInfo, `solicitudes-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Cerrar solicitud: 2026-ARLA-000104' }).click();
      const hoja = page.getByRole('dialog');
      await hoja.getByRole('radio', { name: /^Rechazada/ }).check();
      await page.mouse.move(0, 0);
      await capturar(page, testInfo, `cerrar-solicitud-${colorScheme}`, false);
      await sinViolacionesGraves(page);

      await page.keyboard.press('Escape');
      await pestanaSolicitudes(page, 'Cerradas').click();
      await expect(solicitudes(page)).toHaveCount(2);
      await capturar(page, testInfo, `solicitudes-cerradas-${colorScheme}`);
      await sinViolacionesGraves(page);
    });

    test('inicio with the privacy widgets', async ({ page }, testInfo) => {
      await ingresar(page, USUARIO);
      await cargarDiferidos(page);
      await expect(page.getByTestId('revisiones-pendientes')).toContainText('por revisar');
      await expect(page.getByTestId('solicitudes-abiertas')).toContainText('En trámite');
      await capturar(page, testInfo, `inicio-${colorScheme}`);
      await sinViolacionesGraves(page);
    });
  });
}
