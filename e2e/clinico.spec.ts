import { type BrowserContext, expect, type Page, test, type TestInfo } from './fixtures';
import {
  capturar as capturarEn,
  esEscritorio,
  ingresar,
  sinViolacionesGraves,
  soloBackoffice,
  verificarEnPopup,
} from './backoffice';

// M6 (plan §5.1.4, §5.1.5, §7.5): historia clínica against the local Podman Keycloak (real OTP
// step-up) and the mock API, which enforces acr=2, the assignment (ABAC) and break-the-glass.
// The mock lives in memory until a reload, so each flow navigates inside the app after login.
// Baselines in `e2e/clinico.spec.ts-snapshots/` (dates masked), report copies in docs/reportes/m6/.
const REPORTE_DIR = 'docs/reportes/m6';

const CALIFICADOR = { username: 'calificador.arla', otp: 'NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR' };
const MEDICO_IPS = { username: 'medico.ips', otp: 'NBQWY43BMRSXM3LFMRUWG33JOBZTAMBR' };
const CASO = {
  validado: '0199a000-0000-7000-8000-00000000a002',
  noAsignado: '0199a000-0000-7000-8000-00000000a004',
};
/** Text of a fixture record (projects/backoffice/src/mocks/fixtures.ts), to look for leaks. */
const TEXTO_CLINICO = 'Trauma en mano derecha con prensa hidráulica.';

soloBackoffice();
// Each step-up may wait for a fresh 30 s TOTP window while another worker uses the same user.
test.describe.configure({ timeout: 120_000 });

const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa, [page.locator('time')]);

/** Opens the clinical history behind the gate: the panel first, then the OTP popup. */
async function abrirHistoria(
  page: Page,
  context: BrowserContext,
  usuario: { username: string; otp: string },
  casoId: string,
) {
  await ingresar(page, usuario.username, `/casos/${casoId}/historia-clinica`);
  await expect(page.getByRole('heading', { name: 'Información clínica reservada' })).toBeVisible();
  await verificarEnPopup(
    context,
    page,
    () => page.getByRole('button', { name: 'Verificar identidad' }).click(),
    usuario,
  );
}

const registros = (page: Page) => page.getByTestId('registros').getByRole('listitem');

/** Every value in web storage and every IndexedDB name, as one string. */
async function almacenamiento(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const volcar = (s: Storage) =>
      Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i)!)}`).join('\n');
    const bases = (await indexedDB.databases?.()) ?? [];
    return [
      volcar(localStorage),
      volcar(sessionStorage),
      ...bases.map((b) => `idb:${b.name}`),
    ].join('\n');
  });
}

test.describe('calificador.arla (plan §11)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(({}, testInfo) => {
    // Real OTP codes: one project is enough (the other runs medico.ips in the visuals).
    test.skip(!esEscritorio(testInfo), 'desktop only');
  });

  test('step-up → list → correction → new concepto, and nothing clinical is stored', async ({
    page,
    context,
  }) => {
    await abrirHistoria(page, context, CALIFICADOR, CASO.validado);
    await expect(page.getByText('Res. 1995/1999 · Cada consulta queda auditada')).toBeVisible();

    // Newest first; the record superseded by a correction is hidden until asked for.
    await expect(registros(page)).toHaveCount(2);
    await page.getByLabel('Mostrar versiones corregidas').click();
    await expect(registros(page)).toHaveCount(3);
    await expect(registros(page).filter({ hasText: 'Corregido' })).toHaveCount(1);

    // Detail of the initial report, then correct it.
    await page.getByRole('link', { name: 'Reporte inicial' }).click();
    await expect(page.getByText(TEXTO_CLINICO)).toBeVisible();
    await expect(page.getByText('CIE-10 S62.6')).toBeVisible();
    await expect(page.getByText('Conservar hasta 1 de agosto de 2046')).toBeVisible();
    await page.getByRole('link', { name: 'Corregir' }).click();
    await expect(page.getByTestId('aviso-correccion')).toBeVisible();
    await expect(page.getByLabel('Motivo', { exact: true })).toHaveValue(TEXTO_CLINICO);
    await page
      .getByLabel('Plan', { exact: true })
      .fill('Inmovilización, control por ortopedia en 8 días.');
    await page.getByRole('button', { name: 'Guardar corrección' }).click();
    await expect(page.getByText('Este registro es una corrección.')).toBeVisible();
    await page.getByRole('link', { name: 'Ver el registro original' }).click();
    await expect(page.getByTestId('aviso-corregido')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Corregir' })).toHaveCount(0);

    // A new concepto: the diagnosis code is validated before the request.
    await page.getByRole('link', { name: 'Historia clínica' }).first().click();
    await page.getByRole('link', { name: 'Nuevo registro' }).click();
    await page.getByText('Concepto de rehabilitación').click();
    await page.getByLabel('Análisis').fill('Requiere programa de rehabilitación funcional.');
    await page.getByRole('button', { name: 'Agregar diagnóstico' }).click();
    await page.getByLabel(/Código CIE-10/).fill('s62');
    await expect(page.getByLabel(/Código CIE-10/)).toHaveValue('S62');
    await page.getByLabel(/Código CIE-10/).fill('S6');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.getByText('Formato CIE-10: una letra y dos dígitos')).toBeVisible();
    await page.getByLabel(/Código CIE-10/).fill('S62.6');
    await page.getByRole('button', { name: 'Guardar registro' }).click();
    await expect(page.getByRole('heading', { name: 'Concepto de rehabilitación' })).toBeVisible();
    await expect(page.getByText('Requiere programa de rehabilitación funcional.')).toBeVisible();

    // Leave the clinical view: the data is gone from memory views and never reached storage.
    await page.getByRole('link', { name: 'Resumen' }).click();
    await expect(page.getByText(TEXTO_CLINICO)).toHaveCount(0);
    const guardado = await almacenamiento(page);
    for (const texto of [TEXTO_CLINICO, 'rehabilitación funcional', 'S62.6', 'Inmovilización']) {
      expect(guardado).not.toContain(texto);
    }
    expect(guardado).not.toMatch(/^idb:/m);
  });

  test('not assigned → emergency access with an ASCII motivo, cleared on leave', async ({
    page,
    context,
  }) => {
    await abrirHistoria(page, context, CALIFICADOR, CASO.noAsignado);
    await expect(
      page.getByRole('heading', { name: 'No estás asignado a este caso' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Acceso de emergencia' }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('revisión obligatoria en 72 horas');
    await dialogo
      .getByLabel('Motivo del acceso')
      .fill('Urgencia: paciente inconsciente en atención');
    await expect(dialogo).toContainText(
      'Se registrará como: Urgencia: paciente inconsciente en atencion',
    );
    const acceder = dialogo.getByRole('button', { name: 'Acceder y registrar motivo' });
    await expect(acceder).toBeDisabled();
    await dialogo.getByLabel('Confirmo que es una urgencia clínica').click();
    await acceder.click();

    await expect(page.getByTestId('emergencia-activa')).toContainText(
      'Acceso de emergencia activo — motivo registrado',
    );
    await expect(page.getByText('Aún no hay registros clínicos')).toBeVisible();
    // Writes never use emergency access.
    await expect(page.getByRole('link', { name: 'Nuevo registro' })).toHaveCount(0);

    // Leaving the case view drops the motivo: back in, the panel asks again.
    await page.getByRole('link', { name: 'Resumen' }).click();
    await page
      .getByRole('navigation', { name: 'Secciones del caso' })
      .getByRole('link', { name: /Historia clínica/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'No estás asignado a este caso' }),
    ).toBeVisible();
    await expect(page.getByTestId('emergencia-activa')).toHaveCount(0);
    expect(await almacenamiento(page)).not.toContain('inconsciente');
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`clinico visuals · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('gate, list, detail and the new-record form', async ({ page, context }, testInfo) => {
      // One OTP user per project, so codes don't collide (calificador on desktop).
      const usuario = esEscritorio(testInfo) ? CALIFICADOR : MEDICO_IPS;
      await ingresar(page, usuario.username, `/casos/${CASO.validado}/historia-clinica`);
      await expect(
        page.getByRole('heading', { name: 'Información clínica reservada' }),
      ).toBeVisible();
      await capturar(page, testInfo, `compuerta-${colorScheme}`);
      await sinViolacionesGraves(page);

      await verificarEnPopup(
        context,
        page,
        () => page.getByRole('button', { name: 'Verificar identidad' }).click(),
        usuario,
      );
      await expect(registros(page)).toHaveCount(2);
      await capturar(page, testInfo, `historia-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.getByRole('link', { name: 'Reporte inicial' }).click();
      await expect(page.getByText(TEXTO_CLINICO)).toBeVisible();
      await capturar(page, testInfo, `registro-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.getByRole('link', { name: 'Historia clínica' }).first().click();
      await page.getByRole('link', { name: 'Nuevo registro' }).click();
      await page.getByRole('button', { name: 'Agregar diagnóstico' }).click();
      await page.getByRole('button', { name: 'Guardar registro' }).click();
      await expect(page.getByText('Escribe al menos uno: motivo, anamnesis')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      // The care time defaults to now: mask it with the dates.
      await capturarEn(REPORTE_DIR, page, testInfo, `nuevo-${colorScheme}`, true, [
        page.locator('time'),
        page.locator('#registro-atendido'),
      ]);
      await sinViolacionesGraves(page);
    });
  });
}
