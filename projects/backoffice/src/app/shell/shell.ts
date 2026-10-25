import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { mensajeDeError } from '@halsa/core';
import { EstadoError } from '@halsa/ui/estado-error';
import { HlmAvatarImports } from '@halsa/ui/helm/avatar';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmDropdownMenuImports } from '@halsa/ui/helm/dropdown-menu';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmTooltip } from '@halsa/ui/helm/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideEllipsis,
  lucideHospital,
  lucideLogOut,
  lucidePanelLeftClose,
  lucidePanelLeftOpen,
} from '@ng-icons/lucide';
import { PermisosService } from '../core/permisos/permisos';
import { SesionService } from '../core/sesion/sesion.service';
import { DialogoStepUp } from '../core/step-up/dialogo-step-up';
import { ICONOS_NAVEGACION, navegacionPara } from './navegacion';

// UI preference only (plan §5.3): the one kind of thing allowed in localStorage.
const CLAVE_MENU = 'halsa.menu-contraido';

function leerContraido(): boolean {
  try {
    return globalThis.localStorage?.getItem(CLAVE_MENU) === '1';
  } catch {
    return false;
  }
}

/**
 * Staff shell (plan §6.3), mobile first: < 1024 px a top bar and a bottom bar with at most 4
 * sections + "Más"; ≥ 1024 px a collapsible sidebar. Both come from the same permission-filtered
 * `NAVEGACION`, and the tenant/IPS chip is always visible.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    EstadoError,
    HlmAvatarImports,
    HlmButton,
    HlmDropdownMenuImports,
    HlmSheetImports,
    HlmTooltip,
    NgIcon,
    DialogoStepUp,
  ],
  providers: [
    provideIcons({
      ...ICONOS_NAVEGACION,
      lucideBuilding2,
      lucideEllipsis,
      lucideHospital,
      lucideLogOut,
      lucidePanelLeftClose,
      lucidePanelLeftOpen,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosService);

  protected readonly navegacion = computed(() => navegacionPara(this.permisos.permisos()));
  protected readonly contraido = signal(leerContraido());

  protected readonly contexto = computed(() => {
    const s = this.sesion.sesion();
    if (!s) return null;
    return s.actorTipo === 'ips'
      ? {
          etiqueta: `IPS ${s.ipsId ?? ''}`.trim(),
          icono: 'lucideHospital',
          titulo: 'IPS (código REPS)',
        }
      : { etiqueta: s.tenantId ?? 'ARL', icono: 'lucideBuilding2', titulo: 'ARL' };
  });

  protected readonly iniciales = computed(() => {
    const nombre = this.sesion.sesion()?.nombre ?? '';
    const partes = nombre.split(/[\s.]+/).filter(Boolean);
    return (partes.length > 1 ? partes[0]![0]! + partes[1]![0]! : nombre.slice(0, 2)).toUpperCase();
  });

  protected readonly errorInicio = computed(() =>
    this.sesion.estado() === 'error' ? mensajeDeError(this.sesion.error()) : null,
  );

  protected alternarMenu(): void {
    const contraido = !this.contraido();
    this.contraido.set(contraido);
    try {
      globalThis.localStorage?.setItem(CLAVE_MENU, contraido ? '1' : '0');
    } catch {
      // Storage blocked: the preference lasts for this page only.
    }
  }

  protected reintentar(): void {
    void this.sesion.iniciar();
  }

  protected cerrarSesion(): void {
    this.sesion.cerrarSesion();
  }
}
