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
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  aBogotaLocal,
  getEnumLabel,
  mensajeDeError,
  MensajeError,
  TIPO_REGISTRO_CLINICO_LABELS,
} from '@halsa/core';
import { EditorDiagnosticosCie10 } from '@halsa/ui/editor-diagnosticos-cie10';
import { EstadoError } from '@halsa/ui/estado-error';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideInfo } from '@ng-icons/lucide';
import { firstValueFrom, map, startWith, Subscription } from 'rxjs';
import { ClinicoApi } from '../data-access/clinico-api.service';
import { HistoriaClinicaStore } from '../data-access/historia-clinica.store';
import {
  aRequest,
  CAMPOS_NOTA,
  CampoNota,
  crearFormRegistro,
  errorDeRegistro,
  prellenar,
  TEXTO_MAX,
  TIPOS_REGISTRABLES,
} from '../formulario';

const ETIQUETAS_NOTA: Record<CampoNota, string> = {
  motivo: 'Motivo',
  anamnesis: 'Anamnesis',
  examenFisico: 'Examen físico',
  analisis: 'Análisis',
  plan: 'Plan',
};

/**
 * New clinical record, or a correction with `?corrige=<registroId>` (plan §7.5). The page sits
 * behind the historia clínica gate, so the form only opens with `acr=2`. Never under emergency
 * access: writes don't accept the motivo.
 */
@Component({
  selector: 'app-nuevo-registro-clinico',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    EditorDiagnosticosCie10,
    EstadoError,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmSkeletonImports,
    HlmSpinner,
    HlmTextarea,
  ],
  providers: [provideIcons({ lucideArrowLeft, lucideInfo })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nuevo-registro.page.html',
})
export class NuevoRegistroPage {
  /** Query param: the record this one corrects. */
  readonly corrige = input<string>();

  private readonly api = inject(ClinicoApi);
  protected readonly store = inject(HistoriaClinicaStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly notificaciones = inject(Notificaciones);
  private peticion: Subscription | undefined;

  protected readonly tipos = TIPOS_REGISTRABLES;
  protected readonly campos = CAMPOS_NOTA;
  protected readonly etiquetas = ETIQUETAS_NOTA;
  protected readonly textoMax = TEXTO_MAX;
  protected readonly etiquetaTipo = (t: string) => getEnumLabel(TIPO_REGISTRO_CLINICO_LABELS, t);

  protected readonly form = crearFormRegistro();
  protected readonly maximo = signal(aBogotaLocal(Date.now()) ?? '');
  /** Live lengths for the counters. */
  protected readonly largos = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => {
        const v = this.form.getRawValue();
        return { ...v.nota, observaciones: v.observaciones } as Record<string, string>;
      }),
      map((v) => Object.fromEntries(Object.entries(v).map(([k, t]) => [k, t.length]))),
    ),
    { requireSync: true },
  );

  protected readonly fase = signal<'listo' | 'cargando-original' | 'error-original'>('listo');
  protected readonly errorOriginal = signal<MensajeError | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly errorFecha = signal<string | null>(null);
  protected readonly errorNota = signal<string | null>(null);
  protected readonly errorDiagnosticos = signal<string | null>(null);
  protected readonly enviado = signal(false);
  protected readonly esCorreccion = computed(() => !!this.corrige());

  constructor() {
    effect(() => {
      const corrige = this.corrige();
      untracked(() => (corrige ? this.cargarOriginal(corrige) : this.fase.set('listo')));
    });
    inject(DestroyRef).onDestroy(() => {
      this.peticion?.unsubscribe();
      // Clinical text never outlives the screen (plan §5.3.4).
      this.form.reset();
    });
  }

  protected notaInvalida(): boolean {
    const nota = this.form.controls.nota;
    return !!this.errorNota() || (nota.hasError('notaVacia') && this.enviado());
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.enviado.set(true);
    this.form.markAllAsTouched();
    this.limpiarErrores();
    if (this.form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    const casoId = this.store.casoId();
    if (!casoId || this.enviando()) return;
    this.enviando.set(true);
    try {
      const creado = await firstValueFrom(
        this.api.registrar(casoId, aRequest(this.form, this.corrige() ?? null)),
      );
      this.notificaciones.exito(
        this.esCorreccion() ? 'Corrección registrada' : 'Registro clínico guardado',
      );
      this.store.recargar();
      await this.router.navigate(['..', creado.registroId], { relativeTo: this.ruta });
    } catch (error) {
      const e = errorDeRegistro(error);
      const destino = {
        atendidoEn: this.errorFecha,
        nota: this.errorNota,
        diagnosticos: this.errorDiagnosticos,
        general: this.errorGeneral,
      }[e.destino];
      destino.set(e.mensaje);
      this.enfocarPrimerError();
    } finally {
      this.enviando.set(false);
    }
  }

  protected cargarOriginal(registroId: string): void {
    const casoId = this.store.casoId();
    if (!casoId) return;
    this.peticion?.unsubscribe();
    this.fase.set('cargando-original');
    this.peticion = this.api.obtener(casoId, registroId, null).subscribe({
      next: (original) => {
        prellenar(this.form, original);
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        this.errorOriginal.set(mensajeDeError(error));
        this.fase.set('error-original');
      },
    });
  }

  private limpiarErrores(): void {
    this.errorGeneral.set(null);
    this.errorFecha.set(null);
    this.errorNota.set(null);
    this.errorDiagnosticos.set(null);
  }

  /** Plan §8.6: focus moves to the first invalid field on submit. */
  private enfocarPrimerError(): void {
    queueMicrotask(() => {
      const primero = document.querySelector<HTMLElement>(
        'app-nuevo-registro-clinico [aria-invalid="true"], app-nuevo-registro-clinico .ng-invalid:is(input, textarea), app-nuevo-registro-clinico [data-error]',
      );
      primero?.focus();
    });
  }
}
