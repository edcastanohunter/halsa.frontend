import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatNumero, MensajeError, mensajeDeError } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleX, lucideRotateCw } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PlazosApi } from '../../../shared/plazos/plazos-api.service';

/** "Plazos vencidos" (plan §7.2): one `pageSize=1` request, reading `totalCount`. */
@Component({
  selector: 'app-widget-plazos-vencidos',
  imports: [RouterLink, NgIcon, HlmButton, HlmCardImports, HlmSkeletonImports],
  providers: [provideIcons({ lucideCircleX, lucideRotateCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full" aria-labelledby="w-plazos-vencidos">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="w-plazos-vencidos">Plazos vencidos</h2>
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
          <a
            routerLink="/plazos"
            [queryParams]="{ estado: 'VENCIDO' }"
            class="hover:bg-muted/60 focus-visible:ring-ring -m-2 flex items-center gap-4 rounded-lg p-2 outline-none focus-visible:ring-2"
            data-testid="plazos-vencidos"
          >
            <span
              class="inline-flex size-12 shrink-0 items-center justify-center rounded-full"
              [class]="
                hayVencidos()
                  ? 'bg-destructive/12 text-destructive'
                  : 'bg-muted text-muted-foreground'
              "
              aria-hidden="true"
            >
              <ng-icon name="lucideCircleX" class="text-2xl" />
            </span>
            <span>
              <span
                class="block text-4xl font-semibold tabular-nums"
                [class.text-destructive]="hayVencidos()"
                >{{ n }}</span
              >
              <span class="text-muted-foreground text-sm">Ver plazos vencidos</span>
            </span>
          </a>
        } @else {
          <div
            class="flex items-center gap-4"
            aria-busy="true"
            aria-label="Cargando plazos vencidos"
          >
            <hlm-skeleton class="size-12 rounded-full" />
            <hlm-skeleton class="h-10 w-16" />
          </div>
        }
      </div>
    </section>
  `,
})
export class WidgetPlazosVencidos {
  private readonly api = inject(PlazosApi);

  private readonly conteo = signal<number | null>(null);
  protected readonly error = signal<MensajeError | null>(null);
  /** As text, so a count of 0 still renders (a 0 would read as "loading" in `@else if`). */
  protected readonly total = computed(() => {
    const n = this.conteo();
    return n === null ? null : formatNumero(n);
  });
  protected readonly hayVencidos = computed(() => (this.conteo() ?? 0) > 0);

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(null);
    this.conteo.set(null);
    try {
      const pagina = await firstValueFrom(this.api.listar({ estado: 'VENCIDO', pageSize: 1 }));
      this.conteo.set(pagina.totalCount);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }
}
