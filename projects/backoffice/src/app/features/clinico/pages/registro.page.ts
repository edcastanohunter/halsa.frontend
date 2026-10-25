import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ContenidoClinico, RegistroClinicoResponse } from '@halsa/api-types';
import {
  esErrorApi,
  formatFechaLarga,
  getEnumLabel,
  MensajeError,
  mensajeDeError,
  TIPO_REGISTRO_CLINICO_LABELS,
} from '@halsa/core';
import { EstadoError } from '@halsa/ui/estado-error';
import { EstadoVacio } from '@halsa/ui/estado-vacio';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideFilePen, lucideSearchX } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { PermisosService } from '../../../core/permisos/permisos';
import { ClinicoApi } from '../data-access/clinico-api.service';
import { HistoriaClinicaStore } from '../data-access/historia-clinica.store';

type CampoTexto = keyof Pick<
  ContenidoClinico,
  'motivo' | 'anamnesis' | 'examenFisico' | 'analisis' | 'plan' | 'observaciones'
>;

/** Plan §7.5, in this order; empty sections are hidden. */
const SECCIONES: readonly { campo: CampoTexto; titulo: string }[] = [
  { campo: 'motivo', titulo: 'Motivo' },
  { campo: 'anamnesis', titulo: 'Anamnesis' },
  { campo: 'examenFisico', titulo: 'Examen físico' },
  { campo: 'analisis', titulo: 'Análisis' },
  { campo: 'plan', titulo: 'Plan' },
];

/**
 * A clinical record (plan §7.5). Fetched on its own (with the emergency motivo when active) and
 * held in this component only. Clinical text renders as text, `white-space: pre-wrap`.
 */
@Component({
  selector: 'app-registro-clinico',
  imports: [
    RouterLink,
    NgIcon,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    HlmButton,
    HlmSkeletonImports,
  ],
  providers: [provideIcons({ lucideArrowLeft, lucideFilePen, lucideSearchX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <a hlmBtn variant="ghost" size="sm" class="-ms-2" routerLink="..">
        <ng-icon name="lucideArrowLeft" aria-hidden="true" />
        Historia clínica
      </a>

      @switch (fase()) {
        @case ('cargando') {
          <div class="space-y-3" aria-busy="true" aria-label="Cargando registro">
            <hlm-skeleton class="block h-7 w-56" />
            <hlm-skeleton class="block h-4 w-72" />
            <hlm-skeleton class="block h-24" />
          </div>
        }
        @case ('no-encontrado') {
          <halsa-estado-vacio
            icono="lucideSearchX"
            titulo="Registro no disponible"
            descripcion="No existe o no está disponible para tu usuario."
          />
        }
        @case ('error') {
          <halsa-estado-error
            titulo="No pudimos cargar el registro"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (registro(); as r) {
            <article class="space-y-5" aria-labelledby="registro-titulo">
              <header class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1">
                  <h3 id="registro-titulo" class="text-lg font-semibold">{{ tipo() }}</h3>
                  <p class="text-muted-foreground text-sm">
                    Atendido el <halsa-fecha-bogota [valor]="r.atendidoEn" /> · registrado el
                    <halsa-fecha-bogota [valor]="r.registradoEn" />
                  </p>
                  <p class="text-muted-foreground text-sm">
                    {{ r.profesional.tipoDocumento }} {{ r.profesional.numeroDocumento }}
                    @if (r.profesional.registroRethus) {
                      · RETHUS {{ r.profesional.registroRethus }}
                    }
                  </p>
                </div>
                @if (puedeCorregir()) {
                  <a
                    hlmBtn
                    variant="outline"
                    routerLink="../nuevo"
                    [queryParams]="{ corrige: r.id }"
                  >
                    <ng-icon name="lucideFilePen" aria-hidden="true" />
                    Corregir
                  </a>
                }
              </header>

              @if (r.corregidoPor) {
                <p class="bg-muted rounded-lg p-3 text-sm" data-testid="aviso-corregido">
                  Este registro fue corregido.
                  <a
                    class="text-primary font-medium underline"
                    [routerLink]="['..', r.corregidoPor]"
                    >Ver la corrección</a
                  >
                </p>
              } @else if (r.corrigeA) {
                <p class="bg-info/10 rounded-lg p-3 text-sm">
                  Este registro es una corrección.
                  <a class="text-primary font-medium underline" [routerLink]="['..', r.corrigeA]"
                    >Ver el registro original</a
                  >
                </p>
              }

              <dl class="space-y-4">
                @for (s of secciones(); track s.campo) {
                  <div>
                    <dt class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {{ s.titulo }}
                    </dt>
                    <dd class="mt-1 text-sm whitespace-pre-wrap">{{ s.texto }}</dd>
                  </div>
                }
                @if (r.contenido.diagnosticos?.length) {
                  <div>
                    <dt class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      Diagnósticos
                    </dt>
                    <dd class="mt-2">
                      <ul class="flex flex-wrap gap-2">
                        @for (d of r.contenido.diagnosticos; track $index) {
                          <li
                            class="bg-muted ring-border rounded-md px-2 py-1 text-xs ring-1 ring-inset"
                          >
                            <span class="font-mono font-medium"
                              >{{ d.sistema }} {{ d.codigo }}</span
                            >
                            @if (d.descripcion) {
                              <span class="text-muted-foreground"> · {{ d.descripcion }}</span>
                            }
                            @if ($first) {
                              <span class="text-primary font-medium"> · Principal</span>
                            }
                          </li>
                        }
                      </ul>
                    </dd>
                  </div>
                }
                @if (r.contenido.observaciones) {
                  <div>
                    <dt class="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      Observaciones
                    </dt>
                    <dd class="mt-1 text-sm whitespace-pre-wrap">
                      {{ r.contenido.observaciones }}
                    </dd>
                  </div>
                }
              </dl>

              <footer class="border-border text-muted-foreground border-t pt-3 text-xs">
                Conservar hasta {{ retenerHasta() }}
              </footer>
            </article>
          }
        }
      }
    </div>
  `,
})
export class RegistroPage {
  /** Route param, bound by `withComponentInputBinding()`. */
  readonly registroId = input.required<string>();

  private readonly api = inject(ClinicoApi);
  private readonly store = inject(HistoriaClinicaStore);
  private readonly permisos = inject(PermisosService);
  private peticion: Subscription | undefined;

  protected readonly fase = signal<'cargando' | 'listo' | 'no-encontrado' | 'error'>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly registro = signal<RegistroClinicoResponse | null>(null);

  protected readonly tipo = computed(() =>
    getEnumLabel(TIPO_REGISTRO_CLINICO_LABELS, this.registro()?.tipo),
  );
  protected readonly secciones = computed(() => {
    const c = this.registro()?.contenido;
    if (!c) return [];
    return SECCIONES.map((s) => ({ ...s, texto: c[s.campo]?.trim() ?? '' })).filter((s) => s.texto);
  });
  protected readonly retenerHasta = computed(() => formatFechaLarga(this.registro()?.retenerHasta));
  /**
   * Writes never use emergency access; a superseded record isn't corrected twice. A sick-leave
   * certificate comes from the PDF upload (M7), so it isn't corrected here. The backend doesn't
   * require the correction to keep the type: an initial report is corrected with a concepto.
   */
  protected readonly puedeCorregir = computed(() => {
    const r = this.registro();
    return (
      !!r &&
      !r.corregidoPor &&
      r.tipo !== 'CERTIFICADO_INCAPACIDAD' &&
      this.permisos.puede('clinico:write') &&
      !this.store.emergenciaActiva()
    );
  });

  constructor() {
    effect(() => {
      this.registroId();
      untracked(() => this.cargar());
    });
    inject(DestroyRef).onDestroy(() => {
      this.peticion?.unsubscribe();
      this.registro.set(null);
    });
  }

  protected cargar(): void {
    const casoId = this.store.casoId();
    if (!casoId) return;
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.registro.set(null);
    this.peticion = this.api
      .obtener(casoId, this.registroId(), this.store.motivoEmergencia())
      .subscribe({
        next: (r) => {
          this.registro.set(r);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          if (esErrorApi(error) && error.problema.status === 404) {
            this.fase.set('no-encontrado');
            return;
          }
          this.error.set(mensajeDeError(error));
          this.fase.set('error');
        },
      });
  }
}
