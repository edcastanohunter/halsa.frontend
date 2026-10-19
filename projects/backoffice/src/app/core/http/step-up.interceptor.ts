import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { API_PREFIX, esErrorApi, esPeticionApi } from '@halsa/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { SesionService } from '../sesion/sesion.service';
import { StepUpService } from '../step-up/step-up.service';

/**
 * Outermost interceptor, so a retry runs `authInterceptor` again with the new token.
 * - Step-up 401 (RFC 9470): the verification dialog, then the original request **once**.
 * - Any other 401: the session is over; log in again and return to the current URL.
 * The error is rethrown in every other case, and when the user cancels the dialog.
 */
export const stepUpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esPeticionApi(req, inject(API_PREFIX))) return next(req);
  const stepUp = inject(StepUpService);
  const sesion = inject(SesionService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!esErrorApi(error) || error.problema.status !== 401) return throwError(() => error);
      const desafio = error.problema.stepUp;
      if (!desafio) {
        sesion.sesionExpirada(router.url);
        return throwError(() => error);
      }
      return from(stepUp.solicitar({ acr: desafio.acr, maxAgeSeg: desafio.maxAge })).pipe(
        switchMap((verificado) => (verificado ? next(req) : throwError(() => error))),
      );
    }),
  );
};
