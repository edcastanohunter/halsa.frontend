import { LoadChildrenCallback, Routes } from '@angular/router';
import { Permiso } from '../../core/permisos/permisos';
import { PESTANAS_CASO, requierePestana } from './pestanas';

const estadoPagina = () =>
  import('../../shell/paginas/estado-pagina.page').then((m) => m.EstadoPaginaPage);

/** A tab whose milestone hasn't landed: guarded like the real one, with a neutral page. */
function pestanaPendiente(ruta: string) {
  const pestana = PESTANAS_CASO.find((p) => p.ruta === ruta)!;
  return {
    path: ruta,
    title: `${pestana.etiqueta} · Caso · Halsa`,
    canActivate: [requierePestana(pestana.permiso)],
    loadComponent: estadoPagina,
    data: {
      titulo: pestana.etiqueta,
      descripcion: 'Esta sección del caso estará disponible pronto.',
      icono: 'lucideHammer',
    },
  };
}

function pestana(ruta: string, permiso: Permiso, titulo: string) {
  return { path: ruta, title: `${titulo} · Caso · Halsa`, canActivate: [requierePestana(permiso)] };
}

/** Tabs owned by other features, wired by the app routes (features never import each other). */
export interface PestanasExternas {
  incapacidades?: LoadChildrenCallback;
  historiaClinica?: LoadChildrenCallback;
}

/** A tab owned by another feature, or its "disponible pronto" page when not wired. */
function pestanaExterna(ruta: string, cargar: LoadChildrenCallback | undefined) {
  if (!cargar) return pestanaPendiente(ruta);
  const p = PESTANAS_CASO.find((x) => x.ruta === ruta)!;
  return { path: ruta, canActivate: [requierePestana(p.permiso)], loadChildren: cargar };
}

// Plan §6.2. The parent route already requires `casos:read`.
export const crearRutasCasos = (externas: PestanasExternas = {}): Routes => [
  {
    path: '',
    title: 'Casos · Halsa',
    loadComponent: () => import('./pages/casos-lista.page').then((m) => m.CasosListaPage),
  },
  {
    path: ':casoId',
    loadComponent: () => import('./pages/caso-shell.page').then((m) => m.CasoShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      {
        ...pestana('resumen', 'casos:read', 'Resumen'),
        loadComponent: () => import('./pages/resumen.page').then((m) => m.ResumenPage),
      },
      {
        ...pestana('equipo', 'casos:read', 'Equipo'),
        loadComponent: () => import('./pages/equipo.page').then((m) => m.EquipoPage),
      },
      {
        ...pestana('plazos', 'plazos:read', 'Plazos'),
        loadComponent: () => import('./pages/plazos.page').then((m) => m.PlazosCasoPage),
      },
      pestanaExterna('incapacidades', externas.incapacidades),
      pestanaExterna('historia-clinica', externas.historiaClinica),
      pestanaPendiente('dictamen-pcl'),
      {
        ...pestana('portal-paciente', 'pacientes:activar', 'Portal paciente'),
        loadComponent: () =>
          import('./pages/portal-paciente.page').then((m) => m.PortalPacientePage),
      },
    ],
  },
];
