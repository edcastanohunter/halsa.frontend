import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test, type TestInfo } from '@playwright/test';
import { generate } from 'otplib';

// M3 (plan §6.3, §5.1): backoffice identity and shell against the local Podman Keycloak
// (`npm run kc:up`) with the mock API (`ng serve backoffice --configuration mock`, started by
// playwright.config.ts). Real login, real OTP step-up, real tokens; the mock reads their claims.
// Visual baselines in `e2e/identidad.spec.ts-snapshots/`, report copies in `docs/reportes/m3/`.
const REPORTE_DIR = 'docs/reportes/m3';
const KEYCLOAK = 'http://localhost:8180/realms/halsa';

const USUARIOS = {
  analista: { username: 'analista.arla', sub: '01999000-0000-7000-8000-000000000a01' },
  calificador: { username: 'calificador.arla', otp: 'NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR' },
  privacidad: { username: 'privacidad.arla' },
  medicoIps: { username: 'medico.ips', otp: 'NBQWY43BMRSXM3LFMRUWG33JOBZTAMBR' },
  coordinadorIps: { username: 'coordinador.ips' },
} as const;

// Plan §6.3, top table: [bottom bar, "Más" sheet]; the sidebar shows both in that order.
const MATRIZ: Record<keyof typeof USUARIOS, { barra: string[]; mas: string[]; chip: string }> = {
  analista: { barra: ['Inicio', 'Casos', 'Plazos'], mas: ['Cuenta'], chip: 'ARL_A' },
  calificador: { barra: ['Inicio', 'Casos', 'Plazos'], mas: ['Cuenta'], chip: 'ARL_A' },
  privacidad: {
    barra: ['Inicio', 'Revisiones de emergencia', 'Solicitudes HC', 'Auditoría'],
    mas: ['Cuenta'],
    chip: 'ARL_A',
  },
  medicoIps: { barra: ['Inicio', 'Casos'], mas: ['Cuenta'], chip: 'IPS 110011234501' },
  coordinadorIps: { barra: ['Inicio', 'Casos'], mas: ['Cuenta'], chip: 'IPS 110011234501' },
};

const esEscritorio = (testInfo: TestInfo) => testInfo.project.name.endsWith('desktop');

test.beforeEach(({}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('backoffice'), 'backoffice only');
});

/** Keycloak password login from a protected URL; returns once the app shows the shell. */
async function ingresar(page: Page, username: string, destino = '/inicio') {
  await page.goto(destino);
  await page.waitForURL((url) => url.href.startsWith(`${KEYCLOAK}/protocol/openid-connect/auth`));
  await page.locator('#username').fill(username);
  await page.locator('#password').fill('dev');
  await page.locator('#kc-login').click();
  await page.waitForURL(
    (url) => url.origin === 'http://localhost:3000' && !url.pathname.startsWith('/auth'),
  );
  await expect(page.locator('main#contenido')).toBeVisible();
}

// Keycloak rejects a TOTP code that was already used, so each secret gets a fresh 30 s window.
const ultimaVentana = new Map<string, number>();
async function codigoOtp(secreto: string): Promise<string> {
  let ventana = Math.floor(Date.now() / 30_000);
  if (ultimaVentana.get(secreto) === ventana) {
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 250));
    ventana = Math.floor(Date.now() / 30_000);
  }
  ultimaVentana.set(secreto, ventana);
  return generate({ secret: secreto });
}

/** Completes the OTP page in the step-up popup the click opens. */
// The backend's `browser-loa` flow has no Cookie step, so the step-up asks for the password again
// before the OTP (gap reported in the M3 report).
async function verificarEnPopup(
  context: BrowserContext,
  page: Page,
  clic: () => Promise<void>,
  usuario: { username: string; otp: string },
) {
  const [popup] = await Promise.all([context.waitForEvent('page'), clic()]);
  await popup.waitForURL((url) => url.href.startsWith(KEYCLOAK));
  await popup.locator('#username').fill(usuario.username);
  await popup.locator('#password').fill('dev');
  await popup.locator('#kc-login').click();
  await popup.locator('#otp').fill(await codigoOtp(usuario.otp));
  await Promise.all([
    popup.waitForEvent('close'),
    popup.getByRole('button', { name: 'Verificar' }).click(),
  ]);
  await page.bringToFront();
}

/** Full page on desktop; the viewport on mobile, where the fixed bottom bar would float mid-page. */
async function capturar(page: Page, testInfo: TestInfo, nombre: string, completa = true) {
  const fullPage = completa && esEscritorio(testInfo);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${nombre}.png`, { fullPage });
  const ancho = esEscritorio(testInfo) ? 1440 : 375;
  await page.screenshot({
    path: `${REPORTE_DIR}/${nombre}-${ancho}.jpg`,
    fullPage,
    type: 'jpeg',
    quality: 80,
    animations: 'disabled',
  });
}

async function sinViolacionesGraves(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

/** Accessible names: the bottom bar shows short labels but keeps the full one as aria-label. */
const nombres = (enlaces: ReturnType<Page['getByRole']>) =>
  enlaces.evaluateAll((els) =>
    els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()),
  );

async function navegacionVisible(page: Page, testInfo: TestInfo) {
  const principal = page.getByRole('navigation', { name: 'Principal' });
  const barra = await nombres(principal.getByRole('link'));
  if (esEscritorio(testInfo)) return { barra, mas: [] as string[] };
  await principal.getByRole('button', { name: 'Más' }).click();
  const hoja = page.getByRole('navigation', { name: 'Más opciones' });
  await expect(hoja).toBeVisible();
  return { barra, mas: await nombres(hoja.getByRole('link')) };
}

test.describe('navigation per persona (plan §6.3)', () => {
  for (const persona of Object.keys(MATRIZ) as (keyof typeof USUARIOS)[]) {
    test(`${USUARIOS[persona].username} sees exactly its column`, async ({ page }, testInfo) => {
      await ingresar(page, USUARIOS[persona].username);
      const esperado = MATRIZ[persona];
      await expect(page.getByTestId('contexto')).toContainText(esperado.chip);

      const visible = await navegacionVisible(page, testInfo);
      if (esEscritorio(testInfo)) {
        expect(visible.barra).toEqual([...esperado.barra, ...esperado.mas]);
      } else {
        expect(visible).toEqual({ barra: esperado.barra, mas: esperado.mas });
      }
      // No horizontal page scroll at either width.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
        page.viewportSize()!.width,
      );
    });
  }

  test('a section without permission redirects to /acceso-denegado', async ({ page }) => {
    await ingresar(page, USUARIOS.privacidad.username, '/casos');
    await expect(page).toHaveURL('http://localhost:3000/acceso-denegado');
    await expect(page.getByText('No tienes permiso para ver esta página').first()).toBeVisible();
  });

  test('an unknown URL inside the app is a 404 page', async ({ page }) => {
    await ingresar(page, USUARIOS.analista.username, '/no-existe');
    await expect(page.getByText('Página no encontrada').first()).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`shell visuals · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('analista: inicio, cuenta and the "Más" sheet', async ({ page }, testInfo) => {
      await ingresar(page, USUARIOS.analista.username);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Hola, Analista ARL-A' }),
      ).toBeVisible();
      await capturar(page, testInfo, `inicio-analista-${colorScheme}`);
      await sinViolacionesGraves(page);

      await page.goto('/cuenta');
      await expect(page.getByTestId('sub')).toHaveText(USUARIOS.analista.sub);
      const permisos = page.getByTestId('permisos');
      for (const etiqueta of [
        'Ver casos',
        'Asignar profesionales a casos',
        'Generar códigos de activación del portal',
      ]) {
        await expect(permisos.getByText(etiqueta, { exact: true })).toBeVisible();
      }
      await expect(permisos).not.toContainText('analista-arl');
      await expect(page.getByTestId('verificacion')).toContainText('Verificación con contraseña');
      await capturar(page, testInfo, `cuenta-analista-${colorScheme}`);
      await sinViolacionesGraves(page);

      if (!esEscritorio(testInfo)) {
        await page
          .getByRole('navigation', { name: 'Principal' })
          .getByRole('button', { name: 'Más' })
          .click();
        await expect(page.getByRole('navigation', { name: 'Más opciones' })).toBeVisible();
        await capturar(page, testInfo, `mas-analista-${colorScheme}`, false);
      }
    });

    test('privacidad: inicio with the inbox sections', async ({ page }, testInfo) => {
      await ingresar(page, USUARIOS.privacidad.username);
      await capturar(page, testInfo, `inicio-privacidad-${colorScheme}`);
      await sinViolacionesGraves(page);
    });

    test('the step-up gate before verification', async ({ page }, testInfo) => {
      await ingresar(page, USUARIOS.medicoIps.username, '/_dev/step-up');
      await expect(page.getByRole('button', { name: 'Verificar identidad' })).toHaveCount(2);
      await capturar(page, testInfo, `compuerta-${colorScheme}`);
      await sinViolacionesGraves(page);
    });
  });
}

test.describe('step-up to acr=2 (plan §5.1.4)', () => {
  test.beforeEach(({}, testInfo) => {
    // One run per user: a TOTP code can't be used twice.
    test.skip(!esEscritorio(testInfo), 'desktop only');
  });

  test('calificador.arla: the gate opens after the popup and the draft survives', async ({
    page,
    context,
  }) => {
    await ingresar(page, USUARIOS.calificador.username, '/_dev/step-up');
    await expect(page.getByTestId('nivel')).toHaveText('Nivel actual: acr 1');
    await expect(page.getByTestId('contenido-acr2')).toHaveCount(0);
    await page.getByLabel('Borrador').fill('Fundamentos sin guardar del dictamen');

    await verificarEnPopup(
      context,
      page,
      () => page.getByRole('button', { name: 'Verificar identidad' }).first().click(),
      USUARIOS.calificador,
    );

    await expect(page.getByTestId('nivel')).toHaveText('Nivel actual: acr 2');
    await expect(page.getByTestId('contenido-acr2')).toBeVisible();
    await expect(page.getByTestId('contenido-dictamen')).toBeVisible();
    await expect(page.getByLabel('Borrador')).toHaveValue('Fundamentos sin guardar del dictamen');

    await page.getByRole('link', { name: 'Cuenta' }).first().click();
    await expect(page.getByTestId('verificacion')).toContainText('Verificación reforzada activa');
  });

  test('medico.ips: a step-up 401 opens the dialog and retries the request once', async ({
    page,
    context,
  }) => {
    await ingresar(page, USUARIOS.medicoIps.username, '/_dev/step-up');
    await page.getByRole('button', { name: 'Leer registros clínicos sin compuerta' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByRole('heading', { name: 'Verificación requerida' })).toBeVisible();

    await verificarEnPopup(
      context,
      page,
      () => dialogo.getByRole('button', { name: 'Verificar identidad' }).click(),
      USUARIOS.medicoIps,
    );

    await expect(dialogo).toBeHidden();
    await expect(page.getByTestId('resultado')).toHaveText(/^Respuesta 200: \d+ registros\.$/);
    await expect(page.getByTestId('nivel')).toHaveText('Nivel actual: acr 2');
  });

  test('cancelling the dialog returns the error to the caller', async ({ page }) => {
    await ingresar(page, USUARIOS.calificador.username, '/_dev/step-up');
    await page.getByRole('button', { name: 'Leer registros clínicos sin compuerta' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('resultado')).toHaveText('Error: Verificación requerida');
  });
});

test('logout ends the Keycloak session', async ({ page }, testInfo) => {
  test.skip(!esEscritorio(testInfo), 'desktop only');
  await ingresar(page, USUARIOS.analista.username, '/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).last().click();
  // Back at `/`, the guard sends the anonymous user to the Keycloak login form again.
  await page.waitForURL((url) => url.href.startsWith(`${KEYCLOAK}/protocol/openid-connect/auth`));
  await expect(page.locator('#username')).toBeVisible();
});
