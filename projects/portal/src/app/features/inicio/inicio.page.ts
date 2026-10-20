import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ResumenPacienteResponse } from '@halsa/api-types';
import {
  compararFechas,
  diasEntre,
  formatFechaLarga,
  getEnumLabel,
  hoyBogota,
  MensajeError,
  mensajeDeError,
  PROXIMO_HITO_LABELS,
} from '@halsa/core';
import { EstadoError, EstadoVacio } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCalendarDays, lucideFlag, lucideFolderOpen, lucideScale } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { SesionPaciente } from '../../core/sesion/sesion.service';
import { diasTexto, rangoFechas, textoEnDias } from '../../shared/formato';
import { PacienteApi } from '../../shared/paciente-api.service';
import { TarjetaCaso } from '../../shared/tarjeta-caso';

type Fase = 'cargando' | 'listo' | 'error';

/** Plain-language meaning of each upcoming milestone (plan §7.12). */
const EXPLICACION_HITO: Record<string, string> = {
  FIN_INCAPACIDAD:
    'Ese día termina tu incapacidad actual. Si tu médico la prorroga, verás la nueva fecha aquí.',
  VENCE_CONTROVERSIA:
    'Si no estás de acuerdo con el dictamen, puedes presentar tu inconformidad ante tu ARL hasta ese día.',
};
const ICONO_HITO: Record<string, string> = {
  FIN_INCAPACIDAD: 'lucideCalendarDays',
  VENCE_CONTROVERSIA: 'lucideScale',
};

/**
 * `/inicio` (plan §7.12): a greeting and three cards from `GET /paciente/api/resumen`, the sick
 * leave in force first because it is what the patient checks most.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    RouterLink,
    NgIcon,
    EstadoError,
    EstadoVacio,
    HlmButton,
    HlmSkeletonImports,
    TarjetaCaso,
  ],
  providers: [provideIcons({ lucideCalendarDays, lucideFlag, lucideFolderOpen, lucideScale })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">{{ saludo() }}</h1>
        <p class="text-muted-foreground">Este es el resumen de tus casos.</p>
      </header>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando resumen" class="grid gap-4 lg:grid-cols-2">
            @for (i of [1, 2]; track i) {
              <div class="bg-card ring-border space-y-3 rounded-2xl p-5 ring-1">
                <hlm-skeleton class="h-5 w-40" />
                <hlm-skeleton class="h-9 w-2/3" />
                <hlm-skeleton class="h-4 w-1/2" />
              </div>
            }
          </div>
        }
        @case ('error') {
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar tu resumen'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (resumen(); as r) {
            @if (!r.casosActivos.length) {
              <halsa-estado-vacio
                icono="lucideFolderOpen"
                titulo="No tienes casos activos"
                descripcion="Cuando tu ARL registre un caso con tu documento, lo verás aquí."
              >
                <a hlmBtn variant="outline" routerLink="/casos">Ver todos mis casos</a>
              </halsa-estado-vacio>
            } @else {
              <div class="grid items-start gap-4 lg:grid-cols-2">
                @for (inc of vigentes(); track inc.casoId + inc.fechaInicio) {
                  <section
                    class="bg-primary text-primary-foreground space-y-4 rounded-2xl p-5 shadow-sm lg:p-6"
                    aria-labelledby="titulo-vigente"
                    data-testid="incapacidad-vigente"
                  >
                    <h2
                      id="titulo-vigente"
                      class="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase"
                    >
                      <ng-icon name="lucideCalendarDays" class="text-lg" aria-hidden="true" />
                      Incapacidad vigente
                    </h2>
                    <p class="text-3xl font-semibold tracking-tight tabular-nums">
                      {{ rango(inc.fechaInicio, inc.fechaFin) }}
                    </p>
                    <div class="space-y-2">
                      <div
                        class="bg-primary-foreground/25 h-2 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-label="Días transcurridos de la incapacidad"
                        [attr.aria-valuemin]="0"
                        [attr.aria-valuemax]="inc.dias"
                        [attr.aria-valuenow]="inc.transcurridos"
                        [attr.aria-valuetext]="'Día ' + inc.transcurridos + ' de ' + inc.dias"
                      >
                        <div
                          class="bg-primary-foreground h-full rounded-full"
                          [style.width.%]="(inc.transcurridos / inc.dias) * 100"
                        ></div>
                      </div>
                      <p class="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                        <span>Termina el {{ largo(inc.fechaFin) }}</span>
                        <span class="font-medium tabular-nums">{{ inc.restante }}</span>
                      </p>
                    </div>
                  </section>
                }

                @if (hitos().length) {
                  <section
                    class="bg-card ring-border space-y-4 rounded-2xl p-5 ring-1 lg:p-6"
                    aria-labelledby="titulo-hitos"
                  >
                    <h2 id="titulo-hitos" class="flex items-center gap-2 text-lg font-semibold">
                      <ng-icon name="lucideFlag" class="text-primary" aria-hidden="true" />
                      Próximos hitos
                    </h2>
                    <ul class="divide-border divide-y" data-testid="proximos-hitos">
                      @for (h of hitos(); track h.casoId + h.tipo) {
                        <li class="flex gap-3 py-3 first:pt-0 last:pb-0">
                          <span
                            class="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-full"
                            aria-hidden="true"
                          >
                            <ng-icon [name]="h.icono" class="text-lg" />
                          </span>
                          <div class="min-w-0 space-y-1">
                            <p class="font-semibold">{{ h.titulo }}</p>
                            <p class="text-sm">
                              <span class="font-medium">{{ largo(h.fecha) }}</span>
                              <span class="text-muted-foreground"> · {{ h.cuando }}</span>
                            </p>
                            <p class="text-muted-foreground text-sm">{{ h.explicacion }}</p>
                            @if (h.radicado) {
                              <a
                                [routerLink]="['/casos', h.casoId]"
                                class="text-primary inline-block text-sm font-medium underline-offset-4 hover:underline"
                                >Caso <span class="font-mono">{{ h.radicado }}</span></a
                              >
                            }
                          </div>
                        </li>
                      }
                    </ul>
                  </section>
                }

                <section
                  class="space-y-3 lg:col-span-2"
                  aria-labelledby="titulo-casos"
                  data-testid="casos-activos"
                >
                  <div class="flex items-baseline justify-between gap-3">
                    <h2 id="titulo-casos" class="text-lg font-semibold">
                      Casos activos
                      <span
                        class="bg-muted text-muted-foreground ms-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm tabular-nums"
                        >{{ r.casosActivos.length }}</span
                      >
                    </h2>
                    <a
                      routerLink="/casos"
                      class="text-primary text-sm font-medium underline-offset-4 hover:underline"
                      >Ver todos</a
                    >
                  </div>
                  <ul class="grid gap-3 lg:grid-cols-2">
                    @for (c of r.casosActivos; track c.casoId) {
                      <li><app-tarjeta-caso [caso]="c" /></li>
                    }
                  </ul>
                </section>
              </div>
            }
          }
        }
      }
    </div>
  `,
})
export class InicioPage implements OnInit {
  private readonly api = inject(PacienteApi);
  private readonly sesion = inject(SesionPaciente);

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly resumen = signal<ResumenPacienteResponse | null>(null);

  protected readonly saludo = computed(() => {
    const nombre = this.sesion.usuario()?.nombre?.trim().split(/\s+/)[0];
    return nombre ? `Hola, ${nombre}` : 'Hola';
  });

  protected readonly vigentes = computed(() => {
    const hoy = hoyBogota();
    return (this.resumen()?.incapacidadesVigentes ?? []).map((i) => {
      const restante = diasEntre(hoy, i.fechaFin) ?? 0;
      const transcurridos = Math.min(i.dias, Math.max(1, (diasEntre(i.fechaInicio, hoy) ?? 0) + 1));
      return {
        ...i,
        transcurridos,
        restante: restante <= 0 ? 'Hoy es el último día' : `Faltan ${diasTexto(restante)}`,
      };
    });
  });

  protected readonly hitos = computed(() => {
    const r = this.resumen();
    if (!r) return [];
    const hoy = hoyBogota();
    return [...r.proximosHitos]
      .sort((a, b) => compararFechas(a.fecha, b.fecha))
      .map((h) => ({
        ...h,
        titulo: getEnumLabel(PROXIMO_HITO_LABELS, h.tipo),
        explicacion: EXPLICACION_HITO[h.tipo] ?? '',
        icono: ICONO_HITO[h.tipo] ?? 'lucideFlag',
        cuando: textoEnDias(diasEntre(hoy, h.fecha) ?? 0),
        radicado: r.casosActivos.find((c) => c.casoId === h.casoId)?.radicado ?? null,
      }));
  });

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.fase.set('cargando');
    try {
      this.resumen.set(await firstValueFrom(this.api.resumen()));
      this.fase.set('listo');
    } catch (error) {
      this.error.set(mensajeDeError(error));
      this.fase.set('error');
    }
  }

  protected rango(inicio: string, fin: string): string {
    return rangoFechas(inicio, fin);
  }

  protected largo(fecha: string): string {
    return formatFechaLarga(fecha);
  }
}
