import AxeBuilder from '@axe-core/playwright';
import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { generate } from 'otplib';

// M1.5 AC (plan §11, Appendix A): every themed Keycloak page of both realms, at 375 px and 1440 px,
// light and dark. Each page passes axe (no serious/critical), shows no English string, no PatternFly
// or Font Awesome markup and no broken image, has no horizontal scroll, and matches its baseline.
// Run with `npm run e2e:theme` after `npm run kc:up`.
const SCREENSHOT_DIR = 'docs/reportes/m1.5';
const PASSWORD = 'dev';

// Dev users (plan §6.1): fixed subs and OTP secrets from the backend realm.
const USERS = {
  analistaArla: { username: 'analista.arla', id: '01999000-0000-7000-8000-000000000a01' },
  calificador: {
    username: 'calificador.arla',
    id: '01999000-0000-7000-8000-000000000a02',
    otpSecret: 'NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR',
  },
  privacidad: { username: 'privacidad.arla', id: '01999000-0000-7000-8000-000000000a03' },
  analistaArlb: { username: 'analista.arlb', id: '01999000-0000-7000-8000-000000000b01' },
  medicoIps: {
    username: 'medico.ips',
    id: '01999000-0000-7000-8000-000000000c01',
    otpSecret: 'NBQWY43BMRSXM3LFMRUWG33JOBZTAMBR',
  },
  coordinadorIps: { username: 'coordinador.ips', id: '01999000-0000-7000-8000-000000000c02' },
  // registrationEmailAsUsername: patients sign in with their email.
  paciente: { username: 'paciente.dev@halsa.dev', id: '01999000-0000-7000-8000-000000000d01' },
} as const;

// The backoffice client asks for acr=2, which is what makes Keycloak show the OTP page.
// Its redirect target (port 3000) is intercepted, so no dev server is needed.
const BACKOFFICE_ORIGIN = 'http://localhost:3000';
function backofficeAuthUrl(acr?: 1 | 2): string {
  const params = new URLSearchParams({
    client_id: 'halsa-backoffice',
    redirect_uri: `${BACKOFFICE_ORIGIN}/`,
    response_type: 'code',
    scope: 'openid',
    // Any valid S256 challenge works: the code is never exchanged.
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  });
  if (acr) params.set('acr_values', String(acr));
  return `/realms/halsa/protocol/openid-connect/auth?${params}`;
}

// ---- Admin API -------------------------------------------------------------------------------

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/realms/master/protocol/openid-connect/token', {
    form: { grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: 'admin' },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).access_token;
}

async function adminCall(
  request: APIRequestContext,
  method: 'GET' | 'PUT',
  path: string,
  data?: unknown,
): Promise<unknown> {
  const token = await adminToken(request);
  const response = await request.fetch(`/admin/realms/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBeTruthy();
  return method === 'GET' ? response.json() : undefined;
}

function setRequiredActions(
  request: APIRequestContext,
  realm: string,
  userId: string,
  requiredActions: string[],
) {
  return adminCall(request, 'PUT', `${realm}/users/${userId}`, { requiredActions });
}

// The dev realms have no SMTP server, and Keycloak shows an error page instead of "Revisa tu
// correo" when it can't send the verification email. dev/keycloak/compose.yaml runs Mailpit for that
// (UI at http://localhost:8025); the spec points the realm at it only for the duration of a test.
const SMTP_SERVER = { host: 'mailpit', port: '1025', from: 'no-responder@halsa.dev' };

// ---- Page helpers ----------------------------------------------------------------------------

async function login(page: Page, username: string, password = PASSWORD) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
}

function pageTitle(page: Page) {
  return page.locator('#kc-page-title');
}

// Words that would only show up if a message fell back to Keycloak's English bundle.
const ENGLISH =
  /\b(Sign in|Log ?in|Log ?out|Username|Password|Submit|Forgot|Register|Remember me|Back to|Cancel|Continue|Invalid|Welcome|Click here|Try another|required|Email|Verify|Device|Scan|Account|Update|Confirm|expired|Terms|Accept|Decline|Sorry|First name|Last name)\b/;

async function expectThemedPage(page: Page, name: string, colorScheme: 'light' | 'dark') {
  await page.evaluate(() => document.fonts.ready);
  // Settled images only: a broken one also ends up complete, with naturalWidth 0.
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await expect(page.locator('html')).toHaveClass(
    colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
  );

  const report = await page.evaluate(() => ({
    fontFamily: getComputedStyle(document.body).fontFamily,
    // PatternFly (pf-c-*, pf-m-*, login-pf, card-pf) or Font Awesome markup means an unmapped class.
    unstyled: [...document.querySelectorAll('[class]')]
      .map((el) => el.getAttribute('class') ?? '')
      .filter((c) => /(^|\s)(pf-|fa(\s|$)|fa-|login-pf|card-pf|form-control|btn-default)/.test(c)),
    brokenImages: [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src.slice(0, 80)),
    text: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(report.fontFamily, 'halsa.css loaded').toContain('Plus Jakarta Sans');
  expect(report.unstyled, 'PatternFly / Font Awesome classes').toEqual([]);
  expect(report.brokenImages, 'broken images').toEqual([]);
  expect(report.text).not.toMatch(ENGLISH);
  expect(report.scrollWidth, 'no horizontal scroll').toBe(page.viewportSize()!.width);

  // Screenshots before axe. The report copies are JPEG to keep the repo light; the baselines below
  // are what the spec compares. The QR code and its key change on every visit, so they're masked.
  const width = page.viewportSize()!.width;
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}-${width}-${colorScheme}.jpg`,
    type: 'jpeg',
    quality: 80,
    fullPage: true,
  });
  await expect(page).toHaveScreenshot(`${name}-${colorScheme}.png`, {
    fullPage: true,
    mask: [page.locator('#kc-totp-secret-qr-code'), page.locator('#kc-totp-secret-key')],
  });

  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    'axe serious/critical',
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  // Successful logins land on the backoffice; nothing runs there, so answer locally.
  await page.route(`${BACKOFFICE_ORIGIN}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>ok</title>',
    }),
  );
});

// ---- Every themed page, both schemes ---------------------------------------------------------

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`tema Keycloak · ${colorScheme}`, () => {
    test.use({ colorScheme });

    // Staff realm (halsa)

    test('personal: login', async ({ page }) => {
      await page.goto('/realms/halsa/account');
      await expect(pageTitle(page)).toHaveText('Ingresa a Halsa');
      await expect(page.getByLabel('Usuario o correo')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Mostrar contraseña' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Crear cuenta' })).toHaveCount(0);
      await expectThemedPage(page, 'personal-login', colorScheme);
    });

    test('personal: login con error', async ({ page }) => {
      await page.goto('/realms/halsa/account');
      await login(page, USERS.analistaArla.username, 'incorrecta');
      await expect(page.locator('#input-error')).toContainText('Usuario o contraseña incorrectos');
      await expectThemedPage(page, 'personal-login-error', colorScheme);
    });

    test('personal: OTP', async ({ page }) => {
      await page.goto(backofficeAuthUrl(2));
      await login(page, USERS.calificador.username);
      await expect(pageTitle(page)).toHaveText('Verificación en dos pasos');
      const otp = page.locator('#otp');
      await expect(otp).toHaveAttribute('autocomplete', 'one-time-code');
      await expect(otp).toHaveAttribute('inputmode', 'numeric');
      await expect(otp).toBeFocused();
      await expectThemedPage(page, 'personal-otp', colorScheme);
    });

    test('personal: OTP con error', async ({ page }) => {
      await page.goto(backofficeAuthUrl(2));
      await login(page, USERS.calificador.username);
      await page.locator('#otp').fill('000000');
      await page.getByRole('button', { name: 'Verificar' }).click();
      await expect(page.locator('#input-error-otp-code')).toBeVisible();
      await expectThemedPage(page, 'personal-otp-error', colorScheme);
    });

    test('personal: configurar OTP', async ({ page, request }) => {
      const user = USERS.analistaArla;
      await setRequiredActions(request, 'halsa', user.id, ['CONFIGURE_TOTP']);
      try {
        await page.goto('/realms/halsa/account');
        await login(page, user.username);
        await expect(pageTitle(page)).toHaveText('Activa la verificación en dos pasos');
        await page.getByText('¿No puedes escanear?').click();
        await expect(page.locator('#kc-totp-secret-key')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Activar verificación' })).toBeVisible();
        await expectThemedPage(page, 'personal-config-totp', colorScheme);
      } finally {
        await setRequiredActions(request, 'halsa', user.id, []);
      }
    });

    test('personal: actualizar contraseña', async ({ page, request }) => {
      const user = USERS.analistaArlb;
      await setRequiredActions(request, 'halsa', user.id, ['UPDATE_PASSWORD']);
      try {
        await page.goto('/realms/halsa/account');
        await login(page, user.username);
        await expect(pageTitle(page)).toHaveText('Crea una contraseña nueva');
        await page.locator('#password-new').fill('abcdefgh');
        await expect(page.locator('#password-policy li[data-rule="length"]')).toHaveAttribute(
          'data-met',
          'true',
        );
        await page.locator('#password-new').fill('');
        await expectThemedPage(page, 'personal-update-password', colorScheme);
      } finally {
        await setRequiredActions(request, 'halsa', user.id, []);
      }
    });

    test('personal: actualizar perfil', async ({ page, request }) => {
      const user = USERS.coordinadorIps;
      await setRequiredActions(request, 'halsa', user.id, ['UPDATE_PROFILE']);
      try {
        await page.goto('/realms/halsa/account');
        await login(page, user.username);
        await expect(pageTitle(page)).toHaveText('Completa tu información');
        await expectThemedPage(page, 'personal-update-profile', colorScheme);
      } finally {
        await setRequiredActions(request, 'halsa', user.id, []);
      }
    });

    test('personal: términos', async ({ page, request }) => {
      const user = USERS.privacidad;
      const path = 'halsa/authentication/required-actions/TERMS_AND_CONDITIONS';
      const action = (await adminCall(request, 'GET', path)) as Record<string, unknown>;
      await adminCall(request, 'PUT', path, { ...action, enabled: true });
      await setRequiredActions(request, 'halsa', user.id, ['TERMS_AND_CONDITIONS']);
      try {
        await page.goto('/realms/halsa/account');
        await login(page, user.username);
        await expect(pageTitle(page)).toHaveText('Términos y condiciones');
        await expectThemedPage(page, 'personal-terms', colorScheme);
      } finally {
        await setRequiredActions(request, 'halsa', user.id, []);
        await adminCall(request, 'PUT', path, action);
      }
    });

    test('personal: recuperar contraseña', async ({ page, request }) => {
      await adminCall(request, 'PUT', 'halsa', { resetPasswordAllowed: true });
      try {
        await page.goto('/realms/halsa/account');
        await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
        await expect(pageTitle(page)).toHaveText('Recupera tu contraseña');
        await expectThemedPage(page, 'personal-reset-password', colorScheme);
      } finally {
        await adminCall(request, 'PUT', 'halsa', { resetPasswordAllowed: false });
      }
    });

    test('personal: página expirada', async ({ page }) => {
      await page.goto(backofficeAuthUrl(2));
      const passwordStep = await page.locator('#kc-form-login').getAttribute('action');
      await login(page, USERS.calificador.username);
      await expect(pageTitle(page)).toHaveText('Verificación en dos pasos');
      // Revisiting the password step after moving on, as the back button does.
      await page.goto(passwordStep!);
      await expect(pageTitle(page)).toHaveText('La página expiró');
      await expectThemedPage(page, 'personal-page-expired', colorScheme);
    });

    test('personal: confirmar cierre de sesión', async ({ page }) => {
      await page.goto('/realms/halsa/protocol/openid-connect/logout');
      await expect(pageTitle(page)).toHaveText('Cerrar sesión');
      await expectThemedPage(page, 'personal-logout-confirm', colorScheme);
    });

    test('personal: error', async ({ page }) => {
      await page.goto(
        '/realms/halsa/protocol/openid-connect/auth?client_id=no-existe&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F',
      );
      await expect(pageTitle(page)).toHaveText('Algo salió mal');
      await expectThemedPage(page, 'personal-error', colorScheme);
    });

    // Patient realm (halsa-pacientes)

    test('pacientes: login', async ({ page }) => {
      await page.goto('/realms/halsa-pacientes/account');
      await expect(pageTitle(page)).toHaveText('Ingresa a Halsa');
      await expect(page.locator('html')).toHaveAttribute('data-variant', 'pacientes');
      await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeVisible();
      await expect(page.getByText('código de activación que te entregó tu ARL')).toBeVisible();
      await expectThemedPage(page, 'pacientes-login', colorScheme);
    });

    test('pacientes: registro', async ({ page }) => {
      await page.goto('/realms/halsa-pacientes/account');
      await page.getByRole('link', { name: 'Crear cuenta' }).click();
      await expect(pageTitle(page)).toHaveText('Crea tu cuenta');
      // Plan A.3 order: Nombre, Apellidos, Correo, Contraseña, Confirmar contraseña.
      const ids = await page
        .locator('#kc-register-form input:not([type=hidden]):not([type=submit])')
        .evaluateAll((inputs) => inputs.map((input) => input.id));
      expect(ids).toEqual(['firstName', 'lastName', 'email', 'password', 'password-confirm']);
      await expect(page.getByRole('link', { name: 'Ya tengo cuenta' })).toBeVisible();
      await expectThemedPage(page, 'pacientes-register', colorScheme);
    });

    test('pacientes: registro con errores', async ({ page }) => {
      await page.goto('/realms/halsa-pacientes/account');
      await page.getByRole('link', { name: 'Crear cuenta' }).click();
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page.locator('#input-error-firstName')).toBeVisible();
      await expectThemedPage(page, 'pacientes-register-errors', colorScheme);
    });

    test('pacientes: verificar correo', async ({ page, request }) => {
      const user = USERS.paciente;
      const userPath = `halsa-pacientes/users/${user.id}`;
      await adminCall(request, 'PUT', 'halsa-pacientes', { smtpServer: SMTP_SERVER });
      // Keycloak skips VERIFY_EMAIL for an already verified address.
      await adminCall(request, 'PUT', userPath, {
        emailVerified: false,
        requiredActions: ['VERIFY_EMAIL'],
      });
      try {
        await page.goto('/realms/halsa-pacientes/account');
        await login(page, user.username);
        await expect(pageTitle(page)).toHaveText('Revisa tu correo');
        await expectThemedPage(page, 'pacientes-verify-email', colorScheme);
      } finally {
        await adminCall(request, 'PUT', userPath, { emailVerified: true, requiredActions: [] });
        await adminCall(request, 'PUT', 'halsa-pacientes', { smtpServer: {} });
      }
    });
  });
}

// ---- Functional flows (once, on desktop) -----------------------------------------------------

test.describe('flujos funcionales', () => {
  test.skip(({ viewport }) => viewport!.width < 1024, 'one run is enough');

  for (const user of [USERS.calificador, USERS.medicoIps]) {
    test(`${user.username}: contraseña + OTP llegan al backoffice`, async ({ page }) => {
      await page.goto(backofficeAuthUrl(2));
      await login(page, user.username);
      await expect(pageTitle(page)).toHaveText('Verificación en dos pasos');
      await page.locator('#otp').fill(await generate({ secret: user.otpSecret }));
      const [redirect] = await Promise.all([
        page.waitForRequest((r) => r.url().startsWith(`${BACKOFFICE_ORIGIN}/`)),
        page.getByRole('button', { name: 'Verificar' }).click(),
      ]);
      expect(new URL(redirect.url()).searchParams.get('code')).toBeTruthy();
    });
  }

  test('paciente nuevo: registro completo', async ({ page }) => {
    const email = `paciente.e2e.${Date.now()}@halsa.dev`;
    await page.goto('/realms/halsa-pacientes/account');
    await page.getByRole('link', { name: 'Crear cuenta' }).click();
    await page.locator('#firstName').fill('Paciente');
    await page.locator('#lastName').fill('De Prueba');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('una-clave-larga-2026');
    await page.locator('#password-confirm').fill('una-clave-larga-2026');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    // Registration signs the patient in and returns to the account console.
    await expect(page).toHaveURL(/\/realms\/halsa-pacientes\/account/);
    await expect(page.locator('#kc-page-title')).toHaveCount(0);
  });
});
