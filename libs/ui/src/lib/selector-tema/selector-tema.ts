import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMonitor, lucideMoon, lucideSun } from '@ng-icons/lucide';
import { PreferenciaTema, TemaService } from '../tema/tema.service';

interface OpcionTema {
  valor: PreferenciaTema;
  etiqueta: string;
  icono: string;
}

/** Segmented control for the color theme: Claro · Oscuro · Sistema. */
@Component({
  selector: 'halsa-selector-tema',
  imports: [NgIcon],
  providers: [provideIcons({ lucideSun, lucideMoon, lucideMonitor })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="radiogroup"
      aria-label="Tema de color"
      class="bg-muted ring-border inline-flex rounded-lg p-1 ring-1"
    >
      @for (opcion of opciones; track opcion.valor) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="tema.preferencia() === opcion.valor"
          class="text-muted-foreground hover:text-foreground aria-checked:bg-card aria-checked:text-foreground inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-150 ease-out aria-checked:shadow-sm pointer-coarse:h-11 pointer-coarse:px-3"
          (click)="tema.establecer(opcion.valor)"
        >
          <ng-icon [name]="opcion.icono" class="text-base" aria-hidden="true" />
          {{ opcion.etiqueta }}
        </button>
      }
    </div>
  `,
})
export class SelectorTema {
  protected readonly tema = inject(TemaService);
  protected readonly opciones: OpcionTema[] = [
    { valor: 'light', etiqueta: 'Claro', icono: 'lucideSun' },
    { valor: 'dark', etiqueta: 'Oscuro', icono: 'lucideMoon' },
    { valor: 'system', etiqueta: 'Sistema', icono: 'lucideMonitor' },
  ];
}
