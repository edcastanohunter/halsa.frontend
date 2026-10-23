import { type BrowserContext, expect, type Page, test, type TestInfo } from './fixtures';
import {
  capturar as capturarEn,
  esEscritorio,
  ingresar,
  sinViolacionesGraves,
  soloBackoffice,
  verificarEnPopup,
} from './backoffice';

// M8 (plan §7.7, §5.1.4): the dictamen PCL against the local Podman Keycloak (real OTP step-up)
// and the mock API, which enforces acr=2 and auth_time within 15 minutes. Baselines in
// `e2e/dictamen.spec.ts-snapshots/` (countdown and dates masked), report copies in
// docs/reportes/m8/.
const REPORTE_DIR = 'docs/reportes/m8';

/** The only dev user with `pcl:dictamen:*` (and OTP). */
const CALIFICADOR = { username: 'calificador.arla', otp: 'NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR' };
/** Calificador assigned, no dictamen yet. */
const CASO_VALIDADO = '0199a000-0000-7000-8000-00000000a002';
/** Dictamen PENDIENTE: 23,45 % = 15,45 + 8. */
const CASO_EN_CALIFICACION = '0199a000-0000-7000-8000-00000000a003';

/** Well over the 5 000 characters of the plan's AC (§12, M8). */
const FUNDAMENTOS = (
  'Se califica la pérdida de capacidad laboral conforme al Manual Único de Calificación. ' +
  'La deficiencia por compromiso del nervio mediano se valora según el capítulo 12, con ' +
  'limitación funcional para la pinza fina y la prensión sostenida. '
).repeat(24);

soloBackoffice();
// Every OTP goes to the same user: each step-up may wait for a fresh 30 s TOTP window while
// another worker holds the current one.
test.describe.configure({ timeout: 180_000 });

const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa, [
    page.locator('time'),
    page.getByTestId('vigencia-verificacion'),
  ]);

/** Bogotá wall time `minutos` ago, as a `datetime-local` value. */
function haceMinutosBogota(minutos: number): string {
  return new Date(Date.now() - minutos * 60_000 - 5 * 3_600_000).toISOString().slice(0, 16);
}

/** The dictamen tab behind the 15-minute gate: the panel first, then the OTP popup. */
async function abrirDictamen(page: Page, context: BrowserContext, casoId: string) {
  await ingresar(page, CALIFICADOR.username, `/casos/${casoId}/dictamen-pcl`);
  await expect(page.getByRole('heading', { name: 'Información clínica reservada' })).toBeVisible();
  await verificarEnPopup(
    context,
    page,
    () => page.getByRole('button', { name: 'Verificar identidad' }).click(),
    CALIFICADOR,
  );
  await expect(page.getByTestId('vigencia-verificacion')).toContainText('Verificación vigente por');
}

test.describe('calificador.arla (plan §11)', () => {
  test.beforeEach(({}, testInfo) => {
    // Real OTP codes for one user: the full flow runs on desktop; mobile does the visuals.
    test.skip(!esEscritorio(testInfo), 'desktop only');
  });

  test('registers a dictamen whose long draft survives a popup re-verification, then notifies it', async ({
    page,
    context,
  }) => {
    await abrirDictamen(page, context, CASO_VALIDADO);
    await expect(page.getByText('Aún no hay dictamen registrado')).toBeVisible();
    await page.getByRole('link', { name: 'Registrar dictamen' }).click();

    await page.getByLabel('Porcentaje de PCL').fill('23,45');
    await page.getByRole('radio', { name: /^Laboral/ }).check();
    await page.getByLabel('Fecha de estructuración').fill('2026-09-15');
    await page.getByLabel('Detallar deficiencias y rol laboral (opcional)').check();
    await page.getByRole('textbox', { name: 'Deficiencias' }).fill('15');
    await page.getByLabel('Rol laboral y otras áreas').fill('8');
    await expect(page.getByTestId('suma-componentes')).toContainText(
      'suman 23,00 %, pero el total es 23,45 %',
    );
    await page.getByRole('textbox', { name: 'Deficiencias' }).fill('15,45');
    await expect(page.getByTestId('suma-componentes')).toContainText('Suman 23,45 %');
    await page.getByLabel('Fundamentos').fill(FUNDAMENTOS);
    await page.getByLabel(/Código CIE-10/).fill('g56.0');
    expect(FUNDAMENTOS.length).toBeGreaterThan(5000);

    // Re-verify through the popup with the form full: nothing typed may be lost.
    await verificarEnPopup(
      context,
      page,
      () => page.getByRole('button', { name: 'Renovar verificación' }).click(),
      CALIFICADOR,
    );
    await expect(page.getByLabel('Fundamentos')).toHaveValue(FUNDAMENTOS);
    await expect(page.getByLabel('Porcentaje de PCL')).toHaveValue('23,45');
    await expect(page.getByRole('textbox', { name: 'Deficiencias' })).toHaveValue('15,45');
    await expect(page.getByLabel(/Código CIE-10/)).toHaveValue('G56.0');
    // ...and none of it went to storage (plan §5.1.4).
    const almacenado = await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    );
    expect(almacenado).not.toContain('nervio mediano');

    await page.getByRole('button', { name: 'Registrar dictamen' }).click();
    await expect(page).toHaveURL(new RegExp(`/casos/${CASO_VALIDADO}/dictamen-pcl$`));
    await expect(page.getByTestId('porcentaje')).toHaveText('23,45 %');
    await expect(page.getByTestId('origen')).toHaveText('Origen laboral');
    await expect(page.locator('[aria-current="step"]')).toContainText('Pendiente');
    await expect(page.getByTestId('fundamentos')).toContainText('pinza fina');

    // Notify it: the dispute deadline starts.
    await page.getByRole('button', { name: 'Registrar notificación' }).click();
    const hoja = page.getByRole('dialog');
    await hoja.getByLabel('Fecha y hora de la notificación').fill(haceMinutosBogota(2));
    await hoja.getByRole('radio', { name: /^Personal/ }).check();
    await hoja.getByRole('button', { name: 'Registrar notificación' }).click();
    await expect(hoja).toHaveCount(0);
    await expect(page.locator('[aria-current="step"]')).toContainText('Notificado');
    await expect(page.getByTestId('controversia')).toContainText(
      /Quedan \d+ días para controvertir/,
    );
    await expect(page.getByRole('link', { name: 'Corregir dictamen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar notificación' })).toHaveCount(0);
  });
});

test.describe('analista.arla', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), 'desktop only');
  });

  test('has no dictamen tab, and its URL goes back to the case summary', async ({ page }) => {
    await ingresar(page, 'analista.arla', `/casos/${CASO_EN_CALIFICACION}/resumen`);
    await expect(page.getByRole('link', { name: /Dictamen PCL/ })).toHaveCount(0);

    await page.goto(`/casos/${CASO_EN_CALIFICACION}/dictamen-pcl`);
    await expect(page.getByText('No tienes acceso a esa sección del caso')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/casos/${CASO_EN_CALIFICACION}/resumen$`));
  });
});

test.describe('dictamen visuals', () => {
  test.use({ reducedMotion: 'reduce' });

  /** Light and dark from one test: one OTP step-up per project (see M7's notes). */
  async function capturarAmbos(page: Page, testInfo: TestInfo, nombre: string, completa = true) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await capturar(page, testInfo, `${nombre}-${colorScheme}`, completa);
      await sinViolacionesGraves(page);
    }
    await page.emulateMedia({ colorScheme: 'light' });
  }

  test('gate, view, correction with the live sum, notification sheet', async ({
    page,
    context,
  }, testInfo) => {
    await ingresar(page, CALIFICADOR.username, `/casos/${CASO_EN_CALIFICACION}/dictamen-pcl`);
    await expect(
      page.getByRole('heading', { name: 'Información clínica reservada' }),
    ).toBeVisible();
    await capturarAmbos(page, testInfo, 'compuerta');

    await verificarEnPopup(
      context,
      page,
      () => page.getByRole('button', { name: 'Verificar identidad' }).click(),
      CALIFICADOR,
    );
    await expect(page.getByTestId('porcentaje')).toHaveText('23,45 %');
    await page.mouse.move(0, 0);
    await capturarAmbos(page, testInfo, 'vista');

    await page.getByRole('button', { name: 'Registrar notificación' }).click();
    const hoja = page.getByRole('dialog');
    await expect(hoja.getByRole('heading', { name: 'Registrar notificación' })).toBeVisible();
    await hoja.getByRole('button', { name: 'Registrar notificación' }).click();
    await expect(hoja.getByText('Indica cuándo se notificó.')).toBeVisible();
    await expect(hoja.getByText('Elige el medio de notificación.')).toBeVisible();
    // The pointer stays on the submit button after the click: measure it without hover.
    await page.mouse.move(0, 0);
    await capturarAmbos(page, testInfo, 'notificar', false);
    await hoja.getByRole('button', { name: 'Cancelar' }).click();
    await expect(hoja).toHaveCount(0);

    // Correction: prefilled, and the sum is checked as the user types.
    await page.getByRole('link', { name: 'Corregir dictamen' }).click();
    await expect(page.getByTestId('aviso-correccion')).toBeVisible();
    await expect(page.getByLabel('Porcentaje de PCL')).toHaveValue('23,45');
    await page.getByLabel('Porcentaje de PCL').fill('25');
    await expect(page.getByTestId('suma-componentes')).toContainText(
      'suman 23,45 %, pero el total es 25,00 %',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    await capturarAmbos(page, testInfo, 'corregir');

    await page.getByRole('textbox', { name: 'Deficiencias' }).fill('17');
    await expect(page.getByTestId('suma-componentes')).toContainText('Suman 25,00 %');
    await page.getByRole('button', { name: 'Guardar corrección' }).click();
    await expect(page).toHaveURL(new RegExp(`/casos/${CASO_EN_CALIFICACION}/dictamen-pcl$`));
    await expect(page.getByTestId('porcentaje')).toHaveText('25,00 %');
    await expect(page.getByTestId('aviso-correccion')).toBeVisible();
  });
});
