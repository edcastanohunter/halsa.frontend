import type { EstadoPlazo } from '@halsa/core';

export type NivelPlazo = 'normal' | 'alerta' | 'critico' | 'vencido' | 'cumplido' | 'suspendido';

export interface PlazoSemaforo {
  estado: EstadoPlazo;
  venceEn: string;
  alertaEn: string;
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Urgency of a deadline (plan §8.3). An ABIERTO deadline is amber from `alertaEn`, critical (red
 * outline) when less than 24 h remain, and shown as vencido once `venceEn` passes even if the
 * server hasn't flipped it yet.
 */
export function nivelPlazo(plazo: PlazoSemaforo, ahora: number): NivelPlazo {
  switch (plazo.estado) {
    case 'CUMPLIDO':
      return 'cumplido';
    case 'VENCIDO':
      return 'vencido';
    case 'SUSPENDIDO':
      return 'suspendido';
    case 'ABIERTO': {
      const vence = Date.parse(plazo.venceEn);
      if (ahora >= vence) return 'vencido';
      if (vence - ahora < UN_DIA_MS) return 'critico';
      if (ahora >= Date.parse(plazo.alertaEn)) return 'alerta';
      return 'normal';
    }
  }
}
