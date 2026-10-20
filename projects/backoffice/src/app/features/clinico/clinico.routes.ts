import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Notificaciones } from '@halsa/ui';
import { PermisosService } from '../../core/permisos/permisos';
import { casoIdDe } from './caso-id';

/** `nuevo` needs `clinico:write`; without it, back to the list with a notice (plan §6.2). */
const requiereEscritura: CanActivateFn = (route) => {
  if (inject(PermisosService).puede('clinico:write')) return true;
  inject(Notificaciones).aviso('No puedes crear registros clínicos');
  return inject(Router).createUrlTree(['/casos', casoIdDe(route), 'historia-clinica']);
};

/**
 * `/casos/:casoId/historia-clinica` 🔒 (plan §6.2). Mounted by the app routes under the case
 * shell, behind `requierePestana('clinico:read')`.
 */
export const CLINICO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/historia-clinica.page').then((m) => m.HistoriaClinicaPage),
    children: [
      {
        path: '',
        title: 'Historia clínica · Caso · Halsa',
        loadComponent: () => import('./pages/registros.page').then((m) => m.RegistrosPage),
      },
      {
        path: 'nuevo',
        title: 'Nuevo registro clínico · Caso · Halsa',
        canActivate: [requiereEscritura],
        loadComponent: () => import('./pages/nuevo-registro.page').then((m) => m.NuevoRegistroPage),
      },
      {
        path: ':registroId',
        title: 'Registro clínico · Caso · Halsa',
        loadComponent: () => import('./pages/registro.page').then((m) => m.RegistroPage),
      },
    ],
  },
];
