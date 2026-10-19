import { tieneCodigo } from '../i18n/codigos-error';
import { ErrorApi, ProblemaApi } from './problema';

/** What a toast, alert or error state shows for a failed request. */
export interface MensajeError {
  titulo: string;
  mensaje: string;
  /** Id to quote to support ("Detalles técnicos"): `traceId`, else the correlation id. */
  traza: string | null;
}

const MENSAJE_INESPERADO =
  'Ocurrió un error inesperado. Intenta de nuevo; si persiste, comparte el código de seguimiento con soporte.';

/** "45 segundos", "2 minutos": a coarse wait for 429 messages. */
export function formatEspera(segundos: number): string {
  if (segundos < 60) return segundos === 1 ? '1 segundo' : `${segundos} segundos`;
  const minutos = Math.ceil(segundos / 60);
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
}

/**
 * Maps a problem to Spanish UI copy (plan §4.2). The server's `detail` is already Spanish and
 * presentable, so it wins where it is safe; a 404 is always neutral (never claim the resource
 * doesn't exist), and 5xx bodies are never shown (their detail is generic English).
 */
export function mensajeError(problema: ProblemaApi): MensajeError {
  const { status, detail } = problema;
  const traza = problema.traceId ?? problema.correlationId;
  const con = (titulo: string, mensaje: string): MensajeError => ({ titulo, mensaje, traza });

  if (status === 0) {
    return con(
      'Sin conexión',
      'No pudimos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo.',
    );
  }
  if (status === 401) {
    return problema.stepUp
      ? con(
          'Verificación requerida',
          'Confirma tu identidad con tu código de verificación para continuar.',
        )
      : con('Tu sesión terminó', 'Inicia sesión de nuevo para continuar.');
  }
  if (status === 403 && tieneCodigo(problema, 'Clinico.NoAsignado')) {
    return con('No estás asignado a este caso', detail ?? 'Pide a un analista que te asigne.');
  }
  if (status === 404) {
    return con('No disponible', 'No existe o no está disponible para tu usuario.');
  }
  if (status === 429) {
    const espera = problema.retryAfterSeg;
    return con(
      'Demasiados intentos',
      espera
        ? `Espera ${formatEspera(espera)} e intenta de nuevo.`
        : 'Espera un momento e intenta de nuevo.',
    );
  }
  if (status === 503) {
    return con('Servicio no disponible', 'Intenta de nuevo en unos minutos.');
  }
  if (status >= 500) {
    return con('Error inesperado', MENSAJE_INESPERADO);
  }

  switch (status) {
    case 400:
      return con('Revisa los datos', detail ?? 'Hay datos que no son válidos.');
    case 403:
      return con('Acceso no permitido', detail ?? 'Tu usuario no tiene permiso para esta acción.');
    case 409:
      return con(
        'No se pudo completar',
        detail ?? 'La información cambió mientras trabajabas. Recarga e intenta de nuevo.',
      );
    case 413:
      return con('Archivo demasiado grande', 'El archivo supera el tamaño máximo de 10 MB.');
    case 415:
      return con('Formato no admitido', 'El archivo debe ser un PDF.');
    case 422:
      return con('No se pudo procesar', detail ?? 'La solicitud no se pudo procesar.');
    default:
      return con('No se pudo completar', detail ?? MENSAJE_INESPERADO);
  }
}

/** `mensajeError` for anything a subscription can throw. */
export function mensajeDeError(error: unknown): MensajeError {
  if (error instanceof ErrorApi) return mensajeError(error.problema);
  return { titulo: 'Error inesperado', mensaje: MENSAJE_INESPERADO, traza: null };
}
