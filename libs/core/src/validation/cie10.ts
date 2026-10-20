import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * A CIE-10 code: one letter, two digits and, optionally, a dot and 1–4 characters (`S62`,
 * `S62.6`). Same pattern as the backend's `DiagnosticoRequestValidator` (plan §4.3).
 */
export const PATRON_CIE10 = /^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/;

/** Max length of a diagnosis description (backend `DiagnosticoRequestValidator`). */
export const DESCRIPCION_DIAGNOSTICO_MAX = 250;

export function esCie10(codigo: string | null | undefined): boolean {
  return !!codigo && PATRON_CIE10.test(codigo);
}

/** Typed codes are upper-cased and stripped of spaces: `s62.6 ` → `S62.6`. */
export function normalizarCie10(texto: string): string {
  return texto.replace(/\s+/g, '').toUpperCase();
}

/** Reactive-forms validator: `{ cie10: true }` for a malformed code; empty is `required`'s job. */
export function validarCie10(control: AbstractControl<string | null>): ValidationErrors | null {
  const valor = control.value ?? '';
  return !valor || esCie10(valor) ? null : { cie10: true };
}
