import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { getEnumLabel, mensajeDeError, TIPO_EVENTO_LABELS } from '@halsa/core';
import { EstadoBadge, EstadoError, EstadoVacio, FechaBogota, RadicadoChip } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideLock, lucideSearchX, lucideTriangleAlert } from '@ng-icons/lucide';
import { PermisosService } from '../../../core/permisos/permisos';
import { CasoStore } from '../data-access/caso.store';
import { PESTANAS_CASO } from '../pestanas';

/**
 * `/casos/:casoId` (plan §7.4): sticky header and the permission-filtered tabs. The detail is
 * loaded once here and shared with the tabs through the route-scoped `CasoStore`.
 */
@Component({
  selector: 'app-caso-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NgIcon,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    RadicadoChip,
    HlmButton,
    HlmSkeletonImports,
  ],
  providers: [
    CasoStore,
    provideIcons({ lucideArrowLeft, lucideLock, lucideSearchX, lucideTriangleAlert }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (store.estado()) {
      @case ('no-encontrado') {
        <h1 class="sr-only">Caso no disponible</h1>
        <halsa-estado-vacio
          icono="lucideSearchX"
          titulo="Caso no encontrado o no disponible para tu usuario"
          descripcion="Puede que el caso no exista, que pertenezca a otra entidad o que ya no esté remitido a tu IPS."
        >
          <a hlmBtn variant="outline" routerLink="/casos">Volver a casos</a>
        </halsa-estado-vacio>
      }
      @case ('error') {
        @let e = errorMensaje();
        <h1 class="sr-only">Caso</h1>
        <halsa-estado-error
          titulo="No pudimos cargar el caso"
          [mensaje]="e.mensaje"
          [traza]="e.traza ?? undefined"
          (reintentar)="store.reintentar()"
        />
      }
      @default {
        <div
          class="border-border bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 -mt-6 border-b px-4 pt-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
        >
          <div class="flex items-start gap-2">
            <a
              hlmBtn
              variant="ghost"
              size="icon"
              class="-ms-2 shrink-0"
              routerLink="/casos"
              aria-label="Volver a casos"
            >
              <ng-icon name="lucideArrowLeft" aria-hidden="true" />
            </a>
            @if (store.resumen(); as r) {
              <div class="min-w-0 flex-1 space-y-1">
                <h1 class="sr-only">Caso {{ r.radicado }}</h1>
                <div class="flex flex-wrap items-center gap-2">
                  <halsa-radicado-chip [radicado]="r.radicado" />
                  <halsa-estado-badge tipo="caso" [valor]="r.estado" />
                  @if (store.detalle()?.esGraveOMortal) {
                    <span
                      class="bg-destructive/12 text-destructive ring-destructive/30 inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset"
                    >
                      <ng-icon name="lucideTriangleAlert" aria-hidden="true" />
                      Grave o mortal
                    </span>
                  }
                </div>
                <p class="text-muted-foreground text-sm">
                  {{ tipoEvento() }} ·
                  <halsa-fecha-bogota [valor]="r.fechaEvento" [conHora]="false" />
                </p>
              </div>
            } @else {
              <div class="flex-1 space-y-2" aria-busy="true" aria-label="Cargando caso">
                <hlm-skeleton class="h-7 w-48" />
                <hlm-skeleton class="h-4 w-56" />
              </div>
            }
          </div>

          <nav
            aria-label="Secciones del caso"
            class="-mx-4 mt-2 flex [scrollbar-width:none] overflow-x-auto px-2 md:-mx-6 md:px-4 lg:-mx-8 lg:px-6"
          >
            @for (p of pestanas(); track p.ruta) {
              <a
                [routerLink]="p.ruta"
                routerLinkActive="text-foreground after:bg-primary"
                ariaCurrentWhenActive="page"
                class="text-muted-foreground hover:text-foreground focus-visible:ring-ring relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full focus-visible:ring-2 focus-visible:ring-inset"
              >
                {{ p.etiqueta }}
                @if (p.clinica) {
                  <ng-icon name="lucideLock" class="text-clinical text-xs" aria-hidden="true" />
                  <span class="sr-only">(sección clínica)</span>
                }
              </a>
            }
          </nav>
        </div>

        <div class="pt-6">
          @if (store.detalle()) {
            <router-outlet />
          } @else {
            <div class="grid gap-4 md:grid-cols-2" aria-hidden="true">
              <hlm-skeleton class="h-40 rounded-xl" />
              <hlm-skeleton class="h-40 rounded-xl" />
            </div>
          }
        </div>
      }
    }
  `,
})
export class CasoShellPage {
  readonly casoId = input.required<string>();

  protected readonly store = inject(CasoStore);
  private readonly permisos = inject(PermisosService);

  protected readonly pestanas = computed(() => this.permisos.filtrar(PESTANAS_CASO));
  protected readonly tipoEvento = computed(() =>
    getEnumLabel(TIPO_EVENTO_LABELS, this.store.resumen()?.tipoEvento),
  );
  protected readonly errorMensaje = computed(() => mensajeDeError(this.store.error()));

  constructor() {
    effect(() => {
      const id = this.casoId();
      untracked(() => this.store.cargar(id));
    });
  }
}
