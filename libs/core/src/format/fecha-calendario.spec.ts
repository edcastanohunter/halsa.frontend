import {
  aTextoFechaCalendario,
  compararFechas,
  diasEntre,
  fechaCalendarioBogota,
  hoyBogota,
  parsearFechaCalendario,
  sumarDias,
} from './fecha-calendario';
import { formatFechaCorta } from './date-format';

describe('DateOnly helpers (plan §4.1, §8.5)', () => {
  it('DateOnly off-by-one: "2026-10-17" is the 17th in Bogotá, not the 16th', () => {
    // The bug this module exists to prevent: new Date('2026-10-17') is UTC midnight, which is
    // 7 p. m. on the 16th in Bogotá (UTC-5).
    const ingenuo = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      day: 'numeric',
    }).format(new Date('2026-10-17'));
    expect(ingenuo).toBe('16');
    expect(parsearFechaCalendario('2026-10-17')).toEqual({ anio: 2026, mes: 10, dia: 17 });
    expect(formatFechaCorta('2026-10-17')).toBe('17 oct 2026');
  });

  it('rejects malformed and impossible dates', () => {
    expect(parsearFechaCalendario('2026-02-30')).toBeNull();
    expect(parsearFechaCalendario('2026-13-01')).toBeNull();
    expect(parsearFechaCalendario('2026-1-1')).toBeNull();
    expect(parsearFechaCalendario('2026-10-17T00:00:00Z')).toBeNull();
    expect(parsearFechaCalendario(null)).toBeNull();
    expect(parsearFechaCalendario('2028-02-29')).toEqual({ anio: 2028, mes: 2, dia: 29 });
  });

  it('round-trips to text with zero padding', () => {
    expect(aTextoFechaCalendario({ anio: 2026, mes: 1, dia: 5 })).toBe('2026-01-05');
  });

  it('computes the Bogotá calendar date of an instant', () => {
    // 03:00 UTC on the 18th is still 10 p. m. on the 17th in Bogotá.
    expect(fechaCalendarioBogota('2026-10-18T03:00:00Z')).toBe('2026-10-17');
    expect(hoyBogota(Date.parse('2026-10-18T05:00:00Z'))).toBe('2026-10-18');
    expect(fechaCalendarioBogota('no es fecha')).toBeNull();
  });

  it('does calendar arithmetic across months, years and leap days', () => {
    expect(diasEntre('2026-10-17', '2026-10-20')).toBe(3);
    expect(diasEntre('2026-10-20', '2026-10-17')).toBe(-3);
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    // A 30-day incapacidad starting Aug 1 ends Aug 30 (fechaInicio + dias - 1).
    expect(sumarDias('2026-08-01', 29)).toBe('2026-08-30');
    expect(diasEntre('x', '2026-01-01')).toBeNull();
  });

  it('sorts ISO calendar dates', () => {
    expect(['2026-10-17', '2025-12-31', '2026-01-02'].sort(compararFechas)).toEqual([
      '2025-12-31',
      '2026-01-02',
      '2026-10-17',
    ]);
  });
});
