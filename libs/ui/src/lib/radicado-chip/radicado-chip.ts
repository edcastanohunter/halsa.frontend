import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { injectCopiar } from '../utils/portapapeles';

/** A radicado in monospace with a copy button (plan §8.2). */
@Component({
  selector: 'halsa-radicado-chip',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCopy, lucideCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span
      class="bg-muted text-foreground ring-border inline-flex h-7 items-center gap-1 rounded-md ps-2 pe-0.5 font-mono text-[0.8125rem] font-medium tracking-tight ring-1 ring-inset"
    >
      {{ radicado() }}
      <!-- The ::after pseudo-element grows the hit area to 44 px without changing the layout. -->
      <button
        type="button"
        class="text-muted-foreground hover:bg-card hover:text-foreground relative inline-flex size-6 items-center justify-center rounded transition-colors duration-150 after:absolute after:-inset-2.5"
        [attr.aria-label]="'Copiar radicado ' + radicado()"
        (click)="copiar(radicado())"
      >
        <ng-icon
          [name]="copiado() ? 'lucideCheck' : 'lucideCopy'"
          class="text-sm"
          aria-hidden="true"
        />
      </button>
    </span>
    <span class="sr-only" aria-live="polite">{{ copiado() ? 'Radicado copiado' : '' }}</span>
  `,
})
export class RadicadoChip {
  readonly radicado = input.required<string>();

  private readonly portapapeles = injectCopiar();
  protected readonly copiado = this.portapapeles.copiado;
  protected readonly copiar = this.portapapeles.copiar;
}
