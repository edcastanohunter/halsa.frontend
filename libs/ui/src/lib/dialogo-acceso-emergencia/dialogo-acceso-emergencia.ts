import { ChangeDetectionStrategy, Component, computed, effect, model, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { transliterarAscii } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCheckbox } from '@halsa/ui/helm/checkbox';
import { HlmDialogImports } from '@halsa/ui/helm/dialog';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmLabel } from '@halsa/ui/helm/label';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';

export const MOTIVO_MIN = 20;
export const MOTIVO_MAX = 500;

/**
 * Break-the-glass dialog (plan §5.1.5): audited motivo (20–500 chars, live counter), the exact
 * ASCII text that will be recorded (gap G10), and a required urgency confirmation.
 * Emits the transliterated motivo; the caller keeps it in a component-scoped signal only.
 */
@Component({
  selector: 'halsa-dialogo-acceso-emergencia',
  imports: [
    ReactiveFormsModule,
    HlmDialogImports,
    HlmFieldImports,
    HlmButton,
    HlmCheckbox,
    HlmLabel,
    HlmTextarea,
    NgIcon,
  ],
  providers: [provideIcons({ lucideTriangleAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-dialog [state]="abierto() ? 'open' : 'closed'" (closed)="abierto.set(false)">
      <hlm-dialog-content *hlmDialogPortal="let ctx" class="sm:max-w-lg">
        <hlm-dialog-header>
          <h2 hlmDialogTitle>Acceso de emergencia</h2>
          <p hlmDialogDescription>Úsalo solo ante una urgencia clínica.</p>
        </hlm-dialog-header>

        <div
          class="bg-destructive/12 text-destructive ring-destructive/25 flex gap-3 rounded-lg p-3 text-sm ring-1 ring-inset"
          role="note"
        >
          <ng-icon
            name="lucideTriangleAlert"
            class="mt-0.5 shrink-0 text-base"
            aria-hidden="true"
          />
          <p>
            Este acceso queda auditado con tu motivo, se notifica al oficial de privacidad y genera
            una revisión obligatoria en 72 horas.
          </p>
        </div>

        <form class="grid gap-5" [formGroup]="formulario" (ngSubmit)="enviar()">
          <hlm-field>
            <label hlmFieldLabel for="halsa-motivo-emergencia">Motivo del acceso</label>
            <textarea
              hlmTextarea
              id="halsa-motivo-emergencia"
              rows="4"
              [maxlength]="max"
              [formControl]="motivo"
            ></textarea>
            <div class="flex items-start justify-between gap-3 text-xs">
              <p hlmFieldDescription class="min-w-0">
                @if (motivoAscii()) {
                  Se registrará como:
                  <span class="text-foreground font-mono">{{ motivoAscii() }}</span>
                } @else {
                  Entre {{ min }} y {{ max }} caracteres.
                }
              </p>
              <span class="text-muted-foreground shrink-0 tabular-nums" aria-live="polite">
                {{ longitud() }}/{{ max }}
              </span>
            </div>
            <hlm-field-error validator="minlength">
              Escribe al menos {{ min }} caracteres.
            </hlm-field-error>
            <hlm-field-error validator="required">El motivo es obligatorio.</hlm-field-error>
          </hlm-field>

          <div class="flex items-start gap-3">
            <hlm-checkbox inputId="halsa-confirma-urgencia" [formControl]="confirmacion" />
            <label hlmLabel for="halsa-confirma-urgencia" class="leading-snug">
              Confirmo que es una urgencia clínica
            </label>
          </div>

          <hlm-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="abierto.set(false)">
              Cancelar
            </button>
            <button
              hlmBtn
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              type="submit"
              [disabled]="!valido()"
            >
              Acceder y registrar motivo
            </button>
          </hlm-dialog-footer>
        </form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class DialogoAccesoEmergencia {
  readonly abierto = model(false);
  readonly confirmar = output<string>();

  protected readonly min = MOTIVO_MIN;
  protected readonly max = MOTIVO_MAX;

  protected readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(MOTIVO_MIN),
      Validators.maxLength(MOTIVO_MAX),
    ],
  });
  protected readonly confirmacion = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });
  // The group gives the <form> a FormGroupDirective, which provides (ngSubmit) and prevents the
  // native submit (a full page reload).
  protected readonly formulario = new FormGroup({
    motivo: this.motivo,
    confirmacion: this.confirmacion,
  });

  private readonly motivoValor = toSignal(this.motivo.valueChanges, { initialValue: '' });
  private readonly confirmado = toSignal(this.confirmacion.valueChanges, { initialValue: false });

  protected readonly longitud = computed(() => this.motivoValor().length);
  protected readonly motivoAscii = computed(() => transliterarAscii(this.motivoValor()));
  protected readonly valido = computed(
    () =>
      this.confirmado() &&
      this.motivoAscii().length >= MOTIVO_MIN &&
      this.motivoValor().length <= MOTIVO_MAX,
  );

  constructor() {
    // Never keep the motivo around after the dialog closes.
    effect(() => {
      if (!this.abierto()) {
        this.motivo.reset();
        this.confirmacion.reset();
      }
    });
  }

  protected enviar(): void {
    if (!this.valido()) {
      this.motivo.markAsTouched();
      return;
    }
    this.confirmar.emit(this.motivoAscii());
    this.abierto.set(false);
  }
}
