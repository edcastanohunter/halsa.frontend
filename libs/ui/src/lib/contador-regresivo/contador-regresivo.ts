import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { hlm } from '@halsa/ui/helm/utils';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTimer } from '@ng-icons/lucide';
import { injectAhora } from '../utils/ahora';
import { TONO_SUAVE } from '../utils/tono';

/** Formats milliseconds as m:ss, or h:mm:ss from one hour up. */
export function formatDuracion(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * Countdown chip, e.g. the 15-minute dictamen window (plan §7.7). Amber in the last
 * `avisoSeg` seconds and destructive at zero, when it emits `vencido` once.
 * The visible digits tick every second, but screen readers get a per-minute label only.
 */
@Component({
  selector: 'halsa-contador-regresivo',
  imports: [NgIcon],
  providers: [provideIcons({ lucideTimer })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span role="timer" [attr.aria-label]="etiquetaAccesible()" [class]="clases()">
      <ng-icon name="lucideTimer" class="text-sm" aria-hidden="true" />
      @if (restanteMs() > 0) {
        @if (etiqueta()) {
          <span aria-hidden="true">{{ etiqueta() }}</span>
        }
        <span class="font-mono tabular-nums" aria-hidden="true">{{ duracion() }}</span>
      } @else {
        <span aria-hidden="true">{{ textoVencido() }}</span>
      }
    </span>
  `,
})
export class ContadorRegresivo {
  /** ISO datetime when the countdown reaches zero. */
  readonly hasta = input.required<string>();
  readonly etiqueta = input<string>();
  readonly textoVencido = input('Tiempo agotado');
  readonly avisoSeg = input(120);
  readonly vencido = output<void>();

  private readonly ahora = injectAhora(1000);

  protected readonly restanteMs = computed(() =>
    Math.max(0, Date.parse(this.hasta()) - this.ahora()),
  );
  protected readonly duracion = computed(() => formatDuracion(this.restanteMs()));

  protected readonly etiquetaAccesible = computed(() => {
    const ms = this.restanteMs();
    if (ms <= 0) return this.textoVencido();
    const minutos = Math.ceil(ms / 60_000);
    const prefijo = this.etiqueta() ? `${this.etiqueta()} ` : 'Quedan ';
    return `${prefijo}${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  });

  protected readonly clases = computed(() => {
    const ms = this.restanteMs();
    const tono =
      ms <= 0
        ? TONO_SUAVE.destructive
        : ms <= this.avisoSeg() * 1000
          ? TONO_SUAVE.warning
          : TONO_SUAVE.neutral;
    return hlm(
      'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
      tono,
    );
  });

  constructor() {
    let emitido = false;
    effect(() => {
      if (this.restanteMs() <= 0 && !emitido) {
        emitido = true;
        this.vencido.emit();
      } else if (this.restanteMs() > 0) {
        emitido = false;
      }
    });
  }
}
