import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatFechaHoraBogota, formatFechaRelativa } from '@halsa/core';
import { injectAhora } from '../utils/ahora';

/** "hace 3 horas" / "en 2 días", refreshed every 30 s, with the absolute Bogotá time as title. */
@Component({
  selector: 'halsa-fecha-relativa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<time [attr.datetime]="valor()" [attr.title]="absoluta()">{{ relativa() }}</time>`,
})
export class FechaRelativa {
  readonly valor = input.required<string>();

  private readonly ahora = injectAhora(30_000);
  protected readonly relativa = computed(() => formatFechaRelativa(this.valor(), this.ahora()));
  protected readonly absoluta = computed(() => formatFechaHoraBogota(this.valor()));
}
