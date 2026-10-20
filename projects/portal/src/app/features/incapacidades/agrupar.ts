import type { CasoPacienteResponse, IncapacidadPacienteResponse } from '@halsa/api-types';
import { compararFechas } from '@halsa/core';

/** Where a sick leave stands today, in the patient's words. */
export type Vigencia = 'vigente' | 'proxima' | 'terminada';

export function vigencia(
  i: Pick<IncapacidadPacienteResponse, 'fechaInicio' | 'fechaFin'>,
  hoy: string,
): Vigencia {
  if (compararFechas(hoy, i.fechaInicio) < 0) return 'proxima';
  return compararFechas(hoy, i.fechaFin) <= 0 ? 'vigente' : 'terminada';
}

export interface GrupoIncapacidades {
  casoId: string;
  /** Null when the case is missing from `mis-casos` (it shouldn't happen; the id still shows). */
  caso: CasoPacienteResponse | null;
  /** Newest first. */
  incapacidades: (IncapacidadPacienteResponse & { vigencia: Vigencia })[];
  /** The case's running total: `diasAcumulados` of its latest certificate. */
  acumulados: number;
}

/**
 * Plan §7.12: grouped by case, the case with the most recent sick leave first, and each case's
 * certificates newest first.
 */
export function agruparPorCaso(
  incapacidades: readonly IncapacidadPacienteResponse[],
  casos: readonly CasoPacienteResponse[],
  hoy: string,
): GrupoIncapacidades[] {
  const grupos = new Map<string, GrupoIncapacidades>();
  for (const i of incapacidades) {
    let grupo = grupos.get(i.casoId);
    if (!grupo) {
      grupo = {
        casoId: i.casoId,
        caso: casos.find((c) => c.casoId === i.casoId) ?? null,
        incapacidades: [],
        acumulados: 0,
      };
      grupos.set(i.casoId, grupo);
    }
    grupo.incapacidades.push({ ...i, vigencia: vigencia(i, hoy) });
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.incapacidades.sort((a, b) => compararFechas(b.fechaInicio, a.fechaInicio));
    g.acumulados = g.incapacidades[0]?.diasAcumulados ?? 0;
  }
  return lista.sort((a, b) =>
    compararFechas(b.incapacidades[0]!.fechaInicio, a.incapacidades[0]!.fechaInicio),
  );
}
