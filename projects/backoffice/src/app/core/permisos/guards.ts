import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionService } from '../sesion/sesion.service';
import { Permiso, PermisosService } from './permisos';

/**
 * Every staff route. Anonymous → Keycloak login with this URL as the return target; a non ARL/IPS
 * actor → `/sin-acceso`. An `error` state passes through so the shell can offer retry and logout.
 */
export const requiereSesion: CanActivateFn = (_route, state) => {
  const sesion = inject(SesionService);
  switch (sesion.estado()) {
    case 'anonima':
    case 'iniciando':
      sesion.iniciarSesion(state.url);
      return false;
    case 'sin-acceso':
      return inject(Router).createUrlTree(['/sin-acceso']);
    default:
      return true;
  }
};

/** Needs every listed permission; otherwise `/acceso-denegado` (not the login, plan §5.1.2). */
export function requierePermiso(...permisos: Permiso[]): CanActivateFn {
  return () => {
    const servicio = inject(PermisosService);
    return permisos.every((p) => servicio.puede(p))
      ? true
      : inject(Router).createUrlTree(['/acceso-denegado']);
  };
}
