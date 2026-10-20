/** One step of a copy request's stepper (plan §7.12). */
export interface PasoSolicitud {
  etiqueta: string;
  estado: 'hecho' | 'actual' | 'pendiente';
  /** The closing step's outcome. */
  resultado?: 'entregada' | 'rechazada';
}

/**
 * Recibida → En trámite → Entregada / Rechazada. The ARL may close a request straight from
 * Recibida (`SolicitudCopiaHc.Cerrar`); once closed, the middle step reads as done either way.
 * An unknown state (a newer backend) shows its raw value as the current step.
 */
export function pasosDe(estado: string): PasoSolicitud[] {
  const paso = (etiqueta: string, e: PasoSolicitud['estado']): PasoSolicitud => ({
    etiqueta,
    estado: e,
  });
  switch (estado) {
    case 'RECIBIDA':
      return [
        paso('Recibida', 'actual'),
        paso('En trámite', 'pendiente'),
        paso('Entrega', 'pendiente'),
      ];
    case 'EN_TRAMITE':
      return [
        paso('Recibida', 'hecho'),
        paso('En trámite', 'actual'),
        paso('Entrega', 'pendiente'),
      ];
    case 'ENTREGADA':
      return [
        paso('Recibida', 'hecho'),
        paso('En trámite', 'hecho'),
        { etiqueta: 'Entregada', estado: 'actual', resultado: 'entregada' },
      ];
    case 'RECHAZADA':
      return [
        paso('Recibida', 'hecho'),
        paso('En trámite', 'hecho'),
        { etiqueta: 'Rechazada', estado: 'actual', resultado: 'rechazada' },
      ];
    default:
      return [paso('Recibida', 'hecho'), paso(estado, 'actual')];
  }
}

export const estaCerrada = (estado: string) => estado === 'ENTREGADA' || estado === 'RECHAZADA';
