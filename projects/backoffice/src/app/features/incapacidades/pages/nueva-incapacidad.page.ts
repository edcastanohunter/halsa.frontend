import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpEventType } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AlertaIncapacidad, IncapacidadResponse } from '@halsa/api-types';
import {
  ALERTA_INCAPACIDAD_LABELS,
  ClaveIdempotencia,
  formatFechaCorta,
  formatNumero,
  formatTamanoArchivo,
  getEnumLabel,
  hoyBogota,
  MODALIDAD_INCAPACIDAD_LABELS,
  TIPO_INCAPACIDAD_LABELS,
} from '@halsa/core';
import { ContenidoReforzado } from '@halsa/ui/verificacion-reforzada';
import { EditorDiagnosticosCie10 } from '@halsa/ui/editor-diagnosticos-cie10';
import { injectMediaQuery } from '@halsa/ui/media';
import { SubidaPdf } from '@halsa/ui/subida-pdf';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmProgressImports } from '@halsa/ui/helm/progress';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCircleCheck,
  lucideMinus,
  lucidePlus,
  lucideTriangleAlert,
  lucideWifiOff,
} from '@ng-icons/lucide';
import { map, startWith, Subscription } from 'rxjs';
import { SesionService } from '../../../core/sesion/sesion.service';
import { CompuertaReforzada } from '../../../core/step-up/compuerta-reforzada';
import { IncapacidadesApi } from '../data-access/incapacidades-api.service';
import { IncapacidadesStore } from '../data-access/incapacidades.store';
import {
  aRequest,
  CampoCarga,
  controlesDelPaso,
  crearFormIncapacidad,
  DIAGNOSTICOS_MAX,
  DIAS_MAX,
  DIAS_MIN,
  ErroresCarga,
  erroresDeCarga,
  esFalloDeRed,
  fechaFinDe,
  NUMERO_CERTIFICADO_MAX,
  OBSERVACIONES_MAX,
  Paso,
  PASO_DEL_CAMPO,
  PASO_ETIQUETAS,
  PASOS,
} from '../formulario';

/**
 * The upload form (plan §7.6). Only instantiated behind the `acr=2` gate. A stepper on mobile,
 * one page on desktop. Each submission of a given form state carries one `Idempotency-Key`,
 * reused when the user retries after a network failure (plan §5.3.7).
 */
@Component({
  selector: 'app-formulario-incapacidad',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    EditorDiagnosticosCie10,
    SubidaPdf,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmProgressImports,
    HlmSheetImports,
    HlmSpinner,
    HlmTextarea,
  ],
  providers: [
    provideIcons({
      lucideCircleCheck,
      lucideMinus,
      lucidePlus,
      lucideTriangleAlert,
      lucideWifiOff,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nueva-incapacidad.page.html',
})
export class FormularioIncapacidad {
  private readonly api = inject(IncapacidadesApi);
  protected readonly store = inject(IncapacidadesStore);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly sesion = inject(SesionService).sesion;
  private peticion: Subscription | undefined;
  private readonly claves = new ClaveIdempotencia();

  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');
  protected readonly pasos = PASOS;
  protected readonly etiquetasPaso = PASO_ETIQUETAS;
  protected readonly diasMin = DIAS_MIN;
  protected readonly diasMax = DIAS_MAX;
  protected readonly numeroMax = NUMERO_CERTIFICADO_MAX;
  protected readonly observacionesMax = OBSERVACIONES_MAX;
  protected readonly diagnosticosMax = DIAGNOSTICOS_MAX;
  protected readonly hoy = hoyBogota();
  protected readonly tipos = ['INICIAL', 'PRORROGA'] as const;
  protected readonly modalidades = ['PRESENCIAL', 'TELEMEDICINA'] as const;
  protected readonly etiquetaTipo = (t: string) => getEnumLabel(TIPO_INCAPACIDAD_LABELS, t);
  protected readonly etiquetaModalidad = (m: string) =>
    getEnumLabel(MODALIDAD_INCAPACIDAD_LABELS, m);
  protected readonly fecha = formatFechaCorta;
  protected readonly tamano = formatTamanoArchivo;

  /** IPS actors sign as their own IPS: prefill its REPS code (plan §7.6 step 3). */
  protected readonly form = crearFormIncapacidad(
    this.sesion()?.actorTipo === 'ips' ? (this.sesion()?.ipsId ?? '') : '',
  );
  protected readonly valor = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  protected readonly paso = signal<Paso>('certificado');
  protected readonly indicePaso = computed(() => PASOS.indexOf(this.paso()));
  protected readonly errores = signal<ErroresCarga>({});
  protected readonly enviando = signal(false);
  /** 0–100 while the browser reports it; `null` when the total is unknown (indeterminate). */
  protected readonly progreso = signal<number | null>(null);
  protected readonly falloRed = signal(false);
  protected readonly creada = signal<IncapacidadResponse | null>(null);
  /** The key of the last attempt, exposed for the retry notice and tests. */
  readonly ultimaClave = signal<string | null>(null);

  protected readonly esProrroga = computed(() => this.valor().certificado.tipo === 'PRORROGA');
  protected readonly fechaFin = computed(() => {
    const c = this.valor().certificado;
    return fechaFinDe(c.fechaInicio, c.dias);
  });
  protected readonly prorrogaElegida = computed(() =>
    this.store.prorrogables().find((i) => i.id === this.valor().certificado.prorrogaDe),
  );

  constructor() {
    // A changed form is a new submission: field errors from the last answer no longer apply.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const { general } = this.errores();
      if (Object.keys(this.errores()).some((k) => k !== 'general')) {
        this.errores.set(general ? { general } : {});
      }
    });
    // A prórroga starts from the last chain by default.
    this.form.controls.certificado.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((tipo) => {
        const prorrogaDe = this.form.controls.certificado.controls.prorrogaDe;
        if (tipo === 'INICIAL') prorrogaDe.setValue('');
        else if (!prorrogaDe.value) prorrogaDe.setValue(this.store.prorrogables()[0]?.id ?? '');
      });
    inject(DestroyRef).onDestroy(() => {
      this.peticion?.unsubscribe();
      // The diagnoses and the PDF never outlive the screen (plan §5.3.4).
      this.form.reset();
    });
  }

  protected cambiarDias(delta: number): void {
    const control = this.form.controls.certificado.controls.dias;
    const actual = Number(control.value) || 0;
    control.setValue(Math.min(DIAS_MAX, Math.max(DIAS_MIN, actual + delta)));
    control.markAsTouched();
  }

  protected alElegirSoporte(archivo: File | null): void {
    this.form.controls.soporte.setValue(archivo);
    this.form.controls.soporte.markAsTouched();
  }

  protected error(campo: CampoCarga): string | null {
    return this.errores()[campo] ?? null;
  }

  protected errorDiagnosticos(): string | null {
    return this.error('diagnosticoPrincipal') ?? this.error('diagnosticosRelacionados');
  }

  /** Desktop shows every section; the mobile stepper only the current one. */
  protected enPaso(paso: Paso): boolean {
    return this.escritorio() || this.paso() === paso;
  }

  protected irA(paso: Paso): void {
    this.paso.set(paso);
    this.enfocarTitulo();
  }

  protected siguiente(): void {
    const controles = controlesDelPaso(this.form, this.paso());
    controles.forEach((c) => c.markAllAsTouched());
    if (controles.some((c) => c.invalid)) {
      this.enfocarPrimerError();
      return;
    }
    const siguiente = PASOS[this.indicePaso() + 1];
    if (siguiente) this.irA(siguiente);
  }

  protected anterior(): void {
    const anterior = PASOS[this.indicePaso() - 1];
    if (anterior) this.irA(anterior);
  }

  protected alerta(a: AlertaIncapacidad): string {
    return getEnumLabel(ALERTA_INCAPACIDAD_LABELS, a.code);
  }

  protected dias(n: number): string {
    return n === 1 ? '1 día' : `${formatNumero(n)} días`;
  }

  protected cargar(evento?: Event): void {
    evento?.preventDefault();
    if (this.enviando()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (!this.escritorio()) {
        const primero = PASOS.find((p) => controlesDelPaso(this.form, p).some((c) => c.invalid));
        if (primero && primero !== 'revision') this.paso.set(primero);
      }
      this.enfocarPrimerError();
      return;
    }
    const casoId = this.store.casoId();
    const soporte = this.form.controls.soporte.value;
    if (!casoId || !soporte) return;

    const datos = aRequest(this.form);
    const clave = this.claves.para(JSON.stringify(datos), soporte);
    this.ultimaClave.set(clave);
    this.errores.set({});
    this.falloRed.set(false);
    this.progreso.set(0);
    this.enviando.set(true);

    this.peticion?.unsubscribe();
    this.peticion = this.api.cargar(casoId, datos, soporte, clave).subscribe({
      next: (evento) => {
        if (evento.type === HttpEventType.UploadProgress) {
          this.progreso.set(evento.total ? Math.round((evento.loaded / evento.total) * 100) : null);
        } else if (evento.type === HttpEventType.Response && evento.body) {
          this.claves.descartar();
          this.enviando.set(false);
          this.progreso.set(100);
          this.store.agregar(evento.body);
          this.creada.set(evento.body);
        }
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.progreso.set(null);
        this.falloRed.set(esFalloDeRed(error));
        const errores = erroresDeCarga(error);
        this.errores.set(errores);
        if (!this.escritorio()) {
          const campo = (Object.keys(errores) as CampoCarga[])[0] ?? 'general';
          this.paso.set(PASO_DEL_CAMPO[campo]);
        }
        this.enfocarPrimerError();
      },
    });
  }

  protected volver(): void {
    if (!this.creada()) return;
    this.creada.set(null);
    void this.router.navigate(['..'], { relativeTo: this.ruta });
  }

  private enfocarTitulo(): void {
    queueMicrotask(() =>
      document.querySelector<HTMLElement>('app-formulario-incapacidad [data-titulo-paso]')?.focus(),
    );
  }

  /** Plan §8.6: focus moves to the first invalid field on submit. */
  private enfocarPrimerError(): void {
    setTimeout(() => {
      const primero = document.querySelector<HTMLElement>(
        'app-formulario-incapacidad [data-error], app-formulario-incapacidad .ng-invalid.ng-touched:is(input, textarea), app-formulario-incapacidad [aria-invalid="true"]',
      );
      primero?.focus();
    });
  }
}

/** `/casos/:casoId/incapacidades/nueva` (plan §7.6): the step-up gate first, then the form. */
@Component({
  selector: 'app-nueva-incapacidad',
  imports: [
    RouterLink,
    NgIcon,
    CompuertaReforzada,
    ContenidoReforzado,
    FormularioIncapacidad,
    HlmButton,
  ],
  providers: [provideIcons({ lucideArrowLeft })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-3xl space-y-4">
      <a hlmBtn variant="ghost" size="sm" class="-ms-2" routerLink="..">
        <ng-icon name="lucideArrowLeft" aria-hidden="true" />
        Incapacidades
      </a>
      <h2 class="text-lg font-semibold">Cargar incapacidad</h2>
      <app-compuerta-reforzada [acr]="2">
        <app-formulario-incapacidad *halsaContenidoReforzado />
      </app-compuerta-reforzada>
    </div>
  `,
})
export class NuevaIncapacidadPage {}
