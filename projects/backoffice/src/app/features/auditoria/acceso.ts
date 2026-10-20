import type { AccesoAuditadoResponse } from '@halsa/api-types';
import { ACCION_AUDITORIA_LABELS, getEnumLabel, RECURSO_AUDITORIA_LABELS } from '@halsa/core';

const TIPO_ACTOR: Record<string, string> = {
  arl: 'ARL',
  ips: 'IPS',
  paciente: 'Paciente',
  sistema: 'Sistema',
};

export const etiquetaAccion = (a: string) => getEnumLabel(ACCION_AUDITORIA_LABELS, a);
export const etiquetaRecurso = (r: string) => getEnumLabel(RECURSO_AUDITORIA_LABELS, r);

/** "ARL · ARL_A" or "IPS · 110011234501" (gap G9: codes as labels). */
export function contextoActor(a: AccesoAuditadoResponse): string {
  const tipo = TIPO_ACTOR[a.actorTipo] ?? a.actorTipo;
  const donde = a.actorTipo === 'ips' ? a.actorIpsId : a.actorTenantId;
  return donde ? `${tipo} · ${donde}` : tipo;
}

/** `acr` → "Nivel 2" (step-up) or "Nivel 1". */
export function nivelVerificacion(acr: string | null | undefined): string {
  return acr ? `Nivel ${acr}` : 'Sin nivel';
}

/** A row with a `motivo` is an emergency (break-the-glass) access: plan §7.10's amber badge. */
export const esEmergencia = (a: Pick<AccesoAuditadoResponse, 'motivo'>) => !!a.motivo;
