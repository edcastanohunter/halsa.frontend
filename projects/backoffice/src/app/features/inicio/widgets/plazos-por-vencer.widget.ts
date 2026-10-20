import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PlazoResponse } from '@halsa/api-types';
import { getEnumLabel, MensajeError, mensajeDeError, REGLA_PLAZO_LABELS } from '@halsa/core';
import { SemaforoPlazo } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRotateCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PlazosApi } from '../../../shared/plazos/plazos-api.service';

const DIA_MS = 86_400_000;
const CANTIDAD = 5;

/** "Plazos por vencer (7 días)" (plan §7.2): the next 5 open deadlines, soonest first. */
@Component({
  selector: 'app-widget-plazos-por-vencer',
  imports: [RouterLink, NgIcon, SemaforoPlazo, HlmButton, HlmCardImports, HlmSkeletonImports],
  providers: [provideIcons({ lucideRotateCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full" aria-labelledby="w-plazos-vencer">
      <div hlmCardHeader class="flex flex-row items-center justify-between gap-2">
        <h2 hlmCardTitle id="w-plazos-vencer">Plazos por vencer (7 días)</h2>
        <a
          hlmBtn
          variant="link"
          size="sm"
          class="-me-3"
          routerLink="/plazos"
          [queryParams]="{ estado: 'ABIERTO' }"
          >Ver todos</a
        >
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
        } @else if (plazos(); as lista) {
          @if (lista.length) {
            <ul class="divide-border -my-2 divide-y" data-testid="plazos-por-vencer">
              @for (p of lista; track p.id) {
                <li>
                  <a
                    [routerLink]="['/casos', p.casoId, 'plazos']"
                    class="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2 py-2 outline-none focus-visible:ring-2"
                  >
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-medium">{{ regla(p.regla) }}</span>
                      <span class="text-muted-foreground block font-mono text-xs">{{
                        p.radicado
                      }}</span>
                    </span>
                    <halsa-semaforo-plazo
                      [estado]="p.estado"
                      [venceEn]="p.venceEn"
                      [alertaEn]="p.alertaEn"
                    />
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="text-muted-foreground text-sm">Nada vence en los próximos 7 días.</p>
          }
        } @else {
          <div class="space-y-3" aria-busy="true" aria-label="Cargando plazos por vencer">
            @for (i of [1, 2, 3]; track i) {
              <div class="flex items-center justify-between gap-3">
                <hlm-skeleton class="h-4 w-40" />
                <hlm-skeleton class="h-6 w-24 rounded-full" />
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class WidgetPlazosPorVencer {
  private readonly api = inject(PlazosApi);

  protected readonly plazos = signal<PlazoResponse[] | null>(null);
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly regla = (r: string) => getEnumLabel(REGLA_PLAZO_LABELS, r);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(null);
    this.plazos.set(null);
    try {
      const pagina = await firstValueFrom(
        this.api.listar({
          estado: 'ABIERTO',
          venceAntesDe: new Date(Date.now() + 7 * DIA_MS).toISOString(),
          pageSize: CANTIDAD,
        }),
      );
      this.plazos.set(pagina.items);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }
}
