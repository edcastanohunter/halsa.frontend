import { type BrowserContext, expect, type Page, test, type TestInfo } from './fixtures';
import {
  capturar as capturarEn,
  esEscritorio,
  ingresar,
  sinViolacionesGraves,
  soloBackoffice,
  verificarEnPopup,
} from './backoffice';

// M7 (plan §7.6, §5.3.7, §5.3.8): incapacidades against the local Podman Keycloak (real OTP
// step-up) and the mock API, which enforces acr=2, the Idempotency-Key, the multipart parts and
// the %PDF- signature. Baselines in `e2e/incapacidades.spec.ts-snapshots/` (dates masked), report
// copies in docs/reportes/m7/.
const REPORTE_DIR = 'docs/reportes/m7';

const CALIFICADOR = { username: 'calificador.arla', otp: 'NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR' };
const MEDICO_IPS = { username: 'medico.ips', otp: 'NBQWY43BMRSXM3LFMRUWG33JOBZTAMBR' };
/** Remitted to the dev IPS, medico.ips assigned; an initial incapacidad and one prórroga. */
const CASO_VALIDADO = '0199a000-0000-7000-8000-00000000a002';

const PDF = {
  name: 'certificado.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n% Certificado de prueba\n%%EOF\n'),
};
/** Named and typed as a PDF, but without the signature: only the bytes give it away. */
const NO_PDF = {
  name: 'certificado.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('MZ\x90\x00 esto no es un PDF'),
};

soloBackoffice();
// Each step-up may wait for a fresh 30 s TOTP window while another worker uses the same user.
test.describe.configure({ timeout: 120_000 });

const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa, [page.locator('time')]);

const filas = (page: Page) => page.getByTestId('incapacidad');

/** The upload form behind the gate: the panel first, then the OTP popup. */
async function abrirCarga(
  page: Page,
  context: BrowserContext,
  usuario: { username: string; otp: string },
) {
  await ingresar(page, usuario.username, `/casos/${CASO_VALIDADO}/incapacidades`);
  await expect(filas(page)).toHaveCount(2);
  await page.getByRole('link', { name: 'Cargar incapacidad' }).click();
  await expect(page.getByRole('heading', { name: 'Información clínica reservada' })).toBeVisible();
  await verificarEnPopup(
    context,
    page,
    () => page.getByRole('button', { name: 'Verificar identidad' }).click(),
    usuario,
  );
  await expect(page.getByLabel('Número del certificado')).toBeVisible();
}

/** A prórroga of the last certificate (ends 2026-09-29), 10 days from 2026-09-30. */
async function llenarCertificado(page: Page) {
  await page.getByLabel('Número del certificado').fill('CERT-IPS-2026-0042');
  await page.getByText('Prórroga', { exact: true }).click();
  await expect(page.getByTestId('prorroga-de').getByRole('radio')).toHaveCount(1);
  await expect(page.getByTestId('prorroga-de').getByRole('radio')).toBeChecked();
  await page.getByLabel('Fecha de inicio').fill('2026-09-30');
  await page.getByLabel('Días', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Un día más' }).click();
  await expect(page.getByTestId('termina-el')).toHaveText('Termina el 9 oct 2026');
}

async function llenarDiagnostico(page: Page) {
  await page.getByLabel(/Código CIE-10/).fill('s62.6');
  await expect(page.getByLabel(/Código CIE-10/)).toHaveValue('S62.6');
}

test.describe('medico.ips (plan §11)', () => {
  test.beforeEach(({}, testInfo) => {
    // Real OTP codes: the flow runs on desktop; mobile walks the stepper in the visuals.
    test.skip(!esEscritorio(testInfo), 'desktop only');
  });

  test('uploads a prórroga with a PDF, rejects a non-PDF, downloads the soporte', async ({
    page,
    context,
  }) => {
    await abrirCarga(page, context, MEDICO_IPS);

    // IPS actors sign as their own IPS.
    await expect(page.getByLabel('Código REPS')).toHaveValue('110011234501');
    await llenarCertificado(page);
    await llenarDiagnostico(page);

    // A renamed file is caught by its first bytes, before any request.
    const soporte = page.getByTestId('soporte').locator('input[type="file"]');
    await soporte.setInputFiles(NO_PDF);
    await expect(page.getByText('El archivo no es un PDF válido.')).toBeVisible();
    await page.getByRole('button', { name: 'Cargar incapacidad' }).click();
    await expect(page.getByText('Adjunta el PDF del certificado.')).toBeVisible();

    await soporte.setInputFiles(PDF);
    await expect(page.getByText('certificado.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Cargar incapacidad' }).click();

    const resultado = page.getByRole('dialog');
    await expect(resultado).toContainText('Incapacidad cargada');
    await expect(resultado).toContainText('El caso acumula 70 días de incapacidad.');
    await resultado.getByRole('button', { name: 'Volver a incapacidades' }).click();

    await expect(page).toHaveURL(new RegExp(`/casos/${CASO_VALIDADO}/incapacidades$`));
    await expect(filas(page)).toHaveCount(3);
    await expect(filas(page).nth(2)).toHaveAttribute('data-tipo', 'PRORROGA');
    await expect(page.getByTestId('acumulado')).toContainText('70 días acumulados');

    // The soporte (clinical): already verified, so the download starts right away.
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      filas(page)
        .first()
        .getByRole('button', { name: /Descargar soporte/ })
        .click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^incapacidad-[0-9a-f]{4}\.pdf$/);
  });
});

test.describe('analista.arla', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!esEscritorio(testInfo), 'desktop only');
  });

  test('reads the list, but neither uploads nor downloads', async ({ page }) => {
    await ingresar(page, 'analista.arla', `/casos/${CASO_VALIDADO}/incapacidades`);
    await expect(filas(page)).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Cargar incapacidad' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Descargar soporte/ })).toHaveCount(0);

    await page.goto(`/casos/${CASO_VALIDADO}/incapacidades/nueva`);
    await expect(page.getByText('No puedes cargar incapacidades')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/casos/${CASO_VALIDADO}/incapacidades$`));
  });
});

test.describe('incapacidades visuals', () => {
  test.use({ reducedMotion: 'reduce' });

  /**
   * Each screen in light and dark from one test: the form sits behind a real OTP step-up, and
   * only two dev users have OTP, so a test per scheme would queue too many 30 s TOTP windows.
   */
  async function capturarAmbos(page: Page, testInfo: TestInfo, nombre: string, completa = true) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await capturar(page, testInfo, `${nombre}-${colorScheme}`, completa);
      await sinViolacionesGraves(page);
    }
    await page.emulateMedia({ colorScheme: 'light' });
  }

  test('list, gate, form and the result', async ({ page, context }, testInfo) => {
    // One OTP user per project, so codes don't collide (calificador on desktop).
    const escritorio = esEscritorio(testInfo);
    const usuario = escritorio ? CALIFICADOR : MEDICO_IPS;
    await ingresar(page, usuario.username, `/casos/${CASO_VALIDADO}/incapacidades`);
    await expect(filas(page)).toHaveCount(2);
    await capturarAmbos(page, testInfo, 'lista');

    await page.getByRole('link', { name: 'Cargar incapacidad' }).click();
    await expect(
      page.getByRole('heading', { name: 'Información clínica reservada' }),
    ).toBeVisible();
    await verificarEnPopup(
      context,
      page,
      () => page.getByRole('button', { name: 'Verificar identidad' }).click(),
      usuario,
    );

    if (escritorio) {
      await page.getByLabel('Código REPS').fill('110011234501');
      await llenarCertificado(page);
      await llenarDiagnostico(page);
      await page.getByTestId('soporte').locator('input[type="file"]').setInputFiles(PDF);
      await expect(page.getByText('certificado.pdf')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.mouse.move(0, 0);
      await capturarAmbos(page, testInfo, 'nueva');
    } else {
      // The stepper: a step at a time, each validated before moving on.
      await expect(page.getByText('Paso 1 de 5 · Certificado')).toBeVisible();
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(page.getByText('Escribe el número del certificado.')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
      // The sticky actions stay under the pointer after the click: measure them without hover.
      await page.mouse.move(0, 0);
      await capturarAmbos(page, testInfo, 'nueva');

      await llenarCertificado(page);
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(page.getByText('Paso 2 de 5 · Diagnóstico')).toBeVisible();
      await llenarDiagnostico(page);
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(page.getByText('Paso 3 de 5 · IPS emisora')).toBeVisible();
      await expect(page.getByLabel('Código REPS')).toHaveValue('110011234501');
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.getByTestId('soporte').locator('input[type="file"]').setInputFiles(PDF);
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(page.getByTestId('revision')).toContainText('CERT-IPS-2026-0042');
      await page.mouse.move(0, 0);
      await capturarAmbos(page, testInfo, 'revision');
    }

    await page.getByRole('button', { name: 'Cargar incapacidad' }).click();
    await expect(page.getByRole('dialog')).toContainText('Incapacidad cargada');
    await capturarAmbos(page, testInfo, 'resultado', false);
  });
});
