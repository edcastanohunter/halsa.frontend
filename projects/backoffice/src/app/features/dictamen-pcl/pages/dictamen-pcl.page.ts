import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  ContenidoReforzado,
  DialogoAccesoEmergencia,
  EstadoError,
  EstadoVacio,
  PanelNoAsignado,
  SeccionClinica,
} from '@halsa/ui';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearchX, lucideSiren } from '@ng-icons/lucide';
import { PermisosService } from '../../../core/permisos/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CompuertaReforzada } from '../../../core/step-up/compuerta-reforzada';
import { VigenciaVerificacion } from '../../../core/step-up/vigencia-verificacion';
import { injectCasoId } from '../../../shared/casos/caso-id';
import { DictamenPclApi } from '../data-access/dictamen-pcl-api.service';
import { DictamenPclStore } from '../data-access/dictamen-pcl.store';

/** Plan §5.1.4: the dictamen needs `acr=2` and an `auth_time` within the last 15 minutes. */
export const MAX_AGE_DICTAMEN_SEG = 900;

/**
 * Everything behind the gate. Only instantiated with a fresh `acr=2`, so the dictamen request
 * can't leave before the step-up. Destroyed when the window closes; the store above keeps the
 * data and any draft, so reopening the gate shows them again.
 */
@Component({
  selector: 'app-dictamen-pcl-contenido',
  imports: [
    RouterOutlet,
    NgIcon,
    DialogoAccesoEmergencia,
    EstadoError,
    EstadoVacio,
    PanelNoAsignado,
    SeccionClinica,
    VigenciaVerificacion,
    HlmSkeletonImports,
  ],
  providers: [provideIcons({ lucideSearchX, lucideSiren })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-4' },
  template: `
    <div class="flex flex-wrap items-center justify-end gap-2">
      <app-vigencia-verificacion [maxAgeSeg]="maxAgeSeg" />
    </div>

    @if (store.emergenciaActiva()) {
      <div
        role="status"
        class="bg-warning/15 text-warning ring-warning/40 flex items-start gap-3 rounded-xl p-3 text-sm ring-1 ring-inset"
        data-testid="emergencia-activa"
      >
        <ng-icon name="lucideSiren" class="mt-0.5 shrink-0 text-base" aria-hidden="true" />
        <div class="min-w-0">
          <p class="font-semibold">Acceso de emergencia activo — motivo registrado</p>
          <p class="text-foreground/80 break-words">
            Se registró como: <span class="font-mono">{{ store.motivoEmergencia() }}</span>
          </p>
        </div>
      </div>
    }

    @switch (vista()) {
      @case ('no-asignado') {
        <halsa-panel-no-asignado
          [sub]="sub()"
          [puedeAccesoEmergencia]="puedeEmergencia()"
          (accesoEmergencia)="dialogoAbierto.set(true)"
        />
        <halsa-dialogo-acceso-emergencia
          [(abierto)]="dialogoAbierto"
          (confirmar)="store.activarEmergencia($event)"
        />
      }
      @case ('no-encontrado') {
        <halsa-estado-vacio
          icono="lucideSearchX"
          titulo="Información no disponible"
          descripcion="No existe o no está disponible para tu usuario."
        />
      }
      @case ('error') {
        <halsa-estado-error
          titulo="No pudimos cargar el dictamen"
          [mensaje]="store.error()?.mensaje"
          [traza]="store.error()?.traza ?? undefined"
          (reintentar)="store.recargar()"
        />
      }
      @case ('cargando') {
        <div class="space-y-3" aria-busy="true" aria-label="Cargando el dictamen">
          <hlm-skeleton class="block h-16 rounded-xl" />
          <hlm-skeleton class="block h-40 rounded-xl" />
          <hlm-skeleton class="block h-28 rounded-xl" />
        </div>
      }
      @default {
        <halsa-seccion-clinica titulo="Dictamen de pérdida de capacidad laboral">
          <router-outlet />
        </halsa-seccion-clinica>
      }
    }
  `,
})
export class DictamenPclContenido {
  protected readonly store = inject(DictamenPclStore);
  private readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosService);
  private readonly casoId = injectCasoId();

  protected readonly maxAgeSeg = MAX_AGE_DICTAMEN_SEG;
  protected readonly sub = computed(() => this.sesion.sesion()?.sub ?? '');
  protected readonly puedeEmergencia = computed(() => this.permisos.puede('clinico:emergencia'));
  protected readonly dialogoAbierto = signal(false);
  private readonly cargado = signal(false);

  /**
   * "No dictamen yet" is a routed state (the view's empty state, or the form). A refetch after a
   * write keeps the routed view instead of flashing skeletons.
   */
  protected readonly vista = computed(() => {
    const estado = this.store.estado();
    if (estado === 'listo' || estado === 'sin-dictamen') return 'listo';
    if ((estado === 'cargando' || estado === 'inicial') && !this.cargado()) return 'cargando';
    return estado === 'cargando' ? 'listo' : estado;
  });

  constructor() {
    effect(() => {
      const id = this.casoId();
      if (id) untracked(() => this.store.asegurar(id));
    });
    effect(() => {
      const estado = this.store.estado();
      if (estado === 'listo' || estado === 'sin-dictamen') untracked(() => this.cargado.set(true));
    });
  }
}

/**
 * `/casos/:casoId/dictamen-pcl` 🔒 (plan §7.7): the 15-minute step-up gate first, then the
 * dictamen. Provides the API and the store outside the gate, so the data and an unsent draft
 * survive the gate closing, and are dropped when the user leaves the tab.
 */
@Component({
  selector: 'app-dictamen-pcl',
  imports: [CompuertaReforzada, ContenidoReforzado, DictamenPclContenido],
  providers: [DictamenPclApi, DictamenPclStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-compuerta-reforzada [acr]="2" [maxAgeSeg]="maxAgeSeg">
      <app-dictamen-pcl-contenido *halsaContenidoReforzado />
    </app-compuerta-reforzada>
  `,
})
export class DictamenPclPage {
  protected readonly maxAgeSeg = MAX_AGE_DICTAMEN_SEG;
}
