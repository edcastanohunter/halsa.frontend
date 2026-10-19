import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

export type PreferenciaTema = 'light' | 'dark' | 'system';

// Keep in sync with libs/ui/src/assets/theme-init.js, which applies it before first paint.
const STORAGE_KEY = 'halsa.tema';

function leerPreferencia(): PreferenciaTema {
  try {
    const valor = localStorage.getItem(STORAGE_KEY);
    return valor === 'light' || valor === 'dark' ? valor : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Light/dark theme (a UI preference, the only thing allowed in localStorage).
 * `system` follows `prefers-color-scheme` live.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly document = inject(DOCUMENT);
  private readonly media =
    typeof this.document.defaultView?.matchMedia === 'function'
      ? this.document.defaultView.matchMedia('(prefers-color-scheme: dark)')
      : null;
  private readonly sistemaOscuro = signal(this.media?.matches ?? false);

  readonly preferencia = signal<PreferenciaTema>(leerPreferencia());
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

  establecer(preferencia: PreferenciaTema): void {
    this.preferencia.set(preferencia);
    try {
      if (preferencia === 'system') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, preferencia);
      }
    } catch {
      // Storage blocked: the choice still applies for this session.
    }
  }
}
