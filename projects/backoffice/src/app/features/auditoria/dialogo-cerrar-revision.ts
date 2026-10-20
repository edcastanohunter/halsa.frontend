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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { RevisionEmergenciaResponse } from '@halsa/api-types';
import { ConclusionRevisionEmergencia } from '@halsa/core';
import { FechaBogota, injectMediaQuery, Notificaciones } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideShieldX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { subCorto } from '../../shared/casos/caso';
import { RevisionesEmergenciaApi } from '../../shared/privacidad/revisiones-emergencia-api.service';
import { CampoRevision, erroresDeRevision, OBSERVACIONES_MAX } from './revision';

const CONCLUSIONES: readonly {
  valor: ConclusionRevisionEmergencia;
  etiqueta: string;
  descripcion: string;
  icono: string;
  clases: string;
}[] = [
  {
    valor: 'JUSTIFICADO',
    etiqueta: 'Justificado',
    descripcion: 'Había una urgencia clínica real que justificaba el acceso.',
    icono: 'lucideShieldCheck',
    clases: 'has-checked:ring-success has-checked:bg-success/8 text-success',
  },
  {
    valor: 'INJUSTIFICADO',
    etiqueta: 'Injustificado',
    descripcion: 'El motivo no justifica el acceso. Describe lo encontrado en las observaciones.',
    icono: 'lucideShieldX',
    clases: 'has-checked:ring-destructive has-checked:bg-destructive/8 text-destructive',
  },
];

/**
 * "Cerrar revisión" (plan §7.11): the conclusion (Justificado / Injustificado) and optional
 * observations. A bottom sheet on mobile, a side sheet on desktop. Opens while `revision` is set;
 * emits `cerrada` after the 204, `conflicto` on `Auditoria.RevisionYaCerrada`, `cerrado` on close.
 */
@Component({
  selector: 'app-dialogo-cerrar-revision',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    FechaBogota,
    HlmButton,
    HlmFieldImports,
    HlmSheetImports,
    HlmSpinner,
    HlmTextarea,
  ],
  providers: [provideIcons({ lucideShieldCheck, lucideShieldX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet
      [side]="escritorio() ? 'right' : 'bottom'"
      [state]="revision() ? 'open' : 'closed'"
      (closed)="cerrar()"
    >
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-dvh overflow-y-auto sm:max-w-md">
        @if (revision(); as r) {
          <hlm-sheet-header>
            <h2 hlmSheetTitle>Cerrar revisión</h2>
            <p hlmSheetDescription>
              Acceso de emergencia de
              <code class="font-mono">{{ corto(r.actorId) }}</code> ·
              <halsa-fecha-bogota [valor]="r.ocurridoEn" />
              <span class="block">La conclusión no se puede cambiar después.</span>
            </p>
          </hlm-sheet-header>
          <form
            id="form-cerrar-revision"
            class="space-y-5 px-4"
            [formGroup]="form"
            (ngSubmit)="enviar(r)"
            novalidate
          >
            <div class="space-y-1">
              <p class="text-muted-foreground text-xs font-medium">Motivo registrado</p>
              <p
                class="bg-warning/8 ring-warning/25 rounded-lg p-3 text-sm whitespace-pre-line ring-1 ring-inset"
              >
                {{ r.motivo }}
              </p>
            </div>

            <fieldset [attr.aria-describedby]="conclusionInvalida() ? 'error-conclusion' : null">
              <legend class="mb-2 text-sm font-medium">Conclusión</legend>
              <div class="grid gap-2">
                @for (c of conclusiones; track c.valor) {
                  <label
                    class="ring-border has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-inset has-checked:ring-2"
                    [class]="c.clases"
                  >
                    <input
                      type="radio"
                      class="accent-primary mt-0.5 size-4 shrink-0"
                      formControlName="conclusion"
                      [value]="c.valor"
                      (change)="limpiar('conclusion')"
                    />
                    <span class="min-w-0">
                      <span class="flex items-center gap-1.5 text-sm font-medium">
                        <ng-icon [name]="c.icono" aria-hidden="true" />
                        {{ c.etiqueta }}
                      </span>
                      <span class="text-muted-foreground block text-xs">{{ c.descripcion }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (conclusionInvalida()) {
                <p id="error-conclusion" role="alert" class="text-destructive mt-2 text-sm">
                  {{ errores().conclusion ?? 'Elige la conclusión de la revisión.' }}
                </p>
              }
            </fieldset>

            <hlm-field [forceInvalid]="!!errores().observaciones">
              <label hlmFieldLabel for="revision-observaciones">Observaciones (opcional)</label>
              <textarea
                hlmTextarea
                id="revision-observaciones"
                rows="5"
                formControlName="observaciones"
                [attr.maxlength]="observacionesMax"
                (input)="limpiar('observaciones')"
              ></textarea>
              <p hlmFieldDescription class="flex justify-between gap-2">
                <span>Qué verificaste y con quién. Hasta 2.000 caracteres.</span>
                <span class="tabular-nums" aria-live="polite"
                  >{{ largoObservaciones() }}/{{ observacionesMax }}</span
                >
              </p>
              <hlm-field-error validator="maxlength"
                >Las observaciones admiten como máximo 2.000 caracteres.</hlm-field-error
              >
              @if (errores().observaciones; as e) {
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
            <button hlmBtn type="submit" form="form-cerrar-revision" [disabled]="enviando()">
              @if (enviando()) {
                <hlm-spinner class="size-4" aria-hidden="true" />
              }
              Cerrar revisión
            </button>
          </hlm-sheet-footer>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class DialogoCerrarRevision {
  readonly revision = input<RevisionEmergenciaResponse | null>(null);
  readonly cerrada = output<RevisionEmergenciaResponse>();
  readonly conflicto = output<string>();
  readonly cerrado = output<void>();

  private readonly api = inject(RevisionesEmergenciaApi);
  private readonly notificaciones = inject(Notificaciones);
  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');

  protected readonly conclusiones = CONCLUSIONES;
  protected readonly observacionesMax = OBSERVACIONES_MAX;
  protected readonly corto = subCorto;
  protected readonly form = new FormGroup({
    conclusion: new FormControl<ConclusionRevisionEmergencia | null>(null, Validators.required),
    observaciones: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(OBSERVACIONES_MAX),
    }),
  });
  private readonly valorObservaciones = toSignal(this.form.controls.observaciones.valueChanges, {
    initialValue: '',
  });
  protected readonly largoObservaciones = computed(() => this.valorObservaciones().length);

  protected readonly enviando = signal(false);
  protected readonly errores = signal<Partial<Record<CampoRevision, string>>>({});
  private readonly enviado = signal(false);

  protected conclusionInvalida(): boolean {
    return !!this.errores().conclusion || (this.enviado() && this.form.controls.conclusion.invalid);
  }

  constructor() {
    // A fresh form per review.
    effect(() => {
      if (!this.revision()) return;
      untracked(() => {
        this.form.reset();
        this.errores.set({});
        this.enviado.set(false);
      });
    });
  }

  protected limpiar(campo: CampoRevision): void {
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

  protected async enviar(revision: RevisionEmergenciaResponse): Promise<void> {
    this.enviado.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;
    this.errores.set({});
    this.enviando.set(true);
    const { conclusion, observaciones } = this.form.getRawValue();
    try {
      await firstValueFrom(
        this.api.cerrar(revision.id, {
          conclusion: conclusion!,
          observaciones: observaciones.trim() || null,
        }),
      );
      this.notificaciones.exito(
        'Revisión cerrada',
        conclusion === 'JUSTIFICADO' ? 'Acceso justificado' : 'Acceso injustificado',
      );
      this.enviando.set(false);
      this.cerrada.emit(revision);
    } catch (error) {
      this.enviando.set(false);
      const errores = erroresDeRevision(error);
      if ('conflicto' in errores) this.conflicto.emit(errores.mensaje);
      else this.errores.set(errores);
    }
  }
}
