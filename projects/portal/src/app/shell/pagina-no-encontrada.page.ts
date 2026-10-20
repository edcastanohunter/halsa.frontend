import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoVacio } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { provideIcons } from '@ng-icons/core';
import { lucideSearchX } from '@ng-icons/lucide';

/** `**` inside the shell. The icon is provided here for the projected `halsa-estado-vacio`. */
@Component({
  selector: 'app-pagina-no-encontrada',
  imports: [RouterLink, EstadoVacio, HlmButton],
  providers: [provideIcons({ lucideSearchX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="sr-only">Página no encontrada</h1>
    <halsa-estado-vacio
      icono="lucideSearchX"
      titulo="Página no encontrada"
      descripcion="La dirección no existe o ya no está disponible."
    >
      <a hlmBtn variant="outline" routerLink="/inicio">Ir al inicio</a>
    </halsa-estado-vacio>
  `,
})
export class PaginaNoEncontradaPage {}
