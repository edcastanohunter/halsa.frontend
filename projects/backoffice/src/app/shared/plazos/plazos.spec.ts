import type { PlazoResponse } from '@halsa/api-types';
import { agruparPlazos } from './agrupar';
import { esCumplible } from './dialogo-cumplir-plazo';

// 2026-10-17 10:00 in Bogotá.
const AHORA = Date.parse('2026-10-17T10:00:00-05:00');

const plazo = (id: string, venceEn: string, estado: PlazoResponse['estado'] = 'ABIERTO') =>
  ({ id, venceEn, estado }) as PlazoResponse;

describe('agruparPlazos (plan §7.8)', () => {
  it('groups by Bogotá calendar day', () => {
    const grupos = agruparPlazos(
      [
        plazo('vencido-servidor', '2026-10-10T10:00:00-05:00', 'VENCIDO'),
        plazo('vencido-sin-barrido', '2026-10-17T09:00:00-05:00'),
        plazo('hoy-noche', '2026-10-17T23:30:00-05:00'),
        // 02:00 UTC on the 18th is still the 17th in Bogotá.
        plazo('hoy-utc', '2026-10-18T02:00:00Z'),
        plazo('manana', '2026-10-18T08:00:00-05:00'),
        plazo('dia-7', '2026-10-24T23:00:00-05:00'),
        plazo('dia-8', '2026-10-25T08:00:00-05:00'),
      ],
      AHORA,
    );
    expect(grupos.map((g) => [g.titulo, g.plazos.map((p) => p.id)])).toEqual([
      ['Vencidos', ['vencido-servidor', 'vencido-sin-barrido']],
      ['Hoy', ['hoy-noche', 'hoy-utc']],
      ['Esta semana', ['manana', 'dia-7']],
      ['Más adelante', ['dia-8']],
    ]);
  });

  it('drops empty groups', () => {
    expect(agruparPlazos([], AHORA)).toEqual([]);
  });
});

describe('esCumplible', () => {
  it('follows the backend: ABIERTO and VENCIDO', () => {
    expect(
      ['ABIERTO', 'VENCIDO', 'CUMPLIDO', 'SUSPENDIDO'].filter((e) =>
        esCumplible({ estado: e as PlazoResponse['estado'] }),
      ),
    ).toEqual(['ABIERTO', 'VENCIDO']);
  });
});
