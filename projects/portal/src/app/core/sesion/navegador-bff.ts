import { InjectionToken } from '@angular/core';

/**
 * The full-page navigations of the BFF session (plan §5.2). A token so the mock configuration can
 * replace them (dev.interceptors.ts) while the real BFF login is blocked (gap G3).
 */
export interface NavegadorBff {
  /** Keycloak login (and registration) through the BFF, back to `returnUrl`. */
  login(returnUrl: string): void;
  /** A hard reload of `/`: nothing of the old session stays in memory. */
  inicio(): void;
}

/**
 * The BFF only accepts a local `returnUrl` (`BffEndpoints.EsUrlLocal`): one leading `/`, never
 * `//` or a backslash. Anything else falls back to `/`.
 */
export function retornoSeguro(ruta: string): string {
  return /^\/(?![/\\])[^\\]*$/.test(ruta) ? ruta : '/';
}

export const NAVEGADOR_BFF = new InjectionToken<NavegadorBff>('NAVEGADOR_BFF', {
  providedIn: 'root',
  factory: () => ({
    login: (returnUrl) =>
      globalThis.location.assign(
        `/paciente/bff/login?returnUrl=${encodeURIComponent(retornoSeguro(returnUrl))}`,
      ),
    inicio: () => globalThis.location.assign('/'),
  }),
});
