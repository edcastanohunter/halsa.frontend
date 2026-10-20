import { FormControl } from '@angular/forms';
import { esCie10, normalizarCie10, validarCie10 } from '@halsa/core';

describe('CIE-10 validator (plan §11)', () => {
  it.each(['S62', 'S62.6', 'G56.0', 'M54.16', 'T14.9XX', 'Z00.0001'])('accepts %s', (codigo) =>
    expect(esCie10(codigo)).toBe(true),
  );

  it.each(['s62.6', 'S6', 'S621', 'S62.', 'S62.12345', '62.6', 'SS2.6', 'S62-6', ''])(
    'rejects %j',
    (codigo) => expect(esCie10(codigo)).toBe(false),
  );

  it('normalizes typed codes', () => {
    expect(normalizarCie10(' s62.6 ')).toBe('S62.6');
    expect(normalizarCie10('g 56.0')).toBe('G56.0');
  });

  it('leaves empty values to `required`', () => {
    expect(validarCie10(new FormControl(''))).toBeNull();
    expect(validarCie10(new FormControl('S62.6'))).toBeNull();
    expect(validarCie10(new FormControl('X'))).toEqual({ cie10: true });
  });
});
