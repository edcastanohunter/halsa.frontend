/** A numbered pagination slot: a page number or a gap. */
export type EntradaPaginacion = number | 'hueco';

/**
 * Page numbers to show on desktop: the first, the last and the current one ±1, with gaps between
 * them. A gap that would hide a single page shows that page instead.
 */
export function paginasVisibles(actual: number, total: number): EntradaPaginacion[] {
  if (total <= 0) return [];
  const paginas = new Set([1, total, actual - 1, actual, actual + 1]);
  const ordenadas = [...paginas].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const resultado: EntradaPaginacion[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (p - anterior === 2) resultado.push(p - 1);
    else if (p - anterior > 2) resultado.push('hueco');
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}

/** `?page=` as a positive integer; anything else is page 1. */
export function leerPagina(valor: string | null | undefined): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
