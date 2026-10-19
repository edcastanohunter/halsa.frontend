import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLock } from '@ng-icons/lucide';

let siguienteId = 0;

/**
 * Marks a clinical (reserved) zone: violet banner + lock + audit notice (plan §1, §7.5).
 * Violet is reserved for these zones only.
 */
@Component({
  selector: 'halsa-seccion-clinica',
  imports: [NgIcon],
  providers: [provideIcons({ lucideLock })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section
      [attr.aria-labelledby]="tituloId"
      class="bg-card text-card-foreground ring-clinical/30 overflow-hidden rounded-xl shadow-xs ring-1"
    >
      <header class="border-clinical/20 bg-clinical/10 flex items-start gap-3 border-b px-4 py-3">
        <span
          class="bg-clinical text-clinical-foreground mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <ng-icon name="lucideLock" class="text-sm" />
        </span>
        <div class="min-w-0">
          <h2 [id]="tituloId" class="text-clinical text-sm font-semibold">{{ titulo() }}</h2>
          <p class="text-clinical text-xs">{{ aviso() }}</p>
        </div>
      </header>
      <div class="p-4">
        <ng-content />
      </div>
    </section>
  `,
})
export class SeccionClinica {
  readonly titulo = input('Información clínica reservada');
  readonly aviso = input('Res. 1995/1999 · Cada consulta queda auditada');

  protected readonly tituloId = `halsa-seccion-clinica-${siguienteId++}`;
}
