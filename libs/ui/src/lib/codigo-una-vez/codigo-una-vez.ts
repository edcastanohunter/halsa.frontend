import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatFechaHoraBogota } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy, lucideTriangleAlert } from '@ng-icons/lucide';
import { injectCopiar } from '../utils/portapapeles';

/**
 * One-time activation code display (plan §7.4, §5.3.5): large grouped monospace, copy, expiry and
 * the "won't be shown again" warning. Holds no copy of the code; the caller wipes it on close.
 */
@Component({
  selector: 'halsa-codigo-una-vez',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideCopy, lucideCheck, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-4' },
  template: `
    <div class="bg-muted ring-border rounded-xl px-4 py-5 text-center ring-1 ring-inset">
      <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Código de activación
      </p>
      <p
        class="mt-2 flex flex-wrap justify-center gap-x-2 font-mono text-2xl font-medium tracking-[0.12em] break-all sm:text-3xl"
      >
        @for (grupo of grupos(); track $index) {
          <span aria-hidden="true">{{ grupo }}</span>
          @if (!$last) {
            <span class="text-muted-foreground" aria-hidden="true">-</span>
          }
        }
        <span class="sr-only">{{ deletreado() }}</span>
      </p>
      @if (expiraEn()) {
        <p class="text-muted-foreground mt-2 text-sm">Vence el {{ vence() }}</p>
      }
    </div>

    <button hlmBtn class="w-full" type="button" (click)="copiar(codigo())">
      <ng-icon [name]="copiado() ? 'lucideCheck' : 'lucideCopy'" aria-hidden="true" />
      {{ copiado() ? 'Copiado' : 'Copiar código' }}
    </button>
    <span class="sr-only" aria-live="polite">{{ copiado() ? 'Código copiado' : '' }}</span>

    <p
      class="bg-warning/12 text-warning ring-warning/30 flex gap-2 rounded-lg p-3 text-sm ring-1 ring-inset"
    >
      <ng-icon name="lucideTriangleAlert" class="mt-0.5 shrink-0" aria-hidden="true" />
      No se volverá a mostrar. Si se pierde, genera uno nuevo.
    </p>
  `,
})
export class CodigoUnaVez {
  readonly codigo = input.required<string>();
  readonly expiraEn = input<string>();

  protected readonly grupos = computed(() => this.codigo().split('-'));
  /** Spelled out with spaces so screen readers read it character by character. */
  protected readonly deletreado = computed(() =>
    this.codigo().replace(/-/g, '').split('').join(' '),
  );
  protected readonly vence = computed(() => formatFechaHoraBogota(this.expiraEn()));

  private readonly portapapeles = injectCopiar();
  protected readonly copiado = this.portapapeles.copiado;
  protected readonly copiar = this.portapapeles.copiar;
}
