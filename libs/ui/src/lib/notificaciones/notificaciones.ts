import { Injectable } from '@angular/core';
import { mensajeDeError } from '@halsa/core';
import { toast } from '@spartan-ng/brain/sonner';

const DURACION_ERROR_MS = 8000;

/**
 * Toasts for async results (plan §4.2, §8.6): the `<hlm-toaster>` in each app shell announces
 * them politely. Errors use the shared error→UI mapping, and offer the trace id as a copy action
 * instead of printing it, so support can be given the exact request.
 */
@Injectable({ providedIn: 'root' })
export class Notificaciones {
  exito(titulo: string, descripcion?: string): void {
    toast.success(titulo, { description: descripcion });
  }

  info(titulo: string, descripcion?: string): void {
    toast.info(titulo, { description: descripcion });
  }

  aviso(titulo: string, descripcion?: string): void {
    toast.warning(titulo, { description: descripcion });
  }

  /** Any thrown value: an `ErrorApi` maps to its Spanish message, anything else is generic. */
  error(error: unknown): void {
    const { titulo, mensaje, traza } = mensajeDeError(error);
    toast.error(titulo, {
      description: mensaje,
      duration: DURACION_ERROR_MS,
      action: traza
        ? {
            label: 'Copiar código',
            onClick: () => {
              navigator.clipboard.writeText(traza).then(
                () => toast.info('Código de seguimiento copiado'),
                () => undefined,
              );
            },
          }
        : undefined,
    });
  }
}
