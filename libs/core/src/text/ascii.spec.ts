import { transliterarAscii } from './ascii';

describe('transliterarAscii (emergency motivo header, gap G10)', () => {
  it('strips accents and maps ñ/Ñ', () => {
    expect(transliterarAscii('Paciente en urgencias, señal de síncope. Año Ñandú')).toBe(
      'Paciente en urgencias, senal de sincope. Ano Nandu',
    );
  });

  it('drops characters outside printable ASCII and collapses whitespace', () => {
    expect(transliterarAscii('  Dolor\ttorácico\n«grave» 🚑 ¿ahora?  ')).toBe(
      'Dolor toracico grave ahora?',
    );
  });

  it('keeps plain ASCII untouched', () => {
    expect(transliterarAscii('Trauma craneal - TCE')).toBe('Trauma craneal - TCE');
  });
});
