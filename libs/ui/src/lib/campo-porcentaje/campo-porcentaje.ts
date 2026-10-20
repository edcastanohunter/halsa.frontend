import { Directive, ElementRef, forwardRef, inject, input } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { formatDecimalEditable, parsearDecimal, tieneMaxDecimales } from '@halsa/core';

/**
 * es-CO percentage input (plan §7.7): `<input hlmInput halsaCampoPorcentaje formControlName="…">`.
 * Shows "23,45", hands the form the number `23.45` (`null` when empty, `NaN` when it isn't a
 * number) and reports `numero` / `decimales` errors. A directive on the input itself, so
 * `hlm-field` still finds the control for its errors. Range checks stay with the form.
 */
@Directive({
  selector: 'input[halsaCampoPorcentaje]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoPorcentaje),
      multi: true,
    },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CampoPorcentaje), multi: true },
  ],
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    spellcheck: 'false',
    '(input)': 'alEscribir()',
    '(blur)': 'alSalir()',
  },
})
export class CampoPorcentaje implements ControlValueAccessor, Validator {
  readonly decimales = input(2);

  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private valor: number | null = null;
  private alCambiar: (valor: number | null) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: number | null | undefined): void {
    this.valor = typeof valor === 'number' ? valor : null;
    this.input.value = formatDecimalEditable(this.valor, 20);
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.input.disabled = deshabilitado;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const valor = control.value as number | null;
    if (valor === null || valor === undefined) return null;
    if (Number.isNaN(valor)) return { numero: true };
    return tieneMaxDecimales(valor, this.decimales())
      ? null
      : { decimales: { maximo: this.decimales() } };
  }

  protected alEscribir(): void {
    this.valor = parsearDecimal(this.input.value);
    this.alCambiar(this.valor);
  }

  /** A readable number goes back in canonical form ("23.5" → "23,5"); typos stay as typed. */
  protected alSalir(): void {
    if (this.valor !== null && !Number.isNaN(this.valor)) {
      this.input.value = formatDecimalEditable(this.valor, 20);
    }
    this.alTocar();
  }
}
