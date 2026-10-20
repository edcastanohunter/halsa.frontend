import {
  ESTADO_CASO_STAFF_LABELS,
  formatFechaCorta,
  formatFechaDiaBogota,
  formatFechaHoraBogota,
  formatFechaLarga,
  formatFechaRelativa,
  formatMoneda,
  formatNumero,
  formatPorcentaje,
  formatTamanoArchivo,
  TIPO_EVENTO_LABELS,
} from '@halsa/core';

describe('Core Formats & i18n (Bogota & es-CO)', () => {
  it('formats DateOnly string without UTC date shift bug', () => {
    expect(formatFechaCorta('2026-10-17')).toBe('17 oct 2026');
    expect(formatFechaCorta('2026-01-01')).toBe('1 ene 2026');
    expect(formatFechaCorta('2026-12-31')).toBe('31 dic 2026');
  });

  it('formats full Spanish date correctly', () => {
    expect(formatFechaLarga('2026-10-17')).toBe('17 de octubre de 2026');
  });

  it('takes the calendar day of a datetime in Bogotá, not UTC', () => {
    // 03:00 UTC on the 18th is still the 17th in Bogotá (UTC-5).
    expect(formatFechaDiaBogota('2026-10-18T03:00:00Z')).toBe('17 oct 2026');
    expect(formatFechaDiaBogota('2026-10-17T10:00:00-05:00')).toBe('17 oct 2026');
    expect(formatFechaDiaBogota(null)).toBe('');
  });

  it('formats a datetime like plan §8.5, keeping "p. m." on one line', () => {
    expect(formatFechaHoraBogota('2026-10-17T20:45:00Z')).toBe('17 oct 2026, 3:45 p. m.');
    // 02:00 UTC on the 18th is 9 p. m. on the 17th in Bogotá.
    expect(formatFechaHoraBogota('2026-10-18T02:00:00Z')).toBe('17 oct 2026, 9:00 p. m.');
    expect(formatFechaHoraBogota('no-es-fecha')).toBe('no-es-fecha');
  });

  it('handles null and undefined gracefully', () => {
    expect(formatFechaCorta(null)).toBe('');
    expect(formatFechaCorta(undefined)).toBe('');
  });

  it('formats percentage with comma and percentage sign', () => {
    expect(formatPorcentaje(23.45)).toBe('23,45 %');
  });

  it('formats numbers with es-CO formatting', () => {
    expect(formatNumero(1000)).toBe('1.000');
  });

  it('formats Colombian pesos without decimals', () => {
    expect(formatMoneda(1500000)).toBe('$ 1.500.000');
    expect(formatMoneda(null)).toBe('');
  });

  it('provides Spanish enum labels', () => {
    expect(TIPO_EVENTO_LABELS['AccidenteTrabajo']).toBe('Accidente de trabajo');
    expect(ESTADO_CASO_STAFF_LABELS['Radicado']).toBe('Radicado');
  });
});

describe('formatFechaRelativa with an injected clock', () => {
  const ahora = Date.parse('2026-10-17T15:00:00Z');

  it('describes past and future instants in Spanish', () => {
    expect(formatFechaRelativa('2026-10-17T12:00:00Z', ahora)).toBe('hace 3 horas');
    expect(formatFechaRelativa('2026-10-19T15:00:00Z', ahora)).toBe('pasado mañana');
    expect(formatFechaRelativa('2026-10-17T14:30:00Z', ahora)).toBe('hace 30 minutos');
  });
});

describe('formatTamanoArchivo', () => {
  it('uses es-CO decimals', () => {
    expect(formatTamanoArchivo(512)).toBe('512 B');
    expect(formatTamanoArchivo(2.5 * 1024 * 1024)).toBe('2,5 MB');
    expect(formatTamanoArchivo(300 * 1024)).toBe('300 KB');
  });
});
