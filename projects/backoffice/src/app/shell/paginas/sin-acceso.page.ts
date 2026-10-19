import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUserX } from '@ng-icons/lucide';
import { SesionService } from '../../core/sesion/sesion.service';

/** Authenticated, but not an ARL or IPS actor (plan §5.1.1): full screen, outside the shell. */
@Component({
  selector: 'app-sin-acceso',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideUserX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="bg-background text-foreground grid min-h-dvh place-items-center p-6">
      <div class="flex max-w-sm flex-col items-center gap-4 text-center">
        <span
          class="bg-muted text-muted-foreground inline-flex size-14 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <ng-icon name="lucideUserX" class="text-3xl" />
        </span>
        <h1 class="text-xl font-semibold tracking-tight">
          Este usuario no tiene acceso al backoffice
        </h1>
        <p class="text-muted-foreground text-sm">
          El backoffice es para el personal de las ARL y las IPS. Si eres paciente, ingresa por el
          portal del paciente.
        </p>
        <button hlmBtn type="button" (click)="sesion.cerrarSesion()">Cerrar sesión</button>
      </div>
    </main>
  `,
})
export class SinAccesoPage {
  protected readonly sesion = inject(SesionService);
}
