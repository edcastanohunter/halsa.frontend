import { rangoFechas, textoEnDias } from './formato';

describe('patient date wording', () => {
  it('collapses a DateOnly range by month and year, never shifting a day', () => {
    expect(rangoFechas('2026-10-01', '2026-10-30')).toBe('1 – 30 oct 2026');
    expect(rangoFechas('2026-10-20', '2026-11-08')).toBe('20 oct – 8 nov 2026');
    expect(rangoFechas('2026-12-28', '2027-01-05')).toBe('28 dic 2026 – 5 ene 2027');
  });

  it('says calendar distances in plain words', () => {
    expect(textoEnDias(0)).toBe('Hoy');
    expect(textoEnDias(1)).toBe('Mañana');
    expect(textoEnDias(9)).toBe('En 9 días');
    expect(textoEnDias(-2)).toBe('Hace 2 días');
  });
});
