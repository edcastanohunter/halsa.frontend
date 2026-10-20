import { Routes } from '@angular/router';

export const CASOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis casos · Halsa',
    loadComponent: () => import('./pages/casos.page').then((m) => m.CasosPage),
  },
  {
    path: ':casoId',
    title: 'Mi caso · Halsa',
    loadComponent: () => import('./pages/caso.page').then((m) => m.CasoPage),
  },
  {
    path: ':casoId/solicitar-copia',
    title: 'Solicitar copia de historia clínica · Halsa',
    loadComponent: () => import('./pages/solicitar-copia.page').then((m) => m.SolicitarCopiaPage),
  },
];
