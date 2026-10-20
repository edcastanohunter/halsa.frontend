import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import type { SolicitudCopiaHcResponse } from '@halsa/api-types';
import { injectMediaQuery, Notificaciones } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCircleX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { SolicitudesCopiaHcApi } from '../../shared/privacidad/solicitudes-copia-hc-api.service';
import { CampoCierre, erroresDeCierre, NOTA_MAX, NOTA_MIN } from './bandeja';

type Resultado = 'ENTREGADA' | 'RECHAZADA';

const RESULTADOS: readonly {
  valor: Resultado;
  etiqueta: string;
  descripcion: string;
  icono: string;
  clases: string;
}[] = [
  {
    valor: 'ENTREGADA',
    etiqueta: 'Entregada',
    descripcion: 'La copia se entregó por el medio que pidió el paciente.',
    icono: 'lucideCircleCheck',
    clases: 'has-checked:ring-success has-checked:bg-success/8 text-success',
  },
  {
    valor: 'RECHAZADA',
    etiqueta: 'Rechazada',
    descripcion: 'No procede la entrega. Explica el motivo en la nota.',
    icono: 'lucideCircleX',
    clases: 'has-checked:ring-destructive has-checked:bg-destructive/8 text-destructive',
  },
];

/** The note counts without surrounding spaces, like the server (`Nota.Trim().Length`). */
function validarNota(control: AbstractControl<string>): ValidationErrors | null {
  if (control.value.trim().length < NOTA_MIN) return { corta: true };
  if (control.value.length > NOTA_MAX) return { larga: true };
  return null;
}

/**
 * "Cerrar solicitud" (plan §7.9): the result (Entregada / Rechazada) and a note. A bottom sheet on
 * mobile, a side sheet on desktop. Opens while `solicitud` is set; emits `cerrada` after the 204,
 * `conflicto` when the request had already changed state, and `cerrado` on any close.
 */
@Component({
  selector: 'app-dialogo-cerrar-solicitud',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    HlmButton,
    HlmFieldImports,
    HlmSheetImports,
    HlmSpinner,
    HlmTextarea,
  ],
  providers: [provideIcons({ lucideCircleCheck, lucideCircleX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet
      [side]="escritorio() ? 'right' : 'bottom'"
      [state]="solicitud() ? 'open' : 'closed'"
      (closed)="cerrar()"
    >
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-dvh overflow-y-auto sm:max-w-md">
        @if (solicitud(); as s) {
          <hlm-sheet-header>
            <h2 hlmSheetTitle>Cerrar solicitud</h2>
            <p hlmSheetDescription>
              Copia de historia clínica ·
              <span class="font-mono whitespace-nowrap">{{ s.radicado }}</span
              >. Al cerrarla se cumple su plazo legal y el paciente ve el resultado en el portal.
            </p>
          </hlm-sheet-header>
          <form
            id="form-cerrar-solicitud"
            class="space-y-5 px-4"
            [formGroup]="form"
            (ngSubmit)="enviar(s)"
            novalidate
          >
            <fieldset [attr.aria-describedby]="resultadoInvalido() ? 'error-resultado' : null">
              <legend class="mb-2 text-sm font-medium">Resultado</legend>
              <div class="grid gap-2">
                @for (r of resultados; track r.valor) {
                  <label
                    class="ring-border has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-inset has-checked:ring-2"
                    [class]="r.clases"
                  >
                    <input
                      type="radio"
                      class="accent-primary mt-0.5 size-4 shrink-0"
                      formControlName="resultado"
                      [value]="r.valor"
                      (change)="limpiar('resultado')"
                    />
                    <span class="min-w-0">
                      <span class="flex items-center gap-1.5 text-sm font-medium">
                        <ng-icon [name]="r.icono" aria-hidden="true" />
                        {{ r.etiqueta }}
                      </span>
                      <span class="text-muted-foreground block text-xs">{{ r.descripcion }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (resultadoInvalido()) {
                <p id="error-resultado" role="alert" class="text-destructive mt-2 text-sm">
                  {{ errores().resultado ?? 'Elige el resultado.' }}
                </p>
              }
            </fieldset>

            <hlm-field [forceInvalid]="!!errores().nota">
              <label hlmFieldLabel for="cerrar-nota">Nota</label>
              <textarea
                hlmTextarea
                id="cerrar-nota"
                rows="5"
                formControlName="nota"
                [attr.maxlength]="notaMax"
                (input)="limpiar('nota')"
              ></textarea>
              <p hlmFieldDescription class="flex justify-between gap-2">
                <span
                  >Qué se entregó y cómo, o por qué se rechaza. Entre 10 y 1.000 caracteres.</span
                >
                <span class="tabular-nums" aria-live="polite">{{ largoNota() }}/{{ notaMax }}</span>
              </p>
              <hlm-field-error validator="corta">Escribe al menos 10 caracteres.</hlm-field-error>
              <hlm-field-error validator="larga"
                >La nota admite como máximo 1.000 caracteres.</hlm-field-error
              >
              @if (errores().nota; as e) {
                <hlm-field-error forceShow>{{ e }}</hlm-field-error>
              }
            </hlm-field>

            @if (errores().general; as e) {
              <p
                role="alert"
                class="bg-destructive/10 text-destructive ring-destructive/25 rounded-lg p-3 text-sm ring-1 ring-inset"
              >
                {{ e }}
              </p>
            }
          </form>
          <hlm-sheet-footer>
            <button hlmBtn variant="outline" type="button" (click)="cerrar()">Cancelar</button>
            <button hlmBtn type="submit" form="form-cerrar-solicitud" [disabled]="enviando()">
              @if (enviando()) {
                <hlm-spinner class="size-4" aria-hidden="true" />
              }
              Cerrar solicitud
            </button>
          </hlm-sheet-footer>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class DialogoCerrarSolicitud {
  readonly solicitud = input<SolicitudCopiaHcResponse | null>(null);
  readonly cerrada = output<SolicitudCopiaHcResponse>();
  readonly conflicto = output<string>();
  readonly cerrado = output<void>();

  private readonly api = inject(SolicitudesCopiaHcApi);
  private readonly notificaciones = inject(Notificaciones);
  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');

  protected readonly resultados = RESULTADOS;
  protected readonly notaMax = NOTA_MAX;
  protected readonly form = new FormGroup({
    resultado: new FormControl<Resultado | null>(null, Validators.required),
    nota: new FormControl('', { nonNullable: true, validators: validarNota }),
  });
  private readonly valorNota = toSignal(this.form.controls.nota.valueChanges, {
    initialValue: '',
  });
  protected readonly largoNota = computed(() => this.valorNota().length);

  protected readonly enviando = signal(false);
  protected readonly errores = signal<Partial<Record<CampoCierre, string>>>({});
  private readonly enviado = signal(false);

  /** Radio cards have no `hlm-field`: their error shows after a submit attempt or the server. */
  protected resultadoInvalido(): boolean {
    return !!this.errores().resultado || (this.enviado() && this.form.controls.resultado.invalid);
  }

  constructor() {
    // A fresh form per request: nothing typed for one request shows up on another.
    effect(() => {
      if (!this.solicitud()) return;
      untracked(() => {
        this.form.reset();
        this.errores.set({});
        this.enviado.set(false);
      });
    });
  }

  protected limpiar(campo: CampoCierre): void {
    if (!this.errores()[campo] && !this.errores().general) return;
    this.errores.update((actuales) => {
      const resto = { ...actuales };
      delete resto[campo];
      delete resto.general;
      return resto;
    });
  }

  protected cerrar(): void {
    if (this.enviando()) return;
    this.cerrado.emit();
  }

  protected async enviar(solicitud: SolicitudCopiaHcResponse): Promise<void> {
    this.enviado.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;
    this.errores.set({});
    this.enviando.set(true);
    const { resultado, nota } = this.form.getRawValue();
    try {
      await firstValueFrom(
        this.api.cerrar(solicitud.id, { resultado: resultado!, nota: nota.trim() }),
      );
      this.notificaciones.exito(
        resultado === 'ENTREGADA' ? 'Solicitud cerrada como entregada' : 'Solicitud rechazada',
        solicitud.radicado,
      );
      this.enviando.set(false);
      this.cerrada.emit(solicitud);
    } catch (error) {
      this.enviando.set(false);
      const errores = erroresDeCierre(error);
      if ('conflicto' in errores) this.conflicto.emit(errores.mensaje);
      else this.errores.set(errores);
    }
  }
}
