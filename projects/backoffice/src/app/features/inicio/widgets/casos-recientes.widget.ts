import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CasoResumenResponse } from '@halsa/api-types';
import { getEnumLabel, MensajeError, mensajeDeError, TIPO_EVENTO_LABELS } from '@halsa/core';
import { EstadoBadge } from '@halsa/ui/estado-badge';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideRotateCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { CasosApi } from '../../../shared/casos/casos-api.service';

const CANTIDAD = 5;

/** "Casos recientes" (plan §7.2): the API lists newest first. */
@Component({
  selector: 'app-widget-casos-recientes',
  imports: [
    RouterLink,
    NgIcon,
    EstadoBadge,
    FechaBogota,
    HlmButton,
    HlmCardImports,
    HlmSkeletonImports,
  ],
  providers: [provideIcons({ lucideChevronRight, lucideRotateCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full" aria-labelledby="w-casos-recientes">
      <div hlmCardHeader class="flex flex-row items-center justify-between gap-2">
        <h2 hlmCardTitle id="w-casos-recientes">Casos recientes</h2>
        <a hlmBtn variant="link" size="sm" class="-me-3" routerLink="/casos">Ver todos</a>
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
        } @else if (casos(); as lista) {
          @if (lista.length) {
            <ul class="divide-border -my-2 divide-y" data-testid="casos-recientes">
              @for (c of lista; track c.id) {
                <li>
                  <a
                    [routerLink]="['/casos', c.id]"
                    class="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-2"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-mono text-sm font-medium">{{ c.radicado }}</p>
                      <p class="text-muted-foreground truncate text-xs">
                        {{ tipo(c.tipoEvento) }} ·
                        <halsa-fecha-bogota [valor]="c.fechaEvento" [conHora]="false" />
                      </p>
                    </div>
                    <halsa-estado-badge tipo="caso" [valor]="c.estado" />
                    <ng-icon
                      name="lucideChevronRight"
                      class="text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="text-muted-foreground text-sm">Aún no hay casos.</p>
          }
        } @else {
          <div class="space-y-3" aria-busy="true" aria-label="Cargando casos recientes">
            @for (i of [1, 2, 3]; track i) {
              <div class="flex items-center gap-3">
                <div class="flex-1 space-y-1.5">
                  <hlm-skeleton class="h-4 w-40" />
                  <hlm-skeleton class="h-3 w-32" />
                </div>
                <hlm-skeleton class="h-6 w-20 rounded-full" />
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class WidgetCasosRecientes {
  private readonly api = inject(CasosApi);

  protected readonly casos = signal<CasoResumenResponse[] | null>(null);
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly tipo = (t: string) => getEnumLabel(TIPO_EVENTO_LABELS, t);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(null);
    this.casos.set(null);
    try {
      const pagina = await firstValueFrom(this.api.listar({ pageSize: CANTIDAD }));
      this.casos.set(pagina.items);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }
}
