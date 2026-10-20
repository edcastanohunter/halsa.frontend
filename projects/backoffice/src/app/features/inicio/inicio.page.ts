import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { ConPermiso, PermisosService } from '../../core/permisos/permisos';
import { SesionService } from '../../core/sesion/sesion.service';
import { ICONOS_NAVEGACION, NAVEGACION } from '../../shell/navegacion';
import { WidgetCasosPorEstado } from './widgets/casos-por-estado.widget';
import { WidgetCasosRecientes } from './widgets/casos-recientes.widget';
import { WidgetPlazosPorVencer } from './widgets/plazos-por-vencer.widget';
import { WidgetPlazosVencidos } from './widgets/plazos-vencidos.widget';
import { WidgetRevisionesPendientes } from './widgets/revisiones-pendientes.widget';
import { WidgetSolicitudesAbiertas } from './widgets/solicitudes-abiertas.widget';

type IdWidget =
  | 'revisiones-pendientes'
  | 'solicitudes-abiertas'
  | 'plazos-por-vencer'
  | 'plazos-vencidos'
  | 'casos-por-estado'
  | 'casos-recientes';

/**
 * Plan §7.2: every widget declares its permission. Time-bound queues first: the 72 h emergency
 * reviews and the copy requests, then the deadlines.
 */
const WIDGETS: readonly (ConPermiso & { id: IdWidget })[] = [
  { id: 'revisiones-pendientes', permiso: 'auditoria:revisar' },
  { id: 'solicitudes-abiertas', permiso: 'solicitudes-hc:gestionar' },
  { id: 'plazos-por-vencer', permiso: 'plazos:read' },
  { id: 'plazos-vencidos', permiso: 'plazos:read' },
  { id: 'casos-por-estado', permiso: 'casos:read' },
  { id: 'casos-recientes', permiso: 'casos:read' },
];

/**
 * `/inicio` (plan §7.2): greeting, permission-filtered widgets and quick actions. Each widget
 * fetches on its own when it scrolls into view, so one failure doesn't break the page.
 */
@Component({
  selector: 'app-inicio',
  imports: [
    RouterLink,
    NgIcon,
    HlmSkeletonImports,
    WidgetCasosPorEstado,
    WidgetCasosRecientes,
    WidgetPlazosPorVencer,
    WidgetPlazosVencidos,
    WidgetRevisionesPendientes,
    WidgetSolicitudesAbiertas,
  ],
  providers: [provideIcons({ ...ICONOS_NAVEGACION, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ saludo() }}</h1>
        <p class="text-muted-foreground text-sm">{{ contexto() }}</p>
      </header>

      @if (widgets().length) {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (w of widgets(); track w.id) {
            @switch (w.id) {
              @case ('revisiones-pendientes') {
                @defer (on viewport) {
                  <app-widget-revisiones-pendientes class="xl:col-span-2" />
                } @placeholder {
                  <hlm-skeleton class="block h-56 rounded-xl xl:col-span-2" />
                }
              }
              @case ('solicitudes-abiertas') {
                @defer (on viewport) {
                  <app-widget-solicitudes-abiertas />
                } @placeholder {
                  <hlm-skeleton class="block h-56 rounded-xl" />
                }
              }
              @case ('plazos-por-vencer') {
                @defer (on viewport) {
                  <app-widget-plazos-por-vencer class="xl:col-span-2" />
                } @placeholder {
                  <hlm-skeleton class="block h-56 rounded-xl xl:col-span-2" />
                }
              }
              @case ('plazos-vencidos') {
                @defer (on viewport) {
                  <app-widget-plazos-vencidos />
                } @placeholder {
                  <hlm-skeleton class="block h-56 rounded-xl" />
                }
              }
              @case ('casos-por-estado') {
                @defer (on viewport) {
                  <app-widget-casos-por-estado />
                } @placeholder {
                  <hlm-skeleton class="block h-56 rounded-xl" />
                }
              }
              @case ('casos-recientes') {
                @defer (on viewport) {
                  <app-widget-casos-recientes class="xl:col-span-2" />
                } @placeholder {
                  <hlm-skeleton class="block h-56 rounded-xl xl:col-span-2" />
                }
              }
            }
          }
        </div>
      }

      @if (accesos().length) {
        <section aria-labelledby="t-accesos" class="space-y-3">
          <h2 id="t-accesos" class="text-muted-foreground text-sm font-semibold">
            Accesos rápidos
          </h2>
          <ul class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            @for (item of accesos(); track item.id) {
              <li>
                <a
                  [routerLink]="item.ruta"
                  class="bg-card ring-border hover:bg-muted/60 focus-visible:ring-ring flex min-h-16 items-center gap-3 rounded-xl px-4 py-3 ring-1 outline-none focus-visible:ring-2"
                >
                  <span
                    class="bg-primary/10 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
                    aria-hidden="true"
                  >
                    <ng-icon [name]="item.icono" class="text-xl" />
                  </span>
                  <span class="flex-1 font-medium">{{ item.etiqueta }}</span>
                  <ng-icon
                    name="lucideChevronRight"
                    class="text-muted-foreground"
                    aria-hidden="true"
                  />
                </a>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
})
export class InicioPage {
  private readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosService);

  protected readonly saludo = computed(() => {
    const nombre = this.sesion.sesion()?.nombre;
    return nombre ? `Hola, ${nombre}` : 'Hola';
  });

  protected readonly contexto = computed(() => {
    const s = this.sesion.sesion();
    if (!s) return '';
    return s.actorTipo === 'ips' ? `IPS ${s.ipsId ?? ''}`.trim() : (s.tenantId ?? 'ARL');
  });

  protected readonly widgets = computed(() => this.permisos.filtrar(WIDGETS));

  protected readonly accesos = computed(() =>
    this.permisos.filtrar(NAVEGACION).filter((i) => i.id !== 'inicio' && i.id !== 'cuenta'),
  );
}
