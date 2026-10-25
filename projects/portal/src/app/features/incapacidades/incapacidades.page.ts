import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  getEnumLabel,
  hoyBogota,
  MensajeError,
  mensajeDeError,
  TIPO_EVENTO_LABELS,
  TIPO_INCAPACIDAD_LABELS,
} from '@halsa/core';
import { EstadoError } from '@halsa/ui/estado-error';
import { EstadoVacio } from '@halsa/ui/estado-vacio';
import { TONO_SUAVE } from '@halsa/ui/tono';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { provideIcons } from '@ng-icons/core';
import { lucideCalendarDays } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { diasTexto, rangoFechas } from '../../shared/formato';
import { PacienteApi } from '../../shared/paciente-api.service';
import { agruparPorCaso, GrupoIncapacidades, Vigencia } from './agrupar';

type Fase = 'cargando' | 'listo' | 'error';

const VIGENCIA: Record<Vigencia, { etiqueta: string; clases: string }> = {
  vigente: { etiqueta: 'Vigente', clases: TONO_SUAVE.primary },
  proxima: { etiqueta: 'Próxima', clases: TONO_SUAVE.info },
  terminada: { etiqueta: 'Terminada', clases: TONO_SUAVE.muted },
};

/** `/incapacidades` (plan §7.12): every certificate of the linked cases, grouped by case. */
@Component({
  selector: 'app-incapacidades',
  imports: [RouterLink, EstadoError, EstadoVacio, HlmSkeletonImports],
  providers: [provideIcons({ lucideCalendarDays })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">Mis incapacidades</h1>
        <p class="text-muted-foreground">
          Las incapacidades que tus médicos registraron en tus casos.
        </p>
      </header>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando incapacidades" class="space-y-3">
            <hlm-skeleton class="h-5 w-48" />
            @for (i of [1, 2]; track i) {
              <hlm-skeleton class="h-24 w-full rounded-xl" />
            }
          </div>
        }
        @case ('error') {
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar tus incapacidades'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (!grupos().length) {
            <halsa-estado-vacio
              icono="lucideCalendarDays"
              titulo="No tienes incapacidades registradas"
              descripcion="Cuando tu médico registre una incapacidad en tu caso, la verás aquí."
            />
          } @else {
            <div class="space-y-8">
              @for (g of grupos(); track g.casoId) {
                <section
                  class="space-y-3"
                  [attr.aria-labelledby]="'grupo-' + g.casoId"
                  data-testid="grupo-incapacidades"
                >
                  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 [id]="'grupo-' + g.casoId" class="text-lg font-semibold">
                      @if (g.caso; as c) {
                        {{ tipoEvento(c.tipoEvento) }}
                        <a
                          [routerLink]="['/casos', g.casoId]"
                          class="text-primary ms-1 font-mono text-sm font-medium underline-offset-4 hover:underline"
                          >{{ c.radicado }}</a
                        >
                      } @else {
                        Caso
                      }
                    </h2>
                    <p class="text-muted-foreground text-sm">
                      Acumulados:
                      <span class="text-foreground font-semibold tabular-nums">{{
                        dias(g.acumulados)
                      }}</span>
                    </p>
                  </div>
                  <ul class="grid gap-3 lg:grid-cols-2">
                    @for (i of g.incapacidades; track i.id) {
                      <li class="bg-card ring-border space-y-2 rounded-xl p-4 ring-1">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <span class="text-muted-foreground text-sm font-medium">{{
                            tipo(i.tipo)
                          }}</span>
                          <span
                            class="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset"
                            [class]="vigenciaDe(i.vigencia).clases"
                            ><span class="sr-only">, </span
                            >{{ vigenciaDe(i.vigencia).etiqueta }}</span
                          >
                        </div>
                        <p class="text-xl font-semibold tracking-tight tabular-nums">
                          {{ rango(i.fechaInicio, i.fechaFin) }}
                        </p>
                        <p class="text-muted-foreground text-sm">
                          <span class="text-foreground font-medium tabular-nums">{{
                            dias(i.dias)
                          }}</span>
                          · <span class="tabular-nums">{{ i.diasAcumulados }}</span> acumulados
                        </p>
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          }
        }
      }
    </div>
  `,
})
export class IncapacidadesPage implements OnInit {
  private readonly api = inject(PacienteApi);

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly grupos = signal<GrupoIncapacidades[]>([]);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.fase.set('cargando');
    try {
      const [incapacidades, casos] = await Promise.all([
        firstValueFrom(this.api.incapacidades()),
        firstValueFrom(this.api.misCasos()),
      ]);
      this.grupos.set(agruparPorCaso(incapacidades, casos, hoyBogota()));
      this.fase.set('listo');
    } catch (error) {
      this.error.set(mensajeDeError(error));
      this.fase.set('error');
    }
  }

  protected tipo(valor: string): string {
    return getEnumLabel(TIPO_INCAPACIDAD_LABELS, valor);
  }

  protected tipoEvento(valor: string): string {
    return getEnumLabel(TIPO_EVENTO_LABELS, valor);
  }

  protected vigenciaDe(v: Vigencia) {
    return VIGENCIA[v];
  }

  protected rango(inicio: string, fin: string): string {
    return rangoFechas(inicio, fin);
  }

  protected dias(n: number): string {
    return diasTexto(n);
  }
}
