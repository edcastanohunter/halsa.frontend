import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AlertaIncapacidad, IncapacidadResponse } from '@halsa/api-types';
import {
  ALERTA_INCAPACIDAD_LABELS,
  CodigoAlertaIncapacidad,
  formatFechaCorta,
  formatNumero,
  getEnumLabel,
  guardarBlob,
  TIPO_INCAPACIDAD_LABELS,
} from '@halsa/core';
import {
  BarraDiasAcumulados,
  EstadoError,
  EstadoVacio,
  FechaBogota,
  Notificaciones,
  Tono,
  TONO_SUAVE,
} from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCornerDownRight,
  lucideFilePlus2,
  lucideFileText,
  lucideLock,
  lucideSearchX,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PermisosService } from '../../../core/permisos/permisos';
import { StepUpService } from '../../../core/step-up/step-up.service';
import { IncapacidadesApi } from '../data-access/incapacidades-api.service';
import { IncapacidadesStore } from '../data-access/incapacidades.store';

const TONO_ALERTA: Record<CodigoAlertaIncapacidad, Tono> = {
  ACUMULADO_150_DIAS: 'warning',
  ACUMULADO_180_DIAS: 'destructive',
  ACUMULADO_540_DIAS: 'destructive',
  CARGA_EXTEMPORANEA: 'info',
};

/**
 * Incapacidades list (plan §7.6): accumulated days against the legal markers, then each chain
 * with its prórrogas indented under the initial. The soporte is clinical 🔒: `clinico:read`, the
 * step-up first, and a one-shot download.
 */
@Component({
  selector: 'app-lista-incapacidades',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NgIcon,
    BarraDiasAcumulados,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    HlmButton,
    HlmSkeletonImports,
    HlmSpinner,
  ],
  providers: [
    provideIcons({
      lucideCornerDownRight,
      lucideFilePlus2,
      lucideFileText,
      lucideLock,
      lucideSearchX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (vista()) {
      @case ('cargando') {
        <div class="space-y-4" aria-busy="true" aria-label="Cargando incapacidades">
          <hlm-skeleton class="block h-36 rounded-xl" />
          <hlm-skeleton class="block h-28 rounded-xl" />
          <hlm-skeleton class="block h-28 rounded-xl" />
        </div>
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
          [titulo]="store.error()?.titulo ?? 'No pudimos cargar las incapacidades'"
          [mensaje]="store.error()?.mensaje"
          [traza]="store.error()?.traza ?? undefined"
          (reintentar)="store.recargar()"
        />
      }
      @default {
        <div class="max-w-3xl space-y-4">
          <section
            class="bg-card ring-border rounded-xl p-4 ring-1 sm:p-5"
            aria-labelledby="titulo-acumulado"
            data-testid="acumulado"
          >
            <h2 id="titulo-acumulado" class="sr-only">Días acumulados</h2>
            <halsa-barra-dias-acumulados [dias]="store.diasAcumulados()" />
          </section>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-base font-semibold">
              Certificados
              <span class="text-muted-foreground font-normal tabular-nums"
                >({{ store.incapacidades().length }})</span
              >
            </h2>
            @if (puedeCargar()) {
              <a hlmBtn routerLink="nueva">
                <ng-icon name="lucideFilePlus2" aria-hidden="true" />
                Cargar incapacidad
              </a>
            }
          </div>

          @if (store.cadenas().length) {
            <ul class="space-y-3" aria-label="Incapacidades del caso" data-testid="incapacidades">
              @for (cadena of store.cadenas(); track $index) {
                <li class="bg-card ring-border divide-border divide-y rounded-xl ring-1">
                  @if (cadena.inicial; as inicial) {
                    <ng-container
                      [ngTemplateOutlet]="fila"
                      [ngTemplateOutletContext]="{ $implicit: inicial, prorroga: false }"
                    />
                  }
                  @if (cadena.prorrogas.length) {
                    <ul [attr.aria-label]="'Prórrogas'">
                      @for (p of cadena.prorrogas; track p.id) {
                        <li class="border-border border-t first:border-t-0">
                          <ng-container
                            [ngTemplateOutlet]="fila"
                            [ngTemplateOutletContext]="{
                              $implicit: p,
                              prorroga: !!cadena.inicial,
                            }"
                          />
                        </li>
                      }
                    </ul>
                  }
                </li>
              }
            </ul>
          } @else {
            <halsa-estado-vacio
              icono="lucideFileText"
              titulo="Aún no hay incapacidades"
              descripcion="Los certificados de incapacidad del caso aparecen aquí cuando se cargan."
            />
          }
        </div>
      }
    }

    <ng-template #fila let-inc let-prorroga="prorroga">
      <div
        class="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
        [class.ps-10]="prorroga"
        [class.relative]="prorroga"
        data-testid="incapacidad"
        [attr.data-tipo]="inc.tipo"
      >
        @if (prorroga) {
          <ng-icon
            name="lucideCornerDownRight"
            class="text-muted-foreground absolute start-4 top-4.5"
            aria-hidden="true"
          />
        }
        <div class="min-w-0 space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
              [class]="inc.tipo === 'INICIAL' ? tonos.primary : tonos.neutral"
              >{{ tipo(inc.tipo) }}</span
            >
            <span class="text-sm font-semibold tabular-nums">{{ dias(inc.dias) }}</span>
          </div>
          <p class="text-sm">
            <halsa-fecha-bogota [valor]="inc.fechaInicio" />
            <span aria-hidden="true"> – </span><span class="sr-only"> a </span>
            <halsa-fecha-bogota [valor]="inc.fechaFin" />
          </p>
          <p class="text-muted-foreground text-xs tabular-nums">
            Acumulado al cargarla: {{ dias(inc.diasAcumulados) }}
          </p>
          @if (inc.alertas.length) {
            <ul class="flex flex-wrap gap-1.5 pt-0.5" aria-label="Alertas">
              @for (a of inc.alertas; track a.code) {
                <li
                  class="rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                  [class]="tonoAlerta(a)"
                  [attr.title]="a.mensaje"
                >
                  {{ alerta(a) }}
                </li>
              }
            </ul>
          }
        </div>
        @if (puedeDescargar()) {
          <button
            hlmBtn
            variant="outline"
            size="sm"
            type="button"
            class="shrink-0 self-start"
            [disabled]="descargando() !== null"
            [attr.aria-label]="'Descargar soporte de la incapacidad del ' + fechaTexto(inc)"
            (click)="descargar(inc)"
          >
            @if (descargando() === inc.id) {
              <hlm-spinner class="size-4" aria-hidden="true" />
            } @else {
              <ng-icon name="lucideLock" aria-hidden="true" />
            }
            Descargar soporte
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class ListaIncapacidadesPage {
  protected readonly store = inject(IncapacidadesStore);
  private readonly api = inject(IncapacidadesApi);
  private readonly permisos = inject(PermisosService);
  private readonly stepUp = inject(StepUpService);
  private readonly notificaciones = inject(Notificaciones);
  private readonly documento = inject(DOCUMENT);

  protected readonly tonos = TONO_SUAVE;
  protected readonly puedeCargar = computed(() => this.permisos.puede('incapacidades:write'));
  protected readonly puedeDescargar = computed(() => this.permisos.puede('clinico:read'));
  protected readonly descargando = signal<string | null>(null);
  private readonly cargado = signal(false);

  /** A reload after an upload keeps the list on screen instead of flashing skeletons. */
  protected readonly vista = computed(() => {
    const estado = this.store.estado();
    if (estado === 'cargando' || estado === 'inicial') return this.cargado() ? 'listo' : 'cargando';
    return estado;
  });

  constructor() {
    effect(() => {
      if (this.store.estado() === 'listo') untracked(() => this.cargado.set(true));
    });
  }

  protected tipo(valor: string): string {
    return getEnumLabel(TIPO_INCAPACIDAD_LABELS, valor);
  }

  protected dias(n: number): string {
    return n === 1 ? '1 día' : `${formatNumero(n)} días`;
  }

  protected alerta(a: AlertaIncapacidad): string {
    return getEnumLabel(ALERTA_INCAPACIDAD_LABELS, a.code);
  }

  protected tonoAlerta(a: AlertaIncapacidad): string {
    return TONO_SUAVE[TONO_ALERTA[a.code] ?? 'neutral'];
  }

  protected fechaTexto(inc: IncapacidadResponse): string {
    return formatFechaCorta(inc.fechaInicio);
  }

  /** Step-up first (plan §5.1.4), then a one-shot blob download; a 403/404 goes to a toast. */
  protected async descargar(inc: IncapacidadResponse): Promise<void> {
    const casoId = this.store.casoId();
    if (!casoId || this.descargando()) return;
    const requisito = { acr: 2 };
    if (!this.stepUp.cumple(requisito) && !(await this.stepUp.verificar(requisito))) return;
    this.descargando.set(inc.id);
    try {
      const { blob, nombre } = await firstValueFrom(this.api.soporte(casoId, inc.id));
      guardarBlob(this.documento, blob, nombre);
    } catch (error) {
      this.notificaciones.error(error);
    } finally {
      this.descargando.set(null);
    }
  }
}
