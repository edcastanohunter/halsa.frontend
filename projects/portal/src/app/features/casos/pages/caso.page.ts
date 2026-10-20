import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CasoPacienteResponse, HitoResponse } from '@halsa/api-types';
import {
  esErrorApi,
  formatFechaDiaBogota,
  getEnumLabel,
  HITO_PACIENTE_LABELS,
  MensajeError,
  mensajeDeError,
  TIPO_EVENTO_LABELS,
} from '@halsa/core';
import { EstadoBadge, EstadoError, EstadoVacio } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBadgeCheck,
  lucideCalendarDays,
  lucideCircleDot,
  lucideCircleX,
  lucideFileText,
  lucideFolderOpen,
  lucideHospital,
  lucideInbox,
  lucideMailOpen,
  lucideScale,
  lucideSearchX,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PacienteApi } from '../../../shared/paciente-api.service';

type Fase = 'cargando' | 'listo' | 'no-disponible' | 'error';

/** Plan §7.12: an icon per milestone type; an unknown type still renders, with a neutral dot. */
const ICONO_HITO: Record<string, string> = {
  RADICADO: 'lucideInbox',
  VALIDADO: 'lucideBadgeCheck',
  RECHAZADO: 'lucideCircleX',
  REMITIDO_A_IPS: 'lucideHospital',
  INCAPACIDAD_REGISTRADA: 'lucideCalendarDays',
  DICTAMEN_NOTIFICADO: 'lucideMailOpen',
  DICTAMEN_EN_FIRME: 'lucideScale',
};

/**
 * `/casos/:casoId` (plan §7.12): the case's timeline, newest first, with the server's own
 * description of each milestone, and the request for a copy of the clinical record. A `404`
 * means the case isn't linked to this account; the page doesn't claim it doesn't exist.
 */
@Component({
  selector: 'app-caso',
  imports: [
    RouterLink,
    NgIcon,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    HlmButton,
    HlmSkeletonImports,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideBadgeCheck,
      lucideCalendarDays,
      lucideCircleDot,
      lucideCircleX,
      lucideFileText,
      lucideFolderOpen,
      lucideHospital,
      lucideInbox,
      lucideMailOpen,
      lucideScale,
      lucideSearchX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6 pb-20 lg:pb-0">
      <a hlmBtn variant="ghost" routerLink="/casos" class="-ms-3">
        <ng-icon name="lucideArrowLeft" aria-hidden="true" /> Mis casos
      </a>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando el caso" class="space-y-4">
            <hlm-skeleton class="h-8 w-56" />
            <hlm-skeleton class="h-6 w-72 rounded-full" />
            @for (i of [1, 2, 3]; track i) {
              <div class="flex gap-3">
                <hlm-skeleton class="size-10 rounded-full" />
                <div class="flex-1 space-y-2">
                  <hlm-skeleton class="h-5 w-48" />
                  <hlm-skeleton class="h-4 w-2/3" />
                </div>
              </div>
            }
          </div>
        }
        @case ('no-disponible') {
          <h1 class="sr-only">Caso no disponible</h1>
          <halsa-estado-vacio
            icono="lucideSearchX"
            titulo="Este caso no está disponible"
            descripcion="No existe o no está vinculado a tu cuenta."
          >
            <a hlmBtn variant="outline" routerLink="/casos">Ver mis casos</a>
          </halsa-estado-vacio>
        }
        @case ('error') {
          <h1 class="sr-only">Mi caso</h1>
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar el caso'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          <header class="space-y-3">
            <div class="space-y-1">
              @if (caso(); as c) {
                <p class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                  <span class="text-foreground font-mono font-medium">{{ c.radicado }}</span>
                  <span
                    class="bg-muted ring-border rounded-full px-2 py-0.5 font-mono text-xs ring-1 ring-inset"
                    title="ARL"
                    ><span class="sr-only">, ARL </span>{{ c.arl }}</span
                  >
                </p>
                <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">
                  {{ tipoEvento(c.tipoEvento) }}
                </h1>
                <p class="text-muted-foreground text-sm">Ocurrió el {{ dia(c.fechaEvento) }}</p>
              } @else {
                <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">Mi caso</h1>
              }
            </div>
            @if (caso(); as c) {
              <halsa-estado-badge tipo="casoPaciente" [valor]="c.estado" />
            }
          </header>

          <section aria-labelledby="titulo-linea" class="space-y-4">
            <h2 id="titulo-linea" class="text-lg font-semibold">Línea de tiempo</h2>
            @if (!hitos().length) {
              <p class="text-muted-foreground">Aún no hay movimientos en este caso.</p>
            } @else {
              <ol class="relative" data-testid="linea-tiempo">
                @for (h of hitos(); track $index; let primero = $first; let ultimo = $last) {
                  <li class="relative flex gap-4 pb-6 last:pb-0">
                    @if (!ultimo) {
                      <span
                        class="bg-border absolute top-11 bottom-1 left-5 w-px -translate-x-1/2"
                        aria-hidden="true"
                      ></span>
                    }
                    <span
                      class="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
                      [class]="
                        primero
                          ? 'bg-primary text-primary-foreground ring-primary'
                          : 'bg-card text-muted-foreground ring-border'
                      "
                      aria-hidden="true"
                    >
                      <ng-icon [name]="icono(h.tipo)" class="text-lg" />
                    </span>
                    <div class="min-w-0 flex-1 space-y-1 pt-1.5">
                      <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span class="font-semibold">{{ titulo(h.tipo) }}</span>
                        @if (primero) {
                          <span
                            class="bg-primary/12 text-primary ring-primary/25 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                            ><span class="sr-only">, </span>Lo más reciente</span
                          >
                        }
                      </p>
                      <p class="text-muted-foreground text-sm">
                        <time [attr.datetime]="h.fecha">{{ dia(h.fecha) }}</time>
                      </p>
                      @if (h.descripcion) {
                        <p class="text-sm">{{ h.descripcion }}</p>
                      }
                    </div>
                  </li>
                }
              </ol>
            }
          </section>

          <div
            class="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
          >
            <a
              hlmBtn
              size="lg"
              class="w-full lg:w-auto"
              [routerLink]="['/casos', casoId(), 'solicitar-copia']"
            >
              <ng-icon name="lucideFileText" aria-hidden="true" />
              Solicitar copia de mi historia clínica
            </a>
          </div>
        }
      }
    </div>
  `,
})
export class CasoPage implements OnInit {
  readonly casoId = input.required<string>();

  private readonly api = inject(PacienteApi);

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly caso = signal<CasoPacienteResponse | null>(null);
  private readonly lineaTiempo = signal<HitoResponse[]>([]);

  protected readonly hitos = computed(() =>
    [...this.lineaTiempo()].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)),
  );

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.fase.set('cargando');
    const casoId = this.casoId();
    try {
      // The timeline decides whether the case is visible; mis-casos only adds its header.
      const [hitos, casos] = await Promise.all([
        firstValueFrom(this.api.lineaTiempo(casoId)),
        firstValueFrom(this.api.misCasos()),
      ]);
      this.lineaTiempo.set(hitos);
      this.caso.set(casos.find((c) => c.casoId === casoId) ?? null);
      this.fase.set('listo');
    } catch (error) {
      if (esErrorApi(error) && error.problema.status === 404) {
        this.fase.set('no-disponible');
        return;
      }
      this.error.set(mensajeDeError(error));
      this.fase.set('error');
    }
  }

  protected titulo(tipo: string): string {
    return getEnumLabel(HITO_PACIENTE_LABELS, tipo);
  }

  protected icono(tipo: string): string {
    return ICONO_HITO[tipo] ?? 'lucideCircleDot';
  }

  protected tipoEvento(valor: string): string {
    return getEnumLabel(TIPO_EVENTO_LABELS, valor);
  }

  protected dia(iso: string): string {
    return formatFechaDiaBogota(iso);
  }
}
