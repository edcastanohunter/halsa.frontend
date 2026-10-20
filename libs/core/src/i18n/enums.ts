import { isDevMode } from '@angular/core';
import type {
  AlertaIncapacidad,
  CrearSolicitudCopiaHcRequest,
  DictamenPclResponse,
  HitoResponse,
  IncapacidadRequest,
  NotificarDictamenPclRequest,
  ProximoHitoResponse,
  RegistroClinicoResponse,
  Schemas,
} from '@halsa/api-types';

// One typed map per enum (plan §8.4). `Record<Union, string>` makes every map exhaustive: a new
// backend value in the generated types fails the build until it gets a label.
export type TipoEvento = 'AccidenteTrabajo' | 'EnfermedadLaboral';
// TODO(api-types): `regla` is a plain string in the OpenAPI spec; known codes from plan §4.3.
export type ReglaPlazo =
  | 'REPORTE_FURAT'
  | 'REPORTE_FUREP'
  | 'INVESTIGACION_AT'
  | 'REMISION_INVESTIGACION_GRAVE'
  | 'CONTROVERSIA_DICTAMEN'
  | 'TOPE_IT_180'
  | 'SOLICITUD_COPIA_HC';
export type CodigoAlertaIncapacidad = AlertaIncapacidad['code'];
export type TipoIncapacidad = IncapacidadRequest['tipo'];
export type ModalidadIncapacidad = IncapacidadRequest['modalidad'];
export type TipoRegistroClinico = RegistroClinicoResponse['tipo'];
export type OrigenDictamen = DictamenPclResponse['origen'];
export type MedioNotificacion = NotificarDictamenPclRequest['medio'];
export type MedioEntrega = CrearSolicitudCopiaHcRequest['medioEntrega'];
export type TipoHito = HitoResponse['tipo'];
export type TipoProximoHito = ProximoHitoResponse['tipo'];

export const TIPO_EVENTO_LABELS: Record<TipoEvento, string> = {
  AccidenteTrabajo: 'Accidente de trabajo',
  EnfermedadLaboral: 'Enfermedad laboral',
};

export const REGLA_PLAZO_LABELS: Record<ReglaPlazo, string> = {
  REPORTE_FURAT: 'Reporte del accidente (FURAT)',
  REPORTE_FUREP: 'Reporte de la enfermedad (FUREP)',
  INVESTIGACION_AT: 'Investigación del accidente',
  REMISION_INVESTIGACION_GRAVE: 'Remisión de investigación (AT grave o mortal)',
  CONTROVERSIA_DICTAMEN: 'Controversia del dictamen',
  TOPE_IT_180: 'Tope de incapacidad temporal (180 días)',
  SOLICITUD_COPIA_HC: 'Entrega de copia de historia clínica',
};

export const ALERTA_INCAPACIDAD_LABELS: Record<CodigoAlertaIncapacidad, string> = {
  ACUMULADO_150_DIAS: '150 días acumulados: alerta temprana',
  ACUMULADO_180_DIAS: '180 días: requiere concepto de rehabilitación',
  ACUMULADO_540_DIAS: '540 días acumulados',
  CARGA_EXTEMPORANEA: 'Cargada de forma extemporánea',
};

export const TIPO_REGISTRO_CLINICO_LABELS: Record<TipoRegistroClinico, string> = {
  REPORTE_INICIAL: 'Reporte inicial',
  CONCEPTO_MEDICO: 'Concepto médico',
  EVOLUCION: 'Evolución',
  CONCEPTO_REHABILITACION: 'Concepto de rehabilitación',
  CERTIFICADO_INCAPACIDAD: 'Certificado de incapacidad',
};

export const ORIGEN_LABELS: Record<OrigenDictamen, string> = {
  LABORAL: 'Laboral',
  COMUN: 'Común',
  MIXTO: 'Mixto',
};

export const MEDIO_NOTIFICACION_LABELS: Record<MedioNotificacion, string> = {
  CORREO_CERTIFICADO: 'Correo certificado',
  ELECTRONICO: 'Electrónico',
  PERSONAL: 'Personal',
};

export const MEDIO_ENTREGA_LABELS: Record<MedioEntrega, string> = {
  CORREO_CERTIFICADO: 'Correo certificado',
  PRESENCIAL: 'Presencial (recoger en oficina)',
  ELECTRONICO: 'Correo electrónico',
};

export const ESTADO_CASO_STAFF_LABELS: Record<EstadoCaso, string> = {
  Radicado: 'Radicado',
  Validado: 'Validado',
  EnAtencion: 'En atención',
  EnCalificacionOrigen: 'Calificación de origen',
  EnCalificacionPcl: 'Calificación PCL',
  Cerrado: 'Cerrado',
  Rechazado: 'Rechazado',
};

export const ESTADO_CASO_PACIENTE_LABELS: Record<EstadoCaso, string> = {
  Radicado: 'Recibimos el reporte de tu caso',
  Validado: 'Tu ARL validó el caso',
  EnAtencion: 'Estás en atención médica',
  EnCalificacionOrigen: 'Se está definiendo si el origen es laboral',
  EnCalificacionPcl: 'Se está calificando tu pérdida de capacidad laboral',
  Cerrado: 'Caso cerrado',
  Rechazado: 'El caso no fue aceptado. Comunícate con tu ARL',
};

export const HITO_PACIENTE_LABELS: Record<TipoHito, string> = {
  RADICADO: 'Caso radicado',
  VALIDADO: 'Caso validado',
  RECHAZADO: 'Caso rechazado',
  REMITIDO_A_IPS: 'Remitido a una IPS para tu atención',
  INCAPACIDAD_REGISTRADA: 'Incapacidad registrada',
  DICTAMEN_NOTIFICADO: 'Te notificaron el dictamen',
  DICTAMEN_EN_FIRME: 'El dictamen quedó en firme',
};

export const PROXIMO_HITO_LABELS: Record<TipoProximoHito, string> = {
  FIN_INCAPACIDAD: 'Termina tu incapacidad',
  VENCE_CONTROVERSIA: 'Último día para controvertir el dictamen',
};

/**
 * Spanish label of an enum value. Unknown values (a backend newer than the frontend) render
 * raw, never crash, and warn in dev builds only (plan §8.4).
 */
export function getEnumLabel<K extends string>(
  map: Readonly<Record<K, string>>,
  value: string | null | undefined,
): string {
  if (!value) return '';
  const label = (map as Readonly<Record<string, string>>)[value];
  if (label !== undefined) return label;
  if (isDevMode()) {
    // eslint-disable-next-line no-console -- dev-only signal for a missing label, never in prod
    console.warn(`[halsa] Sin etiqueta para el valor "${value}"`);
  }
  return value;
}

// Typed against the generated API enums, so a new backend value fails the build here.
export type EstadoPlazo = Schemas['PlazoResponse']['estado'];
export type EstadoDictamen = Schemas['DictamenPclResponse']['estadoNotificacion'];
export type EstadoSolicitudCopiaHc = Schemas['SolicitudCopiaHcResponse']['estado'];
export type EstadoRevisionEmergencia = Schemas['RevisionEmergenciaResponse']['estado'];
export type ConclusionRevisionEmergencia = NonNullable<
  Schemas['RevisionEmergenciaResponse']['conclusion']
>;
// TODO(api-types): case states are a plain string in the OpenAPI spec; values from plan §4.3.
export type EstadoCaso =
  | 'Radicado'
  | 'Validado'
  | 'EnAtencion'
  | 'EnCalificacionOrigen'
  | 'EnCalificacionPcl'
  | 'Cerrado'
  | 'Rechazado';
// TODO(api-types): the audit `accion`, `resultado` and `recursoTipo` are plain strings in the
// API. The rows carry the stored codes (backend `AuditoriaCodigos.Codigo`: `NoEncontrado` →
// `NO_ENCONTRADO`), not the enum names plan §4.3 lists; the filters accept either.
export type ResultadoAuditoria = 'EXITO' | 'DENEGADO' | 'NO_ENCONTRADO' | 'ERROR';
export type AccionAuditoria =
  'LEER' | 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR' | 'CORREGIR' | 'EXPORTAR';
export type RecursoAuditoria =
  | 'CASO'
  | 'REMISION'
  | 'ASIGNACION'
  | 'REGISTRO_CLINICO'
  | 'AUDITORIA'
  | 'INCAPACIDAD'
  | 'SOPORTE'
  | 'PLAZO'
  | 'VINCULO'
  | 'CODIGO_ACTIVACION'
  | 'SOLICITUD_COPIA_HC';

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
  EXITO: 'Éxito',
  DENEGADO: 'Denegado',
  NO_ENCONTRADO: 'No encontrado',
  ERROR: 'Error',
};

export const ACCION_AUDITORIA_LABELS: Record<AccionAuditoria, string> = {
  LEER: 'Lectura',
  CREAR: 'Creación',
  ACTUALIZAR: 'Actualización',
  ELIMINAR: 'Eliminación',
  CORREGIR: 'Corrección',
  EXPORTAR: 'Exportación',
};

export const RECURSO_AUDITORIA_LABELS: Record<RecursoAuditoria, string> = {
  CASO: 'Caso',
  REMISION: 'Remisión',
  ASIGNACION: 'Asignación',
  REGISTRO_CLINICO: 'Registro clínico',
  AUDITORIA: 'Auditoría',
  INCAPACIDAD: 'Incapacidad',
  SOPORTE: 'Soporte de incapacidad',
  PLAZO: 'Plazo',
  VINCULO: 'Vínculo del paciente',
  CODIGO_ACTIVACION: 'Código de activación',
  SOLICITUD_COPIA_HC: 'Solicitud de copia HC',
};

export const TIPO_INCAPACIDAD_LABELS: Record<TipoIncapacidad, string> = {
  INICIAL: 'Inicial',
  PRORROGA: 'Prórroga',
};

export const MODALIDAD_INCAPACIDAD_LABELS: Record<ModalidadIncapacidad, string> = {
  PRESENCIAL: 'Presencial',
  TELEMEDICINA: 'Telemedicina',
};

/** Every map, by name, for the exhaustiveness spec and dev tooling. */
export const ENUM_LABEL_MAPS = {
  TIPO_EVENTO_LABELS,
  REGLA_PLAZO_LABELS,
  ALERTA_INCAPACIDAD_LABELS,
  TIPO_REGISTRO_CLINICO_LABELS,
  ORIGEN_LABELS,
  MEDIO_NOTIFICACION_LABELS,
  MEDIO_ENTREGA_LABELS,
  ESTADO_CASO_STAFF_LABELS,
  ESTADO_CASO_PACIENTE_LABELS,
  HITO_PACIENTE_LABELS,
  PROXIMO_HITO_LABELS,
  ESTADO_PLAZO_LABELS,
  ESTADO_DICTAMEN_LABELS,
  ESTADO_SOLICITUD_COPIA_HC_LABELS,
  ESTADO_REVISION_EMERGENCIA_LABELS,
  CONCLUSION_REVISION_EMERGENCIA_LABELS,
  RESULTADO_AUDITORIA_LABELS,
  ACCION_AUDITORIA_LABELS,
  RECURSO_AUDITORIA_LABELS,
  TIPO_INCAPACIDAD_LABELS,
  MODALIDAD_INCAPACIDAD_LABELS,
} as const;
