import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { RegistroClinicoResponse } from '@halsa/api-types';
import { getEnumLabel, TIPO_REGISTRO_CLINICO_LABELS } from '@halsa/core';
import { EstadoVacio, FechaBogota } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSwitch } from '@halsa/ui/helm/switch';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFilePlus2, lucideFileText } from '@ng-icons/lucide';
import { PermisosService } from '../../../core/permisos/permisos';
import { HistoriaClinicaStore } from '../data-access/historia-clinica.store';

/**
 * Historia clínica list (plan §7.5): newest care first; records superseded by a correction are
 * hidden behind "Mostrar versiones corregidas". Writes are hidden during emergency access.
 */
@Component({
  selector: 'app-registros-clinicos',
  imports: [RouterLink, NgIcon, EstadoVacio, FechaBogota, HlmButton, HlmSwitch],
  providers: [provideIcons({ lucideChevronRight, lucideFilePlus2, lucideFileText })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-h-11 items-center gap-2 text-sm">
          <hlm-switch
            inputId="mostrar-corregidos"
            [checked]="mostrarCorregidos()"
            (checkedChange)="mostrarCorregidos.set($event)"
          />
          <label for="mostrar-corregidos">
            Mostrar versiones corregidas
            @if (corregidos()) {
              <span class="text-muted-foreground tabular-nums">({{ corregidos() }})</span>
            }
          </label>
        </div>
        @if (puedeEscribir()) {
          <a hlmBtn routerLink="nuevo">
            <ng-icon name="lucideFilePlus2" aria-hidden="true" />
            Nuevo registro
          </a>
        }
      </div>

      @if (visibles().length) {
        <ul
          class="divide-border -mx-4 divide-y"
          aria-label="Registros clínicos"
          data-testid="registros"
        >
          @for (r of visibles(); track r.id) {
            <li class="relative px-4 py-3" [class.opacity-70]="!!r.corregidoPor">
              <div class="flex items-start gap-3">
                <span
                  class="bg-clinical/12 text-clinical mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg"
                  aria-hidden="true"
                >
                  <ng-icon name="lucideFileText" />
                </span>
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <a
                      [routerLink]="r.id"
                      class="font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                      >{{ tipo(r.tipo) }}</a
                    >
                    @if (r.corregidoPor) {
                      <span
                        class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium"
                        >Corregido</span
                      >
                    } @else if (r.corrigeA) {
                      <span
                        class="bg-info/12 text-info rounded-full px-2 py-0.5 text-xs font-medium"
                        >Corrección</span
                      >
                    }
                  </div>
                  <p class="text-muted-foreground text-sm">
                    <halsa-fecha-bogota [valor]="r.atendidoEn" /> ·
                    {{ r.profesional.tipoDocumento }} {{ r.profesional.numeroDocumento }}
                    @if (r.profesional.registroRethus) {
                      · RETHUS {{ r.profesional.registroRethus }}
                    }
                  </p>
                  @if (principal(r); as dx) {
                    <p>
                      <span
                        class="bg-muted ring-border rounded-md px-2 py-0.5 font-mono text-xs ring-1 ring-inset"
                        >CIE-10 {{ dx }}</span
                      >
                    </p>
                  }
                </div>
                <ng-icon
                  name="lucideChevronRight"
                  class="text-muted-foreground mt-2 shrink-0"
                  aria-hidden="true"
                />
              </div>
            </li>
          }
        </ul>
      } @else {
        <halsa-estado-vacio
          icono="lucideFileText"
          titulo="Aún no hay registros clínicos"
          descripcion="Los conceptos y evoluciones del caso aparecen aquí."
        />
      }
    </div>
  `,
})
export class RegistrosPage {
  private readonly store = inject(HistoriaClinicaStore);
  private readonly permisos = inject(PermisosService);

  protected readonly mostrarCorregidos = signal(false);
  protected readonly puedeEscribir = computed(
    () => this.permisos.puede('clinico:write') && !this.store.emergenciaActiva(),
  );
  protected readonly corregidos = computed(
    () => this.store.registros().filter((r) => !!r.corregidoPor).length,
  );
  protected readonly visibles = computed(() =>
    this.mostrarCorregidos()
      ? this.store.ordenados()
      : this.store.ordenados().filter((r) => !r.corregidoPor),
  );

  protected tipo(valor: string): string {
    return getEnumLabel(TIPO_REGISTRO_CLINICO_LABELS, valor);
  }

  protected principal(r: RegistroClinicoResponse): string | null {
    return r.contenido.diagnosticos?.[0]?.codigo ?? null;
  }
}
