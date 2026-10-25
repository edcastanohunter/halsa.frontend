import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { PermisosService } from '../../core/permisos/permisos';
import { casoIdDe } from '../../shared/casos/caso-id';

/** `nueva` needs `incapacidades:write`; without it, back to the list with a notice (plan §6.2). */
const requiereEscritura: CanActivateFn = (route) => {
  if (inject(PermisosService).puede('incapacidades:write')) return true;
  inject(Notificaciones).aviso('No puedes cargar incapacidades');
  return inject(Router).createUrlTree(['/casos', casoIdDe(route), 'incapacidades']);
};

/**
 * `/casos/:casoId/incapacidades` (plan §6.2, §7.6). Mounted by the app routes under the case
 * shell, behind `requierePestana('incapacidades:read')`.
 */
export const INCAPACIDADES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/incapacidades.page').then((m) => m.IncapacidadesPage),
    children: [
      {
        path: '',
        title: 'Incapacidades · Caso · Halsa',
        loadComponent: () => import('./pages/lista.page').then((m) => m.ListaIncapacidadesPage),
      },
      {
        path: 'nueva',
        title: 'Cargar incapacidad · Caso · Halsa',
        canActivate: [requiereEscritura],
        loadComponent: () =>
          import('./pages/nueva-incapacidad.page').then((m) => m.NuevaIncapacidadPage),
      },
    ],
  },
];
