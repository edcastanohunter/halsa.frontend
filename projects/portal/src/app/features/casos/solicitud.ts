import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { CrearSolicitudCopiaHcRequest } from '@halsa/api-types';
import { esErrorApi, MedioEntrega, mensajeDeError, tieneCodigo } from '@halsa/core';

/** `SolicitudCopiaHc.MaximoDireccion` / `MaximoObservaciones` (SPEC 12). */
export const DESTINO_MAX = 500;
export const OBSERVACIONES_MAX = 1000;

/** The field each delivery method needs (plan §7.12); PRESENCIAL needs none. */
export const CAMPO_DESTINO: Record<MedioEntrega, 'direccion' | 'correo' | null> = {
  CORREO_CERTIFICADO: 'direccion',
  ELECTRONICO: 'correo',
  PRESENCIAL: null,
};

/** Required only while its delivery method is the chosen one. */
function requeridoPara(medio: MedioEntrega) {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    if (control.parent?.get('medio')?.value !== medio) return null;
    return control.value.trim() ? null : { required: true };
  };
}

export function crearFormularioSolicitud() {
  return new FormGroup({
    medio: new FormControl<MedioEntrega | null>(null, Validators.required),
    direccion: new FormControl('', {
      nonNullable: true,
      validators: [requeridoPara('CORREO_CERTIFICADO'), Validators.maxLength(DESTINO_MAX)],
    }),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [
        requeridoPara('ELECTRONICO'),
        Validators.email,
        Validators.maxLength(DESTINO_MAX),
      ],
    }),
    observaciones: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(OBSERVACIONES_MAX),
    }),
  });
}

export type FormularioSolicitud = ReturnType<typeof crearFormularioSolicitud>;

/** The request body: only the destination the chosen method uses, trimmed. */
export function cuerpoSolicitud(form: FormularioSolicitud): CrearSolicitudCopiaHcRequest {
  const { medio, direccion, correo, observaciones } = form.getRawValue();
  const campo = CAMPO_DESTINO[medio!];
  const destino = campo === 'direccion' ? direccion : campo === 'correo' ? correo : '';
  return {
    medioEntrega: medio!,
    direccionOCorreo: destino.trim() || null,
    observaciones: observaciones.trim() || null,
  };
}

export type CampoSolicitud = 'medio' | 'destino' | 'observaciones' | 'general';

/**
 * A failed request, by field (plan §4.2). `SolicitudCopiaHc.YaAbierta` is its own outcome: the
 * page explains it and links to the open request instead of blaming a field.
 */
export function erroresDeSolicitud(
  error: unknown,
): { yaAbierta: true } | Partial<Record<CampoSolicitud, string>> {
  if (esErrorApi(error)) {
    const p = error.problema;
    if (tieneCodigo(p, 'SolicitudCopiaHc.YaAbierta')) return { yaAbierta: true };
    const errores: Partial<Record<CampoSolicitud, string>> = {};
    for (const e of p.errors) {
      switch (e.codigo) {
        case 'SolicitudCopiaHc.MedioEntregaInvalido':
          errores.medio = 'Elige cómo quieres recibir la copia.';
          break;
        case 'SolicitudCopiaHc.DireccionRequerida':
          errores.destino = 'Indica a dónde enviamos la copia.';
          break;
        case 'SolicitudCopiaHc.CorreoInvalido':
          errores.destino = 'Escribe un correo electrónico válido.';
          break;
        case 'SolicitudCopiaHc.DireccionDemasiadoLarga':
          errores.destino = 'Admite como máximo 500 caracteres.';
          break;
        case 'SolicitudCopiaHc.ObservacionesDemasiadoLargas':
          errores.observaciones = 'Las observaciones admiten como máximo 1.000 caracteres.';
          break;
      }
    }
    if (Object.keys(errores).length) return errores;
  }
  const m = mensajeDeError(error);
  return { general: `${m.titulo}. ${m.mensaje}` };
}
