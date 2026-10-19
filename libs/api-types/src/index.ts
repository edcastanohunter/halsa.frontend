export type * from './schema';
import type { components } from './schema';

export type Schemas = components['schemas'];

// Domain models and responses
export type Codificado = Schemas['Codificado'];
export type Identificacion = Schemas['Identificacion'];
export type Ubicacion = Schemas['Ubicacion'];
export type RadicacionResponse = Schemas['RadicacionResponse'];

// Incapacidades
export type IncapacidadRequest = Schemas['IncapacidadRequest'];
export type IncapacidadResponse = Schemas['IncapacidadResponse'];
export type AlertaIncapacidad = NonNullable<IncapacidadResponse['alertas']>[number];

// Clínico
export type RegistroClinicoRequest = Schemas['RegistroClinicoRequest'];
export type RegistroClinicoResponse = Schemas['RegistroClinicoResponse'];
export type RegistroClinicoCreadoResponse = Schemas['RegistroClinicoCreadoResponse'];
export type ContenidoClinico = Schemas['ContenidoClinico'];
export type Profesional = Schemas['Profesional'];

// Dictamen PCL
export type RegistrarDictamenPclRequest = Schemas['RegistrarDictamenPclRequest'];
export type NotificarDictamenPclRequest = Schemas['NotificarDictamenPclRequest'];
export type DictamenPclResponse = Schemas['DictamenPclResponse'];
export type Calificador = Schemas['Calificador'];

// Plazos
export type PlazoResponse = Schemas['PlazoResponse'];
export type PaginaPlazos = Schemas['PaginaPlazos'];
export type CumplirPlazoRequest = Schemas['CumplirPlazoRequest'];

// Auditoría y emergencias
export type RevisionEmergenciaResponse = Schemas['RevisionEmergenciaResponse'];
export type PaginaRevisionesEmergencia = Schemas['PaginaRevisionesEmergencia'];
export type CerrarRevisionEmergenciaRequest = Schemas['CerrarRevisionEmergenciaRequest'];

// Solicitudes HC
export type SolicitudCopiaHcResponse = Schemas['SolicitudCopiaHcResponse'];
export type SolicitudCopiaHcPacienteResponse = Schemas['SolicitudCopiaHcPacienteResponse'];
export type CrearSolicitudCopiaHcRequest = Schemas['CrearSolicitudCopiaHcRequest'];
export type CerrarSolicitudCopiaHcRequest = Schemas['CerrarSolicitudCopiaHcRequest'];

// Portal del paciente / BFF
export type CodigoActivacionResponse = Schemas['CodigoActivacionResponse'];
export type CanjearCodigoRequest = Schemas['CanjearCodigoRequest'];
export type VinculoCreadoResponse = Schemas['VinculoCreadoResponse'];
export type TrabajadorVinculadoResponse = Schemas['TrabajadorVinculadoResponse'];
export type ResumenPacienteResponse = Schemas['ResumenPacienteResponse'];
export type CasoPacienteResponse = Schemas['CasoPacienteResponse'];
export type IncapacidadPacienteResponse = Schemas['IncapacidadPacienteResponse'];
export type HitoResponse = Schemas['HitoResponse'];
export type ProximoHitoResponse = Schemas['ProximoHitoResponse'];
export type IncapacidadVigenteResponse = Schemas['IncapacidadVigenteResponse'];

// Problem Details (RFC 9457)
export type ProblemaApi = Schemas['Problema'];

// TODO(api-types): the OpenAPI spec has no generic page schema; shape from plan §4.1.
export interface PagedList<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// TODO(api-types): GET /v1/identidad/yo has no response schema in the OpenAPI spec; shape from
// Endpoints/Identidad/Yo.cs. `actorTipo` is the ActorTipo enum lowercased (`sistema` never has a token).
export interface UsuarioYo {
  sub: string;
  actorTipo: 'arl' | 'ips' | 'paciente' | 'integracion';
  tenantId: string | null;
  ipsId: string | null;
  permisos: string[];
}

// TODO(api-types): the casos, asignaciones/remisiones and auditoría/accesos endpoints are missing
// from the YAML contract; shapes from the backend records (CasoResponses.cs, RemitirCaso.cs,
// ListAccesosAuditadosQuery.cs) and plan §4.3.
export interface CasoResumenResponse {
  id: string;
  radicado: string;
  tipoEvento: 'AccidenteTrabajo' | 'EnfermedadLaboral';
  estado: string;
  /** date-time (DateTimeOffset), not a DateOnly. */
  fechaEvento: string;
  trabajadorDocumento: string;
  tieneCalificacion: boolean;
  porcentajePcl: number | null;
}

export interface RemisionResponse {
  id: string;
  ipsId: string;
  remitidoEn: string;
}

export interface CasoDetalleResponse {
  resumen: CasoResumenResponse;
  empleadorDocumento: string;
  municipioDivipola: string;
  esGraveOMortal: boolean;
  remisionesVigentes: RemisionResponse[];
  /** Subs of the assigned professionals (gap G4: no user directory). */
  equipoAsignado: string[];
}

export interface AsignarCasoRequest {
  sub: string;
}

export interface RemitirCasoRequest {
  /** REPS code, 12 digits. */
  ipsId: string;
}

export interface RemisionCreadaResponse {
  remisionId: string;
}

export interface AccesoAuditadoResponse {
  id: string;
  ocurridoEn: string;
  tenantId: string | null;
  actorId: string;
  actorTipo: string;
  actorTenantId: string | null;
  actorIpsId: string | null;
  actorRoles: string[];
  clientId: string | null;
  ip: string | null;
  userAgent: string | null;
  correlationId: string;
  accion: string;
  resultado: string;
  recursoTipo: string;
  recursoId: string | null;
  casoMedicoId: string | null;
  motivo: string | null;
  acr: string | null;
}

// TODO(api-types): BFF endpoint, outside the API contract (plan §4.3, portal table).
export interface UsuarioBffResponse {
  nombre: string | null;
  correo: string | null;
  vinculado: boolean;
}
