import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CasoPacienteResponse } from '@halsa/api-types';
import { getEnumLabel, TIPO_EVENTO_LABELS } from '@halsa/core';
import { EstadoBadge } from '@halsa/ui/estado-badge';
import { FechaRelativa } from '@halsa/ui/fecha-relativa';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';

/**
 * One case as the patient sees it (plan §7.12, Casos): radicado, ARL code (gap G9: no names),
 * event type, the state in plain language and the last update. The whole card opens the case.
 */
@Component({
  selector: 'app-tarjeta-caso',
  imports: [RouterLink, NgIcon, EstadoBadge, FechaRelativa],
  providers: [provideIcons({ lucideChevronRight })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let c = caso();
    <a
      [routerLink]="['/casos', c.casoId]"
      class="bg-card ring-border hover:ring-primary/40 focus-visible:ring-ring flex items-center gap-3 rounded-xl p-4 ring-1 transition-shadow duration-150 ease-out outline-none hover:shadow-sm focus-visible:ring-2 motion-reduce:transition-none"
    >
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-medium">{{ c.radicado }}</span>
          <span
            class="bg-muted text-muted-foreground ring-border rounded-full px-2 py-0.5 font-mono text-xs ring-1 ring-inset"
            title="ARL"
            ><span class="sr-only">, ARL </span>{{ c.arl }}</span
          >
        </div>
        <p class="text-base font-semibold">{{ tipoEvento(c.tipoEvento) }}</p>
        <halsa-estado-badge tipo="casoPaciente" [valor]="c.estado" />
        <p class="text-muted-foreground text-sm">
          Última actualización <halsa-fecha-relativa [valor]="c.ultimoHitoEn" />
        </p>
      </div>
      <ng-icon
        name="lucideChevronRight"
        class="text-muted-foreground shrink-0 text-xl"
        aria-hidden="true"
      />
    </a>
  `,
})
export class TarjetaCaso {
  readonly caso = input.required<CasoPacienteResponse>();

  protected tipoEvento(valor: string): string {
    return getEnumLabel(TIPO_EVENTO_LABELS, valor);
  }
}
