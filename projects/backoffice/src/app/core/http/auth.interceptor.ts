import { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { API_PREFIX, esPeticionApi } from '@halsa/core';
import { Observable, of, switchMap, take } from 'rxjs';

/**
 * Where the access token comes from. M3 binds it to the OIDC client; until then there is no
 * session and requests go out without `Authorization`.
 */
export const TOKEN_ACCESO = new InjectionToken<() => Observable<string | null>>('TOKEN_ACCESO', {
  factory: () => () => of(null),
});

/** Adds `Authorization: Bearer <token>` to `apiBaseUrl + '/v1/'` requests only (plan §5.1.3). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esPeticionApi(req, inject(API_PREFIX)) || req.headers.has('Authorization')) {
    return next(req);
  }
  return inject(TOKEN_ACCESO)().pipe(
    take(1),
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req),
    ),
  );
};
