import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatFechaHoraBogota } from '@halsa/core';
import { hlm, injectAhora, TONO_CONTORNO, TONO_SUAVE } from '@halsa/ui';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideClock, lucideTriangleAlert } from '@ng-icons/lucide';

const MINUTO_MS = 60_000;
const HORA_MS = 60 * MINUTO_MS;
const DIA_MS = 24 * HORA_MS;

/** Plan §7.11: red when less than 24 h are left or the 72 h review deadline has passed. */
export type NivelRevision = 'vencida' | 'critica' | 'normal';

export function nivelRevision(venceEn: string, ahora: number): NivelRevision {
  const restante = Date.parse(venceEn) - ahora;
  if (restante <= 0) return 'vencida';
  return restante < DIA_MS ? 'critica' : 'normal';
}

/** A coarse duration for a 72 h window: "2 d 14 h", "11 h 5 min", "40 min". */
export function formatPlazoRestante(ms: number): string {
  const total = Math.max(MINUTO_MS, Math.abs(ms));
  const dias = Math.floor(total / DIA_MS);
  const horas = Math.floor((total % DIA_MS) / HORA_MS);
  const minutos = Math.floor((total % HORA_MS) / MINUTO_MS);
  if (dias > 0) return horas ? `${dias} d ${horas} h` : `${dias} d`;
  if (horas > 0) return minutos ? `${horas} h ${minutos} min` : `${horas} h`;
  return `${minutos} min`;
}

const ICONO: Record<NivelRevision, string> = {
  normal: 'lucideClock',
  critica: 'lucideTriangleAlert',
  vencida: 'lucideCircleAlert',
};

/**
 * The countdown to an emergency review's legal deadline (`venceRevisionEn`, 72 h). Text and icon
 * change with the level, never color alone; the exact instant is in the tooltip.
 */
@Component({
  selector: 'app-vencimiento-revision',
  imports: [NgIcon],
  providers: [provideIcons({ lucideCircleAlert, lucideClock, lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <time
      [attr.datetime]="venceEn()"
      [attr.title]="'Vence: ' + absoluta()"
      [class]="clases()"
      data-testid="vencimiento-revision"
    >
      <ng-icon [name]="icono()" class="text-sm" aria-hidden="true" />
      {{ texto() }}
    </time>
  `,
})
export class VencimientoRevision {
  readonly venceEn = input.required<string>();

  private readonly ahora = injectAhora(MINUTO_MS);

  protected readonly nivel = computed(() => nivelRevision(this.venceEn(), this.ahora()));
  protected readonly icono = computed(() => ICONO[this.nivel()]);
  protected readonly absoluta = computed(() => formatFechaHoraBogota(this.venceEn()));
  protected readonly texto = computed(() => {
    const restante = Date.parse(this.venceEn()) - this.ahora();
    return restante <= 0
      ? `Vencida hace ${formatPlazoRestante(restante)}`
      : `Vence en ${formatPlazoRestante(restante)}`;
  });
  protected readonly clases = computed(() =>
    hlm(
      'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
      this.nivel() === 'vencida'
        ? TONO_SUAVE.destructive
        : this.nivel() === 'critica'
          ? TONO_CONTORNO.destructive
          : TONO_SUAVE.warning,
    ),
  );
}
