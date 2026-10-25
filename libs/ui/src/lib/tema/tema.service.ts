import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

export type PreferenciaTema = 'light' | 'dark' | 'system';

// Keep in sync with libs/ui/src/assets/theme-init.js, which applies it before first paint.
const STORAGE_KEY = 'halsa.tema';

/**
 * Light/dark theme (a UI preference, the only thing allowed in localStorage).
 * `system` follows `prefers-color-scheme` live.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly document = inject(DOCUMENT);
  // Read through `document.defaultView` rather than the `localStorage` global: Node 22.4+ and
  // Node 26 ship an experimental `localStorage` global that shadows the browser/jsdom one and
  // returns `undefined` (breaking unit tests). `document.defaultView.localStorage` is the real
  // Storage in the browser and under jsdom, and is absent when storage is unavailable.
  private readonly almacen = this.document.defaultView?.localStorage ?? null;
  private readonly media =
    typeof this.document.defaultView?.matchMedia === 'function'
      ? this.document.defaultView.matchMedia('(prefers-color-scheme: dark)')
      : null;
  private readonly sistemaOscuro = signal(this.media?.matches ?? false);

  readonly preferencia = signal<PreferenciaTema>(this.leerPreferencia());
  readonly oscuro = computed(() => {
    const preferencia = this.preferencia();
    return preferencia === 'dark' || (preferencia === 'system' && this.sistemaOscuro());
  });

  constructor() {
    const alCambiar = (evento: MediaQueryListEvent) => this.sistemaOscuro.set(evento.matches);
    this.media?.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', alCambiar));

    effect(() => this.document.documentElement.classList.toggle('dark', this.oscuro()));
  }

  private leerPreferencia(): PreferenciaTema {
    try {
      const valor = this.almacen?.getItem(STORAGE_KEY);
      return valor === 'light' || valor === 'dark' ? valor : 'system';
    } catch {
      return 'system';
    }
  }

  establecer(preferencia: PreferenciaTema): void {
    this.preferencia.set(preferencia);
    try {
      if (preferencia === 'system') {
        this.almacen?.removeItem(STORAGE_KEY);
      } else {
        this.almacen?.setItem(STORAGE_KEY, preferencia);
      }
    } catch {
      // Storage blocked: the choice still applies for this session.
    }
  }
}
