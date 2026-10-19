const MONTH_NAMES_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const FULL_MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/**
 * Formats a calendar DateOnly string ('YYYY-MM-DD') without passing through `new Date()`,
 * avoiding UTC-midnight date shift bugs in America/Bogota.
 */
export function formatFechaCorta(dateOnly: string | null | undefined): string {
  if (!dateOnly || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly ?? '';
  }

  const parts = dateOnly.split('-');
  const year = parts[0];
  const monthIdx = parseInt(parts[1]!, 10) - 1;
  const day = parseInt(parts[2]!, 10);

  if (monthIdx < 0 || monthIdx > 11) {
    return dateOnly;
  }

  const month = MONTH_NAMES_ES[monthIdx];
  return `${day} ${month} ${year}`;
}

export function formatFechaLarga(dateOnly: string | null | undefined): string {
  if (!dateOnly || !/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly ?? '';
  }

  const parts = dateOnly.split('-');
  const year = parts[0];
  const monthIdx = parseInt(parts[1]!, 10) - 1;
  const day = parseInt(parts[2]!, 10);

  if (monthIdx < 0 || monthIdx > 11) {
    return dateOnly;
  }

  const month = FULL_MONTH_NAMES_ES[monthIdx];
  return `${day} de ${month} de ${year}`;
}

/**
 * Formats an ISO datetime string in America/Bogota time zone.
 */
export function formatFechaHoraBogota(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

/**
 * Calculates a relative time description in Spanish (e.g. "hace 2 días", "en 3 horas").
 */
export function formatFechaRelativa(
  isoString: string | null | undefined,
  ahora: number = Date.now(),
): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const diffMs = d.getTime() - ahora;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHours = Math.round(diffMin / 60);
    const diffDays = Math.round(diffHours / 24);

    const rtf = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    }
    if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    }
    if (Math.abs(diffMin) >= 1) {
      return rtf.format(diffMin, 'minute');
    }
    return rtf.format(diffSec, 'second');
  } catch {
    return isoString;
  }
}
