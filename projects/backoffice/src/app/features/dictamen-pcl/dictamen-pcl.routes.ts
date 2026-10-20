import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Notificaciones } from '@halsa/ui';
import { PermisosService } from '../../core/permisos/permisos';
import { casoIdDe } from '../../shared/casos/caso-id';

/** `registrar` needs `pcl:dictamen:write`; without it, back to the dictamen (plan §6.2). */
const requiereEscritura: CanActivateFn = (route) => {
  if (inject(PermisosService).puede('pcl:dictamen:write')) return true;
  inject(Notificaciones).aviso('No puedes registrar ni corregir el dictamen');
  return inject(Router).createUrlTree(['/casos', casoIdDe(route), 'dictamen-pcl']);
};

/**
 * `/casos/:casoId/dictamen-pcl` 🔒 (plan §6.2, §7.7). Mounted by the app routes under the case
 * shell, behind `requierePestana('pcl:dictamen:read')`. `registrar?corrige=<id>` corrects.
 */
export const DICTAMEN_PCL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dictamen-pcl.page').then((m) => m.DictamenPclPage),
    children: [
      {
        path: '',
        title: 'Dictamen PCL · Caso · Halsa',
        loadComponent: () => import('./pages/vista-dictamen.page').then((m) => m.VistaDictamenPage),
      },
      {
        path: 'registrar',
        title: 'Registrar dictamen PCL · Caso · Halsa',
        canActivate: [requiereEscritura],
        loadComponent: () =>
          import('./pages/registrar-dictamen.page').then((m) => m.RegistrarDictamenPage),
      },
    ],
  },
];
