import { HttpInterceptorFn } from '@angular/common/http';
import { crearInterceptorMock } from '@halsa/mocks';
import { crearDatosBackoffice } from './fixtures';
import { crearRutasBackoffice } from './rutas';

export { CASO, CASOS_HISTORICOS, IPS_DEV, SUB, crearDatosBackoffice } from './fixtures';
export { crearRutasBackoffice } from './rutas';

/** The backoffice API (`/v1`) served from in-memory fixtures. State resets on reload. */
export function crearMockBackoffice(apiBaseUrl: string, retardoMs?: number): HttpInterceptorFn {
  return crearInterceptorMock(crearRutasBackoffice(crearDatosBackoffice()), {
    prefijo: `${new URL(apiBaseUrl || '/', 'http://mock.local').pathname.replace(/\/$/, '')}/v1/`,
    retardoMs,
  });
}
