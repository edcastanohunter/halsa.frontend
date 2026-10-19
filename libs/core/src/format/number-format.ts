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

/** Human file size in es-CO (e.g. 2457600 -> "2,3 MB"). */
export function formatTamanoArchivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'] as const;
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${formatNumero(valor, valor < 10 ? 1 : 0)} ${unidades[i]}`;
}

/** Colombian pesos without decimals (e.g. 1500000 -> "$ 1.500.000"). */
export function formatMoneda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(valor)
    .replace(/ /g, ' ');
}
