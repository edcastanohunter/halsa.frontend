import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SolicitudCopiaHcResponse } from '@halsa/api-types';
import {
  esErrorApi,
  getEnumLabel,
  MEDIO_ENTREGA_LABELS,
  MensajeError,
  mensajeDeError,
  tieneCodigo,
} from '@halsa/core';
import { EstadoBadge } from '@halsa/ui/estado-badge';
import { EstadoError } from '@halsa/ui/estado-error';
import { EstadoVacio } from '@halsa/ui/estado-vacio';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { FechaRelativa } from '@halsa/ui/fecha-relativa';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { RadicadoChip } from '@halsa/ui/radicado-chip';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideCalendarClock,
  lucideInbox,
  lucideMail,
  lucideMapPin,
  lucideRotateCw,
  lucideSend,
} from '@ng-icons/lucide';
import { firstValueFrom, Subscription } from 'rxjs';
import { IdentificadorCopiable } from '../../../shared/identificador-copiable';
import { SolicitudesCopiaHcApi } from '../../../shared/privacidad/solicitudes-copia-hc-api.service';
import { injectRefrescoAlVolver } from '../../../shared/refresco';
import {
  agruparBandeja,
  Bandeja,
  esCerrable,
  esTramitable,
  leerPestana,
  parametroPestana,
  PESTANAS,
} from '../bandeja';
import { DialogoCerrarSolicitud } from '../dialogo-cerrar-solicitud';

type Fase = 'cargando' | 'listo' | 'error';

const ICONO_MEDIO: Record<string, string> = {
  CORREO_CERTIFICADO: 'lucideMapPin',
  ELECTRONICO: 'lucideMail',
  PRESENCIAL: 'lucideBuilding2',
};

/**
 * `/solicitudes-copia-hc` (plan §7.9): the tenant's clinical-record copy requests, by tab
 * (`?estado=en-tramite|cerradas`, Recibidas by default). The officer has no `casos:read`, so the
 * radicado is text, never a link to the case.
 */
@Component({
  selector: 'app-solicitudes-copia-hc',
  imports: [
    RouterLink,
    NgIcon,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    FechaRelativa,
    RadicadoChip,
    HlmButton,
    HlmSkeletonImports,
    HlmSpinner,
    IdentificadorCopiable,
    DialogoCerrarSolicitud,
  ],
  providers: [
    provideIcons({
      lucideBuilding2,
      lucideCalendarClock,
      lucideInbox,
      lucideMail,
      lucideMapPin,
      lucideRotateCw,
      lucideSend,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight">
            Solicitudes de copia de historia clínica
          </h1>
          <p class="text-muted-foreground text-sm">
            Pedidas por los pacientes desde el portal. La copia se entrega por el canal formal.
          </p>
        </div>
        <button
          hlmBtn
          variant="outline"
          size="icon"
          type="button"
          aria-label="Actualizar"
          [disabled]="fase() === 'cargando'"
          (click)="cargar()"
        >
          <ng-icon name="lucideRotateCw" aria-hidden="true" />
        </button>
      </header>

      <nav
        aria-label="Estado de las solicitudes"
        class="border-border flex gap-1 overflow-x-auto border-b"
      >
        @for (p of pestanas; track p.id) {
          <a
            routerLink="."
            [queryParams]="{ estado: parametro(p.id) }"
            [attr.aria-current]="p.id === pestana() ? 'page' : null"
            class="text-muted-foreground hover:text-foreground focus-visible:ring-ring aria-[current=page]:text-foreground aria-[current=page]:after:bg-primary relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full focus-visible:ring-2 focus-visible:ring-inset"
          >
            {{ p.etiqueta }}
            @if (bandeja(); as b) {
              <span
                class="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums"
                [attr.aria-label]="
                  b[p.id].length + (b[p.id].length === 1 ? ' solicitud' : ' solicitudes')
                "
                >{{ b[p.id].length }}</span
              >
            }
          </a>
        }
      </nav>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando solicitudes" class="grid gap-4 lg:grid-cols-2">
            @for (i of [1, 2]; track i) {
              <div class="bg-card ring-border space-y-3 rounded-xl p-4 ring-1">
                <div class="flex justify-between gap-2">
                  <hlm-skeleton class="h-7 w-44" />
                  <hlm-skeleton class="h-6 w-24 rounded-full" />
                </div>
                <hlm-skeleton class="h-4 w-2/3" />
                <hlm-skeleton class="h-4 w-1/2" />
              </div>
            }
          </div>
        }
        @case ('error') {
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar las solicitudes'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (!visibles().length) {
            <halsa-estado-vacio
              icono="lucideInbox"
              [titulo]="vacio()"
              descripcion="Las nuevas solicitudes de los pacientes aparecen en Recibidas."
            />
          } @else {
            <ul class="grid gap-4 lg:grid-cols-2" data-testid="solicitudes">
              @for (s of visibles(); track s.id) {
                <li>
                  <article
                    class="bg-card ring-border flex h-full flex-col gap-4 rounded-xl p-4 ring-1"
                    [attr.aria-label]="'Solicitud ' + s.radicado"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <halsa-radicado-chip [radicado]="s.radicado" />
                      <halsa-estado-badge tipo="solicitudCopiaHc" [valor]="s.estado" />
                    </div>

                    <dl class="grid gap-3 text-sm sm:grid-cols-2">
                      <div class="space-y-0.5">
                        <dt class="text-muted-foreground text-xs">Medio de entrega</dt>
                        <dd class="flex items-start gap-1.5 font-medium">
                          <ng-icon
                            [name]="iconoMedio(s.medioEntrega)"
                            class="text-muted-foreground mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span class="min-w-0">
                            {{ medio(s.medioEntrega) }}
                            @if (s.direccionOCorreo) {
                              <span class="text-muted-foreground block font-normal break-words">{{
                                s.direccionOCorreo
                              }}</span>
                            }
                          </span>
                        </dd>
                      </div>
                      <div class="space-y-0.5">
                        <dt class="text-muted-foreground text-xs">Solicitada</dt>
                        <dd>
                          <halsa-fecha-relativa class="font-medium" [valor]="s.solicitadaEn" />
                          <span class="text-muted-foreground block text-xs">
                            <halsa-fecha-bogota [valor]="s.solicitadaEn" />
                          </span>
                        </dd>
                      </div>
                      <div class="space-y-0.5 sm:col-span-2">
                        <dt class="text-muted-foreground text-xs">Paciente (identificador)</dt>
                        <dd>
                          <app-identificador-copiable
                            [valor]="s.pacienteSub"
                            etiqueta="identificador del paciente"
                            [corto]="true"
                          />
                        </dd>
                      </div>
                      @if (s.observaciones) {
                        <div class="space-y-0.5 sm:col-span-2">
                          <dt class="text-muted-foreground text-xs">Observaciones del paciente</dt>
                          <dd class="border-border border-s-2 ps-3 whitespace-pre-line">
                            {{ s.observaciones }}
                          </dd>
                        </div>
                      }
                      @if (s.estado === 'EN_TRAMITE' && s.atendidaEn) {
                        <div class="space-y-0.5 sm:col-span-2">
                          <dt class="text-muted-foreground text-xs">En trámite desde</dt>
                          <dd><halsa-fecha-bogota [valor]="s.atendidaEn" /></dd>
                        </div>
                      }
                      @if (!abierta(s)) {
                        <div class="space-y-0.5">
                          <dt class="text-muted-foreground text-xs">Cerrada</dt>
                          <dd><halsa-fecha-bogota [valor]="s.atendidaEn" /></dd>
                        </div>
                        @if (s.atendidaPor) {
                          <div class="space-y-0.5">
                            <dt class="text-muted-foreground text-xs">Por</dt>
                            <dd>
                              <app-identificador-copiable
                                [valor]="s.atendidaPor"
                                etiqueta="identificador de quien la cerró"
                                [corto]="true"
                              />
                            </dd>
                          </div>
                        }
                        @if (s.notaAtencion) {
                          <div class="space-y-0.5 sm:col-span-2">
                            <dt class="text-muted-foreground text-xs">Nota de cierre</dt>
                            <dd class="whitespace-pre-line">{{ s.notaAtencion }}</dd>
                          </div>
                        }
                      }
                    </dl>

                    @if (abierta(s)) {
                      <p
                        class="bg-muted/60 text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
                      >
                        <ng-icon
                          name="lucideCalendarClock"
                          class="mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        Plazo legal: 10 días hábiles desde la solicitud (Res. 1995 de 1999). Se
                        cumple al cerrarla.
                      </p>
                      <div class="mt-auto flex flex-wrap justify-end gap-2">
                        @if (tramitable(s)) {
                          <button
                            hlmBtn
                            variant="outline"
                            type="button"
                            [attr.aria-label]="'Pasar a trámite: ' + s.radicado"
                            [disabled]="!!ocupada()"
                            (click)="tramitar(s)"
                          >
                            @if (ocupada() === s.id) {
                              <hlm-spinner class="size-4" aria-hidden="true" />
                            } @else {
                              <ng-icon name="lucideSend" aria-hidden="true" />
                            }
                            Pasar a trámite
                          </button>
                        }
                        @if (cerrable(s)) {
                          <button
                            hlmBtn
                            type="button"
                            [attr.aria-label]="'Cerrar solicitud: ' + s.radicado"
                            [disabled]="!!ocupada()"
                            (click)="enCierre.set(s)"
                          >
                            Cerrar
                          </button>
                        }
                      </div>
                    }
                  </article>
                </li>
              }
            </ul>
          }
        }
      }
    </div>

    <app-dialogo-cerrar-solicitud
      [solicitud]="enCierre()"
      (cerrada)="alCerrar()"
      (conflicto)="alConflicto($event)"
      (cerrado)="enCierre.set(null)"
    />
  `,
})
export class BandejaSolicitudesPage {
  /** Query param, bound by `withComponentInputBinding()`. */
  readonly estado = input<string>();

  private readonly api = inject(SolicitudesCopiaHcApi);
  private readonly notificaciones = inject(Notificaciones);

  protected readonly pestanas = PESTANAS;
  protected readonly parametro = parametroPestana;
  protected readonly tramitable = esTramitable;
  protected readonly cerrable = esCerrable;
  protected readonly abierta = esCerrable;
  protected readonly medio = (m: string) => getEnumLabel(MEDIO_ENTREGA_LABELS, m);
  protected readonly iconoMedio = (m: string) => ICONO_MEDIO[m] ?? 'lucideInbox';

  protected readonly pestana = computed(() => leerPestana(this.estado()));
  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly bandeja = signal<Bandeja | null>(null);
  protected readonly visibles = computed(() => this.bandeja()?.[this.pestana()] ?? []);
  protected readonly vacio = computed(
    () =>
      ({
        recibidas: 'No hay solicitudes nuevas',
        'en-tramite': 'No hay solicitudes en trámite',
        cerradas: 'Todavía no hay solicitudes cerradas',
      })[this.pestana()],
  );
  protected readonly ocupada = signal<string | null>(null);
  protected readonly enCierre = signal<SolicitudCopiaHcResponse | null>(null);
  private cargadoEn: number | null = null;
  private peticion: Subscription | undefined;

  constructor() {
    this.cargar();
    injectRefrescoAlVolver(
      () => this.cargadoEn,
      () => this.cargar(),
    );
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected cargar(): void {
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.error.set(null);
    this.peticion = this.api.listar().subscribe({
      next: (solicitudes) => {
        this.bandeja.set(agruparBandeja(solicitudes));
        this.cargadoEn = Date.now();
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.fase.set('error');
      },
    });
  }

  protected async tramitar(s: SolicitudCopiaHcResponse): Promise<void> {
    if (this.ocupada()) return;
    this.ocupada.set(s.id);
    try {
      await firstValueFrom(this.api.tramitar(s.id));
      this.notificaciones.exito('Solicitud en trámite', s.radicado);
      this.cargar();
    } catch (error) {
      if (esErrorApi(error) && tieneCodigo(error.problema, 'SolicitudCopiaHc.TransicionInvalida')) {
        this.alConflicto(error.problema.detail ?? 'La solicitud cambió de estado.');
      } else {
        this.notificaciones.error(error);
      }
    } finally {
      this.ocupada.set(null);
    }
  }

  protected alCerrar(): void {
    this.enCierre.set(null);
    this.cargar();
  }

  /** Plan §7.9: `SolicitudCopiaHc.TransicionInvalida` → explain and refresh. */
  protected alConflicto(mensaje: string): void {
    this.enCierre.set(null);
    this.notificaciones.aviso(
      'La solicitud ya cambió de estado',
      `${mensaje} Actualizamos la bandeja.`,
    );
    this.cargar();
  }
}
