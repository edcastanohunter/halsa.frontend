import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EstadoPlazo, formatFechaHoraBogota, formatFechaRelativa } from '@halsa/core';
import { hlm } from '@halsa/ui/helm/utils';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleCheck,
  lucideCirclePause,
  lucideCircleX,
  lucideClock,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { injectAhora } from '../utils/ahora';
import { TONO_CONTORNO, TONO_SUAVE } from '../utils/tono';
import { NivelPlazo, nivelPlazo } from './nivel-plazo';

const ESTILO: Record<NivelPlazo, { clases: string; icono: string }> = {
  normal: { clases: TONO_SUAVE.neutral, icono: 'lucideClock' },
  alerta: { clases: TONO_SUAVE.warning, icono: 'lucideClock' },
  critico: { clases: TONO_CONTORNO.destructive, icono: 'lucideTriangleAlert' },
  vencido: { clases: TONO_SUAVE.destructive, icono: 'lucideCircleX' },
  cumplido: { clases: TONO_SUAVE.success, icono: 'lucideCircleCheck' },
  suspendido: { clases: TONO_SUAVE.muted, icono: 'lucideCirclePause' },
};

/** Deadline urgency chip with icon + text, never color alone (plan §8.3). */
@Component({
  selector: 'halsa-semaforo-plazo',
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideClock,
      lucideTriangleAlert,
      lucideCircleX,
      lucideCircleCheck,
      lucideCirclePause,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-wrap items-center gap-1.5' },
  template: `
    <span [class]="clases()" [attr.title]="'Vence: ' + venceAbsoluto()">
      <ng-icon [name]="icono()" class="text-sm" aria-hidden="true" />
      {{ texto() }}
    </span>
    @if (estado() === 'CUMPLIDO' && extemporaneo()) {
      <span [class]="claseExtemporaneo">Extemporáneo</span>
    }
  `,
})
export class SemaforoPlazo {
  readonly estado = input.required<EstadoPlazo>();
  readonly venceEn = input.required<string>();
  readonly alertaEn = input.required<string>();
  readonly extemporaneo = input(false);

  private readonly ahora = injectAhora(60_000);

  protected readonly nivel = computed(() =>
    nivelPlazo(
      { estado: this.estado(), venceEn: this.venceEn(), alertaEn: this.alertaEn() },
      this.ahora(),
    ),
  );

  protected readonly venceAbsoluto = computed(() => formatFechaHoraBogota(this.venceEn()));

  protected readonly texto = computed(() => {
    const relativo = formatFechaRelativa(this.venceEn(), this.ahora());
    switch (this.nivel()) {
      case 'cumplido':
        return 'Cumplido';
      case 'suspendido':
        return 'Suspendido';
      case 'vencido':
        return this.estado() === 'VENCIDO' ? 'Vencido' : `Venció ${relativo}`;
      default:
        return `Vence ${relativo}`;
    }
  });

  protected readonly icono = computed(() => ESTILO[this.nivel()].icono);

  private readonly base =
    'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset';

  protected readonly clases = computed(() => hlm(this.base, ESTILO[this.nivel()].clases));
  protected readonly claseExtemporaneo = hlm(this.base, TONO_SUAVE.warning);
}
