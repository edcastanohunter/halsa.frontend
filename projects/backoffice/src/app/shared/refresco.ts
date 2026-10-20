import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';

/** Plan §6.3: data older than this is refetched when the browser tab becomes visible again. */
export const ANTIGUEDAD_REFRESCO_MS = 60_000;

/**
 * Calls `refrescar` when the tab becomes visible and the last load (`cargadoEn`, epoch ms) is
 * older than 60 s. There are no push notifications (gap G15), so this keeps lists honest.
 * Must be called in an injection context.
 */
export function injectRefrescoAlVolver(
  cargadoEn: () => number | null,
  refrescar: () => void,
  ahora: () => number = Date.now,
): void {
  const documento = inject(DOCUMENT);
  const alCambiar = () => {
    if (documento.visibilityState !== 'visible') return;
    const ultima = cargadoEn();
    if (ultima !== null && ahora() - ultima > ANTIGUEDAD_REFRESCO_MS) refrescar();
  };
  documento.addEventListener('visibilitychange', alCambiar);
  inject(DestroyRef).onDestroy(() => documento.removeEventListener('visibilitychange', alCambiar));
}
