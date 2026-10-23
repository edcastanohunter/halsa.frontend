import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { withContentSecurityPolicy } from '@ng-icons/core';

/** Trusted Types policy name; the production CSP lists it in `trusted-types` (deploy/). */
export const POLITICA_ICONOS = 'halsa#iconos';

interface PoliticaHtml {
  createHTML(html: string): unknown;
}

interface FabricaTrustedTypes {
  createPolicy(nombre: string, reglas: { createHTML(html: string): string }): PoliticaHtml;
}

let politica: PoliticaHtml | null | undefined;

/**
 * The policy is created once per page: Trusted Types refuses a second policy with the same name
 * unless the CSP allows duplicates. Null when the browser has no Trusted Types.
 */
function politicaIconos(): PoliticaHtml | null {
  if (politica === undefined) {
    const fabrica = (globalThis as { trustedTypes?: FabricaTrustedTypes }).trustedTypes;
    politica = fabrica?.createPolicy(POLITICA_ICONOS, { createHTML: (html) => html }) ?? null;
  }
  return politica;
}

/**
 * `ng-icon` inserts its SVG with `template.innerHTML = string`, which
 * `require-trusted-types-for 'script'` blocks. The SVGs are the lucide definitions compiled into
 * the bundle (never server data), so this pre-processor wraps them in TrustedHTML. It keeps the
 * library's CSP feature too: inline `style` attributes become `data-style` and are applied
 * through the CSSOM, so `style-src` needs no hash for them.
 */
export function provideIconosTrustedTypes(): EnvironmentProviders {
  const [pre, post] = withContentSecurityPolicy().ɵproviders as [
    Provider & { provide: unknown; useValue: (svg: string) => string },
    Provider,
  ];
  return makeEnvironmentProviders([
    {
      provide: pre.provide,
      useValue: (svg: string) => {
        const html = pre.useValue(svg);
        return politicaIconos()?.createHTML(html) ?? html;
      },
    },
    post,
  ]);
}
