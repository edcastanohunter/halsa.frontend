import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatNumero } from '@halsa/core';

interface Hito {
  dias: number;
  etiqueta: string;
}

// Plan §7.6: 150 (early warning), 180 (legal limit, needs a rehabilitation concept), 540.
const HITOS: readonly Hito[] = [
  { dias: 150, etiqueta: 'Alerta temprana' },
  { dias: 180, etiqueta: 'Requiere concepto de rehabilitación' },
  { dias: 540, etiqueta: 'Tope de 540 días' },
];
const ESCALA_MINIMA = 540;

/** Accumulated incapacity days as a meter with the legal markers and a legend. */
@Component({
  selector: 'halsa-barra-dias-acumulados',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <p class="text-muted-foreground text-sm">
      <span class="text-foreground text-2xl font-semibold tabular-nums">{{ diasTexto() }}</span>
      días acumulados
    </p>
    <p class="mt-0.5 min-h-4 text-xs font-medium" [class]="claseTexto()">{{ mensaje() }}</p>

    <div
      role="meter"
      aria-label="Días de incapacidad acumulados"
      aria-valuemin="0"
      [attr.aria-valuemax]="escala()"
      [attr.aria-valuenow]="dias()"
      [attr.aria-valuetext]="valorTexto()"
      class="bg-muted ring-border relative mt-3 h-3 rounded-full ring-1 ring-inset"
    >
      <div
        class="h-full rounded-full transition-[width] duration-200 ease-out"
        [class]="claseRelleno()"
        [style.width.%]="porcentaje(dias())"
      ></div>
      @for (hito of hitos; track hito.dias) {
        <span
          class="bg-foreground/60 absolute -top-1 -bottom-1 w-0.5 rounded-full"
          [style.left.%]="porcentaje(hito.dias)"
          aria-hidden="true"
        ></span>
      }
    </div>

    <ul class="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      @for (hito of hitos; track hito.dias) {
        <li class="flex items-center gap-1.5">
          <span class="bg-foreground/60 h-3 w-0.5 rounded-full" aria-hidden="true"></span>
          <span class="text-foreground font-medium tabular-nums">{{ hito.dias }}</span>
          {{ hito.etiqueta }}
        </li>
      }
    </ul>
  `,
})
export class BarraDiasAcumulados {
  readonly dias = input.required<number>();

  protected readonly hitos = HITOS;
  protected readonly escala = computed(() => Math.max(ESCALA_MINIMA, this.dias()));
  protected readonly diasTexto = computed(() => formatNumero(this.dias()));

  private readonly zona = computed(() => {
    const dias = this.dias();
    return dias >= 180 ? 'limite' : dias >= 150 ? 'alerta' : 'normal';
  });

  protected readonly mensaje = computed(() => {
    switch (this.zona()) {
      case 'limite':
        return 'Superó 180 días: requiere concepto de rehabilitación';
      case 'alerta':
        return '150 días: alerta temprana';
      default:
        return '';
    }
  });

  protected readonly valorTexto = computed(() =>
    [`${this.diasTexto()} días acumulados`, this.mensaje()].filter(Boolean).join('. '),
  );

  protected readonly claseRelleno = computed(() => {
    switch (this.zona()) {
      case 'limite':
        return 'bg-destructive';
      case 'alerta':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
  });

  protected readonly claseTexto = computed(() =>
    this.zona() === 'limite' ? 'text-destructive' : 'text-warning',
  );

  protected porcentaje(dias: number): number {
    return Math.min(100, (dias / this.escala()) * 100);
  }
}
