import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DESCRIPCION_DIAGNOSTICO_MAX, normalizarCie10, validarCie10 } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideTrash2 } from '@ng-icons/lucide';

export type FormDiagnostico = FormGroup<{
  codigo: FormControl<string>;
  descripcion: FormControl<string>;
}>;

/** One editable CIE-10 row; the code is required and must match the backend pattern. */
export function crearFormDiagnostico(
  valor: { codigo?: string | null; descripcion?: string | null } = {},
): FormDiagnostico {
  return new FormGroup({
    codigo: new FormControl(valor.codigo ?? '', {
      nonNullable: true,
      validators: [Validators.required, validarCie10],
    }),
    descripcion: new FormControl(valor.descripcion ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRIPCION_DIAGNOSTICO_MAX)],
    }),
  });
}

/**
 * CIE-10 diagnoses editor (plan §7.5, §8.2): add or remove rows, the code upper-cased as it's
 * typed and validated against the backend pattern, an optional description, and the first row
 * marked "Principal". Edits the `FormArray` the caller owns.
 */
@Component({
  selector: 'halsa-editor-diagnosticos-cie10',
  imports: [ReactiveFormsModule, HlmButton, HlmFieldImports, HlmInput, NgIcon],
  providers: [provideIcons({ lucidePlus, lucideTrash2 })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-medium">{{ titulo() }}</legend>
      @if (!diagnosticos().length) {
        <p class="text-muted-foreground text-sm">Sin diagnósticos.</p>
      }
      <ol class="space-y-3">
        @for (grupo of diagnosticos().controls; track grupo; let i = $index) {
          <li
            class="bg-muted/40 ring-border grid gap-3 rounded-lg p-3 ring-1 sm:grid-cols-[10rem_1fr_auto] sm:items-start"
            [formGroup]="grupo"
          >
            <hlm-field>
              <label hlmFieldLabel [for]="idPrefijo() + '-codigo-' + i">
                Código CIE-10
                @if (i === 0) {
                  <span
                    class="bg-primary/12 text-primary ms-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    >Principal</span
                  >
                }
              </label>
              <input
                hlmInput
                class="font-mono uppercase"
                [id]="idPrefijo() + '-codigo-' + i"
                formControlName="codigo"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                placeholder="S62.6"
                maxlength="8"
                (input)="normalizar(grupo)"
              />
              <hlm-field-error validator="required">Escribe el código.</hlm-field-error>
              <hlm-field-error validator="cie10"
                >Formato CIE-10: una letra y dos dígitos, por ejemplo S62 o S62.6.</hlm-field-error
              >
            </hlm-field>
            <hlm-field>
              <label hlmFieldLabel [for]="idPrefijo() + '-descripcion-' + i"
                >Descripción (opcional)</label
              >
              <input
                hlmInput
                [id]="idPrefijo() + '-descripcion-' + i"
                formControlName="descripcion"
                [attr.maxlength]="descripcionMax"
              />
            </hlm-field>
            <button
              hlmBtn
              variant="ghost"
              size="icon"
              type="button"
              class="sm:mt-6"
              [attr.aria-label]="'Quitar el diagnóstico ' + (i + 1)"
              [disabled]="diagnosticos().length <= minimo()"
              (click)="quitar(i)"
            >
              <ng-icon name="lucideTrash2" aria-hidden="true" />
            </button>
          </li>
        }
      </ol>
      @if (error()) {
        <p role="alert" class="text-destructive text-sm">{{ error() }}</p>
      }
      @if (maximo() === null || diagnosticos().length < maximo()!) {
        <button hlmBtn variant="outline" size="sm" type="button" (click)="agregar()">
          <ng-icon name="lucidePlus" aria-hidden="true" />
          Agregar diagnóstico
        </button>
      }
    </fieldset>
  `,
})
export class EditorDiagnosticosCie10 {
  readonly diagnosticos = input.required<FormArray<FormDiagnostico>>();
  readonly titulo = input('Diagnósticos');
  /** Prefix for the inputs' ids, unique per page. */
  readonly idPrefijo = input('diagnostico');
  /** Rows that can't be removed (the dictamen needs at least one). */
  readonly minimo = input(0);
  /** Rows allowed, e.g. the principal plus 3 related for an incapacidad; `null` for no cap. */
  readonly maximo = input<number | null>(null);
  /** A server-side error about the diagnoses as a whole. */
  readonly error = input<string | null>(null);

  protected readonly descripcionMax = DESCRIPCION_DIAGNOSTICO_MAX;

  protected agregar(): void {
    this.diagnosticos().push(crearFormDiagnostico());
  }

  protected quitar(indice: number): void {
    this.diagnosticos().removeAt(indice);
  }

  protected normalizar(grupo: FormDiagnostico): void {
    const control = grupo.controls.codigo;
    const normalizado = normalizarCie10(control.value);
    if (normalizado !== control.value) control.setValue(normalizado);
  }
}
