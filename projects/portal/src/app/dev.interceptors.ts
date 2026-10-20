import { HttpInterceptorFn } from '@angular/common/http';
import { Provider } from '@angular/core';
import { AppConfig } from '@halsa/core';
import { crearMockPortal, SesionMock } from '../mocks';
import { NAVEGADOR_BFF } from './core/sesion/navegador-bff';

const SESIONES: readonly SesionMock[] = ['anonima', 'sin-vinculo', 'vinculada'];
/** The mocked BFF session, kept across reloads like the real cookie. */
const CLAVE_SESION = 'halsa.mock.sesion';
/** Dev switch: which account the mocked login signs in (default: a new, unlinked one). */
const CLAVE_CUENTA = 'halsa.mock.cuenta';

// Dev-only interceptors and providers. Production builds replace this file with
// dev.interceptors.prod.ts (angular.json), so the mock adapter never reaches a production bundle.
export function devInterceptors(config: AppConfig): HttpInterceptorFn[] {
  return config.mock
    ? [crearMockPortal(leer(CLAVE_SESION) ?? 'anonima', (s) => guardar(CLAVE_SESION, s))]
    : [];
}

/**
 * With the mock adapter there is no BFF to navigate to (gap G3): "login" stores the mocked session
 * and goes straight to `returnUrl`, as the real round trip through Keycloak would.
 */
export function devProviders(config: AppConfig): Provider[] {
  if (!config.mock) return [];
  return [
    {
      provide: NAVEGADOR_BFF,
      useValue: {
        login: (returnUrl: string) => {
          const cuenta = leer(CLAVE_CUENTA);
          guardar(CLAVE_SESION, cuenta && cuenta !== 'anonima' ? cuenta : 'sin-vinculo');
          globalThis.location.assign(returnUrl);
        },
        inicio: () => globalThis.location.assign('/'),
      },
    },
  ];
}

function leer(clave: string): SesionMock | undefined {
  try {
    const valor = sessionStorage.getItem(clave);
    return SESIONES.find((s) => s === valor);
  } catch {
    return undefined;
  }
}

function guardar(clave: string, valor: SesionMock): void {
  try {
    sessionStorage.setItem(clave, valor);
  } catch {
    // Storage blocked: the mocked session lasts until the next reload.
  }
}
