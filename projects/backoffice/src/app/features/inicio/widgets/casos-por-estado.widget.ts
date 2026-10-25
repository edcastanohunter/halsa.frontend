import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ESTADO_CASO_STAFF_LABELS,
  EstadoCaso,
  formatNumero,
  MensajeError,
  mensajeDeError,
} from '@halsa/core';
import { EstadoBadge } from '@halsa/ui/estado-badge';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRotateCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { CasosApi } from '../../../shared/casos/casos-api.service';

/** Plan §7.2: the states an analyst works through. */
const ESTADOS: readonly EstadoCaso[] = ['Radicado', 'Validado', 'EnAtencion', 'EnCalificacionPcl'];

interface Conteo {
  estado: EstadoCaso;
  etiqueta: string;
  total: string;
}

/** "Casos por estado": one `pageSize=1` request per state, in parallel, reading `totalCount`. */
@Component({
  selector: 'app-widget-casos-por-estado',
  imports: [RouterLink, NgIcon, EstadoBadge, HlmButton, HlmCardImports, HlmSkeletonImports],
  providers: [provideIcons({ lucideRotateCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full" aria-labelledby="w-casos-estado">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="w-casos-estado">Casos por estado</h2>
      </div>
      <div hlmCardContent>
        @if (error(); as e) {
          <div role="alert" class="space-y-2 text-sm">
            <p class="text-destructive">{{ e.titulo }}. {{ e.mensaje }}</p>
            <button hlmBtn variant="outline" size="sm" type="button" (click)="cargar()">
              <ng-icon name="lucideRotateCw" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        } @else {
          <ul class="grid grid-cols-2 gap-3" data-testid="casos-por-estado">
            @for (c of conteos() ?? marcadores; track c.estado) {
              <li>
                <a
                  [routerLink]="['/casos']"
                  [queryParams]="{ estado: c.estado }"
                  class="bg-muted/50 hover:bg-muted focus-visible:ring-ring flex min-h-20 flex-col justify-between gap-2 rounded-lg p-3 outline-none focus-visible:ring-2"
                  [attr.aria-label]="c.etiqueta + ': ' + (c.total || 'cargando')"
                >
                  <halsa-estado-badge tipo="caso" [valor]="c.estado" />
                  @if (conteos()) {
                    <span class="text-2xl font-semibold tabular-nums">{{ c.total }}</span>
                  } @else {
                    <hlm-skeleton class="h-7 w-10" />
                  }
                </a>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class WidgetCasosPorEstado {
  private readonly api = inject(CasosApi);

  protected readonly marcadores: Conteo[] = ESTADOS.map((estado) => ({
    estado,
    etiqueta: ESTADO_CASO_STAFF_LABELS[estado],
    total: '',
  }));
  protected readonly conteos = signal<Conteo[] | null>(null);
  protected readonly error = signal<MensajeError | null>(null);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(null);
    this.conteos.set(null);
    try {
      const paginas = await Promise.all(
        ESTADOS.map((estado) => firstValueFrom(this.api.listar({ estado, pageSize: 1 }))),
      );
      this.conteos.set(
        ESTADOS.map((estado, i) => ({
          estado,
          etiqueta: ESTADO_CASO_STAFF_LABELS[estado],
          total: formatNumero(paginas[i]!.totalCount),
        })),
      );
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }
}
