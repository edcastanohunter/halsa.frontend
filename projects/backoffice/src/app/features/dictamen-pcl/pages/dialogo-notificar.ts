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
import { ReactiveFormsModule } from '@angular/forms';
import type { DictamenPclResponse } from '@halsa/api-types';
import {
  aBogotaLocal,
  formatFechaCorta,
  getEnumLabel,
  MEDIO_NOTIFICACION_LABELS,
  MedioNotificacion,
} from '@halsa/core';
import { injectMediaQuery, Notificaciones } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { firstValueFrom } from 'rxjs';
import { DictamenPclApi } from '../data-access/dictamen-pcl-api.service';
import {
  aRequestNotificacion,
  CampoNotificacion,
  conflictoDictamen,
  crearFormNotificacion,
  errorDeNotificacion,
  FormNotificacion,
  MEDIOS,
} from '../formulario';

const DESCRIPCION_MEDIO: Record<MedioNotificacion, string> = {
  CORREO_CERTIFICADO: 'Por empresa de mensajería, con constancia de entrega.',
  ELECTRONICO: 'Al correo electrónico que autorizó el trabajador.',
  PERSONAL: 'En persona, con firma de recibido.',
};

/**
 * "Registrar notificación" (plan §7.7): when and how the worker was notified. A bottom sheet on
 * mobile, a side sheet on desktop. Opens while `dictamen` is set; emits `notificado` after the
 * 204, `conflicto` when the dictamen was no longer pending, and `cerrado` on any close.
 */
@Component({
  selector: 'app-dialogo-notificar-dictamen',
  imports: [ReactiveFormsModule, HlmButton, HlmFieldImports, HlmInput, HlmSheetImports, HlmSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet
      [side]="escritorio() ? 'right' : 'bottom'"
      [state]="dictamen() ? 'open' : 'closed'"
      (closed)="cerrar()"
    >
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-dvh overflow-y-auto sm:max-w-md">
        @if (dictamen(); as d) {
          <hlm-sheet-header>
            <h2 hlmSheetTitle>Registrar notificación</h2>
            <p hlmSheetDescription>
              Desde la notificación corre el plazo para controvertir el dictamen del
              {{ fecha(d.fechaDictamen) }}.
            </p>
          </hlm-sheet-header>
          <form
            id="form-notificar"
            class="space-y-5 px-4"
            [formGroup]="form()"
            (ngSubmit)="enviar()"
            novalidate
          >
            <hlm-field [forceInvalid]="!!error('notificadoEn')">
              <label hlmFieldLabel for="notificar-fecha">Fecha y hora de la notificación</label>
              <input
                hlmInput
                id="notificar-fecha"
                type="datetime-local"
                formControlName="notificadoEn"
                [min]="minimo()"
                [max]="maximo()"
                (input)="limpiar('notificadoEn')"
              />
              <p hlmFieldDescription>Hora de Bogotá.</p>
              <hlm-field-error validator="required">Indica cuándo se notificó.</hlm-field-error>
              <hlm-field-error validator="futura">No puede ser una fecha futura.</hlm-field-error>
              <hlm-field-error validator="anteriorAlDictamen"
                >No puede ser anterior a la fecha del dictamen.</hlm-field-error
              >
              <hlm-field-error validator="invalida">La fecha no es válida.</hlm-field-error>
              @if (error('notificadoEn'); as e) {
                <hlm-field-error forceShow data-testid="error-notificado-en">{{
                  e
                }}</hlm-field-error>
              }
            </hlm-field>

            <fieldset [attr.aria-describedby]="medioInvalido() ? 'error-medio' : null">
              <legend class="mb-2 text-sm font-medium">Medio</legend>
              <div class="grid gap-2">
                @for (m of medios; track m) {
                  <label
                    class="ring-border has-checked:ring-primary has-checked:bg-primary/5 has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-inset has-checked:ring-2"
                  >
                    <input
                      type="radio"
                      class="accent-primary mt-0.5 size-4 shrink-0"
                      formControlName="medio"
                      [value]="m"
                      (change)="limpiar('medio')"
                    />
                    <span class="min-w-0">
                      <span class="block text-sm font-medium">{{ etiquetaMedio(m) }}</span>
                      <span class="text-muted-foreground block text-xs">{{
                        descripcionMedio[m]
                      }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (medioInvalido()) {
                <p id="error-medio" role="alert" class="text-destructive mt-2 text-sm">
                  {{ error('medio') ?? 'Elige el medio de notificación.' }}
                </p>
              }
            </fieldset>

            @if (error('general'); as e) {
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
            <button hlmBtn type="submit" form="form-notificar" [disabled]="enviando()">
              @if (enviando()) {
                <hlm-spinner class="size-4" aria-hidden="true" />
              }
              Registrar notificación
            </button>
          </hlm-sheet-footer>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class DialogoNotificarDictamen {
  readonly dictamen = input<DictamenPclResponse | null>(null);
  readonly notificado = output<void>();
  readonly conflicto = output<string>();
  readonly cerrado = output<void>();

  private readonly api = inject(DictamenPclApi);
  private readonly notificaciones = inject(Notificaciones);
  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');

  protected readonly medios = MEDIOS;
  protected readonly descripcionMedio = DESCRIPCION_MEDIO;
  protected readonly etiquetaMedio = (m: string) => getEnumLabel(MEDIO_NOTIFICACION_LABELS, m);
  protected readonly fecha = formatFechaCorta;

  protected readonly form = signal<FormNotificacion>(crearFormNotificacion(''));
  protected readonly maximo = signal('');
  protected readonly minimo = computed(() => {
    const d = this.dictamen();
    return d ? `${d.fechaDictamen}T00:00` : '';
  });
  protected readonly enviando = signal(false);
  protected readonly errores = signal<Partial<Record<CampoNotificacion, string>>>({});
  private readonly enviado = signal(false);

  /** Radio cards have no `hlm-field`: their error shows after a submit attempt or the server. */
  protected medioInvalido(): boolean {
    return !!this.errores().medio || (this.enviado() && this.form().controls.medio.invalid);
  }

  constructor() {
    // A fresh form per opening: nothing typed for one dictamen carries over.
    effect(() => {
      const d = this.dictamen();
      if (!d) return;
      untracked(() => {
        this.form.set(crearFormNotificacion(d.fechaDictamen));
        this.errores.set({});
        this.enviado.set(false);
        this.maximo.set(aBogotaLocal(Date.now()) ?? '');
      });
    });
  }

  protected error(campo: CampoNotificacion): string | null {
    return this.errores()[campo] ?? null;
  }

  protected limpiar(campo: CampoNotificacion): void {
    if (!this.errores()[campo]) return;
    const resto = { ...this.errores() };
    delete resto[campo];
    this.errores.set(resto);
  }

  protected cerrar(): void {
    if (this.enviando()) return;
    this.cerrado.emit();
  }

  protected async enviar(): Promise<void> {
    const d = this.dictamen();
    const form = this.form();
    this.enviado.set(true);
    form.markAllAsTouched();
    if (!d || form.invalid || this.enviando()) return;
    this.errores.set({});
    this.enviando.set(true);
    try {
      await firstValueFrom(this.api.notificar(d.casoId, aRequestNotificacion(form)), {
        defaultValue: undefined,
      });
      this.enviando.set(false);
      this.notificaciones.exito('Notificación registrada', 'Corre el plazo para controvertir.');
      this.notificado.emit();
    } catch (error) {
      this.enviando.set(false);
      const conflicto = conflictoDictamen(error);
      if (conflicto) {
        this.conflicto.emit(conflicto);
        return;
      }
      this.errores.set(errorDeNotificacion(error));
    }
  }
}
