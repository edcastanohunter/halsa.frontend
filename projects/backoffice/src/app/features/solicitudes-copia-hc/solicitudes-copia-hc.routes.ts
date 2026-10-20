import { Routes } from '@angular/router';

// Plan §6.2. The parent route already requires `solicitudes-hc:gestionar`.
export const SOLICITUDES_COPIA_HC_ROUTES: Routes = [
  {
    path: '',
    title: 'Solicitudes de copia HC · Halsa',
    loadComponent: () => import('./pages/bandeja.page').then((m) => m.BandejaSolicitudesPage),
  },
];
