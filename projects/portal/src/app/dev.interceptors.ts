import { HttpInterceptorFn } from '@angular/common/http';
import { AppConfig } from '@halsa/core';
import { crearMockPortal, SesionMock } from '../mocks';

const SESIONES: readonly SesionMock[] = ['anonima', 'sin-vinculo', 'vinculada'];

// Dev-only interceptors. Production builds replace this file with dev.interceptors.prod.ts
// (angular.json), so the mock adapter never reaches a production bundle.
export function devInterceptors(config: AppConfig): HttpInterceptorFn[] {
  return config.mock ? [crearMockPortal(sesionInicial())] : [];
}

/** Dev switch for the mocked BFF session: `sessionStorage['halsa.mock.sesion']`. */
function sesionInicial(): SesionMock | undefined {
  try {
    const valor = sessionStorage.getItem('halsa.mock.sesion');
    return SESIONES.find((s) => s === valor);
  } catch {
    return undefined;
  }
}
