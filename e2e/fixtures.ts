import { test as base, expect } from '@playwright/test';

export * from '@playwright/test';

// Every spec imports `test` from here. The dev servers send the production CSP with Trusted
// Types (angular.json `serve.headers`, same policy as deploy/), and this auto fixture fails any
// test whose pages log a CSP or Trusted Types violation (M11 AC). Keycloak's own pages are
// outside the apps' policy and are ignored.
const ORIGENES_APP = ['http://localhost:3000', 'https://localhost:4300'];
const VIOLACION = /Content Security Policy|Trusted ?Type|TrustedHTML|TrustedScript/i;

const deLaApp = (url: string | undefined) => ORIGENES_APP.some((o) => url?.startsWith(o));

export const test = base.extend<{ sinViolacionesCsp: void }>({
  sinViolacionesCsp: [
    async ({ context }, use) => {
      const violaciones: string[] = [];
      context.on('console', (mensaje) => {
        const url = mensaje.page()?.url() ?? mensaje.location().url;
        if (VIOLACION.test(mensaje.text()) && deLaApp(url)) {
          violaciones.push(`${url}: ${mensaje.text()}`);
        }
      });
      context.on('weberror', (error) => {
        const url = error.page()?.url();
        if (VIOLACION.test(error.error().message) && deLaApp(url)) {
          violaciones.push(`${url}: ${error.error().message}`);
        }
      });
      await use();
      expect(violaciones, 'CSP / Trusted Types violations').toEqual([]);
    },
    { auto: true },
  ],
});
