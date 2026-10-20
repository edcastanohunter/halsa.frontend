import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';
import { map, of } from 'rxjs';

/**
 * The `:casoId` of the enclosing case route. Tabs of other features are mounted under the case
 * shell (`/casos/:casoId/historia-clinica`, `…/incapacidades`), whose params they don't inherit.
 */
export function casoIdDe(ruta: ActivatedRouteSnapshot): string | null {
  const ids = ruta.pathFromRoot.map((r) => r.paramMap.get('casoId'));
  return ids.reverse().find((id) => !!id) ?? null;
}

/** Same, as a signal that follows navigation between cases. Injection context only. */
export function injectCasoId(): Signal<string | null> {
  const ruta = inject(ActivatedRoute);
  const delCaso = [...ruta.pathFromRoot].reverse().find((r) => r.snapshot.paramMap.has('casoId'));
  const id$ = delCaso ? delCaso.paramMap.pipe(map((p) => p.get('casoId'))) : of(null);
  return toSignal(id$, { initialValue: casoIdDe(ruta.snapshot) });
}
