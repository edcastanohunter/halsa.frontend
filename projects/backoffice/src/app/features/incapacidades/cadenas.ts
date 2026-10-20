import type { IncapacidadResponse } from '@halsa/api-types';
import { compararFechas } from '@halsa/core';

/** An initial incapacidad and its prórrogas, oldest first (plan §7.6). */
export interface Cadena {
  /** `null` when the list holds prórrogas whose initial isn't visible. */
  inicial: IncapacidadResponse | null;
  prorrogas: IncapacidadResponse[];
}

const porInicio = (a: IncapacidadResponse, b: IncapacidadResponse) =>
  compararFechas(a.fechaInicio, b.fechaInicio);

export function ultimaDe(cadena: Cadena): IncapacidadResponse {
  return cadena.prorrogas.at(-1) ?? cadena.inicial!;
}

/**
 * Groups the case's incapacidades into chains, newest chain first. The response has no
 * `prorrogaDe` (gap G18), so a prórroga joins the chain whose last certificate ends closest
 * before it starts: the backend only accepts a prórroga of the last one of a chain, with at most
 * 30 days in between, and periods never overlap.
 */
export function agruparCadenas(incapacidades: readonly IncapacidadResponse[]): Cadena[] {
  const cadenas: Cadena[] = [];
  for (const inc of [...incapacidades].sort(porInicio)) {
    if (inc.tipo === 'INICIAL') {
      cadenas.push({ inicial: inc, prorrogas: [] });
      continue;
    }
    const previas = cadenas.filter(
      (c) => compararFechas(ultimaDe(c).fechaFin, inc.fechaInicio) < 0,
    );
    const destino = previas.sort((a, b) =>
      compararFechas(ultimaDe(b).fechaFin, ultimaDe(a).fechaFin),
    )[0];
    if (destino) destino.prorrogas.push(inc);
    else cadenas.push({ inicial: null, prorrogas: [inc] });
  }
  return cadenas.reverse();
}

/** The certificates a new prórroga may extend: the last one of each chain. */
export function prorrogables(cadenas: readonly Cadena[]): IncapacidadResponse[] {
  return cadenas.map(ultimaDe);
}

/** The header figure: the largest `diasAcumulados` of the case (plan §7.6). */
export function diasAcumulados(incapacidades: readonly IncapacidadResponse[]): number {
  return incapacidades.reduce((max, i) => Math.max(max, i.diasAcumulados), 0);
}
