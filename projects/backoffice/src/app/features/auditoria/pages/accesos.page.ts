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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { AccesoAuditadoResponse, PagedList } from '@halsa/api-types';
import {
  formatFechaCorta,
  formatNumero,
  getEnumLabel,
  MensajeError,
  mensajeDeError,
  parsearFechaCalendario,
  RESULTADO_AUDITORIA_LABELS,
} from '@halsa/core';
import { EstadoBadge, EstadoError, EstadoVacio, FechaBogota, FechaRelativa } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmPaginationImports } from '@halsa/ui/helm/pagination';
import { HlmSelectImports } from '@halsa/ui/helm/select';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmTableImports } from '@halsa/ui/helm/table';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideRotateCw,
  lucideScrollText,
  lucideShieldAlert,
  lucideSlidersHorizontal,
  lucideX,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { subCorto } from '../../../shared/casos/caso';
import { paginasVisibles } from '../../../shared/paginacion';
import { injectRefrescoAlVolver } from '../../../shared/refresco';
import {
  contextoActor,
  esEmergencia,
  etiquetaAccion,
  etiquetaRecurso,
  nivelVerificacion,
} from '../acceso';
import { AccesosAuditadosApi } from '../data-access/accesos-api.service';
import { DetalleAcceso } from '../detalle-acceso';
import {
  ACCIONES,
  ACTOR_MAX,
  aConsulta,
  aParametrosUrl,
  contarFiltros,
  DIAS_MAXIMOS,
  ErrorRango,
  esUuid,
  FiltroAccesos,
  leerFiltro,
  RESULTADOS,
  validarRango,
} from '../filtros';

type Fase = 'cargando' | 'listo' | 'error';
const TODOS = 'todos';

const MENSAJE_RANGO: Record<ErrorRango, string> = {
  invertido: 'La fecha inicial no puede ser posterior a la final.',
  excedido: `El rango admite como máximo ${DIAS_MAXIMOS} días.`,
};

/**
 * `/auditoria/accesos` (plan §7.10): the tenant's audit log for the privacy officer. Filters live
 * in the URL (`desde`/`hasta` as Bogotá calendar days, default the last 7; `casoId`, `actorId`,
 * `accion`, `resultado`, `page`) and apply with "Aplicar". 50 rows per page, server pagination.
 * No export: `auditoria:export` has no endpoint (gap G8).
 */
@Component({
  selector: 'app-auditoria-accesos',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    FechaRelativa,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmPaginationImports,
    HlmSelectImports,
    HlmSkeletonImports,
    HlmTableImports,
    DetalleAcceso,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideRotateCw,
      lucideScrollText,
      lucideShieldAlert,
      lucideSlidersHorizontal,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accesos.page.html',
})
export class AccesosPage {
  /** Query params, bound by `withComponentInputBinding()`. */
  readonly desde = input<string>();
  readonly hasta = input<string>();
  readonly casoId = input<string>();
  readonly actorId = input<string>();
  readonly accion = input<string>();
  readonly resultado = input<string>();
  readonly page = input<string>();

  private readonly api = inject(AccesosAuditadosApi);
  private readonly router = inject(Router);

  protected readonly todos = TODOS;
  protected readonly acciones = ACCIONES;
  protected readonly resultados = RESULTADOS;
  protected readonly actorMax = ACTOR_MAX;
  protected readonly etiquetaAccion = etiquetaAccion;
  protected readonly etiquetaRecurso = etiquetaRecurso;
  protected readonly contexto = contextoActor;
  protected readonly nivel = nivelVerificacion;
  protected readonly emergencia = esEmergencia;
  protected readonly corto = subCorto;
  protected readonly fechaCorta = formatFechaCorta;
  protected readonly etiquetaFiltroAccion = (v: string) =>
    v === TODOS ? 'Todas las acciones' : etiquetaAccion(v);
  protected readonly etiquetaFiltroResultado = (v: string) =>
    v === TODOS ? 'Todos los resultados' : getEnumLabel(RESULTADO_AUDITORIA_LABELS, v);

  protected readonly filtro = computed<FiltroAccesos>(() =>
    leerFiltro({
      desde: this.desde(),
      hasta: this.hasta(),
      casoId: this.casoId(),
      actorId: this.actorId(),
      accion: this.accion(),
      resultado: this.resultado(),
      page: this.page(),
    }),
  );
  /** A hand-edited URL can carry an invalid range: explained in the form, nothing is fetched. */
  protected readonly errorRangoUrl = computed(() => {
    const f = this.filtro();
    return validarRango(f.desde, f.hasta);
  });
  protected readonly cantidadFiltros = computed(() => contarFiltros(this.filtro()));

  protected readonly form = new FormGroup({
    desde: new FormControl('', { nonNullable: true }),
    hasta: new FormControl('', { nonNullable: true }),
    casoId: new FormControl('', { nonNullable: true }),
    actorId: new FormControl('', { nonNullable: true }),
    accion: new FormControl(TODOS, { nonNullable: true }),
    resultado: new FormControl(TODOS, { nonNullable: true }),
  });
  protected readonly errorRango = signal<string | null>(null);
  protected readonly errorCaso = signal<string | null>(null);
  protected readonly filtrosAbiertos = signal(false);

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly pagina = signal<PagedList<AccesoAuditadoResponse> | null>(null);
  protected readonly seleccionado = signal<AccesoAuditadoResponse | null>(null);
  protected readonly items = computed(() => this.pagina()?.items ?? []);
  protected readonly paginaActual = computed(() => this.filtro().page);
  protected readonly totalPaginas = computed(() => this.pagina()?.totalPages ?? 0);
  protected readonly entradasPaginacion = computed(() =>
    paginasVisibles(this.paginaActual(), this.totalPaginas()),
  );
  protected readonly resumenTotal = computed(() => {
    const n = this.pagina()?.totalCount ?? 0;
    return n === 1 ? '1 acceso' : `${formatNumero(n)} accesos`;
  });
  private cargadoEn: number | null = null;
  private peticion: Subscription | undefined;

  constructor() {
    // The form follows the URL (first load, "Atrás", a pagination link), never the reverse.
    effect(() => {
      const f = this.filtro();
      const errorUrl = this.errorRangoUrl();
      untracked(() => {
        this.form.reset({
          desde: f.desde,
          hasta: f.hasta,
          casoId: f.casoId ?? '',
          actorId: f.actorId ?? '',
          accion: f.accion ?? TODOS,
          resultado: f.resultado ?? TODOS,
        });
        this.errorRango.set(errorUrl ? MENSAJE_RANGO[errorUrl] : null);
        this.errorCaso.set(null);
        if (errorUrl) {
          this.peticion?.unsubscribe();
          this.filtrosAbiertos.set(true);
          this.fase.set('listo');
          this.pagina.set(null);
          return;
        }
        this.cargar(f);
      });
    });
    injectRefrescoAlVolver(
      () => this.cargadoEn,
      () => this.recargar(),
    );
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected aplicar(): void {
    const v = this.form.getRawValue();
    const desde = parsearFechaCalendario(v.desde) ? v.desde : null;
    const hasta = parsearFechaCalendario(v.hasta) ? v.hasta : null;
    const rango = desde && hasta ? validarRango(desde, hasta) : null;
    this.errorRango.set(
      !desde || !hasta ? 'Indica las dos fechas del rango.' : rango ? MENSAJE_RANGO[rango] : null,
    );
    const caso = v.casoId.trim();
    this.errorCaso.set(
      caso && !esUuid(caso)
        ? 'El identificador del caso tiene el formato 0199a000-0000-7000-8000-00000000a002.'
        : null,
    );
    if (this.errorRango() || this.errorCaso()) return;
    this.filtrosAbiertos.set(false);
    void this.router.navigate([], {
      queryParams: aParametrosUrl({
        desde: desde!,
        hasta: hasta!,
        casoId: caso ? caso.toLowerCase() : null,
        actorId: v.actorId.trim() || null,
        accion: v.accion === TODOS ? null : (v.accion as FiltroAccesos['accion']),
        resultado: v.resultado === TODOS ? null : (v.resultado as FiltroAccesos['resultado']),
      }),
    });
  }

  protected limpiar(): void {
    this.filtrosAbiertos.set(false);
    void this.router.navigate([], { queryParams: {} });
  }

  protected recargar(): void {
    if (!this.errorRangoUrl()) this.cargar(this.filtro());
  }

  private cargar(f: FiltroAccesos): void {
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.error.set(null);
    this.peticion = this.api.listar(aConsulta(f)).subscribe({
      next: (pagina) => {
        this.pagina.set(pagina);
        this.cargadoEn = Date.now();
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeError(error));
        this.fase.set('error');
      },
    });
  }
}
