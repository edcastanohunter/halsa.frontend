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
import { RouterLink } from '@angular/router';
import type { RevisionEmergenciaResponse } from '@halsa/api-types';
import { formatNumero, MensajeError, mensajeDeError } from '@halsa/core';
import {
  EstadoBadge,
  EstadoError,
  EstadoVacio,
  FechaBogota,
  FechaRelativa,
  Notificaciones,
} from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmPaginationImports } from '@halsa/ui/helm/pagination';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRotateCw, lucideShieldAlert, lucideShieldCheck } from '@ng-icons/lucide';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { IdentificadorCopiable } from '../../../shared/identificador-copiable';
import { leerPagina, paginasVisibles } from '../../../shared/paginacion';
import { RevisionesEmergenciaApi } from '../../../shared/privacidad/revisiones-emergencia-api.service';
import { VencimientoRevision } from '../../../shared/privacidad/vencimiento-revision';
import { injectRefrescoAlVolver } from '../../../shared/refresco';
import { DialogoCerrarRevision } from '../dialogo-cerrar-revision';
import { leerPestanaRevisiones, PESTANAS_REVISIONES, PestanaRevisiones } from '../revision';

type Fase = 'cargando' | 'listo' | 'error';

/** Closed reviews: server pagination, newest first (the API order). */
export const TAMANO_PAGINA_REVISIONES = 50;

interface Listado {
  items: RevisionEmergenciaResponse[];
  total: number;
  totalPaginas: number;
}

/**
 * `/auditoria/revisiones-emergencia` (plan §7.11): every emergency (break-the-glass) access opens
 * a review the privacy officer must close within 72 h. Pendientes (default) sorted by deadline,
 * soonest first, with the motivo in full; Cerradas (`?estado=cerradas`) paginated.
 */
@Component({
  selector: 'app-revisiones-emergencia',
  imports: [
    RouterLink,
    NgIcon,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    FechaRelativa,
    HlmButton,
    HlmPaginationImports,
    HlmSkeletonImports,
    IdentificadorCopiable,
    VencimientoRevision,
    DialogoCerrarRevision,
  ],
  providers: [provideIcons({ lucideRotateCw, lucideShieldAlert, lucideShieldCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-5">
      <header class="flex items-start justify-between gap-3">
        <div class="min-w-0 space-y-1">
          <h1 class="text-2xl font-semibold tracking-tight">Revisiones de emergencia</h1>
          <p class="text-muted-foreground text-sm">
            Cada acceso de emergencia a una historia clínica exige revisarlo en las 72 horas
            siguientes.
          </p>
        </div>
        <button
          hlmBtn
          variant="outline"
          size="icon"
          type="button"
          aria-label="Actualizar"
          [disabled]="fase() === 'cargando'"
          (click)="cargar()"
        >
          <ng-icon name="lucideRotateCw" aria-hidden="true" />
        </button>
      </header>

      <nav aria-label="Estado de las revisiones" class="border-border flex gap-1 border-b">
        @for (p of pestanas; track p.id) {
          <a
            routerLink="."
            [queryParams]="{ estado: p.id === 'pendientes' ? null : p.id }"
            [attr.aria-current]="p.id === pestana() ? 'page' : null"
            class="text-muted-foreground hover:text-foreground focus-visible:ring-ring aria-[current=page]:text-foreground aria-[current=page]:after:bg-primary relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full focus-visible:ring-2 focus-visible:ring-inset"
          >
            {{ p.etiqueta }}
            @if (p.id === pestana() && listado(); as l) {
              <span
                class="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums"
                [attr.aria-label]="l.total + (l.total === 1 ? ' revisión' : ' revisiones')"
                >{{ total() }}</span
              >
            }
          </a>
        }
      </nav>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando revisiones" class="space-y-3">
            @for (i of [1, 2, 3]; track i) {
              <div class="bg-card ring-border space-y-3 rounded-xl p-4 ring-1">
                <div class="flex justify-between gap-2">
                  <hlm-skeleton class="h-7 w-36 rounded-full" />
                  <hlm-skeleton class="h-6 w-24 rounded-full" />
                </div>
                <hlm-skeleton class="h-12 w-full" />
              </div>
            }
          </div>
        }
        @case ('error') {
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar las revisiones'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (!listado()?.items?.length) {
            <halsa-estado-vacio
              icono="lucideShieldCheck"
              [titulo]="
                pestana() === 'pendientes'
                  ? 'No hay revisiones pendientes'
                  : 'Todavía no hay revisiones cerradas'
              "
              descripcion="Cuando alguien use el acceso de emergencia, su revisión aparece aquí."
            />
          } @else {
            <ul class="space-y-4" data-testid="revisiones">
              @for (r of listado()!.items; track r.id) {
                <li>
                  <article
                    class="bg-card ring-border space-y-4 rounded-xl p-4 ring-1"
                    [attr.aria-label]="'Revisión del acceso de ' + r.actorId"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      @if (r.estado === 'PENDIENTE') {
                        <app-vencimiento-revision [venceEn]="r.venceRevisionEn" />
                      } @else if (r.conclusion) {
                        <halsa-estado-badge tipo="conclusionRevision" [valor]="r.conclusion" />
                      }
                      <halsa-estado-badge
                        tipo="revisionEmergencia"
                        [valor]="r.estado"
                        [vencida]="vencida(r)"
                      />
                    </div>

                    <div class="space-y-1">
                      <p
                        class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                      >
                        <ng-icon name="lucideShieldAlert" class="text-warning" aria-hidden="true" />
                        Motivo registrado
                      </p>
                      <p class="text-base leading-relaxed font-medium whitespace-pre-line">
                        {{ r.motivo }}
                      </p>
                    </div>

                    <dl class="grid gap-3 text-sm sm:grid-cols-3">
                      <div class="space-y-0.5">
                        <dt class="text-muted-foreground text-xs">Quién accedió</dt>
                        <dd>
                          <app-identificador-copiable
                            [valor]="r.actorId"
                            etiqueta="identificador de quien accedió"
                            [corto]="true"
                          />
                        </dd>
                      </div>
                      <div class="space-y-0.5">
                        <dt class="text-muted-foreground text-xs">Caso</dt>
                        <dd>
                          <app-identificador-copiable
                            [valor]="r.casoMedicoId"
                            etiqueta="identificador del caso"
                            [corto]="true"
                          />
                        </dd>
                      </div>
                      <div class="space-y-0.5">
                        <dt class="text-muted-foreground text-xs">Cuándo</dt>
                        <dd>
                          <halsa-fecha-bogota [valor]="r.ocurridoEn" />
                          <span class="text-muted-foreground block text-xs">
                            <halsa-fecha-relativa [valor]="r.ocurridoEn" />
                          </span>
                        </dd>
                      </div>
                      @if (r.estado === 'CERRADA') {
                        <div class="space-y-0.5">
                          <dt class="text-muted-foreground text-xs">Revisada</dt>
                          <dd><halsa-fecha-bogota [valor]="r.revisadoEn" /></dd>
                        </div>
                        @if (r.revisadoPor) {
                          <div class="space-y-0.5 sm:col-span-2">
                            <dt class="text-muted-foreground text-xs">Por</dt>
                            <dd>
                              <app-identificador-copiable
                                [valor]="r.revisadoPor"
                                etiqueta="identificador de quien revisó"
                                [corto]="true"
                              />
                            </dd>
                          </div>
                        }
                        @if (r.observaciones) {
                          <div class="space-y-0.5 sm:col-span-3">
                            <dt class="text-muted-foreground text-xs">Observaciones</dt>
                            <dd class="whitespace-pre-line">{{ r.observaciones }}</dd>
                          </div>
                        }
                      }
                    </dl>

                    @if (r.estado === 'PENDIENTE') {
                      <div class="flex justify-end">
                        <button
                          hlmBtn
                          type="button"
                          class="w-full sm:w-auto"
                          [attr.aria-label]="'Cerrar revisión del acceso de ' + r.actorId"
                          (click)="enCierre.set(r)"
                        >
                          Cerrar revisión
                        </button>
                      </div>
                    }
                  </article>
                </li>
              }
            </ul>

            @if (pestana() === 'cerradas' && totalPaginas() > 1) {
              <nav hlmPagination aria-label="Paginación de revisiones cerradas">
                <ul hlmPaginationContent class="flex-wrap">
                  @if (pagina() > 1) {
                    <li hlmPaginationItem>
                      <hlm-pagination-previous
                        link="."
                        [queryParams]="{ page: pagina() - 1 }"
                        queryParamsHandling="merge"
                      />
                    </li>
                  }
                  @for (entrada of entradasPaginacion(); track $index) {
                    <li hlmPaginationItem>
                      @if (entrada === 'hueco') {
                        <hlm-pagination-ellipsis />
                      } @else {
                        <a
                          hlmPaginationLink
                          link="."
                          [queryParams]="{ page: entrada }"
                          queryParamsHandling="merge"
                          [isActive]="entrada === pagina()"
                          [attr.aria-label]="'Página ' + entrada"
                          >{{ entrada }}</a
                        >
                      }
                    </li>
                  }
                  @if (pagina() < totalPaginas()) {
                    <li hlmPaginationItem>
                      <hlm-pagination-next
                        link="."
                        [queryParams]="{ page: pagina() + 1 }"
                        queryParamsHandling="merge"
                      />
                    </li>
                  }
                </ul>
              </nav>
            }
          }
        }
      }
    </div>

    <app-dialogo-cerrar-revision
      [revision]="enCierre()"
      (cerrada)="alCerrar()"
      (conflicto)="alConflicto($event)"
      (cerrado)="enCierre.set(null)"
    />
  `,
})
export class RevisionesEmergenciaPage {
  /** Query params, bound by `withComponentInputBinding()`. */
  readonly estado = input<string>();
  readonly page = input<string>();

  private readonly api = inject(RevisionesEmergenciaApi);
  private readonly notificaciones = inject(Notificaciones);

  protected readonly pestanas = PESTANAS_REVISIONES;
  protected readonly pestana = computed(() => leerPestanaRevisiones(this.estado()));
  protected readonly pagina = computed(() => leerPagina(this.page()));

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly listado = signal<Listado | null>(null);
  protected readonly enCierre = signal<RevisionEmergenciaResponse | null>(null);
  protected readonly total = computed(() => formatNumero(this.listado()?.total ?? 0));
  protected readonly totalPaginas = computed(() => this.listado()?.totalPaginas ?? 0);
  protected readonly entradasPaginacion = computed(() =>
    paginasVisibles(this.pagina(), this.totalPaginas()),
  );
  private cargadoEn: number | null = null;
  private peticion: Subscription | undefined;

  constructor() {
    effect(() => {
      const pestana = this.pestana();
      const pagina = this.pagina();
      untracked(() => this.cargarDe(pestana, pagina));
    });
    injectRefrescoAlVolver(
      () => this.cargadoEn,
      () => this.cargar(),
    );
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  protected vencida(r: RevisionEmergenciaResponse): boolean {
    return r.estado === 'PENDIENTE' && Date.parse(r.venceRevisionEn) <= Date.now();
  }

  protected cargar(): void {
    this.cargarDe(this.pestana(), this.pagina());
  }

  protected alCerrar(): void {
    this.enCierre.set(null);
    this.cargar();
  }

  /** Plan §7.11: `Auditoria.RevisionYaCerrada` → explain and refresh. */
  protected alConflicto(mensaje: string): void {
    this.enCierre.set(null);
    this.notificaciones.aviso('Otra persona ya cerró esta revisión', mensaje);
    this.cargar();
  }

  private cargarDe(pestana: PestanaRevisiones, pagina: number): void {
    this.peticion?.unsubscribe();
    this.fase.set('cargando');
    this.error.set(null);
    const fuente: Observable<Listado> =
      pestana === 'pendientes'
        ? this.api.pendientes().pipe(map(({ items, total }) => ({ items, total, totalPaginas: 1 })))
        : this.api
            .listar({ estado: 'CERRADA', page: pagina, pageSize: TAMANO_PAGINA_REVISIONES })
            .pipe(
              map((p) => ({ items: p.items, total: p.totalCount, totalPaginas: p.totalPages })),
            );
    this.peticion = fuente.subscribe({
      next: (listado) => {
        this.listado.set(listado);
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
