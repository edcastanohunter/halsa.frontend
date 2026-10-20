import { fechaCalendarioBogota, parsearFechaCalendario } from './fecha-calendario';

/**
 * Colombia has kept UTC-5 all year since 1993 (no daylight saving), so a Bogotá wall-clock time
 * maps to an instant with a fixed offset. That lets `datetime-local` inputs, which have no zone,
 * be read as Bogotá time whatever the browser's own zone is (plan §2: never the browser's zone).
 */
export const OFFSET_BOGOTA = '-05:00';
const OFFSET_BOGOTA_MS = -5 * 3_600_000;

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** `'2026-10-17T15:30'` (a `datetime-local` value, Bogotá) → `'2026-10-17T15:30:00-05:00'`. */
export function bogotaLocalAIso(valor: string | null | undefined): string | null {
  const m = valor ? LOCAL.exec(valor) : null;
  if (!m || !parsearFechaCalendario(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59) return null;
  return `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}${OFFSET_BOGOTA}`;
}

/** An instant as a Bogotá `datetime-local` value (`'YYYY-MM-DDTHH:mm'`), e.g. for `max`. */
export function aBogotaLocal(instante: number | string): string | null {
  const ms = typeof instante === 'string' ? Date.parse(instante) : instante;
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + OFFSET_BOGOTA_MS);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fechaCalendarioBogota(ms)}T${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}

/**
 * A calendar date read as "until the end of that day in Bogotá" (plan §7.8, "Vence antes de"):
 * the first instant of the next Bogotá day, as an ISO string with offset.
 */
export function finDelDiaBogota(dateOnly: string | null | undefined): string | null {
  const f = parsearFechaCalendario(dateOnly);
  if (!f) return null;
  const siguiente = new Date(Date.UTC(f.anio, f.mes - 1, f.dia + 1));
  return `${siguiente.toISOString().slice(0, 10)}T00:00:00${OFFSET_BOGOTA}`;
}
