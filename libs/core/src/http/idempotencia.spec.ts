import { ClaveIdempotencia } from './idempotencia';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('ClaveIdempotencia (plan §5.3.7)', () => {
  const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

  it('generates a UUID v4', () => {
    expect(new ClaveIdempotencia().para('{}', pdf)).toMatch(UUID_V4);
  });

  it('reuses the key while the data and the file are the same (retry)', () => {
    const claves = new ClaveIdempotencia();
    const primera = claves.para('{"dias":5}', pdf);
    expect(claves.para('{"dias":5}', pdf)).toBe(primera);
  });

  it('gets a new key when the data change', () => {
    const claves = new ClaveIdempotencia();
    const primera = claves.para('{"dias":5}', pdf);
    expect(claves.para('{"dias":6}', pdf)).not.toBe(primera);
  });

  it('gets a new key when the file changes, even with the same bytes', () => {
    const claves = new ClaveIdempotencia();
    const primera = claves.para('{}', pdf);
    expect(claves.para('{}', new Blob(['%PDF-1.7'], { type: 'application/pdf' }))).not.toBe(
      primera,
    );
  });

  it('starts over after descartar', () => {
    const claves = new ClaveIdempotencia();
    const primera = claves.para('{}', pdf);
    claves.descartar();
    expect(claves.para('{}', pdf)).not.toBe(primera);
  });
});
