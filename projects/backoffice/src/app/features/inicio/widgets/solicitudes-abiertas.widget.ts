import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatNumero, MensajeError, mensajeDeError } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInbox, lucideRotateCw, lucideSend } from '@ng-icons/lucide';
import { firstValueFrom, forkJoin } from 'rxjs';
import { SolicitudesCopiaHcApi } from '../../../shared/privacidad/solicitudes-copia-hc-api.service';

/**
 * "Solicitudes de copia HC abiertas" (plan §7.2): RECIBIDA and EN_TRAMITE, each a link to its tab
 * of the inbox. Two parallel requests, as the plan lists them.
 */
@Component({
  selector: 'app-widget-solicitudes-abiertas',
  imports: [RouterLink, NgIcon, HlmButton, HlmCardImports, HlmSkeletonImports],
  providers: [provideIcons({ lucideInbox, lucideRotateCw, lucideSend })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section hlmCard class="h-full" aria-labelledby="w-solicitudes">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="w-solicitudes">Solicitudes de copia HC abiertas</h2>
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
        } @else if (conteos(); as c) {
          <ul class="grid grid-cols-2 gap-3" data-testid="solicitudes-abiertas">
            <li>
              <a
                routerLink="/solicitudes-copia-hc"
                class="hover:bg-muted/60 focus-visible:ring-ring ring-border flex flex-col gap-1 rounded-lg p-3 ring-1 outline-none focus-visible:ring-2"
              >
                <span class="text-info flex items-center gap-1.5 text-sm font-medium">
                  <ng-icon name="lucideInbox" aria-hidden="true" />
                  Recibidas
                </span>
                <span class="text-3xl font-semibold tabular-nums">{{ c.recibidas }}</span>
              </a>
            </li>
            <li>
              <a
                routerLink="/solicitudes-copia-hc"
                [queryParams]="{ estado: 'en-tramite' }"
                class="hover:bg-muted/60 focus-visible:ring-ring ring-border flex flex-col gap-1 rounded-lg p-3 ring-1 outline-none focus-visible:ring-2"
              >
                <span class="text-warning flex items-center gap-1.5 text-sm font-medium">
                  <ng-icon name="lucideSend" aria-hidden="true" />
                  En trámite
                </span>
                <span class="text-3xl font-semibold tabular-nums">{{ c.enTramite }}</span>
              </a>
            </li>
          </ul>
        } @else {
          <div class="grid grid-cols-2 gap-3" aria-busy="true" aria-label="Cargando solicitudes">
            <hlm-skeleton class="h-20 rounded-lg" />
            <hlm-skeleton class="h-20 rounded-lg" />
          </div>
        }
      </div>
    </section>
  `,
})
export class WidgetSolicitudesAbiertas {
  private readonly api = inject(SolicitudesCopiaHcApi);

  private readonly datos = signal<{ recibidas: number; enTramite: number } | null>(null);
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly conteos = computed(() => {
    const d = this.datos();
    return d && { recibidas: formatNumero(d.recibidas), enTramite: formatNumero(d.enTramite) };
  });

  constructor() {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.error.set(null);
    this.datos.set(null);
    try {
      const { recibidas, enTramite } = await firstValueFrom(
        forkJoin({
          recibidas: this.api.listar('RECIBIDA'),
          enTramite: this.api.listar('EN_TRAMITE'),
        }),
      );
      this.datos.set({ recibidas: recibidas.length, enTramite: enTramite.length });
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }
}
