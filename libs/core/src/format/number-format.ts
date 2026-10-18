/**
 * Formats a number as a Colombian percentage string (e.g. 23.45 -> "23,45 %").
 * Standardizes to Colombian format with space before '%'.
 */
export function formatPorcentaje(valor: number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '';
  const numStr = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
  return `${numStr} %`;
}

/**
 * Formats a general number according to es-CO locale.
 */
export function formatNumero(valor: number | null | undefined, decimales = 0): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}
