import AxeBuilder from '@axe-core/playwright';
import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
// Workers run in parallel processes: the last window per secret lives in a file, guarded by a
// lock file created with `wx` (fails if it exists). Windows can answer EPERM/EBUSY while another
// worker deletes it, so every lock operation retries.
const DIR_OTP = path.join(os.tmpdir(), 'halsa-e2e-otp');

async function conCandado<T>(nombre: string, hacer: () => Promise<T>): Promise<T> {
  fs.mkdirSync(DIR_OTP, { recursive: true });
  const candado = path.join(DIR_OTP, `${nombre}.lock`);
  for (;;) {
    try {
      fs.closeSync(fs.openSync(candado, 'wx'));
      break;
    } catch {
      try {
        // A lock older than a minute belongs to a crashed worker.
        const edad = Date.now() - (fs.statSync(candado, { throwIfNoEntry: false })?.mtimeMs ?? 0);
        if (edad > 60_000) fs.rmSync(candado, { force: true });
      } catch {
        // Being deleted by its owner right now: try again.
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  try {
    return await hacer();
  } finally {
    for (let i = 0; i < 10; i++) {
      try {
        fs.rmSync(candado, { force: true });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
}

export async function codigoOtp(secreto: string): Promise<string> {
  return conCandado(secreto, async () => {
    const archivo = path.join(DIR_OTP, `${secreto}.ventana`);
    const usada = Number(fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8') : -1);
    let ventana = Math.floor(Date.now() / 30_000);
    if (usada >= ventana) {
      await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 250));
      ventana = Math.floor(Date.now() / 30_000);
    }
    fs.writeFileSync(archivo, String(ventana));
    return generate({ secret: secreto });
  });
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

/**
 * Scrolls down in steps so every `@defer (on viewport)` block below the fold loads (a jump to the
 * bottom could skip the ones in between), then back to the top.
 */
export async function cargarDiferidos(page: Page) {
  await page.evaluate(async () => {
    const paso = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += paso) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
}

export async function sinViolacionesGraves(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}
