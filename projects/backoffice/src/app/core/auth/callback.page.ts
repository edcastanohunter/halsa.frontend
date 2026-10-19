import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EstadoError } from '@halsa/ui';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { SesionService } from '../sesion/sesion.service';
import { tomarRetorno } from './retorno';

/**
 * `/auth/callback`: the initializer already exchanged the code (`checkAuth`), so this only routes
 * to the stored return URL. Inside the step-up popup it just waits for the opener to close it.
 */
@Component({
  selector: 'app-callback',
  imports: [EstadoError, HlmSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="bg-background text-foreground grid min-h-dvh place-items-center p-6">
      @if (sesion.estado() === 'anonima') {
        <halsa-estado-error
          titulo="No pudimos completar el ingreso"
          mensaje="El enlace de ingreso venció o ya se usó. Ingresa de nuevo."
          (reintentar)="sesion.iniciarSesion('/inicio')"
        />
      } @else {
        <div class="text-muted-foreground flex items-center gap-3 text-sm" role="status">
          <hlm-spinner class="size-5" aria-hidden="true" />
          Ingresando…
        </div>
      }
    </main>
  `,
})
export class CallbackPage {
  protected readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      switch (this.sesion.estado()) {
        case 'lista':
        case 'error':
          void this.router.navigateByUrl(tomarRetorno() ?? '/inicio', { replaceUrl: true });
          break;
        case 'sin-acceso':
          void this.router.navigateByUrl('/sin-acceso', { replaceUrl: true });
          break;
      }
    });
  }
}
