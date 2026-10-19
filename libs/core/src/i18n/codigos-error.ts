/**
 * Domain error codes the UI may branch on (plan §4.2), plus the step-up code the backend sends
 * with its RFC 9470 challenge. Branch through `tieneCodigo` so a typo fails the build.
 */
export const CODIGOS_ERROR = [
  'Auth.StepUpRequerido',
  'Caso.NoEncontrado',
  'Caso.IpsIdInvalido',
  'Caso.RemisionDuplicada',
  'Caso.RemisionNoEncontrada',
  'Caso.RemisionYaRevocada',
  'Caso.AsignacionNoEncontrada',
  'Caso.ConflictoConcurrencia',
  'Caso.TransicionInvalida',
  'Clinico.AccesoNoPermitido',
  'Clinico.CasoNoEncontrado',
  'Clinico.NoAsignado',
  'Clinico.MotivoEmergenciaInvalido',
  'Clinico.CasoNoAdmiteRegistros',
  'Clinico.AtendidoEnFuturo',
  'Clinico.FechaAtencionAnteriorAlEvento',
  'Clinico.ProfesionalNoIdentificado',
  'Clinico.ProfesionalSinRegistro',
  'Clinico.RethusRequerido',
  'Clinico.RegistroNoEncontrado',
  'Clinico.SoporteNoEncontrado',
  'Dictamen.YaExiste',
  'Dictamen.YaNotificado',
  'Dictamen.CorrigeANoVigente',
  'Dictamen.FechasInvalidas',
  'Dictamen.NotificacionFueraDeRango',
  'Dictamen.PorcentajeFueraDeRango',
  'Dictamen.NoEncontrado',
  'Incapacidades.CertificadoDuplicado',
  'Incapacidades.DiasFueraDeRango',
  'Incapacidades.InicialConProrrogaDe',
  'Incapacidades.PartesInvalidas',
  'Integracion.IdempotencyKeyInvalida',
  'Integracion.IdempotenciaConflicto',
  'Paciente.CodigoInvalido',
  'Paciente.CasoNoValidado',
  'Paciente.VinculoDistinto',
  'Plazo.NoCumplible',
  'Plazo.CumplidoEnFuturo',
  'Plazo.NoEncontrado',
  'SolicitudCopiaHc.YaAbierta',
  'SolicitudCopiaHc.TransicionInvalida',
  'SolicitudCopiaHc.ResultadoInvalido',
  'Auditoria.RevisionYaCerrada',
  'Auditoria.RevisionNoEncontrada',
  // Not in plan §4.2, but returned by the backend (verified in its source):
  'General.Validation',
  'Archivos.NoEsPdf',
  'Archivos.SoporteDemasiadoGrande',
  'Archivos.SoporteInfectado',
  'Archivos.AntivirusNoDisponible',
  'Archivos.Corrupto',
  'Incapacidades.CasoNoEncontrado',
  'SolicitudCopiaHc.NoEncontrada',
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

/** Type-safe check of a problem's `errorCode`. */
export function tieneCodigo(
  problema: { errorCode: string | null } | null | undefined,
  codigo: CodigoError,
): boolean {
  return problema?.errorCode === codigo;
}
