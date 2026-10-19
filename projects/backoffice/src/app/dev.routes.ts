import { Routes } from '@angular/router';

// Dev-only routes. Production builds replace this file with dev.routes.prod.ts (angular.json).
export const devRoutes: Routes = [
  {
    path: '_ui/errores',
    title: 'Errores y notificaciones · Halsa',
    loadComponent: () => import('@halsa/ui/showcase').then((m) => m.UiErroresPage),
  },
  {
    path: '_ui',
    title: 'Sistema de diseño · Halsa',
    loadComponent: () => import('@halsa/ui/showcase').then((m) => m.UiShowcasePage),
  },
];
