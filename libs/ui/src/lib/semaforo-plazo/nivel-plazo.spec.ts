import { nivelPlazo, PlazoSemaforo } from './nivel-plazo';

const HORA = 60 * 60 * 1000;
const ahora = Date.parse('2026-10-17T15:00:00Z');
const en = (horas: number) => new Date(ahora + horas * HORA).toISOString();

const abierto = (venceEnHoras: number, alertaEnHoras: number): PlazoSemaforo => ({
  estado: 'ABIERTO',
  venceEn: en(venceEnHoras),
  alertaEn: en(alertaEnHoras),
});

describe('nivelPlazo (plan §8.3 semaphore)', () => {
  it.each([
    ['before alertaEn', abierto(24 * 5, 24 * 2), 'normal'],
    ['from alertaEn', abierto(24 * 3, -1), 'alerta'],
    ['exactly at alertaEn', abierto(24 * 3, 0), 'alerta'],
    ['less than 24 h left', abierto(23, -48), 'critico'],
    ['critical wins over alerta', abierto(2, 24), 'critico'],
    ['past venceEn but still ABIERTO', abierto(-1, -48), 'vencido'],
  ] as const)('ABIERTO %s → %s', (_caso, plazo, esperado) => {
    expect(nivelPlazo(plazo, ahora)).toBe(esperado);
  });

  it.each([
    ['CUMPLIDO', 'cumplido'],
    ['VENCIDO', 'vencido'],
    ['SUSPENDIDO', 'suspendido'],
  ] as const)('%s → %s regardless of dates', (estado, esperado) => {
    expect(nivelPlazo({ estado, venceEn: en(-100), alertaEn: en(-200) }, ahora)).toBe(esperado);
  });
});
