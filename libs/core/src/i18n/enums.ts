import type { Schemas } from '@halsa/api-types';

export const TIPO_EVENTO_LABELS: Record<string, string> = {
  AccidenteTrabajo: 'Accidente de trabajo',
  EnfermedadLaboral: 'Enfermedad laboral',
};

export const REGLA_PLAZO_LABELS: Record<string, string> = {
  REPORTE_FURAT: 'Reporte del accidente (FURAT)',
  REPORTE_FUREP: 'Reporte de la enfermedad (FUREP)',
  INVESTIGACION_AT: 'Investigación del accidente',
  REMISION_INVESTIGACION_GRAVE: 'Remisión de investigación (AT grave o mortal)',
  CONTROVERSIA_DICTAMEN: 'Controversia del dictamen',
  TOPE_IT_180: 'Tope de incapacidad temporal (180 días)',
  SOLICITUD_COPIA_HC: 'Entrega de copia de historia clínica',
};

export const ALERTA_INCAPACIDAD_LABELS: Record<string, string> = {
  ACUMULADO_150_DIAS: '150 días acumulados: alerta temprana',
  ACUMULADO_180_DIAS: '180 días: requiere concepto de rehabilitación',
  ACUMULADO_540_DIAS: '540 días acumulados',
  CARGA_EXTEMPORANEA: 'Cargada de forma extemporánea',
};

export const TIPO_REGISTRO_CLINICO_LABELS: Record<string, string> = {
  REPORTE_INICIAL: 'Reporte inicial',
  CONCEPTO_MEDICO: 'Concepto médico',
  EVOLUCION: 'Evolución',
  CONCEPTO_REHABILITACION: 'Concepto de rehabilitación',
  CERTIFICADO_INCAPACIDAD: 'Certificado de incapacidad',
};

export const ORIGEN_LABELS: Record<string, string> = {
  LABORAL: 'Laboral',
  COMUN: 'Común',
  MIXTO: 'Mixto',
};

export const MEDIO_NOTIFICACION_LABELS: Record<string, string> = {
  CORREO_CERTIFICADO: 'Correo certificado',
  ELECTRONICO: 'Electrónico',
  PERSONAL: 'Personal',
};

export const MEDIO_ENTREGA_LABELS: Record<string, string> = {
  CORREO_CERTIFICADO: 'Correo certificado',
  PRESENCIAL: 'Presencial (recoger en oficina)',
  ELECTRONICO: 'Correo electrónico',
};

export const ESTADO_CASO_STAFF_LABELS: Record<string, string> = {
  Radicado: 'Radicado',
  Validado: 'Validado',
  EnAtencion: 'En atención',
  EnCalificacionOrigen: 'Calificación de origen',
  EnCalificacionPcl: 'Calificación PCL',
  Cerrado: 'Cerrado',
  Rechazado: 'Rechazado',
};

export const ESTADO_CASO_PACIENTE_LABELS: Record<string, string> = {
  Radicado: 'Recibimos el reporte de tu caso',
  Validado: 'Tu ARL validó el caso',
  EnAtencion: 'Estás en atención médica',
  EnCalificacionOrigen: 'Se está definiendo si el origen es laboral',
  EnCalificacionPcl: 'Se está calificando tu pérdida de capacidad laboral',
  Cerrado: 'Caso cerrado',
  Rechazado: 'El caso no fue aceptado. Comunícate con tu ARL',
};

export const HITO_PACIENTE_LABELS: Record<string, string> = {
  RADICADO: 'Caso radicado',
  VALIDADO: 'Caso validado',
  RECHAZADO: 'Caso rechazado',
  REMITIDO_A_IPS: 'Remitido a una IPS para tu atención',
  INCAPACIDAD_REGISTRADA: 'Incapacidad registrada',
  DICTAMEN_NOTIFICADO: 'Te notificaron el dictamen',
  DICTAMEN_EN_FIRME: 'El dictamen quedó en firme',
};

export const PROXIMO_HITO_LABELS: Record<string, string> = {
  FIN_INCAPACIDAD: 'Termina tu incapacidad',
  VENCE_CONTROVERSIA: 'Último día para controvertir el dictamen',
};

export function getEnumLabel(
  map: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return '';
  return map[value] ?? value;
}

// Typed against the generated API enums, so a new backend value fails the build here.
export type EstadoPlazo = Schemas['PlazoResponse']['estado'];
export type EstadoDictamen = Schemas['DictamenPclResponse']['estadoNotificacion'];
export type EstadoSolicitudCopiaHc = Schemas['SolicitudCopiaHcResponse']['estado'];
export type EstadoRevisionEmergencia = Schemas['RevisionEmergenciaResponse']['estado'];
export type ConclusionRevisionEmergencia = NonNullable<
  Schemas['RevisionEmergenciaResponse']['conclusion']
>;
// TODO(api-types): case states and audit results are plain strings in the OpenAPI spec;
// values from plan §4.3 / §8.3.
export type EstadoCaso =
  | 'Radicado'
  | 'Validado'
  | 'EnAtencion'
  | 'EnCalificacionOrigen'
  | 'EnCalificacionPcl'
  | 'Cerrado'
  | 'Rechazado';
export type ResultadoAuditoria = 'Exito' | 'Denegado' | 'NoEncontrado' | 'Error';

export const ESTADO_PLAZO_LABELS: Record<EstadoPlazo, string> = {
  ABIERTO: 'Abierto',
  CUMPLIDO: 'Cumplido',
  VENCIDO: 'Vencido',
  SUSPENDIDO: 'Suspendido',
};

export const ESTADO_DICTAMEN_LABELS: Record<EstadoDictamen, string> = {
  PENDIENTE: 'Pendiente de notificar',
  NOTIFICADO: 'Notificado',
  EN_CONTROVERSIA: 'En controversia',
  EN_FIRME: 'En firme',
};

export const ESTADO_SOLICITUD_COPIA_HC_LABELS: Record<EstadoSolicitudCopiaHc, string> = {
  RECIBIDA: 'Recibida',
  EN_TRAMITE: 'En trámite',
  ENTREGADA: 'Entregada',
  RECHAZADA: 'Rechazada',
};

export const ESTADO_REVISION_EMERGENCIA_LABELS: Record<EstadoRevisionEmergencia, string> = {
  PENDIENTE: 'Pendiente',
  CERRADA: 'Cerrada',
};

export const CONCLUSION_REVISION_EMERGENCIA_LABELS: Record<ConclusionRevisionEmergencia, string> = {
  JUSTIFICADO: 'Justificado',
  INJUSTIFICADO: 'Injustificado',
};

export const RESULTADO_AUDITORIA_LABELS: Record<ResultadoAuditoria, string> = {
  Exito: 'Éxito',
  Denegado: 'Denegado',
  NoEncontrado: 'No encontrado',
  Error: 'Error',
};
