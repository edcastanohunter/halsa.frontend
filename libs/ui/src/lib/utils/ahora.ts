import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/**
 * A clock signal for countdowns and relative times. Ticks every `intervaloMs` and stops when the
 * injection context is destroyed. Must be called in an injection context.
 */
export function injectAhora(intervaloMs = 60_000): Signal<number> {
  const ahora = signal(Date.now());
  const id = setInterval(() => ahora.set(Date.now()), intervaloMs);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return ahora.asReadonly();
}
