import { Routes } from '@angular/router';
import { requierePermiso } from '../../core/permisos/guards';

// Plan §6.2: each audit screen has its own permission.
export const AUDITORIA_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'accesos' },
  {
    path: 'accesos',
    title: 'Auditoría de accesos · Halsa',
    canActivate: [requierePermiso('auditoria:read')],
    loadComponent: () => import('./pages/accesos.page').then((m) => m.AccesosPage),
  },
  {
    path: 'revisiones-emergencia',
    title: 'Revisiones de emergencia · Halsa',
    canActivate: [requierePermiso('auditoria:revisar')],
    loadComponent: () =>
      import('./pages/revisiones-emergencia.page').then((m) => m.RevisionesEmergenciaPage),
  },
];
