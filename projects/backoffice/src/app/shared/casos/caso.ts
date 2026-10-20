import { EstadoCaso } from '@halsa/core';

/** Filter order of `/casos` (plan §4.1): the administrative flow, then the closed outcomes. */
export const ESTADOS_CASO: readonly EstadoCaso[] = [
  'Radicado',
  'Validado',
  'EnAtencion',
  'EnCalificacionOrigen',
  'EnCalificacionPcl',
  'Cerrado',
  'Rechazado',
];

export function esEstadoCaso(valor: unknown): valor is EstadoCaso {
  return typeof valor === 'string' && (ESTADOS_CASO as readonly string[]).includes(valor);
}

export interface Documento {
  tipo: string | null;
  numero: string;
}

/** `"CC 1020304050"` (backend `CasoResponseMapping.Documento`) → type and number. */
export function separarDocumento(documento: string): Documento {
  const texto = documento.trim();
  const espacio = texto.indexOf(' ');
  if (espacio < 0) return { tipo: null, numero: texto };
  return { tipo: texto.slice(0, espacio), numero: texto.slice(espacio + 1).trim() };
}

/**
 * Gap G4: no user directory, so a sub shows shortened (the full one in a tooltip). Subs are
 * time-ordered UUIDs (v7), so accounts created together share their first 8 characters; the last
 * 4 tell them apart: `01999000…0a01`.
 */
export function subCorto(sub: string): string {
  return sub.length <= 12 ? sub : `${sub.slice(0, 8)}…${sub.slice(-4)}`;
}
