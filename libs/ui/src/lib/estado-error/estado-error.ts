import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCircleAlert, lucideCopy, lucideRotateCw } from '@ng-icons/lucide';
import { injectCopiar } from '../utils/portapapeles';

/**
 * Error state with retry and the correlation id (`traza`) the user can hand to support
 * (plan §8.2). Honest, plain-Spanish copy comes from the caller's error mapping (M2).
 */
@Component({
  selector: 'halsa-estado-error',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideCircleAlert, lucideRotateCw, lucideCopy, lucideCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div role="alert" class="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span
        class="bg-destructive/12 text-destructive inline-flex size-12 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <ng-icon name="lucideCircleAlert" class="text-2xl" />
      </span>
      <div class="max-w-sm space-y-1">
        <p class="text-base font-semibold">{{ titulo() }}</p>
        @if (mensaje()) {
          <p class="text-muted-foreground text-sm">{{ mensaje() }}</p>
        }
      </div>
      @if (reintentable()) {
        <button hlmBtn variant="outline" type="button" (click)="reintentar.emit()">
          <ng-icon name="lucideRotateCw" aria-hidden="true" />
          Reintentar
        </button>
      }
      @if (traza()) {
        <p class="text-muted-foreground flex flex-wrap items-center justify-center gap-x-1 text-xs">
          <span class="whitespace-nowrap">Código de seguimiento:</span>
          <code class="text-foreground font-mono break-all">{{ traza() }}</code>
          <button
            type="button"
            class="hover:bg-muted hover:text-foreground relative inline-flex size-6 items-center justify-center rounded after:absolute after:-inset-2.5"
            aria-label="Copiar código de seguimiento"
            (click)="copiar(traza()!)"
          >
            <ng-icon [name]="copiado() ? 'lucideCheck' : 'lucideCopy'" aria-hidden="true" />
          </button>
        </p>
      }
    </div>
  `,
})
export class EstadoError {
  readonly titulo = input('No pudimos cargar la información');
  readonly mensaje = input<string>();
  /** The request's correlation id, to quote to support. */
  readonly traza = input<string>();
  readonly reintentable = input(true);
  readonly reintentar = output<void>();

  private readonly portapapeles = injectCopiar();
  protected readonly copiado = this.portapapeles.copiado;
  protected readonly copiar = this.portapapeles.copiar;
}
