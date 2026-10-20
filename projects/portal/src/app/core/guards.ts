import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionPaciente } from './sesion/sesion.service';

/**
 * `/` (plan §6.4): the welcome page is for anonymous visitors; a signed-in patient goes to
 * `/inicio` (or `/activar` if not linked yet). An `error` state goes to the shell, which explains
 * it and offers retry.
 */
export const soloAnonimo: CanActivateFn = () => {
  const sesion = inject(SesionPaciente);
  const router = inject(Router);
  switch (sesion.estado()) {
    case 'sin-vinculo':
      return router.createUrlTree(['/activar']);
    case 'vinculada':
    case 'error':
      return router.createUrlTree(['/inicio']);
    default:
      return true;
  }
};

/** `/activar`, `/cuenta`: any signed-in patient. Anonymous → BFF login back to this URL. */
export const requiereSesion: CanActivateFn = (_route, state) => {
  const sesion = inject(SesionPaciente);
  if (sesion.estado() === 'anonima' || sesion.estado() === 'iniciando') {
    sesion.iniciarSesion(state.url);
    return false;
  }
  return true;
};

/** Everything that shows case data: a linked account, otherwise `/activar` first. */
export const requiereVinculo: CanActivateFn = (route, state) => {
  const sesion = inject(SesionPaciente);
  if (sesion.estado() === 'sin-vinculo') return inject(Router).createUrlTree(['/activar']);
  return requiereSesion(route, state);
};
