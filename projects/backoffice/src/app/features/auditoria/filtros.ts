import {
  ACCION_AUDITORIA_LABELS,
  AccionAuditoria,
  diasEntre,
  finDelDiaBogota,
  hoyBogota,
  OFFSET_BOGOTA,
  parsearFechaCalendario,
  RESULTADO_AUDITORIA_LABELS,
  ResultadoAuditoria,
  sumarDias,
} from '@halsa/core';
import { leerPagina } from '../../shared/paginacion';

/** Plan §7.10: 50 rows per page, server pagination. */
export const TAMANO_PAGINA_ACCESOS = 50;
/** Plan §7.10: the last 7 days by default, today included. */
export const DIAS_POR_DEFECTO = 7;
/** Backend `ListAccesosAuditadosQuery.RangoMaximoDias`. */
export const DIAS_MAXIMOS = 31;
/** Backend `ListAccesosAuditadosQueryValidator`: `actorId` up to 64 characters. */
export const ACTOR_MAX = 64;

/** The filter options, in one place (plan §4.3), in the order of the backend enums. */
export const ACCIONES = Object.keys(ACCION_AUDITORIA_LABELS) as AccionAuditoria[];
export const RESULTADOS = Object.keys(RESULTADO_AUDITORIA_LABELS) as ResultadoAuditoria[];

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The audit filters as the URL holds them: calendar days in Bogotá, both ends included. */
export interface FiltroAccesos {
  desde: string;
  hasta: string;
  casoId: string | null;
  actorId: string | null;
  accion: AccionAuditoria | null;
  resultado: ResultadoAuditoria | null;
  page: number;
}

export interface ParametrosUrl {
  desde?: string;
  hasta?: string;
  casoId?: string;
  actorId?: string;
  accion?: string;
  resultado?: string;
  page?: string;
}

export function rangoPorDefecto(ahora = Date.now()): { desde: string; hasta: string } {
  const hasta = hoyBogota(ahora);
  return { desde: sumarDias(hasta, -(DIAS_POR_DEFECTO - 1))!, hasta };
}

const deLista = <T extends string>(lista: readonly T[], valor: string | undefined): T | null =>
  lista.includes(valor as T) ? (valor as T) : null;

/**
 * URL → filter. Anything malformed falls back to its default instead of failing the page; an
 * invalid date range (a hand-edited URL) is kept so the form can explain it.
 */
export function leerFiltro(q: ParametrosUrl, ahora = Date.now()): FiltroAccesos {
  const defecto = rangoPorDefecto(ahora);
  const caso = q.casoId?.trim() ?? '';
  const actor = q.actorId?.trim() ?? '';
  return {
    desde: parsearFechaCalendario(q.desde) ? q.desde! : defecto.desde,
    hasta: parsearFechaCalendario(q.hasta) ? q.hasta! : defecto.hasta,
    casoId: PATRON_UUID.test(caso) ? caso.toLowerCase() : null,
    actorId: actor && actor.length <= ACTOR_MAX ? actor : null,
    accion: deLista(ACCIONES, q.accion),
    resultado: deLista(RESULTADOS, q.resultado),
    page: leerPagina(q.page),
  };
}

/** Filter → query params. Defaults are left out, so the clean URL means "the last 7 days". */
export function aParametrosUrl(
  f: Omit<FiltroAccesos, 'page'>,
  ahora = Date.now(),
): Record<string, string | null> {
  const defecto = rangoPorDefecto(ahora);
  const rangoDefecto = f.desde === defecto.desde && f.hasta === defecto.hasta;
  return {
    desde: rangoDefecto ? null : f.desde,
    hasta: rangoDefecto ? null : f.hasta,
    casoId: f.casoId,
    actorId: f.actorId,
    accion: f.accion,
    resultado: f.resultado,
    page: null,
  };
}

export type ErrorRango = 'invertido' | 'excedido';

/** `desde ≤ hasta` and at most 31 days, both ends included (the API's `hasta` is exclusive). */
export function validarRango(desde: string, hasta: string): ErrorRango | null {
  const dias = diasEntre(desde, hasta);
  if (dias === null) return null;
  if (dias < 0) return 'invertido';
  return dias + 1 > DIAS_MAXIMOS ? 'excedido' : null;
}

export function esUuid(valor: string): boolean {
  return PATRON_UUID.test(valor.trim());
}

/** The API query: Bogotá midnight of `desde` up to (excluding) the midnight after `hasta`. */
export function aConsulta(f: FiltroAccesos) {
  return {
    desde: `${f.desde}T00:00:00${OFFSET_BOGOTA}`,
    hasta: finDelDiaBogota(f.hasta)!,
    casoId: f.casoId,
    actorId: f.actorId,
    accion: f.accion,
    resultado: f.resultado,
    page: f.page,
    pageSize: TAMANO_PAGINA_ACCESOS,
  };
}

export type ConsultaAccesos = ReturnType<typeof aConsulta>;

/** "Filtros (3)" on mobile: how many filters differ from the defaults. */
export function contarFiltros(f: FiltroAccesos, ahora = Date.now()): number {
  const defecto = rangoPorDefecto(ahora);
  const rango = f.desde !== defecto.desde || f.hasta !== defecto.hasta ? 1 : 0;
  return rango + [f.casoId, f.actorId, f.accion, f.resultado].filter(Boolean).length;
}
