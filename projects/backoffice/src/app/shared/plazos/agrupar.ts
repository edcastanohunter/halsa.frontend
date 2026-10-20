import type { PlazoResponse } from '@halsa/api-types';
import { diasEntre, fechaCalendarioBogota } from '@halsa/core';

export type IdGrupoPlazo = 'vencidos' | 'hoy' | 'semana' | 'despues';

export interface GrupoPlazos {
  id: IdGrupoPlazo;
  titulo: string;
  plazos: PlazoResponse[];
}

const TITULOS: Record<IdGrupoPlazo, string> = {
  vencidos: 'Vencidos',
  hoy: 'Hoy',
  semana: 'Esta semana',
  despues: 'Más adelante',
};

/**
 * Mobile grouping of the board (plan §7.8), by Bogotá calendar day: past due (already VENCIDO,
 * or ABIERTO with `venceEn` gone by while the server sweep hasn't run), due today, within the
 * next 7 days, and later. Empty groups are dropped; order inside a group is kept.
 */
export function agruparPlazos(plazos: readonly PlazoResponse[], ahora: number): GrupoPlazos[] {
  const hoy = fechaCalendarioBogota(ahora)!;
  const grupos = new Map<IdGrupoPlazo, PlazoResponse[]>(
    (Object.keys(TITULOS) as IdGrupoPlazo[]).map((id) => [id, []]),
  );
  for (const p of plazos) {
    grupos.get(grupoDe(p, hoy, ahora))!.push(p);
  }
  return [...grupos]
    .filter(([, lista]) => lista.length)
    .map(([id, lista]) => ({ id, titulo: TITULOS[id], plazos: lista }));
}

function grupoDe(p: PlazoResponse, hoy: string, ahora: number): IdGrupoPlazo {
  if (p.estado === 'VENCIDO' || Date.parse(p.venceEn) <= ahora) return 'vencidos';
  const dias = diasEntre(hoy, fechaCalendarioBogota(p.venceEn) ?? hoy) ?? 0;
  if (dias <= 0) return 'hoy';
  return dias <= 7 ? 'semana' : 'despues';
}
