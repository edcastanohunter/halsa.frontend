import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** REPS code of an IPS: exactly 12 digits (plan §4.3, gap G5). */
export const PATRON_REPS = /^\d{12}$/;

/** A Keycloak `sub` (UUID, any version). */
export const PATRON_SUB = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function patron(regex: RegExp, error: string): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const valor = (control.value ?? '').trim();
    if (!valor) return null;
    return regex.test(valor) ? null : { [error]: true };
  };
}

export const validarReps = patron(PATRON_REPS, 'reps');
export const validarSub = patron(PATRON_SUB, 'sub');

/** Pasted REPS codes often carry spaces or dashes; keep digits only. */
export function normalizarReps(valor: string): string {
  return valor.replace(/\D/g, '');
}
