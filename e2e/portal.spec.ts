import { expect, type Page, test, type TestInfo } from '@playwright/test';
import { capturar as capturarEn, esEscritorio, sinViolacionesGraves } from './backoffice';

// M10 (plan §6.4, §7.12): the patient portal against the mock BFF (gap G3 blocks the real BFF
// login from :4300). The mocked login stores the session in sessionStorage
// (`halsa.mock.sesion`, dev.interceptors.ts) and goes straight to its `returnUrl`; state lives in
// memory until a reload. Baselines in `e2e/portal.spec.ts-snapshots/` with the browser clock
// fixed (the fixtures are relative to today), report copies in docs/reportes/m10/.
const REPORTE_DIR = 'docs/reportes/m10';
const ORIGEN = 'https://localhost:4300';
const CODIGO_VALIDO = 'ABC123-K7Q2M9XD4P';
const CASO_ACTIVO = '0199a000-0000-7000-8000-00000000a002';
const AHORA = new Date('2026-10-20T10:00:00-05:00');

test.beforeEach(({}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('portal'), 'portal only');
});

/** Starts already signed in through the mocked BFF (only if the page hasn't set it yet). */
async function sesion(page: Page, cuenta: 'sin-vinculo' | 'vinculada') {
  await page.addInitScript((c) => {
    if (!sessionStorage.getItem('halsa.mock.sesion'))
      sessionStorage.setItem('halsa.mock.sesion', c);
  }, cuenta);
}

/** Plan §12 M10 AC: no request leaves to an origin other than self. */
function peticionesAjenas(page: Page): string[] {
  const ajenas: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== ORIGEN) {
      ajenas.push(r.url());
    }
  });
  return ajenas;
}

const titulo = (page: Page) => page.getByRole('heading', { level: 1 });
const capturar = (page: Page, testInfo: TestInfo, nombre: string, completa = true) =>
  capturarEn(REPORTE_DIR, page, testInfo, nombre, completa);

test.describe('patient portal (plan §7.12)', () => {
  test('login → activar (invalid, then valid) → inicio → caso → solicitar copia → solicitudes → logout', async ({
    page,
  }) => {
    const ajenas = peticionesAjenas(page);

    await page.goto('/');
    await expect(titulo(page)).toHaveText(
      'Consulta el estado de tu caso de accidente o enfermedad laboral',
    );
    await expect(page.getByText('Nunca mostramos diagnósticos en línea')).toBeVisible();
    await sinViolacionesGraves(page);

    // "Ingresar": a new account lands on /activar first.
    await page.getByRole('main').getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/activar$/);
    await expect(titulo(page)).toHaveText('Vincula tu cuenta');
    await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
    await sinViolacionesGraves(page);

    const codigo = page.getByLabel('Código de activación');
    await codigo.pressSequentially('zzz999 k7q2m9xd4p');
    await expect(codigo).toHaveValue('ZZZ999-K7Q2M9XD4P');
    await codigo.press('Enter');
    await expect(page.getByRole('alert')).toHaveText('El código no es válido o ya fue usado.');

    await codigo.fill(CODIGO_VALIDO.toLowerCase());
    await page.getByRole('button', { name: 'Vincular cuenta' }).click();
    await expect(titulo(page)).toHaveText('Cuenta vinculada');
    await expect(page.getByTestId('documento-vinculado')).toHaveText(
      'Cuenta vinculada al documento CC ******2222',
    );
    await sinViolacionesGraves(page);

    await page.getByRole('link', { name: 'Inicio', exact: true }).click();
    await expect(titulo(page)).toHaveText('Hola, Paciente');
    await expect(page.getByTestId('incapacidad-vigente')).toBeVisible();
    await expect(page.getByTestId('proximos-hitos').getByRole('listitem')).toHaveCount(2);

    await page.getByRole('link', { name: 'Casos', exact: true }).click();
    await expect(titulo(page)).toHaveText('Mis casos');
    await page.getByRole('link', { name: /2026-ARLA-000102/ }).click();
    await expect(page).toHaveURL(new RegExp(`/casos/${CASO_ACTIVO}$`));
    await expect(page.getByTestId('linea-tiempo').getByRole('listitem')).toHaveCount(5);
    await sinViolacionesGraves(page);

    await page.getByRole('link', { name: 'Solicitar copia de mi historia clínica' }).click();
    await expect(titulo(page)).toHaveText('Solicitar copia de tu historia clínica');
    await page.getByText('Correo electrónico', { exact: true }).click();
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue(
      'paciente@example.com',
    );
    await sinViolacionesGraves(page);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page).toHaveURL(/\/solicitudes$/);
    const solicitudes = page.getByTestId('solicitudes').getByRole('article');
    await expect(solicitudes).toHaveCount(2);
    await expect(solicitudes.first().locator('[aria-current="step"]')).toContainText('Recibida');
    await sinViolacionesGraves(page);

    // A second request for the same case while that one is open.
    await page.goBack();
    await page.goBack();
    await page.getByRole('link', { name: 'Solicitar copia de mi historia clínica' }).click();
    await page.getByText('Presencial', { exact: true }).click();
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByTestId('solicitud-ya-abierta')).toContainText(
      'Ya tienes una solicitud abierta para este caso',
    );

    await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(`${ORIGEN}/`);
    await expect(titulo(page)).toHaveText(
      'Consulta el estado de tu caso de accidente o enfermedad laboral',
    );
    // The session is gone: `/` would redirect a signed-in patient to /inicio.
    expect(await page.evaluate(() => sessionStorage.getItem('halsa.mock.sesion'))).toBe('anonima');
    await page.reload();
    await expect(page).toHaveURL(`${ORIGEN}/`);

    expect(ajenas).toEqual([]);
  });

  test('429: the code button waits out Retry-After with a countdown', async ({ page }) => {
    await sesion(page, 'sin-vinculo');
    await page.goto('/activar');
    const codigo = page.getByLabel('Código de activación');
    const vincular = page.getByRole('button', { name: 'Vincular cuenta' });
    for (let i = 0; i < 5; i++) {
      await codigo.fill('ZZZ999-K7Q2M9XD4P');
      await vincular.click();
      await expect(page.getByRole('alert')).toHaveText('El código no es válido o ya fue usado.');
    }
    await codigo.fill(CODIGO_VALIDO);
    await vincular.click();
    await expect(page.getByTestId('espera-vinculo')).toContainText(
      /Demasiados intentos\. Intenta de nuevo en \d+ segundos\./,
    );
    await expect(vincular).toBeDisabled();
    await sinViolacionesGraves(page);
  });

  test('a case not linked to the account is "not available"', async ({ page }) => {
    await sesion(page, 'vinculada');
    await page.goto('/casos/0199a000-0000-7000-8000-00000000ffff');
    await expect(page.getByText('Este caso no está disponible')).toBeVisible();
    await expect(page.getByText('No existe o no está vinculado a tu cuenta.')).toBeVisible();
  });

  test('navigation: bottom tab bar on mobile, top nav on desktop, same five sections', async ({
    page,
  }, testInfo) => {
    await sesion(page, 'vinculada');
    await page.goto('/inicio');
    const nav = page.getByRole('navigation', { name: 'Principal' });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole('link')).toHaveText([
      'Inicio',
      'Casos',
      'Incapacidades',
      'Solicitudes',
      'Cuenta',
    ]);
    const caja = await nav.boundingBox();
    if (esEscritorio(testInfo)) expect(caja!.y).toBeLessThan(100);
    else expect(caja!.y + caja!.height).toBeGreaterThan(812 - 2);
    await expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`portal visuals · ${colorScheme}`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(AHORA);
    });

    test('bienvenida', async ({ page }, testInfo) => {
      await page.goto('/');
      await expect(titulo(page)).toBeVisible();
      await sinViolacionesGraves(page);
      await capturar(page, testInfo, `bienvenida-${colorScheme}`);
    });

    test('activar', async ({ page }, testInfo) => {
      await sesion(page, 'sin-vinculo');
      await page.goto('/activar');
      await page.getByLabel('Código de activación').fill('ZZZ999-K7Q2M9XD4P');
      await page.getByRole('button', { name: 'Vincular cuenta' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await sinViolacionesGraves(page);
      await capturar(page, testInfo, `activar-error-${colorScheme}`);

      await page.getByLabel('Código de activación').fill(CODIGO_VALIDO);
      await page.getByRole('button', { name: 'Vincular cuenta' }).click();
      await expect(titulo(page)).toHaveText('Cuenta vinculada');
      await capturar(page, testInfo, `activar-vinculada-${colorScheme}`);
    });

    const PAGINAS = [
      { nombre: 'inicio', url: '/inicio', listo: 'incapacidad-vigente' },
      { nombre: 'casos', url: '/casos', listo: 'casos' },
      { nombre: 'caso', url: `/casos/${CASO_ACTIVO}`, listo: 'linea-tiempo' },
      { nombre: 'incapacidades', url: '/incapacidades', listo: 'grupo-incapacidades' },
      { nombre: 'solicitudes', url: '/solicitudes', listo: 'solicitudes' },
    ];
    for (const p of PAGINAS) {
      test(p.nombre, async ({ page }, testInfo) => {
        await sesion(page, 'vinculada');
        await page.goto(p.url);
        await expect(page.getByTestId(p.listo).first()).toBeVisible();
        await sinViolacionesGraves(page);
        await capturar(page, testInfo, `${p.nombre}-${colorScheme}`);
      });
    }

    test('solicitar copia', async ({ page }, testInfo) => {
      await sesion(page, 'vinculada');
      await page.goto(`/casos/${CASO_ACTIVO}/solicitar-copia`);
      await page.getByRole('button', { name: 'Enviar solicitud' }).click();
      await expect(page.locator('#error-medio')).toBeVisible();
      await page.getByText('Correo certificado', { exact: true }).click();
      await sinViolacionesGraves(page);
      await capturar(page, testInfo, `solicitar-copia-${colorScheme}`);
    });

    test('cuenta', async ({ page }, testInfo) => {
      await sesion(page, 'vinculada');
      await page.goto('/cuenta');
      await expect(titulo(page)).toHaveText('Mi cuenta');
      await sinViolacionesGraves(page);
      await capturar(page, testInfo, `cuenta-${colorScheme}`);
    });
  });
}
