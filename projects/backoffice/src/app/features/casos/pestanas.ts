import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Notificaciones } from '@halsa/ui';
import { ConPermiso, Permiso, PermisosService } from '../../core/permisos/permisos';

export interface PestanaCaso extends ConPermiso {
  /** Child route under `/casos/:casoId`. */
  ruta: string;
  etiqueta: string;
  permiso: Permiso;
  /** Clinical tabs carry a lock (plan §7.4). */
  clinica?: boolean;
}

/** Plan §6.2 / §6.3, in display order. */
export const PESTANAS_CASO: readonly PestanaCaso[] = [
  { ruta: 'resumen', etiqueta: 'Resumen', permiso: 'casos:read' },
  { ruta: 'equipo', etiqueta: 'Equipo', permiso: 'casos:read' },
  { ruta: 'plazos', etiqueta: 'Plazos', permiso: 'plazos:read' },
  { ruta: 'incapacidades', etiqueta: 'Incapacidades', permiso: 'incapacidades:read' },
  {
    ruta: 'historia-clinica',
    etiqueta: 'Historia clínica',
    permiso: 'clinico:read',
    clinica: true,
  },
  { ruta: 'dictamen-pcl', etiqueta: 'Dictamen PCL', permiso: 'pcl:dictamen:read', clinica: true },
  { ruta: 'portal-paciente', etiqueta: 'Portal paciente', permiso: 'pacientes:activar' },
];

/**
 * A case tab opened by URL without its permission goes back to the case `resumen` with a toast
 * (plan §6.2), not to the generic 403 page: the case itself is visible.
 */
export function requierePestana(permiso: Permiso): CanActivateFn {
  return (route) => {
    if (inject(PermisosService).puede(permiso)) return true;
    inject(Notificaciones).aviso(
      'No tienes acceso a esa sección del caso',
      'Te llevamos al resumen del caso.',
    );
    const casoId = route.parent?.paramMap.get('casoId') ?? '';
    return inject(Router).createUrlTree(['/casos', casoId, 'resumen']);
  };
}
