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

// TODO(api-types): GET /v1/identidad/yo has no response schema in the OpenAPI spec; shape from plan §4.3.
export interface UsuarioYo {
  sub: string;
  actorTipo: 'arl' | 'ips';
  tenantId: string | null;
  ipsId: string | null;
  permisos: string[];
}
