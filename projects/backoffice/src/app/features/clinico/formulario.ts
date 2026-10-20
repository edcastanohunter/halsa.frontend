import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { RegistroClinicoRequest, RegistroClinicoResponse } from '@halsa/api-types';
import {
  aBogotaLocal,
  bogotaLocalAIso,
  CodigoError,
  esErrorApi,
  mensajeDeError,
  tieneCodigo,
} from '@halsa/core';
import { crearFormDiagnostico, FormDiagnostico } from '@halsa/ui';

/** What the backoffice may register (plan §4.3, `RegistroClinicoRequest.tipo`). */
export const TIPOS_REGISTRABLES = [
  'CONCEPTO_MEDICO',
  'EVOLUCION',
  'CONCEPTO_REHABILITACION',
] as const;
export type TipoRegistrable = (typeof TIPOS_REGISTRABLES)[number];

/** Backend `ContenidoClinicoRequestValidator.MaximoCaracteres`. */
export const TEXTO_MAX = 8000;

/** The five note fields; at least one needs text (backend `Clinico.ContenidoVacio`). */
export const CAMPOS_NOTA = ['motivo', 'anamnesis', 'examenFisico', 'analisis', 'plan'] as const;
export type CampoNota = (typeof CAMPOS_NOTA)[number];

const texto = () =>
  new FormControl('', { nonNullable: true, validators: [Validators.maxLength(TEXTO_MAX)] });

function alMenosUnaNota(grupo: AbstractControl): ValidationErrors | null {
  const valores = (grupo as FormGroup).getRawValue() as Record<CampoNota, string>;
  return CAMPOS_NOTA.some((c) => valores[c]?.trim()) ? null : { notaVacia: true };
}

function noFutura(control: AbstractControl<string>): ValidationErrors | null {
  const iso = bogotaLocalAIso(control.value);
  if (!control.value) return null;
  if (!iso) return { invalida: true };
  return Date.parse(iso) > Date.now() ? { futura: true } : null;
}

export function crearFormRegistro(ahora: number = Date.now()) {
  return new FormGroup({
    tipo: new FormControl<TipoRegistrable>('CONCEPTO_MEDICO', { nonNullable: true }),
    atendidoEn: new FormControl(aBogotaLocal(ahora) ?? '', {
      nonNullable: true,
      validators: [Validators.required, noFutura],
    }),
    nota: new FormGroup(
      {
        motivo: texto(),
        anamnesis: texto(),
        examenFisico: texto(),
        analisis: texto(),
        plan: texto(),
      },
      { validators: alMenosUnaNota },
    ),
    diagnosticos: new FormArray<FormDiagnostico>([]),
    observaciones: texto(),
  });
}

export type FormRegistro = ReturnType<typeof crearFormRegistro>;

/** Correction mode: the new record starts as a copy of the original (plan §7.5). */
export function prellenar(form: FormRegistro, original: RegistroClinicoResponse): void {
  const c = original.contenido;
  const tipo = (TIPOS_REGISTRABLES as readonly string[]).includes(original.tipo)
    ? (original.tipo as TipoRegistrable)
    : 'CONCEPTO_MEDICO';
  form.patchValue({
    tipo,
    atendidoEn: aBogotaLocal(original.atendidoEn) ?? '',
    nota: {
      motivo: c.motivo ?? '',
      anamnesis: c.anamnesis ?? '',
      examenFisico: c.examenFisico ?? '',
      analisis: c.analisis ?? '',
      plan: c.plan ?? '',
    },
    observaciones: c.observaciones ?? '',
  });
  form.controls.diagnosticos.clear();
  for (const d of c.diagnosticos ?? []) form.controls.diagnosticos.push(crearFormDiagnostico(d));
}

const oNulo = (valor: string) => valor.trim() || null;

export function aRequest(form: FormRegistro, corrigeA: string | null): RegistroClinicoRequest {
  const v = form.getRawValue();
  return {
    tipo: v.tipo,
    atendidoEn: bogotaLocalAIso(v.atendidoEn)!,
    corrigeA,
    contenido: {
      motivo: oNulo(v.nota.motivo),
      anamnesis: oNulo(v.nota.anamnesis),
      examenFisico: oNulo(v.nota.examenFisico),
      analisis: oNulo(v.nota.analisis),
      plan: oNulo(v.nota.plan),
      diagnosticos: v.diagnosticos.map((d) => ({
        sistema: 'CIE-10' as const,
        codigo: d.codigo,
        descripcion: oNulo(d.descripcion),
      })),
      observaciones: oNulo(v.observaciones),
    },
  };
}

export type DestinoError = 'atendidoEn' | 'nota' | 'diagnosticos' | 'general';

export interface ErrorFormulario {
  destino: DestinoError;
  mensaje: string;
}

const RETHUS = 'Tu usuario no tiene registro RETHUS configurado. Contacta al administrador.';

/** Where each backend error goes (plan §7.5, "Errors"); the codes come in either 400 shape. */
export function errorDeRegistro(error: unknown): ErrorFormulario {
  if (esErrorApi(error)) {
    const p = error.problema;
    const codigos = [p.errorCode, ...p.errors.map((e) => e.codigo)];
    const con = (codigo: CodigoError | string) => codigos.includes(codigo);
    const detalle = (codigo: string, defecto: string) =>
      p.errors.find((e) => e.codigo === codigo)?.mensaje ?? p.detail ?? defecto;

    if (tieneCodigo(p, 'Clinico.ProfesionalSinRegistro') || con('Clinico.RethusRequerido')) {
      return { destino: 'general', mensaje: RETHUS };
    }
    if (con('Clinico.CasoNoAdmiteRegistros')) {
      return {
        destino: 'general',
        mensaje: p.detail ?? 'El caso está cerrado o rechazado y no admite registros nuevos.',
      };
    }
    if (con('Clinico.AtendidoEnFuturo')) {
      return {
        destino: 'atendidoEn',
        mensaje: detalle('Clinico.AtendidoEnFuturo', 'No puede ser una fecha futura.'),
      };
    }
    if (con('Clinico.FechaAtencionAnteriorAlEvento')) {
      return {
        destino: 'atendidoEn',
        mensaje: detalle(
          'Clinico.FechaAtencionAnteriorAlEvento',
          'Es anterior a la fecha del evento del caso.',
        ),
      };
    }
    if (con('Clinico.ContenidoVacio')) {
      return {
        destino: 'nota',
        mensaje: 'Escribe al menos uno: motivo, anamnesis, examen físico, análisis o plan.',
      };
    }
    const dx = p.errors.find((e) => e.codigo?.startsWith('Clinico.Diagnostico'));
    if (dx) return { destino: 'diagnosticos', mensaje: dx.mensaje };
  }
  const { titulo, mensaje } = mensajeDeError(error);
  return { destino: 'general', mensaje: `${titulo}. ${mensaje}` };
}
