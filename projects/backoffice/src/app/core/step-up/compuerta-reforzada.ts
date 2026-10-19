import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import { APP_CONFIG } from '@halsa/core';
import { ContenidoReforzado, VerificacionReforzada } from '@halsa/ui';
import { StepUpService } from './step-up.service';

/**
 * `<app-compuerta-reforzada [acr]="2" [maxAgeSeg]="900"><div *halsaContenidoReforzado>…`
 * (plan §5.1.4). Wraps every clinical section and form: until the token meets the level, the
 * content isn't even instantiated, so no clinical request leaves before the step-up. With
 * `maxAgeSeg` it closes again when less than 2 minutes of the window remain.
 */
@Component({
  selector: 'app-compuerta-reforzada',
  imports: [VerificacionReforzada],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <halsa-verificacion-reforzada
      [satisfecha]="satisfecha()"
      [verificando]="stepUp.verificando()"
      [urlConfigurarOtp]="urlCuenta"
      [plantilla]="contenido()?.template"
      (verificar)="verificar()"
    />
  `,
})
export class CompuertaReforzada {
  readonly acr = input(2);
  readonly maxAgeSeg = input<number>();

  protected readonly stepUp = inject(StepUpService);
  protected readonly contenido = contentChild(ContenidoReforzado);
  protected readonly urlCuenta = `${inject(APP_CONFIG).keycloak?.authority ?? ''}/account`;

  protected readonly satisfecha = computed(() =>
    this.stepUp.cumple({ acr: this.acr(), maxAgeSeg: this.maxAgeSeg() }),
  );

  protected verificar(): void {
    void this.stepUp.verificar({ acr: this.acr(), maxAgeSeg: this.maxAgeSeg() });
  }
}
