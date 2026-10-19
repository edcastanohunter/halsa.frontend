import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInbox } from '@ng-icons/lucide';

/**
 * Empty state: icon, title, optional description and projected actions.
 * Pass any icon registered by the caller through `icono` (defaults to an inbox).
 */
@Component({
  selector: 'halsa-estado-vacio',
  imports: [NgIcon],
  providers: [provideIcons({ lucideInbox })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span
        class="bg-muted text-muted-foreground inline-flex size-12 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <ng-icon [name]="icono()" class="text-2xl" />
      </span>
      <div class="max-w-sm space-y-1">
        <p class="text-base font-semibold">{{ titulo() }}</p>
        @if (descripcion()) {
          <p class="text-muted-foreground text-sm">{{ descripcion() }}</p>
        }
      </div>
      <div class="flex flex-wrap justify-center gap-2 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class EstadoVacio {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly icono = input('lucideInbox');
}
