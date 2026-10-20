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
import { injectCasoId } from '../../../shared/casos/caso-id';
import { ClinicoApi } from '../data-access/clinico-api.service';
import { HistoriaClinicaStore } from '../data-access/historia-clinica.store';

/**
 * Everything behind the gate. Only instantiated once the token has `acr=2`, so the first
 * clinical request can't leave before the step-up (plan §5.1.4).
 */
@Component({
  selector: 'app-historia-clinica-contenido',
  imports: [
    RouterOutlet,
    NgIcon,
    DialogoAccesoEmergencia,
    EstadoError,
    EstadoVacio,
    PanelNoAsignado,
    SeccionClinica,
    HlmSkeletonImports,
  ],
  providers: [provideIcons({ lucideSearchX, lucideSiren })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-4' },
  template: `
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
          titulo="No pudimos cargar la historia clínica"
          [mensaje]="store.error()?.mensaje"
          [traza]="store.error()?.traza ?? undefined"
          (reintentar)="store.recargar()"
        />
      }
      @case ('cargando') {
        <div class="space-y-3" aria-busy="true" aria-label="Cargando historia clínica">
          <hlm-skeleton class="block h-16 rounded-xl" />
          <hlm-skeleton class="block h-28 rounded-xl" />
          <hlm-skeleton class="block h-28 rounded-xl" />
        </div>
      }
      @default {
        <halsa-seccion-clinica titulo="Información clínica reservada">
          <router-outlet />
        </halsa-seccion-clinica>
      }
    }
  `,
})
export class HistoriaClinicaContenido {
  protected readonly store = inject(HistoriaClinicaStore);
  private readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosService);
  private readonly casoId = injectCasoId();

  protected readonly sub = computed(() => this.sesion.sesion()?.sub ?? '');
  protected readonly puedeEmergencia = computed(() => this.permisos.puede('clinico:emergencia'));
  protected readonly dialogoAbierto = signal(false);
  private readonly cargado = signal(false);

  /** A refetch (after a new record) keeps the routed view instead of flashing skeletons. */
  protected readonly vista = computed(() => {
    const estado = this.store.estado();
    if (estado === 'listo') return 'listo';
    if ((estado === 'cargando' || estado === 'inicial') && !this.cargado()) return 'cargando';
    return estado === 'cargando' ? 'listo' : estado;
  });

  constructor() {
    effect(() => {
      const id = this.casoId();
      if (id) untracked(() => this.store.cargar(id));
    });
    effect(() => {
      if (this.store.estado() === 'listo') untracked(() => this.cargado.set(true));
    });
  }
}

/**
 * `/casos/:casoId/historia-clinica` 🔒 (plan §7.5): the step-up gate first, then the clinical
 * content. Provides the clinical API and store, so the data is dropped when the user leaves.
 */
@Component({
  selector: 'app-historia-clinica',
  imports: [CompuertaReforzada, ContenidoReforzado, HistoriaClinicaContenido],
  providers: [ClinicoApi, HistoriaClinicaStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-compuerta-reforzada [acr]="2">
      <app-historia-clinica-contenido *halsaContenidoReforzado />
    </app-compuerta-reforzada>
  `,
})
export class HistoriaClinicaPage {}
