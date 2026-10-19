import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatFechaCorta, formatFechaHoraBogota, formatFechaLarga } from '@halsa/core';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type FormatoFecha = 'corta' | 'larga';

/**
 * Renders a date in Bogotá time (plan §8.5). `YYYY-MM-DD` values are formatted by splitting the
 * string, never through `Date`, so they can't shift a day. Datetimes always include the time.
 */
@Component({
  selector: 'halsa-fecha-bogota',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<time class="tabular-nums" [attr.datetime]="valor()">{{ texto() }}</time>`,
})
export class FechaBogota {
  readonly valor = input.required<string | null | undefined>();
  readonly formato = input<FormatoFecha>('corta');

  protected readonly texto = computed(() => {
    const valor = this.valor();
    if (!valor) return '—';
    if (DATE_ONLY.test(valor)) {
      return this.formato() === 'larga' ? formatFechaLarga(valor) : formatFechaCorta(valor);
    }
    return formatFechaHoraBogota(valor);
  });
}
