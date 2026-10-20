import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import type { PlazoResponse } from '@halsa/api-types';
import {
  aBogotaLocal,
  bogotaLocalAIso,
  esErrorApi,
  getEnumLabel,
  MensajeError,
  mensajeDeError,
  REGLA_PLAZO_LABELS,
  tieneCodigo,
} from '@halsa/core';
import { injectMediaQuery, Notificaciones } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { firstValueFrom } from 'rxjs';
import { PlazosApi } from './plazos-api.service';

/** Plan §4.3 / backend `Plazo.MinimoNota`, `Plazo.MaximoNota`. */
export const NOTA_MIN = 10;
export const NOTA_MAX = 1000;

/** Only these accept `cumplir` (backend `Plazo.Cumplir`; the plan said ABIERTO only). */
export function esCumplible(plazo: Pick<PlazoResponse, 'estado'>): boolean {
  return plazo.estado === 'ABIERTO' || plazo.estado === 'VENCIDO';
}

/** The note counts without surrounding spaces, like the server (`Nota.Trim().Length`). */
function validarNota(control: AbstractControl<string>): ValidationErrors | null {
  const largo = control.value.trim().length;
  if (largo < NOTA_MIN) return { corta: true };
  if (control.value.length > NOTA_MAX) return { larga: true };
  return null;
}

function validarCumplidoEn(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) return null;
  const iso = bogotaLocalAIso(control.value);
  if (!iso) return { invalida: true };
  return Date.parse(iso) > Date.now() ? { futura: true } : null;
}

/**
 * "Marcar como cumplido" (plan §7.4): a bottom sheet on mobile, a side sheet on desktop. Opens
 * while `plazo` is set; emits `cumplido` after a 204 and `cerrado` on any close.
 */
@Component({
  selector: 'app-dialogo-cumplir-plazo',
  imports: [
    ReactiveFormsModule,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmSheetImports,
    HlmSpinner,
    HlmTextarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet
      [side]="escritorio() ? 'right' : 'bottom'"
      [state]="plazo() ? 'open' : 'closed'"
      (closed)="cerrar()"
    >
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-dvh overflow-y-auto sm:max-w-md">
        @if (plazo(); as p) {
          <hlm-sheet-header>
            <h2 hlmSheetTitle>Marcar como cumplido</h2>
            <p hlmSheetDescription>
              {{ regla() }} ·
              <span class="font-mono whitespace-nowrap">{{ p.radicado }}</span>
            </p>
          </hlm-sheet-header>
          <form
            id="form-cumplir"
            class="space-y-5 px-4"
            [formGroup]="form"
            (ngSubmit)="enviar(p)"
            novalidate
          >
            <hlm-field [forceInvalid]="!!errorNota()">
              <label hlmFieldLabel for="cumplir-nota">Nota</label>
              <textarea
                hlmTextarea
                id="cumplir-nota"
                rows="5"
                formControlName="nota"
                [attr.maxlength]="notaMax"
                (input)="errorNota.set(null)"
              ></textarea>
              <p hlmFieldDescription class="flex justify-between gap-2">
                <span>Qué se hizo para cumplirlo. Entre 10 y 1.000 caracteres.</span>
                <span class="tabular-nums" aria-live="polite">{{ largoNota() }}/{{ notaMax }}</span>
              </p>
              <hlm-field-error validator="corta">Escribe al menos 10 caracteres.</hlm-field-error>
              <hlm-field-error validator="larga"
                >La nota admite como máximo 1.000 caracteres.</hlm-field-error
              >
              @if (errorNota(); as e) {
                <hlm-field-error forceShow data-testid="error-nota">{{ e }}</hlm-field-error>
              }
            </hlm-field>

            <hlm-field [forceInvalid]="!!errorFecha()">
              <label hlmFieldLabel for="cumplir-fecha">Fecha de cumplimiento (opcional)</label>
              <input
                hlmInput
                id="cumplir-fecha"
                type="datetime-local"
                formControlName="cumplidoEn"
                [max]="maximo()"
                (input)="errorFecha.set(null)"
              />
              <p hlmFieldDescription>Hora de Bogotá. Si la dejas vacía, se usa la hora actual.</p>
              <hlm-field-error validator="futura">No puede ser una fecha futura.</hlm-field-error>
              <hlm-field-error validator="invalida">La fecha no es válida.</hlm-field-error>
              @if (errorFecha(); as e) {
                <hlm-field-error forceShow>{{ e }}</hlm-field-error>
              }
            </hlm-field>

            @if (error(); as e) {
              <p
                role="alert"
                class="bg-destructive/10 text-destructive ring-destructive/25 rounded-lg p-3 text-sm ring-1 ring-inset"
              >
                <span class="font-medium">{{ e.titulo }}.</span> {{ e.mensaje }}
              </p>
            }
          </form>
          <hlm-sheet-footer>
            <button hlmBtn variant="outline" type="button" (click)="cerrar()">Cancelar</button>
            <button hlmBtn type="submit" form="form-cumplir" [disabled]="enviando()">
              @if (enviando()) {
                <hlm-spinner class="size-4" aria-hidden="true" />
              }
              Marcar como cumplido
            </button>
          </hlm-sheet-footer>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class DialogoCumplirPlazo {
  readonly plazo = input<PlazoResponse | null>(null);
  readonly cumplido = output<PlazoResponse>();
  readonly cerrado = output<void>();

  private readonly api = inject(PlazosApi);
  private readonly notificaciones = inject(Notificaciones);
  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');

  protected readonly notaMax = NOTA_MAX;
  protected readonly maximo = signal('');
  protected readonly form = new FormGroup({
    nota: new FormControl('', { nonNullable: true, validators: validarNota }),
    cumplidoEn: new FormControl('', { nonNullable: true, validators: validarCumplidoEn }),
  });
  private readonly valorNota = toSignal(this.form.controls.nota.valueChanges, {
    initialValue: '',
  });
  protected readonly largoNota = computed(() => this.valorNota().length);

  protected readonly enviando = signal(false);
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly errorNota = signal<string | null>(null);
  protected readonly errorFecha = signal<string | null>(null);
  protected readonly regla = computed(() => getEnumLabel(REGLA_PLAZO_LABELS, this.plazo()?.regla));

  constructor() {
    // A fresh form per deadline: nothing typed for one deadline shows up on another.
    effect(() => {
      if (!this.plazo()) return;
      this.form.reset();
      this.error.set(null);
      this.errorNota.set(null);
      this.errorFecha.set(null);
      this.maximo.set(aBogotaLocal(Date.now()) ?? '');
    });
  }

  protected cerrar(): void {
    if (this.enviando()) return;
    this.cerrado.emit();
  }

  protected async enviar(plazo: PlazoResponse): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);
    const { nota, cumplidoEn } = this.form.getRawValue();
    try {
      await firstValueFrom(
        this.api.cumplir(plazo.casoId, plazo.id, {
          nota: nota.trim(),
          cumplidoEn: cumplidoEn ? bogotaLocalAIso(cumplidoEn) : null,
        }),
      );
      this.notificaciones.exito('Plazo marcado como cumplido', this.regla());
      this.enviando.set(false);
      this.cumplido.emit(plazo);
    } catch (error) {
      this.enviando.set(false);
      this.mapearError(error);
    }
  }

  /** Plan §4.2: field errors next to their field, the rest inside the sheet. */
  private mapearError(error: unknown): void {
    if (esErrorApi(error)) {
      const p = error.problema;
      const deNota = p.errors.find((e) => e.codigo?.startsWith('Plazo.Nota'));
      if (deNota) {
        this.errorNota.set(deNota.mensaje);
        return;
      }
      if (tieneCodigo(p, 'Plazo.CumplidoEnFuturo')) {
        this.errorFecha.set(p.detail ?? 'No puede ser una fecha futura.');
        return;
      }
    }
    this.error.set(mensajeDeError(error));
  }
}
