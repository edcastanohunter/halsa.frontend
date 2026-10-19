import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideEyeOff } from '@ng-icons/lucide';

const OCULTAR_TRAS_MS = 15_000;

/** Masks all but the last 4 characters: "1020304050" -> "••••4050". */
export function enmascararDocumento(numero: string): string {
  return numero.length <= 4 ? numero : `••••${numero.slice(-4)}`;
}

/**
 * A worker's document number, masked by default with tap-to-reveal (plan §8.2).
 * It masks itself again after 15 s. Pass `revelable=false` for numbers the API already masked.
 */
@Component({
  selector: 'halsa-documento-enmascarado',
  imports: [NgIcon],
  providers: [provideIcons({ lucideEye, lucideEyeOff })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-1' },
  template: `
    <span class="font-mono text-sm tabular-nums">
      @if (tipo()) {
        <span class="text-muted-foreground font-sans font-medium">{{ tipo() }}</span>
      }
      {{ visible() || !revelable() ? numero() : enmascarado() }}
    </span>
    @if (revelable()) {
      <button
        type="button"
        class="text-muted-foreground hover:bg-muted hover:text-foreground relative inline-flex size-7 items-center justify-center rounded-md transition-colors duration-150 after:absolute after:-inset-2"
        [attr.aria-pressed]="visible()"
        [attr.aria-label]="
          visible() ? 'Ocultar número de documento' : 'Mostrar número de documento'
        "
        (click)="alternar()"
      >
        <ng-icon
          [name]="visible() ? 'lucideEyeOff' : 'lucideEye'"
          class="text-base"
          aria-hidden="true"
        />
      </button>
    }
  `,
})
export class DocumentoEnmascarado {
  readonly numero = input.required<string>();
  readonly tipo = input<string>();
  readonly revelable = input(true);

  protected readonly visible = signal(false);
  protected readonly enmascarado = computed(() => enmascararDocumento(this.numero()));

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected alternar(): void {
    clearTimeout(this.timer);
    this.visible.update((v) => !v);
    if (this.visible()) {
      this.timer = setTimeout(() => this.visible.set(false), OCULTAR_TRAS_MS);
    }
  }
}
