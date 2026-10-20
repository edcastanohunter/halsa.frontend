import AxeBuilder from '@axe-core/playwright';
import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from '@playwright/test';
import { generate } from 'otplib';

// Shared helpers of the backoffice specs: real Keycloak login (Podman, `npm run kc:up`), OTP
// step-up, screenshots and axe.
export const KEYCLOAK = 'http://localhost:8180/realms/halsa';

/** The backoffice specs skip the portal projects. */
export function soloBackoffice() {
  test.beforeEach(({}, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('backoffice'), 'backoffice only');
  });
}

export const esEscritorio = (testInfo: TestInfo) => testInfo.project.name.endsWith('desktop');

/** Keycloak password login from a protected URL; returns once the app shows the shell. */
export async function ingresar(page: Page, username: string, destino = '/inicio') {
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
export async function codigoOtp(secreto: string): Promise<string> {
  let ventana = Math.floor(Date.now() / 30_000);
  if (ultimaVentana.get(secreto) === ventana) {
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 250));
    ventana = Math.floor(Date.now() / 30_000);
  }
  ultimaVentana.set(secreto, ventana);
  return generate({ secret: secreto });
}

/**
 * Completes the step-up popup the click opens. The Keycloak session already meets level 1, so the
 * Cookie step (G17) leaves only the OTP page.
 */
export async function verificarEnPopup(
  context: BrowserContext,
  page: Page,
  clic: () => Promise<void>,
  usuario: { username: string; otp: string },
) {
  const [popup] = await Promise.all([context.waitForEvent('page'), clic()]);
  await popup.waitForURL((url) => url.href.startsWith(KEYCLOAK));
  await expect(popup.locator('#password')).toHaveCount(0);
  await popup.locator('#otp').fill(await codigoOtp(usuario.otp));
  await Promise.all([
    popup.waitForEvent('close'),
    popup.getByRole('button', { name: 'Verificar' }).click(),
  ]);
  await page.bringToFront();
}

/**
 * A screenshot baseline plus its report copy in `dir` (`docs/reportes/<milestone>/`). Full page on
 * desktop; the viewport on mobile, where the fixed bottom bar would float mid-page.
 */
export async function capturar(
  dir: string,
  page: Page,
  testInfo: TestInfo,
  nombre: string,
  completa = true,
  /** Volatile content (dates relative to now, one-time codes), masked in the baseline only. */
  mask: Locator[] = [],
) {
  const fullPage = completa && esEscritorio(testInfo);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${nombre}.png`, { fullPage, mask });
  const ancho = esEscritorio(testInfo) ? 1440 : 375;
  await page.screenshot({
    path: `${dir}/${nombre}-${ancho}.jpg`,
    fullPage,
    type: 'jpeg',
    quality: 80,
    animations: 'disabled',
  });
}

export async function sinViolacionesGraves(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}
