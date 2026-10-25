import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ContadorRegresivo } from '@halsa/ui/contador-regresivo';
import { injectAhora } from '@halsa/ui/ahora';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { MARGEN_VENTANA_SEG, StepUpService } from './step-up.service';

/**
 * "Verificación vigente por 12:34" next to a time-windowed gate (plan §7.7), counting down to when
 * the gate closes. "Renovar verificación" restarts the window through the popup, so whatever the
 * user is typing stays on screen; it turns primary in the last 2 minutes. Hidden while the gate
 * is closed: the gate itself asks then.
 */
@Component({
  selector: 'app-vigencia-verificacion',
  imports: [ContadorRegresivo, HlmButton, HlmSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (hasta(); as h) {
      <div class="flex flex-wrap items-center gap-2" data-testid="vigencia-verificacion">
        <halsa-contador-regresivo
          [hasta]="h"
          etiqueta="Verificación vigente por"
          textoVencido="Verificación vencida"
          [avisoSeg]="avisoSeg"
          (vencido)="stepUp.actualizarReloj()"
        />
        <button
          hlmBtn
          size="sm"
          type="button"
          [variant]="porVencer() ? 'default' : 'ghost'"
          [disabled]="stepUp.verificando()"
          (click)="renovar()"
        >
          @if (stepUp.verificando()) {
            <hlm-spinner class="size-4" aria-hidden="true" />
          }
          <!-- Short on mobile; the accessible name is always the full one. -->
          Renovar<span class="sr-only sm:not-sr-only"> verificación</span>
        </button>
      </div>
    }
  `,
})
export class VigenciaVerificacion {
  readonly acr = input(2);
  readonly maxAgeSeg = input.required<number>();

  protected readonly stepUp = inject(StepUpService);
  protected readonly avisoSeg = MARGEN_VENTANA_SEG;
  private readonly ahora = injectAhora(1000);

  private readonly cierraEn = computed(() =>
    this.stepUp.cierraEn({ acr: this.acr(), maxAgeSeg: this.maxAgeSeg() }),
  );
  protected readonly hasta = computed(() => {
    const ms = this.cierraEn();
    return ms === null ? null : new Date(ms).toISOString();
  });
  protected readonly porVencer = computed(() => {
    const ms = this.cierraEn();
    return ms !== null && ms - this.ahora() <= MARGEN_VENTANA_SEG * 1000;
  });

  protected renovar(): void {
    void this.stepUp.verificar({ acr: this.acr(), maxAgeSeg: this.maxAgeSeg() });
  }
}
