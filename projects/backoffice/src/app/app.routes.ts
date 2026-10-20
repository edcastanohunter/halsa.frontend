import { Routes } from '@angular/router';
import { requierePermiso, requiereSesion } from './core/permisos/guards';
import { devRoutes, devShellRoutes } from './dev.routes';

const estadoPagina = () =>
  import('./shell/paginas/estado-pagina.page').then((m) => m.EstadoPaginaPage);

// Plan §6.2. Every staff route lives under the shell, behind the session guard.
export const routes: Routes = [
  ...devRoutes,
  {
    path: 'auth/callback',
    title: 'Ingresando · Halsa',
    loadComponent: () => import('./core/auth/callback.page').then((m) => m.CallbackPage),
  },
  {
    path: 'sin-acceso',
    title: 'Sin acceso · Halsa',
    loadComponent: () => import('./shell/paginas/sin-acceso.page').then((m) => m.SinAccesoPage),
  },
  {
    path: '',
    canActivate: [requiereSesion],
    loadComponent: () => import('./shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · Halsa',
        loadComponent: () => import('./features/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        path: 'casos',
        canActivate: [requierePermiso('casos:read')],
        // The case shell hosts tabs of other features; they are composed here, not imported there.
        loadChildren: () =>
          import('./features/casos/casos.routes').then((m) =>
            m.crearRutasCasos({
              incapacidades: () =>
                import('./features/incapacidades/incapacidades.routes').then(
                  (i) => i.INCAPACIDADES_ROUTES,
                ),
              historiaClinica: () =>
                import('./features/clinico/clinico.routes').then((c) => c.CLINICO_ROUTES),
              dictamenPcl: () =>
                import('./features/dictamen-pcl/dictamen-pcl.routes').then(
                  (d) => d.DICTAMEN_PCL_ROUTES,
                ),
            }),
          ),
      },
      {
        path: 'plazos',
        canActivate: [requierePermiso('plazos:read')],
        loadChildren: () => import('./features/plazos/plazos.routes').then((m) => m.PLAZOS_ROUTES),
      },
      {
        path: 'solicitudes-copia-hc',
        canActivate: [requierePermiso('solicitudes-hc:gestionar')],
        loadChildren: () =>
          import('./features/solicitudes-copia-hc/solicitudes-copia-hc.routes').then(
            (m) => m.SOLICITUDES_COPIA_HC_ROUTES,
          ),
      },
      {
        path: 'auditoria',
        loadChildren: () =>
          import('./features/auditoria/auditoria.routes').then((m) => m.AUDITORIA_ROUTES),
      },
      {
        path: 'cuenta',
        title: 'Mi cuenta · Halsa',
        loadComponent: () => import('./features/cuenta/cuenta.page').then((m) => m.CuentaPage),
      },
      ...devShellRoutes,
      {
        path: 'acceso-denegado',
        title: 'Acceso denegado · Halsa',
        loadComponent: estadoPagina,
        data: {
          titulo: 'No tienes permiso para ver esta página',
          descripcion: 'Si crees que deberías tener acceso, pide a tu administrador que lo revise.',
          icono: 'lucideBan',
        },
      },
      {
        path: '**',
        title: 'Página no encontrada · Halsa',
        loadComponent: estadoPagina,
        data: {
          titulo: 'Página no encontrada',
          descripcion: 'La dirección no existe o ya no está disponible.',
          icono: 'lucideSearchX',
        },
      },
    ],
  },
];
