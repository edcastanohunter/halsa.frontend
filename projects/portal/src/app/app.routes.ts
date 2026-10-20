import { Routes } from '@angular/router';
import { requiereSesion, requiereVinculo, soloAnonimo } from './core/guards';
import { devRoutes } from './dev.routes';

// Plan §6.4. No route may start with `/paciente`: that prefix belongs to the BFF on this host.
export const routes: Routes = [
  ...devRoutes,
  {
    path: '',
    pathMatch: 'full',
    canActivate: [soloAnonimo],
    title: 'Halsa · Portal del paciente',
    loadComponent: () =>
      import('./features/bienvenida/bienvenida.page').then((m) => m.BienvenidaPage),
  },
  {
    path: 'privacidad',
    title: 'Tratamiento de datos personales · Halsa',
    loadComponent: () =>
      import('./features/bienvenida/privacidad.page').then((m) => m.PrivacidadPage),
  },
  {
    path: '',
    canActivate: [requiereSesion],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'activar',
        title: 'Vincular cuenta · Halsa',
        loadComponent: () => import('./features/activar/activar.page').then((m) => m.ActivarPage),
      },
      {
        path: 'inicio',
        canActivate: [requiereVinculo],
        title: 'Inicio · Halsa',
        loadComponent: () => import('./features/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        path: 'casos',
        canActivate: [requiereVinculo],
        loadChildren: () => import('./features/casos/casos.routes').then((m) => m.CASOS_ROUTES),
      },
      {
        path: 'incapacidades',
        canActivate: [requiereVinculo],
        title: 'Mis incapacidades · Halsa',
        loadComponent: () =>
          import('./features/incapacidades/incapacidades.page').then((m) => m.IncapacidadesPage),
      },
      {
        path: 'solicitudes',
        canActivate: [requiereVinculo],
        title: 'Mis solicitudes · Halsa',
        loadComponent: () =>
          import('./features/solicitudes/solicitudes.page').then((m) => m.SolicitudesPage),
      },
      {
        path: 'cuenta',
        title: 'Mi cuenta · Halsa',
        loadComponent: () => import('./features/cuenta/cuenta.page').then((m) => m.CuentaPage),
      },
      {
        path: '**',
        title: 'Página no encontrada · Halsa',
        loadComponent: () =>
          import('./shell/pagina-no-encontrada.page').then((m) => m.PaginaNoEncontradaPage),
      },
    ],
  },
];
