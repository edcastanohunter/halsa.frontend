import { esErrorApi, mensajeDeError, tieneCodigo } from '@halsa/core';

/** Backend `CodigosRevision.MaximoObservaciones`. */
export const OBSERVACIONES_MAX = 2000;

/** Plan §7.11: Pendientes (default) · Cerradas, as `?estado=` slugs. */
export type PestanaRevisiones = 'pendientes' | 'cerradas';
export const PESTANAS_REVISIONES: readonly { id: PestanaRevisiones; etiqueta: string }[] = [
  { id: 'pendientes', etiqueta: 'Pendientes' },
  { id: 'cerradas', etiqueta: 'Cerradas' },
];

export function leerPestanaRevisiones(valor: string | null | undefined): PestanaRevisiones {
  return valor === 'cerradas' ? 'cerradas' : 'pendientes';
}

export type CampoRevision = 'conclusion' | 'observaciones' | 'general';

/**
 * A failed closure, by field. `Auditoria.RevisionYaCerrada` (409) means another officer closed it
 * first: the caller refreshes the list instead of keeping the sheet open (plan §7.11).
 */
export function erroresDeRevision(
  error: unknown,
): { conflicto: true; mensaje: string } | Partial<Record<CampoRevision, string>> {
  if (esErrorApi(error)) {
    const p = error.problema;
    if (tieneCodigo(p, 'Auditoria.RevisionYaCerrada')) {
      return { conflicto: true, mensaje: p.detail ?? 'La revisión ya está cerrada.' };
    }
    const errores: Partial<Record<CampoRevision, string>> = {};
    for (const e of p.errors) {
      if (e.codigo === 'Auditoria.ConclusionInvalida') errores.conclusion = e.mensaje;
      else if (e.codigo === 'Auditoria.ObservacionesDemasiadoLargas') {
        errores.observaciones = e.mensaje;
      }
    }
    if (Object.keys(errores).length) return errores;
  }
  const m = mensajeDeError(error);
  return { general: `${m.titulo}. ${m.mensaje}` };
}
