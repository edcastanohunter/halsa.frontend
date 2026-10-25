import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { IncapacidadRequest } from '@halsa/api-types';
import {
  esErrorApi,
  hoyBogota,
  mensajeDeError,
  ModalidadIncapacidad,
  parsearFechaCalendario,
  sumarDias,
  TipoIncapacidad,
} from '@halsa/core';
import { crearFormDiagnostico, FormDiagnostico } from '@halsa/ui/editor-diagnosticos-cie10';

/** Backend `IncapacidadRequestValidator` and `Incapacidad.MaxDias`. */
export const NUMERO_CERTIFICADO_MAX = 40;
export const DIAS_MIN = 1;
export const DIAS_MAX = 30;
export const RELACIONADOS_MAX = 3;
export const DIAGNOSTICOS_MAX = 1 + RELACIONADOS_MAX;
export const NOMBRE_IPS_MAX = 200;
export const OBSERVACIONES_MAX = 1000;
export const PATRON_REPS = /^[0-9]{10,12}$/;

const REQUERIDO = Validators.required;

function fechaNoFutura(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) return null;
  if (!parsearFechaCalendario(control.value)) return { invalida: true };
  return control.value > hoyBogota() ? { futura: true } : null;
}

/** `prorrogaDe` is required for a prórroga only (backend 422 `PRORROGA_SIN_INICIAL`). */
function prorrogaConOrigen(grupo: AbstractControl): ValidationErrors | null {
  const { tipo, prorrogaDe } = (grupo as FormCertificado).getRawValue();
  return tipo === 'PRORROGA' && !prorrogaDe ? { sinOrigen: true } : null;
}

export function crearFormIncapacidad(codigoReps = '') {
  return new FormGroup({
    certificado: new FormGroup(
      {
        numeroCertificado: new FormControl('', {
          nonNullable: true,
          validators: [REQUERIDO, Validators.maxLength(NUMERO_CERTIFICADO_MAX)],
        }),
        tipo: new FormControl<TipoIncapacidad>('INICIAL', { nonNullable: true }),
        prorrogaDe: new FormControl('', { nonNullable: true }),
        fechaInicio: new FormControl('', {
          nonNullable: true,
          validators: [REQUERIDO, fechaNoFutura],
        }),
        dias: new FormControl<number | null>(1, {
          validators: [
            REQUERIDO,
            Validators.min(DIAS_MIN),
            Validators.max(DIAS_MAX),
            Validators.pattern(/^\d+$/),
          ],
        }),
        modalidad: new FormControl<ModalidadIncapacidad>('PRESENCIAL', { nonNullable: true }),
      },
      { validators: prorrogaConOrigen },
    ),
    diagnostico: new FormGroup({
      // The first row is the principal; up to 3 related follow (one editor, plan §7.6 step 2).
      diagnosticos: new FormArray<FormDiagnostico>([crearFormDiagnostico()], {
        validators: [Validators.minLength(1), Validators.maxLength(DIAGNOSTICOS_MAX)],
      }),
      observaciones: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(OBSERVACIONES_MAX)],
      }),
    }),
    ips: new FormGroup({
      codigoReps: new FormControl(codigoReps, {
        nonNullable: true,
        validators: [REQUERIDO, Validators.pattern(PATRON_REPS)],
      }),
      nombre: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(NOMBRE_IPS_MAX)],
      }),
    }),
    soporte: new FormControl<File | null>(null, { validators: [REQUERIDO] }),
  });
}

export type FormIncapacidad = ReturnType<typeof crearFormIncapacidad>;
type FormCertificado = FormIncapacidad['controls']['certificado'];

/** The stepper's steps on mobile (plan §7.6); desktop shows the first four at once. */
export const PASOS = ['certificado', 'diagnostico', 'ips', 'soporte', 'revision'] as const;
export type Paso = (typeof PASOS)[number];

export const PASO_ETIQUETAS: Record<Paso, string> = {
  certificado: 'Certificado',
  diagnostico: 'Diagnóstico',
  ips: 'IPS emisora',
  soporte: 'Soporte',
  revision: 'Revisión',
};

/** The controls each step validates before moving on. */
export function controlesDelPaso(form: FormIncapacidad, paso: Paso): AbstractControl[] {
  const c = form.controls;
  switch (paso) {
    case 'certificado':
      return [c.certificado];
    case 'diagnostico':
      return [c.diagnostico];
    case 'ips':
      return [c.ips];
    case 'soporte':
      return [c.soporte];
    case 'revision':
      return [form];
  }
}

/** "Termina el …": `fechaInicio + dias − 1`, like the server (plan §7.6). */
export function fechaFinDe(fechaInicio: string, dias: number | null): string | null {
  if (!parsearFechaCalendario(fechaInicio) || !dias || !Number.isInteger(dias)) return null;
  if (dias < DIAS_MIN || dias > DIAS_MAX) return null;
  return sumarDias(fechaInicio, dias - 1);
}

const oUndefined = (valor: string) => valor.trim() || undefined;

/** The `datos` part. Never `profesional`: the backoffice signs with the token claims. */
export function aRequest(form: FormIncapacidad): IncapacidadRequest {
  const { certificado: c, diagnostico: d, ips } = form.getRawValue();
  const [principal, ...relacionados] = d.diagnosticos;
  const codificado = (dx: { codigo: string; descripcion: string }) => ({
    sistema: 'CIE-10' as const,
    codigo: dx.codigo,
    ...(oUndefined(dx.descripcion) ? { descripcion: dx.descripcion.trim() } : {}),
  });
  const request: IncapacidadRequest = {
    numeroCertificado: c.numeroCertificado.trim(),
    tipo: c.tipo,
    fechaInicio: c.fechaInicio,
    dias: Number(c.dias),
    diagnosticoPrincipal: codificado(principal!),
    ipsEmisora: {
      codigoReps: ips.codigoReps.trim(),
      ...(oUndefined(ips.nombre) ? { nombre: ips.nombre.trim() } : {}),
    },
    modalidad: c.modalidad,
  };
  if (c.tipo === 'PRORROGA') request.prorrogaDe = c.prorrogaDe;
  if (relacionados.length) request.diagnosticosRelacionados = relacionados.map(codificado);
  if (oUndefined(d.observaciones)) request.observaciones = d.observaciones.trim();
  return request;
}

export type CampoCarga =
  | 'numeroCertificado'
  | 'tipo'
  | 'prorrogaDe'
  | 'fechaInicio'
  | 'dias'
  | 'modalidad'
  | 'diagnosticoPrincipal'
  | 'diagnosticosRelacionados'
  | 'observaciones'
  | 'codigoReps'
  | 'nombreIps'
  | 'soporte'
  | 'general';

export type ErroresCarga = Partial<Record<CampoCarga, string>>;

/** The step that shows each field, to send the user there after a server error. */
export const PASO_DEL_CAMPO: Record<CampoCarga, Paso> = {
  numeroCertificado: 'certificado',
  tipo: 'certificado',
  prorrogaDe: 'certificado',
  fechaInicio: 'certificado',
  dias: 'certificado',
  modalidad: 'certificado',
  diagnosticoPrincipal: 'diagnostico',
  diagnosticosRelacionados: 'diagnostico',
  observaciones: 'diagnostico',
  codigoReps: 'ips',
  nombreIps: 'ips',
  soporte: 'soporte',
  general: 'revision',
};

/** Validation paths start with `datos.` (backend `RegistrarIncapacidadCommandHandler`). */
const CAMPO_DE_RUTA: [RegExp, CampoCarga][] = [
  [/^numeroCertificado/, 'numeroCertificado'],
  [/^tipo/, 'tipo'],
  [/^prorrogaDe/, 'prorrogaDe'],
  [/^fechaInicio/, 'fechaInicio'],
  [/^dias/, 'dias'],
  [/^modalidad/, 'modalidad'],
  [/^diagnosticoPrincipal/, 'diagnosticoPrincipal'],
  [/^diagnosticosRelacionados/, 'diagnosticosRelacionados'],
  [/^observaciones/, 'observaciones'],
  [/^ipsEmisora\.nombre/, 'nombreIps'],
  [/^ipsEmisora/, 'codigoReps'],
];

function campoDeRuta(ruta: string): CampoCarga {
  const relativa = ruta.replace(/^datos\.?/i, '');
  const minuscula = relativa.charAt(0).toLowerCase() + relativa.slice(1);
  return CAMPO_DE_RUTA.find(([patron]) => patron.test(minuscula))?.[1] ?? 'general';
}

/** 422 rules of SPEC 07: the backend answers with the rule code as is. */
const CAMPO_DE_REGLA: Record<string, CampoCarga> = {
  CASO_CERRADO: 'general',
  INCAPACIDAD_SOLAPADA: 'fechaInicio',
  PRORROGA_SIN_INICIAL: 'prorrogaDe',
  PRORROGA_NO_ES_ULTIMA: 'prorrogaDe',
  PRORROGA_DISCONTINUA: 'fechaInicio',
  PRORROGA_DIAGNOSTICO_NO_RELACIONADO: 'diagnosticoPrincipal',
  FECHA_ANTERIOR_AL_EVENTO: 'fechaInicio',
  'Incapacidades.CertificadoDuplicado': 'numeroCertificado',
  'Incapacidades.DiasFueraDeRango': 'dias',
  'Incapacidades.InicialConProrrogaDe': 'prorrogaDe',
  'Archivos.SoporteInfectado': 'soporte',
  'Archivos.NoEsPdf': 'soporte',
  'Archivos.SoporteDemasiadoGrande': 'soporte',
};

/**
 * Where each upload error goes (plan §7.6, "Errors"): domain codes and rules on their field,
 * `errors` by JSON path, 413/415 on the soporte, the rest above the form.
 */
export function erroresDeCarga(error: unknown): ErroresCarga {
  const { titulo, mensaje } = mensajeDeError(error);
  if (!esErrorApi(error)) return { general: `${titulo}. ${mensaje}` };
  const p = error.problema;

  const porCampo: ErroresCarga = {};
  for (const e of p.errors) {
    const campo = e.campo ? campoDeRuta(e.campo) : (CAMPO_DE_REGLA[e.codigo ?? ''] ?? 'general');
    porCampo[campo] ??= e.mensaje;
  }
  if (Object.keys(porCampo).length) return porCampo;

  const campo =
    CAMPO_DE_REGLA[p.errorCode ?? ''] ??
    (p.status === 413 || p.status === 415 ? 'soporte' : 'general');
  if (campo === 'soporte' && (p.status === 413 || p.status === 415)) return { soporte: mensaje };
  if (campo !== 'general') return { [campo]: p.detail ?? mensaje };
  return { general: `${titulo}. ${mensaje}` };
}

/** A request that never got an answer: retrying is safe, it carries the same key. */
export function esFalloDeRed(error: unknown): boolean {
  return esErrorApi(error) && error.problema.status === 0;
}
