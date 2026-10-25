import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoVacio } from '@halsa/ui/estado-vacio';
import { HlmButton } from '@halsa/ui/helm/button';
import { provideIcons } from '@ng-icons/core';
import { lucideBan, lucideHammer, lucideSearchX } from '@ng-icons/lucide';

/**
 * Whole-page states inside the shell, configured by route `data`: 403 (`/acceso-denegado`), 404
 * (`**`) and the sections whose milestone hasn't landed yet.
 * The icons are provided here for the projected `halsa-estado-vacio`.
 */
@Component({
  selector: 'app-estado-pagina',
  imports: [RouterLink, EstadoVacio, HlmButton],
  providers: [provideIcons({ lucideBan, lucideSearchX, lucideHammer })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="sr-only">{{ titulo() }}</h1>
    <halsa-estado-vacio [titulo]="titulo()" [descripcion]="descripcion()" [icono]="icono()">
      <a hlmBtn variant="outline" routerLink="/inicio">Ir al inicio</a>
    </halsa-estado-vacio>
  `,
})
export class EstadoPaginaPage {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly icono = input('lucideSearchX');
}
