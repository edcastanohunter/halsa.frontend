import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmDialogImports } from '@halsa/ui/helm/dialog';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck } from '@ng-icons/lucide';
import { StepUpService } from './step-up.service';

/**
 * Mounted once in the shell. Asks for the step-up a 401 challenged (reactive flow), and asks
 * before falling back to a redirect when the browser blocked the popup (both flows).
 */
@Component({
  selector: 'app-dialogo-step-up',
  imports: [HlmDialogImports, HlmButton, HlmSpinner, NgIcon],
  providers: [provideIcons({ lucideShieldCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog [state]="abierto() ? 'open' : 'closed'" (closed)="cerrado()">
      <hlm-dialog-content *hlmDialogPortal="let ctx" class="sm:max-w-md" [showCloseButton]="false">
        @if (stepUp.solicitud()?.fase === 'bloqueado') {
          <hlm-dialog-header>
            <h2 hlmDialogTitle>El navegador bloqueó la ventana de verificación</h2>
            <p hlmDialogDescription>
              Se abrirá la verificación en esta pestaña; los cambios sin guardar se perderán.
            </p>
          </hlm-dialog-header>
          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="stepUp.cancelar()">
              Cancelar
            </button>
            <button hlmBtn type="button" (click)="stepUp.continuarEnEstaPestana()">
              Continuar en esta pestaña
            </button>
          </hlm-dialog-footer>
        } @else {
          <hlm-dialog-header class="items-center text-center sm:items-center sm:text-center">
            <span
              class="bg-clinical/12 text-clinical inline-flex size-12 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <ng-icon name="lucideShieldCheck" class="text-2xl" />
            </span>
            <h2 hlmDialogTitle>Verificación requerida</h2>
            <p hlmDialogDescription>
              Confirma tu identidad con tu código de verificación para continuar. Cada acceso queda
              registrado.
            </p>
          </hlm-dialog-header>
          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="stepUp.cancelar()">
              Cancelar
            </button>
            <button
              hlmBtn
              type="button"
              [disabled]="stepUp.verificando()"
              (click)="stepUp.confirmarSolicitud()"
            >
              @if (stepUp.verificando()) {
                <hlm-spinner class="size-4" aria-hidden="true" />
                Verificando…
              } @else {
                Verificar identidad
              }
            </button>
          </hlm-dialog-footer>
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class DialogoStepUp {
  protected readonly stepUp = inject(StepUpService);
  protected readonly abierto = computed(() => this.stepUp.solicitud() !== null);

  /** Escape or an outside click count as "Cancelar". */
  protected cerrado(): void {
    if (this.stepUp.solicitud()) this.stepUp.cancelar();
  }
}
