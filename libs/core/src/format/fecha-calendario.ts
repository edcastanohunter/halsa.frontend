/**
 * DateOnly helpers (plan §4.1, §8.5). API `date` values are 'YYYY-MM-DD' calendar dates: they
 * never go through `new Date(str)`, which reads them as UTC midnight and shows the previous day
 * in Bogotá. Arithmetic runs on UTC day numbers, so no local time zone is involved.
 */
export const ZONA_HORARIA = 'America/Bogota';

export interface FechaCalendario {
  anio: number;
  /** 1–12 */
  mes: number;
  dia: number;
}

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 86_400_000;

/** Parses a 'YYYY-MM-DD' string; `null` for malformed or impossible dates (2026-02-30). */
export function parsearFechaCalendario(valor: string | null | undefined): FechaCalendario | null {
  const partes = valor ? FORMATO_FECHA.exec(valor) : null;
  if (!partes) return null;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const utc = new Date(Date.UTC(anio, mes - 1, dia));
  if (utc.getUTCFullYear() !== anio || utc.getUTCMonth() !== mes - 1 || utc.getUTCDate() !== dia) {
    return null;
  }
  return { anio, mes, dia };
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

export function aTextoFechaCalendario({ anio, mes, dia }: FechaCalendario): string {
  return `${String(anio).padStart(4, '0')}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

function aDiaUtc(fecha: FechaCalendario): number {
  return Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia) / MS_DIA;
}

function desdeDiaUtc(dia: number): FechaCalendario {
  const d = new Date(dia * MS_DIA);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

const partesBogota = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date of an instant in Bogotá, as 'YYYY-MM-DD'. */
export function fechaCalendarioBogota(instante: number | Date | string): string | null {
  const ms =
    instante instanceof Date
      ? instante.getTime()
      : typeof instante === 'string'
        ? Date.parse(instante)
        : instante;
  if (!Number.isFinite(ms)) return null;
  const partes = Object.fromEntries(
    partesBogota.formatToParts(ms).map(({ type, value }) => [type, value]),
  );
  return `${partes['year']}-${partes['month']}-${partes['day']}`;
}

/** Today in Bogotá, as 'YYYY-MM-DD' (e.g. for "not in the future" validations). */
export function hoyBogota(ahora: number = Date.now()): string {
  return fechaCalendarioBogota(ahora)!;
}

/** Whole calendar days from `desde` to `hasta` (negative if `hasta` is earlier). */
export function diasEntre(desde: string, hasta: string): number | null {
  const a = parsearFechaCalendario(desde);
  const b = parsearFechaCalendario(hasta);
  return a && b ? aDiaUtc(b) - aDiaUtc(a) : null;
}

export function sumarDias(fecha: string, dias: number): string | null {
  const f = parsearFechaCalendario(fecha);
  return f ? aTextoFechaCalendario(desdeDiaUtc(aDiaUtc(f) + dias)) : null;
}

/** Sort comparator for valid 'YYYY-MM-DD' strings (they order lexicographically). */
export function compararFechas(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
