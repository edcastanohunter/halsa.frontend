import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { PermisosService } from '../../core/permisos/permisos';
import { SesionService } from '../../core/sesion/sesion.service';
import { ICONOS_NAVEGACION, NAVEGACION } from '../../shell/navegacion';

/**
 * `/inicio` (plan §7.2). M3 ships the greeting and the permission-filtered quick actions; the
 * data widgets arrive with their features (casos in M4, plazos in M5, privacidad in M9).
 */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, NgIcon],
  providers: [provideIcons({ ...ICONOS_NAVEGACION, lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-8">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ saludo() }}</h1>
        <p class="text-muted-foreground text-sm">{{ contexto() }}</p>
      </header>

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

  protected readonly accesos = computed(() =>
    this.permisos.filtrar(NAVEGACION).filter((i) => i.id !== 'inicio' && i.id !== 'cuenta'),
  );
}
