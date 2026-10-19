import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/** A live `matchMedia` signal, e.g. `injectMediaQuery('(min-width: 768px)')`. */
export function injectMediaQuery(query: string): Signal<boolean> {
  const view = inject(DOCUMENT).defaultView;
  const media = typeof view?.matchMedia === 'function' ? view.matchMedia(query) : null;
  const coincide = signal(media?.matches ?? false);
  if (media) {
    const alCambiar = (evento: MediaQueryListEvent) => coincide.set(evento.matches);
    media.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', alCambiar));
  }
  return coincide.asReadonly();
}
