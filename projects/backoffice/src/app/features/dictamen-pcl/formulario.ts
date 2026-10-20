import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import type {
  DictamenPclResponse,
  NotificarDictamenPclRequest,
  RegistrarDictamenPclRequest,
} from '@halsa/api-types';
import {
  bogotaLocalAIso,
  diasEntre,
  EstadoDictamen,
  esErrorApi,
  fechaCalendarioBogota,
  hoyBogota,
  MedioNotificacion,
  mensajeDeError,
  OrigenDictamen,
  parsearFechaCalendario,
  tieneMaxDecimales,
} from '@halsa/core';
import { crearFormDiagnostico, FormDiagnostico } from '@halsa/ui';

/** Backend `RegistrarDictamenPclCommandValidator`. */
export const PORCENTAJE_MIN = 0;
export const PORCENTAJE_MAX = 100;
export const FUNDAMENTOS_MIN = 50;
export const FUNDAMENTOS_MAX = 20_000;
export const TOLERANCIA_COMPONENTES = 0.01;

export const ORIGENES: readonly OrigenDictamen[] = ['LABORAL', 'COMUN', 'MIXTO'];
export const MEDIOS: readonly MedioNotificacion[] = [
  'CORREO_CERTIFICADO',
  'ELECTRONICO',
  'PERSONAL',
];

const REQUERIDO = Validators.required;

function fechaValida(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && !parsearFechaCalendario(control.value) ? { invalida: true } : null;
}

function noFutura(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > hoyBogota() ? { futura: true } : null;
}

/** `fechaEstructuracion ≤ fechaDictamen` (`Dictamen.FechasInvalidas`). */
function noPosteriorAlDictamen(control: AbstractControl<string>): ValidationErrors | null {
  const dictamen = control.parent?.get('fechaDictamen')?.value as string | undefined;
  return control.value && dictamen && control.value > dictamen ? { posterior: true } : null;
}

/** `NotEmpty`: whitespace alone doesn't count. Length is the raw one, like `.Length(50, 20000)`. */
function conTexto(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** A readable number with at most two decimals (also checked by `CampoPorcentaje`). */
function dosDecimales(control: AbstractControl<number | null>): ValidationErrors | null {
  const valor = control.value;
  if (typeof valor !== 'number') return null;
  if (!Number.isFinite(valor)) return { numero: true };
  return tieneMaxDecimales(valor) ? null : { decimales: { maximo: 2 } };
}

const numeroEntre = (min: number, max: number): ValidatorFn[] => [
  REQUERIDO,
  dosDecimales,
  Validators.min(min),
  Validators.max(max),
];

export interface Suma {
  suma: number;
  total: number;
}

/** deficiencias + rol laboral, when the toggle is on and all three numbers are readable. */
export function sumaComponentes(form: FormDictamen): Suma | null {
  const v = form.getRawValue();
  if (!v.conComponentes) return null;
  const { deficiencias: d, rolLaboralYOtrasAreas: r } = v.componentes;
  const total = v.porcentajePcl;
  if (![d, r, total].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { suma: Math.round((d! + r!) * 100) / 100, total: total! };
}

/** `Dictamen.ComponentesNoSuman`: the parts add up to the total, ±0.01. */
function componentesSuman(grupo: AbstractControl): ValidationErrors | null {
  const suma = sumaComponentes(grupo as FormDictamen);
  return suma && Math.abs(suma.suma - suma.total) > TOLERANCIA_COMPONENTES + 1e-9
    ? { componentesNoSuman: suma }
    : null;
}

/**
 * The register / correct form (plan §7.7). A correction starts from `original`; the backend only
 * keeps one current dictamen, so it's a full replacement, not a patch.
 */
export function crearFormDictamen(original?: DictamenPclResponse | null) {
  const componentes = original?.componentes;
  const conComponentes =
    typeof componentes?.deficiencias === 'number' &&
    typeof componentes.rolLaboralYOtrasAreas === 'number';
  const form = new FormGroup(
    {
      porcentajePcl: new FormControl<number | null>(original?.porcentajePcl ?? null, {
        validators: numeroEntre(PORCENTAJE_MIN, PORCENTAJE_MAX),
      }),
      origen: new FormControl<OrigenDictamen | null>(original?.origen ?? null, {
        validators: [REQUERIDO],
      }),
      fechaEstructuracion: new FormControl(original?.fechaEstructuracion ?? '', {
        nonNullable: true,
        validators: [REQUERIDO, fechaValida, noPosteriorAlDictamen],
      }),
      fechaDictamen: new FormControl(original?.fechaDictamen ?? hoyBogota(), {
        nonNullable: true,
        validators: [REQUERIDO, fechaValida, noFutura],
      }),
      conComponentes: new FormControl(conComponentes, { nonNullable: true }),
      componentes: new FormGroup({
        deficiencias: new FormControl<number | null>(
          conComponentes ? componentes!.deficiencias! : null,
          { validators: numeroEntre(PORCENTAJE_MIN, PORCENTAJE_MAX) },
        ),
        rolLaboralYOtrasAreas: new FormControl<number | null>(
          conComponentes ? componentes!.rolLaboralYOtrasAreas! : null,
          { validators: numeroEntre(PORCENTAJE_MIN, PORCENTAJE_MAX) },
        ),
      }),
      fundamentos: new FormControl(original?.fundamentos ?? '', {
        nonNullable: true,
        validators: [
          conTexto,
          Validators.minLength(FUNDAMENTOS_MIN),
          Validators.maxLength(FUNDAMENTOS_MAX),
        ],
      }),
      diagnosticos: new FormArray<FormDiagnostico>(
        original?.diagnosticos.length
          ? original.diagnosticos.map((d) => crearFormDiagnostico({ codigo: d.codigo }))
          : [crearFormDiagnostico()],
        { validators: [Validators.minLength(1)] },
      ),
    },
    { validators: componentesSuman },
  );

  // The subscriptions live as long as the form itself: no teardown needed.
  const c = form.controls;
  c.fechaDictamen.valueChanges.subscribe(() =>
    c.fechaEstructuracion.updateValueAndValidity({ emitEvent: false }),
  );
  const alternarComponentes = (activo: boolean) =>
    activo
      ? c.componentes.enable({ emitEvent: false })
      : c.componentes.disable({ emitEvent: false });
  alternarComponentes(conComponentes);
  c.conComponentes.valueChanges.subscribe((activo) => {
    alternarComponentes(activo);
    form.updateValueAndValidity();
  });
  return form;
}

export type FormDictamen = ReturnType<typeof crearFormDictamen>;

const redondear = (n: number) => Math.round(n * 100) / 100;

/** The POST body. The calificador comes from the token, never from here. */
export function aRequest(
  form: FormDictamen,
  corrigeA?: string | null,
): RegistrarDictamenPclRequest {
  const v = form.getRawValue();
  const request: RegistrarDictamenPclRequest = {
    porcentajePcl: redondear(v.porcentajePcl!),
    origen: v.origen!,
    fechaEstructuracion: v.fechaEstructuracion,
    fechaDictamen: v.fechaDictamen,
    fundamentos: v.fundamentos,
    diagnosticos: v.diagnosticos.map((d) => ({
      sistema: 'CIE-10' as const,
      codigo: d.codigo,
      ...(d.descripcion.trim() ? { descripcion: d.descripcion.trim() } : {}),
    })),
  };
  if (v.conComponentes) {
    request.componentes = {
      deficiencias: redondear(v.componentes.deficiencias!),
      rolLaboralYOtrasAreas: redondear(v.componentes.rolLaboralYOtrasAreas!),
    };
  }
  if (corrigeA) request.corrigeA = corrigeA;
  return request;
}

export type CampoDictamen =
  | 'porcentajePcl'
  | 'origen'
  | 'fechas'
  | 'componentes'
  | 'fundamentos'
  | 'diagnosticos'
  | 'general';

export type ErroresDictamen = Partial<Record<CampoDictamen, string>>;

/** Backend validator and domain codes → the field that shows them. */
const CAMPO_DE_CODIGO: Record<string, CampoDictamen> = {
  'Dictamen.PorcentajeRequerido': 'porcentajePcl',
  'Dictamen.PorcentajeFueraDeRango': 'porcentajePcl',
  'Dictamen.OrigenInvalido': 'origen',
  'Dictamen.FechaEstructuracionRequerida': 'fechas',
  'Dictamen.FechaDictamenRequerida': 'fechas',
  'Dictamen.FechasInvalidas': 'fechas',
  'Dictamen.ComponentesInvalidos': 'componentes',
  'Dictamen.ComponentesNoSuman': 'componentes',
  'Dictamen.FundamentosRequeridos': 'fundamentos',
  'Dictamen.FundamentosLongitud': 'fundamentos',
  'Dictamen.DiagnosticoRequerido': 'diagnosticos',
};

const SIN_RETHUS = new Set([
  'Clinico.ProfesionalSinRegistro',
  'Clinico.RethusRequerido',
  'Clinico.ProfesionalNoIdentificado',
]);
const RETHUS = 'Tu usuario no tiene registro RETHUS configurado. Contacta al administrador.';

function campoDe(codigo: string | null | undefined): CampoDictamen | null {
  if (!codigo) return null;
  if (codigo.startsWith('Clinico.Diagnostico')) return 'diagnosticos';
  return CAMPO_DE_CODIGO[codigo] ?? null;
}

/** 409s that mean "what you see is no longer current": refresh the view and explain (§7.7). */
const CONFLICTOS: Record<string, string> = {
  'Dictamen.YaExiste': 'El caso ya tiene un dictamen registrado. Te mostramos el vigente.',
  'Dictamen.YaNotificado':
    'El dictamen ya fue notificado: no admite correcciones ni otra notificación.',
  'Dictamen.CorrigeANoVigente':
    'El dictamen que estabas corrigiendo ya no es el vigente. Revisa el actual.',
};

/** The explanation of a stale-view 409, or `null` for any other error. */
export function conflictoDictamen(error: unknown): string | null {
  if (!esErrorApi(error) || error.problema.status !== 409) return null;
  return CONFLICTOS[error.problema.errorCode ?? ''] ?? null;
}

/**
 * Where each register error goes (plan §7.7, "Errors"): codes in either 400 shape on their
 * field, a missing RETHUS and the rest above the form.
 */
export function erroresDeDictamen(error: unknown): ErroresDictamen {
  if (esErrorApi(error)) {
    const p = error.problema;
    const codigos = [p.errorCode, ...p.errors.map((e) => e.codigo)];
    if (codigos.some((c) => c && SIN_RETHUS.has(c))) return { general: RETHUS };

    const porCampo: ErroresDictamen = {};
    for (const e of p.errors) {
      const campo = campoDe(e.codigo);
      if (campo) porCampo[campo] ??= e.mensaje;
    }
    const campo = campoDe(p.errorCode);
    if (campo) porCampo[campo] ??= p.detail ?? undefined;
    if (Object.values(porCampo).some(Boolean)) return porCampo;
  }
  const { titulo, mensaje } = mensajeDeError(error);
  return { general: `${titulo}. ${mensaje}` };
}

/* ---------- notificación ---------- */

/** `notificadoEn` not in the future, nor before `fechaDictamen` in Bogotá (backend `Notificar`). */
function validarNotificadoEn(fechaDictamen: string): ValidatorFn {
  return (control: AbstractControl<string>) => {
    if (!control.value) return null;
    const iso = bogotaLocalAIso(control.value);
    if (!iso) return { invalida: true };
    if (Date.parse(iso) > Date.now()) return { futura: true };
    const dia = fechaCalendarioBogota(iso);
    return dia && dia < fechaDictamen ? { anteriorAlDictamen: true } : null;
  };
}

export function crearFormNotificacion(fechaDictamen: string) {
  return new FormGroup({
    notificadoEn: new FormControl('', {
      nonNullable: true,
      validators: [REQUERIDO, validarNotificadoEn(fechaDictamen)],
    }),
    medio: new FormControl<MedioNotificacion | null>(null, { validators: [REQUERIDO] }),
  });
}

export type FormNotificacion = ReturnType<typeof crearFormNotificacion>;

export function aRequestNotificacion(form: FormNotificacion): NotificarDictamenPclRequest {
  const v = form.getRawValue();
  return { notificadoEn: bogotaLocalAIso(v.notificadoEn)!, medio: v.medio! };
}

export type CampoNotificacion = 'notificadoEn' | 'medio' | 'general';

export function errorDeNotificacion(error: unknown): Partial<Record<CampoNotificacion, string>> {
  if (esErrorApi(error)) {
    const p = error.problema;
    const de = (codigo: string) =>
      p.errorCode === codigo
        ? (p.detail ?? '')
        : (p.errors.find((e) => e.codigo === codigo)?.mensaje ?? null);
    const fecha = de('Dictamen.NotificacionFueraDeRango') ?? de('Dictamen.NotificadoEnRequerido');
    if (fecha !== null) {
      return { notificadoEn: fecha || 'La fecha de notificación no es válida.' };
    }
    const medio = de('Dictamen.MedioInvalido');
    if (medio !== null) return { medio: medio || 'Elige el medio de notificación.' };
  }
  const { titulo, mensaje } = mensajeDeError(error);
  return { general: `${titulo}. ${mensaje}` };
}

/* ---------- estado de la notificación ---------- */

export type FaseEtapa = 'hecha' | 'actual' | 'pendiente' | 'omitida';

export interface Etapa {
  estado: EstadoDictamen;
  etiqueta: string;
  fase: FaseEtapa;
  /** "En controversia" only happens if someone disputes the dictamen. */
  opcional: boolean;
}

const ETAPAS: readonly { estado: EstadoDictamen; etiqueta: string; opcional: boolean }[] = [
  { estado: 'PENDIENTE', etiqueta: 'Pendiente', opcional: false },
  { estado: 'NOTIFICADO', etiqueta: 'Notificado', opcional: false },
  { estado: 'EN_CONTROVERSIA', etiqueta: 'En controversia', opcional: true },
  { estado: 'EN_FIRME', etiqueta: 'En firme', opcional: false },
];

/** Pendiente → Notificado → (En controversia) → En firme (plan §7.7). */
export function etapasNotificacion(estado: string): Etapa[] {
  const actual = ETAPAS.findIndex((e) => e.estado === estado);
  return ETAPAS.map((e, i) => {
    let fase: FaseEtapa = i < actual ? 'hecha' : i === actual ? 'actual' : 'pendiente';
    // Firm without a dispute: the optional step was skipped, not done.
    if (e.opcional && fase === 'hecha' && estado === 'EN_FIRME') fase = 'omitida';
    return { ...e, fase };
  });
}

/** Days from today (Bogotá) to the last day to dispute: 0 is today, negative is past. */
export function diasParaControversia(
  vence: string | null | undefined,
  hoy: string = hoyBogota(),
): number | null {
  return vence ? diasEntre(hoy, vence) : null;
}
