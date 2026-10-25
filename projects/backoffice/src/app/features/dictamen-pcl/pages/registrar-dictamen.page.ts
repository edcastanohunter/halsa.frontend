import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  formatNumero,
  formatPorcentaje,
  getEnumLabel,
  hoyBogota,
  ORIGEN_LABELS,
  OrigenDictamen,
} from '@halsa/core';
import { CampoPorcentaje } from '@halsa/ui/campo-porcentaje';
import { EditorDiagnosticosCie10 } from '@halsa/ui/editor-diagnosticos-cie10';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmInputGroupImports } from '@halsa/ui/helm/input-group';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCircleCheck,
  lucideInfo,
  lucideTriangleAlert,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { DictamenPclApi } from '../data-access/dictamen-pcl-api.service';
import { DictamenPclStore } from '../data-access/dictamen-pcl.store';
import {
  aRequest,
  CampoDictamen,
  conflictoDictamen,
  crearFormDictamen,
  ErroresDictamen,
  erroresDeDictamen,
  FormDictamen,
  FUNDAMENTOS_MAX,
  FUNDAMENTOS_MIN,
  ORIGENES,
  sumaComponentes,
} from '../formulario';

const DESCRIPCION_ORIGEN: Record<OrigenDictamen, string> = {
  LABORAL: 'Derivado del accidente o la enfermedad laboral.',
  COMUN: 'Sin relación con el trabajo.',
  MIXTO: 'Concurren causas laborales y comunes.',
};

/** What the page can do with the case's current dictamen. */
type Modo = 'nuevo' | 'corregir' | 'ya-existe' | 'no-corregible';

/**
 * `/casos/:casoId/dictamen-pcl/registrar[?corrige=<id>]` (plan §7.7). Behind the 15-minute gate.
 * The form belongs to the store, not to this component: when the window closes the gate
 * destroys this view, and verifying again brings back the same form with everything typed.
 */
@Component({
  selector: 'app-registrar-dictamen',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    CampoPorcentaje,
    EditorDiagnosticosCie10,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmInputGroupImports,
    HlmSpinner,
    HlmTextarea,
  ],
  providers: [
    provideIcons({ lucideArrowLeft, lucideCircleCheck, lucideInfo, lucideTriangleAlert }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registrar-dictamen.page.html',
})
export class RegistrarDictamenPage {
  /** `?corrige=<id>`: the current dictamen, still PENDIENTE. */
  readonly corrige = input<string>();

  protected readonly store = inject(DictamenPclStore);
  private readonly api = inject(DictamenPclApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly notificaciones = inject(Notificaciones);
  private peticion: Subscription | undefined;

  protected readonly origenes = ORIGENES;
  protected readonly descripcionOrigen = DESCRIPCION_ORIGEN;
  protected readonly etiquetaOrigen = (o: string) => getEnumLabel(ORIGEN_LABELS, o);
  protected readonly fundamentosMin = FUNDAMENTOS_MIN;
  protected readonly fundamentosMax = FUNDAMENTOS_MAX;
  protected readonly numero = formatNumero;
  protected readonly porcentaje = formatPorcentaje;
  protected readonly hoy = hoyBogota();

  protected readonly modo = computed<Modo>(() => {
    const actual = this.store.dictamen();
    const corrige = this.corrige();
    if (!corrige) return actual ? 'ya-existe' : 'nuevo';
    return actual?.id === corrige && actual.estadoNotificacion === 'PENDIENTE'
      ? 'corregir'
      : 'no-corregible';
  });

  /** Same draft for the same target: a new one, or a correction of one specific dictamen. */
  protected readonly form = computed<FormDictamen>(() => {
    const corrige = this.corrige();
    const original = untracked(() => this.store.dictamen());
    return this.store.formulario(corrige ? `corrige:${corrige}` : 'nuevo', () =>
      crearFormDictamen(corrige ? original : null),
    );
  });

  protected readonly valor = signal<ReturnType<FormDictamen['getRawValue']> | null>(null);
  protected readonly largoFundamentos = computed(() => this.valor()?.fundamentos.length ?? 0);
  protected readonly conComponentes = computed(() => !!this.valor()?.conComponentes);
  /** The parts against the total, live (plan §7.7); `null` until the three are readable. */
  protected readonly suma = computed(() => {
    this.valor(); // the form isn't a signal: `valor` is what changes with it
    return sumaComponentes(this.form());
  });
  protected readonly descuadre = computed(
    () => !!this.suma() && this.form().hasError('componentesNoSuman'),
  );

  protected readonly errores = signal<ErroresDictamen>({});
  protected readonly enviando = signal(false);
  /** Submitted once: shows the errors of fields that aren't plain inputs (origen). */
  protected readonly enviado = signal(false);
  /** A stale-view 409: the form stays, so nothing typed is lost, but can't be sent again. */
  protected readonly conflicto = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const form = this.form();
      untracked(() => this.valor.set(form.getRawValue()));
      const cambios = form.valueChanges.subscribe(() => {
        this.valor.set(form.getRawValue());
        // A changed form is a new submission: field errors from the last answer no longer apply.
        const { general } = this.errores();
        if (Object.keys(this.errores()).some((k) => k !== 'general')) {
          this.errores.set(general ? { general } : {});
        }
      });
      onCleanup(() => cambios.unsubscribe());
    });
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected error(campo: CampoDictamen): string | null {
    return this.errores()[campo] ?? null;
  }

  protected origenInvalido(): boolean {
    return !!this.error('origen') || (this.enviado() && this.form().controls.origen.invalid);
  }

  protected errorDiagnosticos(): string | null {
    if (this.error('diagnosticos')) return this.error('diagnosticos');
    return this.enviado() && !this.form().controls.diagnosticos.length
      ? 'Agrega al menos un diagnóstico.'
      : null;
  }

  protected guardar(evento?: Event): void {
    evento?.preventDefault();
    const form = this.form();
    const casoId = this.store.casoId();
    if (this.enviando() || this.conflicto() || !casoId) return;
    this.enviado.set(true);
    form.markAllAsTouched();
    if (form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const corrigeA = this.modo() === 'corregir' ? this.corrige() : null;
    this.errores.set({});
    this.enviando.set(true);
    this.peticion?.unsubscribe();
    this.peticion = this.api.registrar(casoId, aRequest(form, corrigeA)).subscribe({
      next: (dictamen) => {
        this.enviando.set(false);
        this.store.registrado(dictamen);
        this.notificaciones.exito(corrigeA ? 'Corrección registrada' : 'Dictamen registrado');
        void this.router.navigate(['..'], { relativeTo: this.ruta });
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        const conflicto = conflictoDictamen(error);
        if (conflicto) {
          this.conflicto.set(conflicto);
          this.store.recargar();
        } else {
          this.errores.set(erroresDeDictamen(error));
        }
        this.enfocarPrimerError();
      },
    });
  }

  /** Cancel drops the draft: leaving on purpose isn't the same as the gate closing. */
  protected cancelar(): void {
    this.store.descartarBorrador();
    void this.router.navigate(['..'], { relativeTo: this.ruta });
  }

  /** Plan §8.6: focus moves to the first invalid field on submit. */
  private enfocarPrimerError(): void {
    setTimeout(() => {
      const primero = document.querySelector<HTMLElement>(
        'app-registrar-dictamen [data-error], app-registrar-dictamen .ng-invalid.ng-touched:is(input, textarea), app-registrar-dictamen [aria-invalid="true"]',
      );
      primero?.focus();
    });
  }
}
