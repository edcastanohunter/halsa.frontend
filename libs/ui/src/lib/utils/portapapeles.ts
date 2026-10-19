import { DestroyRef, inject, signal } from '@angular/core';

/**
 * Clipboard copy with a transient "copied" flag for the button state and the live region.
 * Never logs or stores the copied value (it may be an activation code).
 */
export function injectCopiar(duracionMs = 2000) {
  const copiado = signal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));

  async function copiar(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return false;
    }
    copiado.set(true);
    clearTimeout(timer);
    timer = setTimeout(() => copiado.set(false), duracionMs);
    return true;
  }

  return { copiado: copiado.asReadonly(), copiar };
}
