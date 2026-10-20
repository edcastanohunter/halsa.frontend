import { formatFechaCorta, parsearFechaCalendario } from '@halsa/core';

/**
 * A DateOnly range in few words: "1 – 30 oct 2026", "20 oct – 8 nov 2026", "28 dic 2026 – 5 ene
 * 2027". Never through `Date` (plan §8.5).
 */
export function rangoFechas(inicio: string, fin: string): string {
  const a = parsearFechaCalendario(inicio);
  const b = parsearFechaCalendario(fin);
  if (!a || !b) return `${formatFechaCorta(inicio)} – ${formatFechaCorta(fin)}`;
  const finTexto = formatFechaCorta(fin);
  if (a.anio !== b.anio) return `${formatFechaCorta(inicio)} – ${finTexto}`;
  const [dia, mes] = formatFechaCorta(inicio).split(' ');
  return a.mes === b.mes ? `${dia} – ${finTexto}` : `${dia} ${mes} – ${finTexto}`;
}

/** "Hoy", "Mañana", "En 9 días", "Hace 2 días": a calendar distance in plain words. */
export function textoEnDias(dias: number): string {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return dias > 0 ? `En ${dias} días` : `Hace ${-dias} días`;
}

export const diasTexto = (n: number) => (n === 1 ? '1 día' : `${n} días`);
