import { esErrorApi, mensajeDeError, tieneCodigo } from '@halsa/core';

/** `FormatoCodigoActivacion` (SPEC 12): `ABC123-K7Q2M9XD4P`, an id of 6 and a secret of 10. */
export const LARGO_ID = 6;
export const LARGO_SECRETO = 10;
const LARGO_TOTAL = LARGO_ID + LARGO_SECRETO;

const sinSeparadores = (texto: string) => texto.toUpperCase().replace(/[^0-9A-Z]/g, '');

/**
 * Live formatting of what the patient types or pastes (plan §7.12): uppercase, spaces and stray
 * symbols dropped, the hyphen after the sixth character. Crockford's confusables (`O`, `I`, `L`)
 * are kept as typed: the server reads them as `0`, `1`, `1`, so the raw intent goes through. The
 * hyphen appears only once a seventh character exists, so backspace can always remove it.
 */
export function formatearCodigo(texto: string): string {
  const limpio = sinSeparadores(texto).slice(0, LARGO_TOTAL);
  return limpio.length > LARGO_ID
    ? `${limpio.slice(0, LARGO_ID)}-${limpio.slice(LARGO_ID)}`
    : limpio;
}

/** Where the caret goes after formatting: behind the same number of code characters. */
export function cursorTrasFormato(crudo: string, cursor: number): number {
  const antes = Math.min(sinSeparadores(crudo.slice(0, cursor)).length, LARGO_TOTAL);
  return antes > LARGO_ID ? antes + 1 : antes;
}

export const codigoCompleto = (codigo: string) => sinSeparadores(codigo).length === LARGO_TOTAL;

/** What the activation form shows for a failed redeem; `esperaSeg` starts the countdown. */
export interface ErrorVinculo {
  mensaje: string;
  esperaSeg?: number;
}

/**
 * `POST /paciente/api/vinculos` errors (plan §7.12, SPEC 12). Two different `429`s exist: a
 * per-IP limiter with `Retry-After` (plan §4.3) gets a countdown; `Paciente.DemasiadosIntentos`
 * (5 failed redeems per patient in 24 h) has no `Retry-After` and keeps the server's wording.
 */
export function errorDeVinculo(error: unknown): ErrorVinculo {
  if (esErrorApi(error)) {
    const p = error.problema;
    if (p.status === 429) {
      if (p.retryAfterSeg) {
        return { mensaje: 'Demasiados intentos.', esperaSeg: p.retryAfterSeg };
      }
      return {
        mensaje: p.detail ?? 'Demasiados intentos fallidos. Vuelve a intentarlo en 24 horas.',
      };
    }
    if (tieneCodigo(p, 'Paciente.CodigoInvalido')) {
      return { mensaje: 'El código no es válido o ya fue usado.' };
    }
    if (tieneCodigo(p, 'Paciente.VinculoDistinto')) {
      return { mensaje: 'Tu cuenta ya está vinculada a otro documento.' };
    }
    if (tieneCodigo(p, 'Paciente.CodigoBloqueado')) {
      return {
        mensaje: 'Este código se bloqueó por demasiados intentos. Pide uno nuevo a tu ARL.',
      };
    }
  }
  const m = mensajeDeError(error);
  return { mensaje: `${m.titulo}. ${m.mensaje}` };
}
