import { esEstadoCaso, separarDocumento, subCorto } from './casos/caso';
import { leerPagina, paginasVisibles } from './paginacion';

describe('caso helpers', () => {
  it('splits the API document into type and number', () => {
    expect(separarDocumento('CC 1020304050')).toEqual({ tipo: 'CC', numero: '1020304050' });
    expect(separarDocumento('CE 445566')).toEqual({ tipo: 'CE', numero: '445566' });
    expect(separarDocumento('1020304050')).toEqual({ tipo: null, numero: '1020304050' });
  });

  it('shortens a sub to its first 8 and last 4 characters (gap G4)', () => {
    // Time-ordered subs share the prefix: the dev users differ only at the end.
    expect(subCorto('01999000-0000-7000-8000-000000000a01')).toBe('01999000…0a01');
    expect(subCorto('01999000-0000-7000-8000-000000000c01')).toBe('01999000…0c01');
  });

  it('accepts only the PascalCase case states', () => {
    expect(esEstadoCaso('EnAtencion')).toBe(true);
    expect(esEstadoCaso('EN_ATENCION')).toBe(false);
    expect(esEstadoCaso(undefined)).toBe(false);
  });
});

describe('pagination', () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [1, 10, [1, 2, 'hueco', 10]],
    [5, 10, [1, 'hueco', 4, 5, 6, 'hueco', 10]],
    // A gap of a single page shows the page.
    [3, 10, [1, 2, 3, 4, 'hueco', 10]],
    [10, 10, [1, 'hueco', 9, 10]],
    [1, 0, []],
  ])('page %i of %i', (actual, total, esperado) => {
    expect(paginasVisibles(actual, total)).toEqual(esperado);
  });

  it('reads ?page= defensively', () => {
    expect(leerPagina('3')).toBe(3);
    expect(leerPagina(undefined)).toBe(1);
    expect(leerPagina('0')).toBe(1);
    expect(leerPagina('-2')).toBe(1);
    expect(leerPagina('2.5')).toBe(1);
    expect(leerPagina('abc')).toBe(1);
  });
});
