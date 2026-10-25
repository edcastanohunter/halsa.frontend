import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PlazoResponse } from '@halsa/api-types';
import { getEnumLabel, REGLA_PLAZO_LABELS } from '@halsa/core';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { SemaforoPlazo } from '@halsa/ui/semaforo-plazo';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck } from '@ng-icons/lucide';

/**
 * One legal deadline (plan §7.4, §7.8): rule label, legal basis, dates, semaphore and, when
 * allowed, "Marcar como cumplido". Presentational: the caller decides links and permissions.
 */
@Component({
  selector: 'app-tarjeta-plazo',
  imports: [RouterLink, NgIcon, FechaBogota, SemaforoPlazo, HlmButton],
  providers: [provideIcons({ lucideCircleCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let p = plazo();
    <article class="space-y-2" [attr.aria-labelledby]="'plazo-' + p.id">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0 space-y-0.5">
          <h3 class="font-medium" [id]="'plazo-' + p.id">{{ regla() }}</h3>
          <p class="text-muted-foreground text-xs">{{ p.baseLegal }}</p>
        </div>
        <halsa-semaforo-plazo
          [estado]="p.estado"
          [venceEn]="p.venceEn"
          [alertaEn]="p.alertaEn"
          [extemporaneo]="p.extemporaneo"
        />
      </div>
      @if (mostrarRadicado()) {
        @if (enlaceCaso()) {
          <a
            class="text-primary font-mono text-sm font-medium underline-offset-4 hover:underline"
            [routerLink]="['/casos', p.casoId, 'plazos']"
            [attr.aria-label]="'Caso ' + p.radicado + ', ver plazos del caso'"
            >{{ p.radicado }}</a
          >
        } @else {
          <p class="font-mono text-sm font-medium">{{ p.radicado }}</p>
        }
      }
      <!-- One column on phones: a date never wraps, so the card keeps its height. -->
      <dl
        class="text-muted-foreground grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 sm:text-sm [&_dd]:whitespace-nowrap"
      >
        <div>
          <dt>Inicia</dt>
          <dd class="text-foreground"><halsa-fecha-bogota [valor]="p.iniciaEn" /></dd>
        </div>
        <div>
          <dt>Vence</dt>
          <dd class="text-foreground"><halsa-fecha-bogota [valor]="p.venceEn" /></dd>
        </div>
        @if (p.cumplidoEn) {
          <div>
            <dt>Cumplido</dt>
            <dd class="text-foreground"><halsa-fecha-bogota [valor]="p.cumplidoEn" /></dd>
          </div>
        }
      </dl>
      @if (puedeCumplir()) {
        <button
          hlmBtn
          variant="outline"
          size="sm"
          type="button"
          [attr.aria-label]="'Marcar como cumplido: ' + regla() + ', ' + p.radicado"
          (click)="cumplir.emit(p)"
        >
          <ng-icon name="lucideCircleCheck" aria-hidden="true" />
          Marcar como cumplido
        </button>
      }
    </article>
  `,
})
export class TarjetaPlazo {
  readonly plazo = input.required<PlazoResponse>();
  readonly mostrarRadicado = input(true);
  /** Link the radicado to the case (only with `casos:read`, plan §7.8). */
  readonly enlaceCaso = input(false);
  readonly puedeCumplir = input(false);
  readonly cumplir = output<PlazoResponse>();

  /** Unknown rules render as the raw code (plan §4.3). */
  protected readonly regla = computed(() => getEnumLabel(REGLA_PLAZO_LABELS, this.plazo().regla));
}
