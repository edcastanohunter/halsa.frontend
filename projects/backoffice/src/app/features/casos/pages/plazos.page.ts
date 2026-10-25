import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import type { PlazoResponse } from '@halsa/api-types';
import { MensajeError, mensajeDeError } from '@halsa/core';
import { EstadoError } from '@halsa/ui/estado-error';
import { EstadoVacio } from '@halsa/ui/estado-vacio';
import { injectAhora } from '@halsa/ui/ahora';
import { nivelPlazo } from '@halsa/ui/nivel-plazo';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { provideIcons } from '@ng-icons/core';
import { lucideCalendarClock } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { PermisosService } from '../../../core/permisos/permisos';
import { DialogoCumplirPlazo, esCumplible } from '../../../shared/plazos/dialogo-cumplir-plazo';
import { PlazosApi } from '../../../shared/plazos/plazos-api.service';
import { TarjetaPlazo } from '../../../shared/plazos/tarjeta-plazo';
import { injectRefrescoAlVolver } from '../../../shared/refresco';
import { CasoStore } from '../data-access/caso.store';

/** Timeline dot per urgency, matching the semaphore tones (plan §8.3). */
const PUNTO: Record<string, string> = {
  normal: 'bg-muted-foreground/40',
  alerta: 'bg-warning',
  critico: 'bg-destructive',
  vencido: 'bg-destructive',
  cumplido: 'bg-success',
  suspendido: 'bg-muted-foreground/40',
};

/** Plazos tab (plan §7.4): the case's deadlines as a vertical timeline sorted by `venceEn`. */
@Component({
  selector: 'app-caso-plazos',
  imports: [EstadoError, EstadoVacio, HlmSkeletonImports, DialogoCumplirPlazo, TarjetaPlazo],
  providers: [provideIcons({ lucideCalendarClock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (fase()) {
      @case ('cargando') {
        <div class="space-y-4" aria-busy="true" aria-label="Cargando plazos">
          @for (i of [1, 2, 3]; track i) {
            <hlm-skeleton class="block h-28 rounded-xl" />
          }
        </div>
      }
      @case ('error') {
        <halsa-estado-error
          [titulo]="error()?.titulo ?? 'No pudimos cargar los plazos'"
          [mensaje]="error()?.mensaje"
          [traza]="error()?.traza ?? undefined"
          (reintentar)="cargar()"
        />
      }
      @default {
        @if (ordenados().length) {
          <ol
            class="relative max-w-3xl space-y-4"
            aria-label="Plazos del caso"
            data-testid="plazos-caso"
          >
            @for (p of ordenados(); track p.id) {
              <li class="relative ps-7">
                <!-- The line between dots; the last item has none. -->
                @if (!$last) {
                  <span
                    class="bg-border absolute start-[0.4375rem] top-5 -bottom-4 w-px"
                    aria-hidden="true"
                  ></span>
                }
                <span
                  class="ring-background absolute start-0 top-1.5 size-3.5 rounded-full ring-4"
                  [class]="punto(p)"
                  aria-hidden="true"
                ></span>
                <div class="bg-card ring-border rounded-xl p-4 ring-1">
                  <app-tarjeta-plazo
                    [plazo]="p"
                    [mostrarRadicado]="false"
                    [puedeCumplir]="puedeCumplir() && esCumplible(p)"
                    (cumplir)="enCumplimiento.set($event)"
                  />
                </div>
              </li>
            }
          </ol>
        } @else {
          <halsa-estado-vacio
            icono="lucideCalendarClock"
            titulo="El caso no tiene plazos"
            descripcion="Los plazos legales aparecen aquí cuando el caso los genera."
          />
        }
      }
    }

    <app-dialogo-cumplir-plazo
      [plazo]="enCumplimiento()"
      (cumplido)="alCumplir()"
      (cerrado)="enCumplimiento.set(null)"
    />
  `,
})
export class PlazosCasoPage {
  private readonly store = inject(CasoStore);
  private readonly api = inject(PlazosApi);
  private readonly permisos = inject(PermisosService);
  private readonly ahora = injectAhora(60_000);

  protected readonly fase = signal<'cargando' | 'listo' | 'error'>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  private readonly plazos = signal<PlazoResponse[]>([]);
  protected readonly enCumplimiento = signal<PlazoResponse | null>(null);
  protected readonly puedeCumplir = computed(() => this.permisos.puede('plazos:write'));
  protected readonly esCumplible = esCumplible;
  protected readonly ordenados = computed(() =>
    [...this.plazos()].sort((a, b) => Date.parse(a.venceEn) - Date.parse(b.venceEn)),
  );
  private cargadoEn: number | null = null;
  private peticion: Subscription | undefined;

  constructor() {
    effect(() => {
      if (this.store.casoId()) untracked(() => this.cargar());
    });
    injectRefrescoAlVolver(
      () => this.cargadoEn,
      () => this.cargar(),
    );
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected punto(p: PlazoResponse): string {
    return PUNTO[nivelPlazo(p, this.ahora())] ?? PUNTO['normal']!;
  }

  protected alCumplir(): void {
    this.enCumplimiento.set(null);
    this.cargar();
  }

  protected cargar(): void {
    const casoId = this.store.casoId();
    if (!casoId) return;
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.peticion = this.api.delCaso(casoId).subscribe({
      next: (plazos) => {
        this.plazos.set(plazos);
        this.cargadoEn = Date.now();
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.fase.set('error');
      },
    });
  }
}
