import { Routes } from '@angular/router';

// Plan §6.2. The parent route already requires `plazos:read`.
export const PLAZOS_ROUTES: Routes = [
  {
    path: '',
    title: 'Plazos · Halsa',
    loadComponent: () => import('./pages/tablero.page').then((m) => m.TableroPlazosPage),
  },
];
