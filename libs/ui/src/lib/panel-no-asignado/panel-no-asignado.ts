import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideSiren, lucideUserX } from '@ng-icons/lucide';
import { injectCopiar } from '../utils/portapapeles';

/**
 * Shown on `403 Clinico.NoAsignado` (plan §5.1.5): explains the normal path (ask an analyst to
 * assign you, sharing your `sub`) and, for actors with `clinico:emergencia`, offers emergency access.
 */
@Component({
  selector: 'halsa-panel-no-asignado',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideUserX, lucideCopy, lucideCheck, lucideSiren })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="halsa-no-asignado-titulo"
      class="bg-card ring-foreground/10 rounded-xl p-6 shadow-xs ring-1"
    >
      <div class="flex items-start gap-4">
        <span
          class="bg-muted text-muted-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <ng-icon name="lucideUserX" class="text-xl" />
        </span>
        <div class="min-w-0 space-y-3">
          <div class="space-y-1">
            <h2 id="halsa-no-asignado-titulo" class="text-base font-semibold">
              No estás asignado a este caso
            </h2>
            <p class="text-muted-foreground text-sm">
              Para consultar la información clínica, pide a un analista de tu ARL que te asigne al
              caso. Compártele tu identificador:
            </p>
          </div>

          <div
            class="bg-muted ring-border flex max-w-full items-center gap-1 rounded-md ps-3 pe-1 ring-1 ring-inset"
          >
            <code class="min-w-0 flex-1 truncate py-2 font-mono text-xs">{{ sub() }}</code>
            <button
              hlmBtn
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Copiar mi identificador"
              (click)="copiar(sub())"
            >
              <ng-icon [name]="copiado() ? 'lucideCheck' : 'lucideCopy'" aria-hidden="true" />
            </button>
          </div>
          <span class="sr-only" aria-live="polite">
            {{ copiado() ? 'Identificador copiado' : '' }}
          </span>

          @if (puedeAccesoEmergencia()) {
            <div class="border-border border-t pt-3">
              <button hlmBtn variant="destructive" type="button" (click)="accesoEmergencia.emit()">
                <ng-icon name="lucideSiren" aria-hidden="true" />
                Acceso de emergencia
              </button>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class PanelNoAsignado {
  /** The signed-in user's `sub`. */
  readonly sub = input.required<string>();
  readonly puedeAccesoEmergencia = input(false);
  readonly accesoEmergencia = output<void>();

  private readonly portapapeles = injectCopiar();
  protected readonly copiado = this.portapapeles.copiado;
  protected readonly copiar = this.portapapeles.copiar;
}
