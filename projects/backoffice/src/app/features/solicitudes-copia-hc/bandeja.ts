import type { SolicitudCopiaHcResponse } from '@halsa/api-types';
import { esErrorApi, EstadoSolicitudCopiaHc, mensajeDeError, tieneCodigo } from '@halsa/core';

/** Backend `SolicitudCopiaHc.MinimoNota` / `MaximoNota`. */
export const NOTA_MIN = 10;
export const NOTA_MAX = 1000;

/** Plan §7.9: Recibidas · En trámite · Cerradas (ENTREGADA + RECHAZADA), as `?estado=` slugs. */
export type Pestana = 'recibidas' | 'en-tramite' | 'cerradas';
export const PESTANAS: readonly { id: Pestana; etiqueta: string }[] = [
  { id: 'recibidas', etiqueta: 'Recibidas' },
  { id: 'en-tramite', etiqueta: 'En trámite' },
  { id: 'cerradas', etiqueta: 'Cerradas' },
];
const PESTANA_POR_DEFECTO: Pestana = 'recibidas';

const ESTADOS_PESTANA: Record<Pestana, readonly EstadoSolicitudCopiaHc[]> = {
  recibidas: ['RECIBIDA'],
  'en-tramite': ['EN_TRAMITE'],
  cerradas: ['ENTREGADA', 'RECHAZADA'],
};

export function leerPestana(valor: string | null | undefined): Pestana {
  return PESTANAS.some((p) => p.id === valor) ? (valor as Pestana) : PESTANA_POR_DEFECTO;
}

/** The default tab needs no param, so the clean URL keeps meaning "recibidas". */
export function parametroPestana(pestana: Pestana): string | null {
  return pestana === PESTANA_POR_DEFECTO ? null : pestana;
}

export type Bandeja = Record<Pestana, SolicitudCopiaHcResponse[]>;

/**
 * One `GET` (every state) split into the three tabs, so every badge count is right. Open requests
 * keep the API order (oldest first: their deadline runs first); closed ones show the latest
 * closure first. A state this frontend doesn't know lands in no tab.
 */
export function agruparBandeja(solicitudes: readonly SolicitudCopiaHcResponse[]): Bandeja {
  const de = (p: Pestana) => solicitudes.filter((s) => ESTADOS_PESTANA[p].includes(s.estado));
  const instante = (s: SolicitudCopiaHcResponse) => Date.parse(s.atendidaEn ?? s.solicitadaEn);
  return {
    recibidas: de('recibidas'),
    'en-tramite': de('en-tramite'),
    cerradas: de('cerradas').sort((a, b) => instante(b) - instante(a)),
  };
}

export const esTramitable = (s: Pick<SolicitudCopiaHcResponse, 'estado'>) =>
  s.estado === 'RECIBIDA';
/** `SolicitudCopiaHc.Cerrar`: from any open state, not only EN_TRAMITE. */
export const esCerrable = (s: Pick<SolicitudCopiaHcResponse, 'estado'>) =>
  s.estado === 'RECIBIDA' || s.estado === 'EN_TRAMITE';

export type CampoCierre = 'resultado' | 'nota' | 'general';

/**
 * A failed closure, by field (plan §4.2). `SolicitudCopiaHc.TransicionInvalida` is a conflict: the
 * request changed under us, so the caller refreshes instead of showing it in the form.
 */
export function erroresDeCierre(
  error: unknown,
): { conflicto: true; mensaje: string } | Partial<Record<CampoCierre, string>> {
  if (esErrorApi(error)) {
    const p = error.problema;
    if (tieneCodigo(p, 'SolicitudCopiaHc.TransicionInvalida')) {
      return { conflicto: true, mensaje: p.detail ?? 'La solicitud cambió de estado.' };
    }
    const errores: Partial<Record<CampoCierre, string>> = {};
    for (const e of p.errors) {
      if (e.codigo?.startsWith('SolicitudCopiaHc.Nota')) errores.nota = e.mensaje;
      else if (e.codigo === 'SolicitudCopiaHc.ResultadoInvalido') errores.resultado = e.mensaje;
    }
    if (tieneCodigo(p, 'SolicitudCopiaHc.ResultadoInvalido') && !errores.resultado) {
      errores.resultado = p.detail ?? 'Elige el resultado.';
    }
    if (Object.keys(errores).length) return errores;
  }
  const m = mensajeDeError(error);
  return { general: `${m.titulo}. ${m.mensaje}` };
}
