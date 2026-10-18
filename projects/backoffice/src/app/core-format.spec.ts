import {
  formatFechaCorta,
  formatFechaLarga,
  formatPorcentaje,
  formatNumero,
  TIPO_EVENTO_LABELS,
  ESTADO_CASO_STAFF_LABELS,
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

  it('provides Spanish enum labels', () => {
    expect(TIPO_EVENTO_LABELS['AccidenteTrabajo']).toBe('Accidente de trabajo');
    expect(ESTADO_CASO_STAFF_LABELS['Radicado']).toBe('Radicado');
  });
});
