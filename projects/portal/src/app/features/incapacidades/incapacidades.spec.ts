import type { CasoPacienteResponse, IncapacidadPacienteResponse } from '@halsa/api-types';
import { abrirPortal, texto } from '../../testing/portal';
import { agruparPorCaso, vigencia } from './agrupar';

const inc = (
  casoId: string,
  fechaInicio: string,
  fechaFin: string,
  diasAcumulados: number,
): IncapacidadPacienteResponse => ({
  id: crypto.randomUUID(),
  casoId,
  tipo: 'INICIAL',
  fechaInicio,
  fechaFin,
  dias: 10,
  diasAcumulados,
  estado: 'REGISTRADA',
});

describe('grouping sick leaves by case (plan §7.12)', () => {
  it('in force, upcoming or over, by Bogotá calendar day (both ends inclusive)', () => {
    const i = { fechaInicio: '2026-10-10', fechaFin: '2026-10-20' };
    expect(vigencia(i, '2026-10-09')).toBe('proxima');
    expect(vigencia(i, '2026-10-10')).toBe('vigente');
    expect(vigencia(i, '2026-10-20')).toBe('vigente');
    expect(vigencia(i, '2026-10-21')).toBe('terminada');
  });

  it('newest case first, each one newest certificate first, with its running total', () => {
    const casos = [
      { casoId: 'a', radicado: 'R-A' },
      { casoId: 'b', radicado: 'R-B' },
    ] as CasoPacienteResponse[];
    const grupos = agruparPorCaso(
      [
        inc('a', '2026-01-01', '2026-01-10', 10),
        inc('b', '2026-05-01', '2026-05-10', 10),
        inc('a', '2026-01-11', '2026-01-20', 20),
      ],
      casos,
      '2026-10-20',
    );
    expect(grupos.map((g) => g.casoId)).toEqual(['b', 'a']);
    expect(grupos[1]!.incapacidades.map((i) => i.fechaInicio)).toEqual([
      '2026-01-11',
      '2026-01-01',
    ]);
    expect(grupos[1]!.acumulados).toBe(20);
    expect(grupos[1]!.caso?.radicado).toBe('R-A');
  });
});

describe('/incapacidades', () => {
  it('shows each case with its certificates, dates, days and accumulated days', async () => {
    await abrirPortal('/incapacidades');
    const grupos = [...document.querySelectorAll('[data-testid="grupo-incapacidades"]')];
    expect(grupos.map((g) => texto(g.querySelector('h2')))).toEqual([
      'Accidente de trabajo 2026-ARLA-000102',
      'Enfermedad laboral 2026-ARLA-000103',
    ]);
    expect(texto(grupos[0])).toContain('Acumulados: 50 días');
    const tarjetas = [...grupos[0]!.querySelectorAll('li')].map(texto);
    expect(tarjetas[0]).toMatch(/^Prórroga, Próxima/);
    expect(tarjetas[0]).toContain('20 días · 50 acumulados');
    expect(tarjetas[1]).toMatch(/^Inicial, Vigente/);
    expect(texto(grupos[1])).toContain('Terminada');
  });
});
