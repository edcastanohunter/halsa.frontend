import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { injectCopiar } from '@halsa/ui/portapapeles';
import { HlmTooltipImports } from '@halsa/ui/helm/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { subCorto } from './casos/caso';

/**
 * A technical identifier (sub, UUID, correlation id) in monospace with a copy button. `corto`
 * shows it shortened (gap G4) with the full value in a tooltip; the copy is always the full value.
 */
@Component({
  selector: 'app-identificador-copiable',
  imports: [NgIcon, HlmTooltipImports],
  providers: [provideIcons({ lucideCheck, lucideCopy })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex max-w-full min-w-0 items-center gap-0.5' },
  template: `
    @if (corto()) {
      <code
        class="font-mono text-sm"
        [hlmTooltip]="valor()"
        tabindex="0"
        [attr.aria-label]="etiqueta() + ': ' + valor()"
        >{{ visible() }}</code
      >
    } @else {
      <code class="min-w-0 font-mono text-sm break-all">{{ valor() }}</code>
    }
    <!-- The ::after pseudo-element grows the hit area to 44 px without changing the layout. -->
    <button
      type="button"
      class="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring relative inline-flex size-7 shrink-0 items-center justify-center rounded outline-none after:absolute after:-inset-2 focus-visible:ring-2"
      [attr.aria-label]="'Copiar ' + etiqueta()"
      (click)="copiar(valor())"
    >
      <ng-icon
        [name]="copiado() ? 'lucideCheck' : 'lucideCopy'"
        class="text-sm"
        aria-hidden="true"
      />
    </button>
    <span class="sr-only" aria-live="polite">{{ copiado() ? etiqueta() + ' copiado' : '' }}</span>
  `,
})
export class IdentificadorCopiable {
  readonly valor = input.required<string>();
  /** What it is, for the button's accessible name: "identificador del paciente". */
  readonly etiqueta = input.required<string>();
  readonly corto = input(false);

  private readonly portapapeles = injectCopiar();
  protected readonly copiado = this.portapapeles.copiado;
  protected readonly copiar = this.portapapeles.copiar;
  protected readonly visible = computed(() => subCorto(this.valor()));
}
