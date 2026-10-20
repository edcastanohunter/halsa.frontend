import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RevisionEmergenciaResponse } from '@halsa/api-types';
import { formatNumero, MensajeError, mensajeDeError } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRotateCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { subCorto } from '../../../shared/casos/caso';
import { RevisionesEmergenciaApi } from '../../../shared/privacidad/revisiones-emergencia-api.service';
import { VencimientoRevision } from '../../../shared/privacidad/vencimiento-revision';

const CANTIDAD = 3;

/**
 * "Revisiones de emergencia pendientes" (plan §7.2): the count and the ones expiring first, red
 * under 24 h. The whole queue is read (`pendientes()`): the API sorts by `ocurridoEn`, so a
 * `pageSize=5` request would show the newest, not the most urgent (gap G21).
 */
@Component({
  selector: 'app-widget-revisiones-pendientes',
  imports: [RouterLink, NgIcon, HlmButton, HlmCardImports, HlmSkeletonImports, VencimientoRevision],
  providers: [provideIcons({ lucideRotateCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full" aria-labelledby="w-revisiones">
      <div hlmCardHeader class="flex flex-row items-center justify-between gap-2">
        <h2 hlmCardTitle id="w-revisiones">Revisiones de emergencia pendientes</h2>
        <a
          hlmBtn
          variant="link"
          size="sm"
          class="-me-3"
          routerLink="/auditoria/revisiones-emergencia"
          >Ver todas</a
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
        } @else if (total(); as n) {
          <div class="space-y-4" data-testid="revisiones-pendientes">
            <!-- One text run: whitespace between two spans is dropped and "3por" would be read. -->
            <p class="text-muted-foreground text-sm">
              <span class="text-foreground me-1 text-4xl font-semibold tabular-nums">{{ n }}</span>
              por revisar
            </p>
            @if (primeras().length) {
              <ul class="divide-border -my-2 divide-y">
                @for (r of primeras(); track r.id) {
                  <li>
                    <a
                      routerLink="/auditoria/revisiones-emergencia"
                      class="hover:bg-muted/60 focus-visible:ring-ring -mx-2 flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2 py-2 outline-none focus-visible:ring-2"
                    >
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-medium">{{ r.motivo }}</span>
                        <span class="text-muted-foreground block font-mono text-xs">{{
                          corto(r.actorId)
                        }}</span>
                      </span>
                      <app-vencimiento-revision [venceEn]="r.venceRevisionEn" />
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-muted-foreground text-sm">No hay accesos de emergencia por revisar.</p>
            }
          </div>
        } @else {
          <div class="space-y-3" aria-busy="true" aria-label="Cargando revisiones pendientes">
            <hlm-skeleton class="h-10 w-16" />
            @for (i of [1, 2]; track i) {
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
export class WidgetRevisionesPendientes {
  private readonly api = inject(RevisionesEmergenciaApi);

  private readonly revisiones = signal<{
    items: RevisionEmergenciaResponse[];
    total: number;
  } | null>(null);
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly corto = subCorto;
  /** As text, so a count of 0 still renders (a 0 would read as "loading" in `@else if`). */
  protected readonly total = computed(() => {
    const r = this.revisiones();
    return r === null ? null : formatNumero(r.total);
  });
  protected readonly primeras = computed(() => this.revisiones()?.items.slice(0, CANTIDAD) ?? []);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(null);
    this.revisiones.set(null);
    try {
      this.revisiones.set(await firstValueFrom(this.api.pendientes()));
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }
}
