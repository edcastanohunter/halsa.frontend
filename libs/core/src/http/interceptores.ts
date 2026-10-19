import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { ErrorApi, parsearProblema } from './problema';

/**
 * URL prefix of the app's API: `apiBaseUrl + '/v1/'` in the backoffice, `/paciente/` in the
 * portal. Interceptors only touch matching requests, so tokens and ids never leak elsewhere.
 */
export const API_PREFIX = new InjectionToken<string>('API_PREFIX');

export const CABECERA_CORRELACION = 'X-Correlation-Id';

export function esPeticionApi(req: HttpRequest<unknown>, prefijo: string): boolean {
  return req.url.startsWith(prefijo);
}

/** Adds a fresh `X-Correlation-Id` to each API request (plan §5.1.3, gap G1 for CORS). */
export const correlacionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esPeticionApi(req, inject(API_PREFIX)) || req.headers.has(CABECERA_CORRELACION)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { [CABECERA_CORRELACION]: crypto.randomUUID() } }));
};

async function leerCuerpo(cuerpo: unknown): Promise<unknown> {
  // Blob/arraybuffer requests (PDF downloads) carry their problem+json as bytes.
  if (cuerpo instanceof Blob) return cuerpo.text().catch(() => null);
  if (cuerpo instanceof ArrayBuffer) return new TextDecoder().decode(cuerpo);
  return cuerpo;
}

/**
 * Rethrows API failures as a typed `ErrorApi` (RFC 9457 + `WWW-Authenticate` step-up +
 * `Retry-After`). It never retries: the caller decides, and non-idempotent calls are not safe.
 */
export const problemaInterceptor: HttpInterceptorFn = (req, next) => {
  const prefijo = inject(API_PREFIX);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || !esPeticionApi(req, prefijo)) {
        return throwError(() => error);
      }
      return from(leerCuerpo(error.error)).pipe(
        switchMap((cuerpo) =>
          throwError(
            () =>
              new ErrorApi(
                parsearProblema(
                  error.status,
                  cuerpo,
                  error.headers,
                  req.headers.get(CABECERA_CORRELACION),
                ),
              ),
          ),
        ),
      );
    }),
  );
};
