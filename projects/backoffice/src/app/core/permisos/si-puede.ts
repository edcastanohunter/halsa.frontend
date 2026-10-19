import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { cumplePermiso, Permiso, PermisosService } from './permisos';

/**
 * `*halsaSiPuede="'clinico:read'; else sinPermiso"` (plan §5.1.2), for templates where
 * `@if (permisos.puede(...))` reads worse. With a list, any one of the permissions is enough.
 */
@Directive({ selector: '[halsaSiPuede]' })
export class SiPuede {
  readonly halsaSiPuede = input.required<Permiso | readonly Permiso[]>();
  readonly halsaSiPuedeElse = input<TemplateRef<unknown> | null>(null);

  private readonly plantilla = inject(TemplateRef);
  private readonly contenedor = inject(ViewContainerRef);
  private readonly permisos = inject(PermisosService);

  constructor() {
    let mostrada: TemplateRef<unknown> | null | undefined;
    effect(() => {
      const puede = cumplePermiso({ permiso: this.halsaSiPuede() }, this.permisos.permisos());
      const siguiente = puede ? this.plantilla : this.halsaSiPuedeElse();
      if (siguiente === mostrada) return;
      this.contenedor.clear();
      if (siguiente) this.contenedor.createEmbeddedView(siguiente);
      mostrada = siguiente;
    });
  }
}
