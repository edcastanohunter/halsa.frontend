import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { esErrorApi } from '@halsa/core';
import { catchError, throwError } from 'rxjs';
import { SesionPaciente } from '../sesion/sesion.service';

export const CABECERA_CSRF = 'X-Halsa-Csrf';

/**
 * Plan §5.2: the BFF answers `403` to any `/paciente/api/*` request or logout without
 * `X-Halsa-Csrf: 1`. Every `/paciente/` request carries it; nothing else does.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/paciente/')
    ? next(req.clone({ setHeaders: { [CABECERA_CSRF]: '1' } }))
    : next(req);

/**
 * A `401` from `/paciente/api/*` means the BFF session expired (plan §5.2). `bff/usuario` is not
 * included: there a `401` only means "anonymous". It sits outside `problemaInterceptor`, so it
 * sees the parsed `ErrorApi`, and rethrows it for the caller's error state.
 */
export const sesionExpiradaInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/paciente/api/')) return next(req);
  const sesion = inject(SesionPaciente);
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (esErrorApi(error) && error.problema.status === 401) sesion.sesionExpirada(router.url);
      return throwError(() => error);
    }),
  );
};
