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
import { Router, RouterLink } from '@angular/router';
import type { PagedList, PlazoResponse } from '@halsa/api-types';
import {
  ESTADO_PLAZO_LABELS,
  EstadoPlazo,
  finDelDiaBogota,
  formatNumero,
  getEnumLabel,
  MensajeError,
  mensajeDeError,
  parsearFechaCalendario,
  REGLA_PLAZO_LABELS,
  ReglaPlazo,
} from '@halsa/core';
import { EstadoError } from '@halsa/ui/estado-error';
import { EstadoVacio } from '@halsa/ui/estado-vacio';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { FechaRelativa } from '@halsa/ui/fecha-relativa';
import { injectAhora } from '@halsa/ui/ahora';
import { injectMediaQuery } from '@halsa/ui/media';
import { SemaforoPlazo } from '@halsa/ui/semaforo-plazo';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmPaginationImports } from '@halsa/ui/helm/pagination';
import { HlmSelectImports } from '@halsa/ui/helm/select';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTableImports } from '@halsa/ui/helm/table';
import { HlmTooltipImports } from '@halsa/ui/helm/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideCalendarClock,
  lucideCircleCheck,
  lucideRotateCw,
  lucideX,
} from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { PermisosService } from '../../../core/permisos/permisos';
import { leerPagina, paginasVisibles } from '../../../shared/paginacion';
import { agruparPlazos } from '../../../shared/plazos/agrupar';
import { DialogoCumplirPlazo, esCumplible } from '../../../shared/plazos/dialogo-cumplir-plazo';
import { PlazosApi } from '../../../shared/plazos/plazos-api.service';
import { TarjetaPlazo } from '../../../shared/plazos/tarjeta-plazo';
import { injectRefrescoAlVolver } from '../../../shared/refresco';

export const TAMANO_PAGINA_PLAZOS = 50;
const TODOS = 'todos';
/** Plan §7.8: the board opens on the open deadlines. */
const ESTADO_POR_DEFECTO: EstadoPlazo = 'ABIERTO';
const ESTADOS: readonly EstadoPlazo[] = ['ABIERTO', 'VENCIDO', 'CUMPLIDO', 'SUSPENDIDO'];
const REGLAS = Object.keys(REGLA_PLAZO_LABELS) as ReglaPlazo[];

type Fase = 'cargando' | 'listo' | 'error';

/**
 * `/plazos` (plan §7.8): the tenant's legal deadlines. Filters live in the URL (`estado`,
 * `regla`, `venceAntesDe` as a Bogotá calendar date, `page`). Grouped cards below `md`, a table
 * sortable by `venceEn` from `md` up.
 */
@Component({
  selector: 'app-plazos-tablero',
  imports: [
    RouterLink,
    NgIcon,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    FechaRelativa,
    SemaforoPlazo,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmPaginationImports,
    HlmSelectImports,
    HlmSkeletonImports,
    HlmSpinner,
    HlmTableImports,
    HlmTooltipImports,
    DialogoCumplirPlazo,
    TarjetaPlazo,
  ],
  providers: [
    provideIcons({
      lucideArrowDown,
      lucideArrowUp,
      lucideCalendarClock,
      lucideCircleCheck,
      lucideRotateCw,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tablero.page.html',
})
export class TableroPlazosPage {
  /** Query params, bound by `withComponentInputBinding()`. */
  readonly estado = input<string>();
  readonly regla = input<string>();
  readonly venceAntesDe = input<string>();
  readonly page = input<string>();

  private readonly api = inject(PlazosApi);
  private readonly router = inject(Router);
  private readonly permisos = inject(PermisosService);
  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');
  private readonly ahora = injectAhora(60_000);

  protected readonly todos = TODOS;
  protected readonly estados = ESTADOS;
  protected readonly reglas = REGLAS;
  protected readonly etiquetaEstado = (e: string) => getEnumLabel(ESTADO_PLAZO_LABELS, e);
  protected readonly etiquetaRegla = (r: string) => getEnumLabel(REGLA_PLAZO_LABELS, r);
  protected readonly etiquetaFiltroEstado = (v: string) =>
    v === TODOS ? 'Todos los estados' : this.etiquetaEstado(v);
  protected readonly etiquetaFiltroRegla = (v: string) =>
    v === TODOS ? 'Todas las reglas' : this.etiquetaRegla(v);

  /** `null` means every state (`?estado=todos`); no param means the default, ABIERTO. */
  protected readonly filtroEstado = computed<EstadoPlazo | null>(() => {
    const e = this.estado();
    if (e === TODOS) return null;
    return (ESTADOS as readonly string[]).includes(e ?? '')
      ? (e as EstadoPlazo)
      : ESTADO_POR_DEFECTO;
  });
  /** Any rule code is accepted: the backend may know rules this frontend doesn't. */
  protected readonly filtroRegla = computed(() => this.regla()?.trim() || null);
  protected readonly filtroFecha = computed(() =>
    parsearFechaCalendario(this.venceAntesDe()) ? this.venceAntesDe()! : null,
  );
  protected readonly pagina = computed(() => leerPagina(this.page()));
  protected readonly hayFiltrosExtra = computed(() => !!this.filtroRegla() || !!this.filtroFecha());

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly items = signal<PlazoResponse[]>([]);
  protected readonly ultima = signal<PagedList<PlazoResponse> | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly ascendente = signal(true);
  protected readonly enCumplimiento = signal<PlazoResponse | null>(null);
  private cargadoEn: number | null = null;
  private peticion: Subscription | undefined;

  protected readonly puedeCumplir = computed(() => this.permisos.puede('plazos:write'));
  protected readonly enlaceCaso = computed(() => this.permisos.puede('casos:read'));
  protected readonly ordenados = computed(() => {
    const lista = [...this.items()].sort((a, b) => Date.parse(a.venceEn) - Date.parse(b.venceEn));
    return this.ascendente() ? lista : lista.reverse();
  });
  protected readonly grupos = computed(() =>
    this.filtroEstado() === 'ABIERTO' ? agruparPlazos(this.ordenados(), this.ahora()) : null,
  );
  protected readonly totalPaginas = computed(() => this.ultima()?.totalPages ?? 0);
  protected readonly entradasPaginacion = computed(() =>
    paginasVisibles(this.pagina(), this.totalPaginas()),
  );
  protected readonly resumenTotal = computed(() => {
    const n = this.ultima()?.totalCount ?? 0;
    return n === 1 ? '1 plazo' : `${formatNumero(n)} plazos`;
  });

  constructor() {
    effect(() => {
      const filtro = {
        estado: this.filtroEstado(),
        regla: this.filtroRegla(),
        venceAntesDe: finDelDiaBogota(this.filtroFecha()),
        page: this.pagina(),
      };
      untracked(() => this.cargar(filtro));
    });
    injectRefrescoAlVolver(
      () => this.cargadoEn,
      () => this.recargar(),
    );
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected cumplible(p: PlazoResponse): boolean {
    return this.puedeCumplir() && esCumplible(p);
  }

  protected filtrar(cambios: Record<string, string | null>): void {
    void this.router.navigate([], {
      queryParams: { ...cambios, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected filtrarEstado(valor: string | null | undefined): void {
    // The default needs no param, so the clean URL keeps meaning "abiertos".
    this.filtrar({ estado: !valor || valor === ESTADO_POR_DEFECTO ? null : valor });
  }

  protected filtrarRegla(valor: string | null | undefined): void {
    this.filtrar({ regla: valor && valor !== TODOS ? valor : null });
  }

  protected filtrarFecha(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.filtrar({ venceAntesDe: parsearFechaCalendario(valor) ? valor : null });
  }

  protected limpiarFiltros(): void {
    this.filtrar({ regla: null, venceAntesDe: null });
  }

  protected recargar(): void {
    this.cargar({
      estado: this.filtroEstado(),
      regla: this.filtroRegla(),
      venceAntesDe: finDelDiaBogota(this.filtroFecha()),
      page: this.pagina(),
    });
  }

  protected alCumplir(): void {
    this.enCumplimiento.set(null);
    this.recargar();
  }

  protected cargarMas(): void {
    const ultima = this.ultima();
    if (!ultima?.hasNextPage || this.cargandoMas()) return;
    this.cargandoMas.set(true);
    this.api
      .listar({
        estado: this.filtroEstado(),
        regla: this.filtroRegla(),
        venceAntesDe: finDelDiaBogota(this.filtroFecha()),
        page: ultima.page + 1,
        pageSize: TAMANO_PAGINA_PLAZOS,
      })
      .subscribe({
        next: (pagina) => {
          this.items.update((actuales) => [...actuales, ...pagina.items]);
          this.ultima.set(pagina);
          this.cargandoMas.set(false);
        },
        error: (error: unknown) => {
          this.cargandoMas.set(false);
          this.error.set(mensajeDeError(error));
        },
      });
  }

  private cargar(filtro: {
    estado: EstadoPlazo | null;
    regla: string | null;
    venceAntesDe: string | null;
    page: number;
  }): void {
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.error.set(null);
    this.peticion = this.api.listar({ ...filtro, pageSize: TAMANO_PAGINA_PLAZOS }).subscribe({
      next: (resultado) => {
        this.items.set(resultado.items);
        this.ultima.set(resultado);
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
