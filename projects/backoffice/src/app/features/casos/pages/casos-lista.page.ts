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
import type { CasoResumenResponse, PagedList } from '@halsa/api-types';
import {
  ESTADO_CASO_STAFF_LABELS,
  EstadoCaso,
  formatNumero,
  formatPorcentaje,
  getEnumLabel,
  MensajeError,
  mensajeDeError,
  TIPO_EVENTO_LABELS,
} from '@halsa/core';
import {
  DocumentoEnmascarado,
  EstadoBadge,
  EstadoError,
  EstadoVacio,
  FechaBogota,
  hlm,
  RadicadoChip,
} from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmPaginationImports } from '@halsa/ui/helm/pagination';
import { HlmSelectImports } from '@halsa/ui/helm/select';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTableImports } from '@halsa/ui/helm/table';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFolderOpen, lucideRotateCw } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { ESTADOS_CASO, esEstadoCaso, separarDocumento } from '../../../shared/casos/caso';
import { CasosApi } from '../../../shared/casos/casos-api.service';
import { leerPagina, paginasVisibles } from '../../../shared/paginacion';
import { injectRefrescoAlVolver } from '../../../shared/refresco';

/** Plan §7.3. */
export const TAMANO_PAGINA_CASOS = 20;
const TODOS = 'todos';

type Fase = 'cargando' | 'listo' | 'error';

/**
 * `/casos` (plan §7.3): filtered by `estado` only (gap G6: no text search), synced to the URL.
 * Cards with "Cargar más" below `md`, a table with numbered pages from `md` up.
 */
@Component({
  selector: 'app-casos-lista',
  imports: [
    RouterLink,
    NgIcon,
    DocumentoEnmascarado,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    RadicadoChip,
    HlmButton,
    HlmPaginationImports,
    HlmSelectImports,
    HlmSkeletonImports,
    HlmSpinner,
    HlmTableImports,
  ],
  providers: [provideIcons({ lucideChevronRight, lucideFolderOpen, lucideRotateCw })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './casos-lista.page.html',
})
export class CasosListaPage {
  /** Query params, bound by `withComponentInputBinding()`. */
  readonly estado = input<string>();
  readonly page = input<string>();

  private readonly api = inject(CasosApi);
  private readonly router = inject(Router);

  protected readonly estados = ESTADOS_CASO;
  protected readonly todos = TODOS;
  protected readonly etiquetaEstado = (e: string) => getEnumLabel(ESTADO_CASO_STAFF_LABELS, e);
  /** The select shows the label before its items render (they live in a portal). */
  protected readonly etiquetaFiltro = (v: string) =>
    v === TODOS ? 'Todos los estados' : this.etiquetaEstado(v);
  protected readonly etiquetaTipo = (t: string) => getEnumLabel(TIPO_EVENTO_LABELS, t);
  protected readonly documento = separarDocumento;
  protected readonly porcentaje = formatPorcentaje;
  protected readonly claseChip = (activo: boolean) =>
    hlm(
      'focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 transition-colors duration-150 outline-none ring-inset focus-visible:ring-2',
      activo
        ? 'bg-primary text-primary-foreground ring-primary'
        : 'bg-card text-foreground ring-border hover:bg-muted',
    );

  protected readonly filtro = computed<EstadoCaso | null>(() => {
    const e = this.estado();
    return esEstadoCaso(e) ? e : null;
  });
  protected readonly pagina = computed(() => leerPagina(this.page()));

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly items = signal<CasoResumenResponse[]>([]);
  /** Last page fetched: on mobile, "Cargar más" appends the next one. */
  protected readonly ultima = signal<PagedList<CasoResumenResponse> | null>(null);
  protected readonly cargandoMas = signal(false);
  private cargadoEn: number | null = null;
  private peticion: Subscription | undefined;

  protected readonly total = computed(() => this.ultima()?.totalCount ?? 0);
  protected readonly totalPaginas = computed(() => this.ultima()?.totalPages ?? 0);
  protected readonly entradasPaginacion = computed(() =>
    paginasVisibles(this.pagina(), this.totalPaginas()),
  );
  protected readonly resumenTotal = computed(() => {
    const n = this.total();
    return n === 1 ? '1 caso' : `${formatNumero(n)} casos`;
  });

  constructor() {
    effect(() => {
      const estado = this.filtro();
      const pagina = this.pagina();
      untracked(() => this.cargar(estado, pagina));
    });
    injectRefrescoAlVolver(
      () => this.cargadoEn,
      () => this.recargar(),
    );
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected recargar(): void {
    this.cargar(this.filtro(), this.pagina());
  }

  protected filtrar(valor: string | null | undefined): void {
    const estado = valor && valor !== TODOS ? valor : null;
    void this.router.navigate([], {
      queryParams: { estado, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected cargarMas(): void {
    const ultima = this.ultima();
    if (!ultima?.hasNextPage || this.cargandoMas()) return;
    this.cargandoMas.set(true);
    this.api
      .listar({ estado: this.filtro(), page: ultima.page + 1, pageSize: TAMANO_PAGINA_CASOS })
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

  private cargar(estado: EstadoCaso | null, pagina: number): void {
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.error.set(null);
    this.peticion = this.api
      .listar({ estado, page: pagina, pageSize: TAMANO_PAGINA_CASOS })
      .subscribe({
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
