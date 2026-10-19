import {
  ENUM_LABEL_MAPS,
  ESTADO_CASO_PACIENTE_LABELS,
  getEnumLabel,
  REGLA_PLAZO_LABELS,
  TIPO_REGISTRO_CLINICO_LABELS,
  TipoRegistroClinico,
} from './enums';
import { CODIGOS_ERROR, tieneCodigo } from './codigos-error';

// Compile-time exhaustiveness: `Record<Union, string>` rejects a missing or extra key. These
// guards fail type-checking if a map is ever widened back to `Record<string, string>`.
type EsExacto<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const claves: EsExacto<keyof typeof TIPO_REGISTRO_CLINICO_LABELS, TipoRegistroClinico> = true;

describe('Spanish enum labels (plan §8.4)', () => {
  it('maps are typed by their enum union', () => {
    expect(claves).toBe(true);
  });

  it('every label is non-empty Spanish text, not the raw code', () => {
    for (const [nombre, mapa] of Object.entries(ENUM_LABEL_MAPS)) {
      for (const [valor, etiqueta] of Object.entries(mapa as Record<string, string>)) {
        expect(etiqueta.trim(), `${nombre}.${valor}`).not.toBe('');
        if (/^[A-Z0-9_]+$/.test(valor)) expect(etiqueta, `${nombre}.${valor}`).not.toBe(valor);
      }
    }
  });

  it('uses plain-language patient copy', () => {
    expect(getEnumLabel(ESTADO_CASO_PACIENTE_LABELS, 'EnCalificacionPcl')).toBe(
      'Se está calificando tu pérdida de capacidad laboral',
    );
  });

  it('renders unknown values raw and warns only in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(getEnumLabel(REGLA_PLAZO_LABELS, 'REGLA_FUTURA')).toBe('REGLA_FUTURA');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(getEnumLabel(REGLA_PLAZO_LABELS, null)).toBe('');
    warn.mockRestore();
  });
});

describe('error codes', () => {
  it('are unique and branchable', () => {
    expect(new Set(CODIGOS_ERROR).size).toBe(CODIGOS_ERROR.length);
    expect(tieneCodigo({ errorCode: 'Clinico.NoAsignado' }, 'Clinico.NoAsignado')).toBe(true);
    expect(tieneCodigo(null, 'Clinico.NoAsignado')).toBe(false);
  });
});
