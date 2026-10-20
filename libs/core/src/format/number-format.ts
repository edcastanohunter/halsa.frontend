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

const DECIMAL_ES_CO = /^-?(\d+([.,]\d*)?|[.,]\d+)$/;

/**
 * Parses a typed decimal (es-CO "23,45"; "23.45" is accepted too, since grouping makes no sense
 * in a percentage). Empty → `null`; anything else that isn't one number → `NaN`.
 */
export function parsearDecimal(texto: string | null | undefined): number | null {
  const limpio = (texto ?? '').replace(/[\s%]/g, '');
  if (!limpio) return null;
  if (!DECIMAL_ES_CO.test(limpio)) return Number.NaN;
  return Number(limpio.replace(',', '.'));
}

/** Whether `valor` has at most `decimales` decimal places (backend `decimal.Round(v, 2) == v`). */
export function tieneMaxDecimales(valor: number, decimales = 2): boolean {
  const escalado = valor * 10 ** decimales;
  return Math.abs(escalado - Math.round(escalado)) < 1e-6;
}

/** A number as typed in an es-CO field: comma decimals, no grouping, no trailing zeros. */
export function formatDecimalEditable(valor: number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || isNaN(valor)) return '';
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: decimales,
    useGrouping: false,
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
