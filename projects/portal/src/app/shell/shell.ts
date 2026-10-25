import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { mensajeDeError } from '@halsa/core';
import { EstadoError } from '@halsa/ui/estado-error';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLogOut } from '@ng-icons/lucide';
import { SesionPaciente } from '../core/sesion/sesion.service';
import { ICONOS_NAVEGACION, NAVEGACION } from './navegacion';

/**
 * Patient shell (plan §6.4), designed for phones first: a top bar and a bottom tab bar below
 * 1024 px, a top nav above. The sections only appear once the account is linked; before that
 * the patient can activate a code or log out.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, EstadoError, HlmButton, NgIcon],
  providers: [provideIcons({ ...ICONOS_NAVEGACION, lucideLogOut })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly sesion = inject(SesionPaciente);

  protected readonly navegacion = computed(() =>
    this.sesion.estado() === 'vinculada' ? NAVEGACION : [],
  );

  protected readonly errorInicio = computed(() =>
    this.sesion.estado() === 'error' ? mensajeDeError(this.sesion.error()) : null,
  );

  /** A reload re-runs the initializer and the guards with the BFF's answer. */
  protected reintentar(): void {
    globalThis.location.reload();
  }

  protected cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }
}
