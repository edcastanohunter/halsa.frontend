import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DictamenPclResponse } from '@halsa/api-types';
import {
  formatFechaCorta,
  formatFechaLarga,
  formatPorcentaje,
  getEnumLabel,
  ORIGEN_LABELS,
} from '@halsa/core';
import { DocumentoEnmascarado, EstadoBadge, EstadoVacio, Notificaciones } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideFilePen,
  lucideFilePlus2,
  lucideFileText,
  lucideHourglass,
  lucideInfo,
  lucideSend,
} from '@ng-icons/lucide';
import { PermisosService } from '../../../core/permisos/permisos';
import { DictamenPclStore } from '../data-access/dictamen-pcl.store';
import { diasParaControversia, etapasNotificacion, FaseEtapa } from '../formulario';
import { DialogoNotificarDictamen } from './dialogo-notificar';

/**
 * The current dictamen (plan §7.7): the figure, the notification stepper and the clinical
 * rationale. "Corregir" and "Registrar notificación" only while PENDIENTE, with
 * `pcl:dictamen:write`, and never during an emergency access.
 */
@Component({
  selector: 'app-vista-dictamen',
  imports: [
    RouterLink,
    NgIcon,
    DialogoNotificarDictamen,
    DocumentoEnmascarado,
    EstadoBadge,
    EstadoVacio,
    HlmButton,
  ],
  providers: [
    provideIcons({
      lucideCheck,
      lucideFilePen,
      lucideFilePlus2,
      lucideFileText,
      lucideHourglass,
      lucideInfo,
      lucideSend,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.dictamen(); as d) {
      <article class="space-y-6" data-testid="dictamen">
        @if (d.corrigeA) {
          <p class="bg-info/10 flex gap-2 rounded-lg p-3 text-sm" data-testid="aviso-correccion">
            <ng-icon name="lucideInfo" class="text-info mt-0.5 shrink-0" aria-hidden="true" />
            Este dictamen corrige uno anterior que no llegó a notificarse.
          </p>
        }

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div class="min-w-0 space-y-6">
            <section aria-labelledby="dictamen-cifra" class="space-y-4">
              <div>
                <h3 id="dictamen-cifra" class="text-muted-foreground text-sm font-medium">
                  Pérdida de capacidad laboral
                </h3>
                <p
                  class="text-5xl font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-6xl"
                  data-testid="porcentaje"
                >
                  {{ porcentaje(d.porcentajePcl) }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="bg-muted text-foreground ring-border inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset"
                  data-testid="origen"
                  >Origen {{ origen(d.origen) }}</span
                >
                <halsa-estado-badge tipo="dictamen" [valor]="d.estadoNotificacion" />
              </div>
              <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt class="text-muted-foreground">Estructuración</dt>
                  <dd class="font-medium">{{ fecha(d.fechaEstructuracion) }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Fecha del dictamen</dt>
                  <dd class="font-medium">{{ fecha(d.fechaDictamen) }}</dd>
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <dt class="text-muted-foreground">Manual</dt>
                  <dd class="font-medium">{{ d.manual }}</dd>
                </div>
              </dl>
            </section>
            @if (componentes(); as c) {
              <section aria-labelledby="dictamen-componentes" class="space-y-3">
                <h3 id="dictamen-componentes" class="text-sm font-semibold">Componentes</h3>
                <div
                  class="bg-muted h-3 overflow-hidden rounded-full"
                  role="img"
                  [attr.aria-label]="
                    'Deficiencias ' +
                    porcentaje(c.deficiencias) +
                    ' más rol laboral y otras áreas ' +
                    porcentaje(c.rol) +
                    ': total ' +
                    porcentaje(d.porcentajePcl)
                  "
                  data-testid="barra-componentes"
                >
                  <div class="flex h-full gap-0.5" [style.width.%]="anchoBarra(d.porcentajePcl)">
                    <span
                      class="bg-primary h-full min-w-0.5"
                      [style.flex-grow]="c.deficiencias"
                    ></span>
                    <span class="bg-info h-full min-w-0.5" [style.flex-grow]="c.rol"></span>
                  </div>
                </div>
                <dl class="grid gap-2 text-sm sm:grid-cols-3">
                  <div class="flex items-center gap-2">
                    <span class="bg-primary size-2.5 shrink-0 rounded-sm" aria-hidden="true"></span>
                    <dt class="text-muted-foreground">Deficiencias</dt>
                    <dd class="ms-auto font-medium tabular-nums sm:ms-0">
                      {{ porcentaje(c.deficiencias) }}
                    </dd>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="bg-info size-2.5 shrink-0 rounded-sm" aria-hidden="true"></span>
                    <dt class="text-muted-foreground">Rol laboral y otras áreas</dt>
                    <dd class="ms-auto font-medium tabular-nums sm:ms-0">
                      {{ porcentaje(c.rol) }}
                    </dd>
                  </div>
                  <div class="flex items-center gap-2">
                    <dt class="text-muted-foreground">Total</dt>
                    <dd class="ms-auto font-semibold tabular-nums sm:ms-0">
                      {{ porcentaje(d.porcentajePcl) }}
                    </dd>
                  </div>
                </dl>
              </section>
            }
          </div>

          <section
            aria-labelledby="dictamen-notificacion"
            class="bg-muted/40 ring-border space-y-4 rounded-xl p-4 ring-1"
          >
            <h3 id="dictamen-notificacion" class="text-sm font-semibold">Notificación</h3>
            <ol class="space-y-3" data-testid="etapas">
              @for (e of etapas(); track e.estado) {
                <li
                  class="flex items-center gap-3 text-sm"
                  [attr.aria-current]="e.fase === 'actual' ? 'step' : null"
                  [attr.data-fase]="e.fase"
                >
                  <span
                    class="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    [class]="claseEtapa(e.fase, e.opcional)"
                    aria-hidden="true"
                  >
                    @if (e.fase === 'hecha') {
                      <ng-icon name="lucideCheck" />
                    } @else {
                      {{ $index + 1 }}
                    }
                  </span>
                  <span [class]="claseEtiqueta(e.fase)">
                    {{ e.opcional ? '(' + e.etiqueta + ')' : e.etiqueta }}
                    <span class="sr-only">{{ textoFase[e.fase] }}</span>
                  </span>
                </li>
              }
            </ol>

            @if (d.estadoNotificacion === 'NOTIFICADO') {
              <div class="border-border border-t pt-3 text-sm" data-testid="controversia">
                @if (d.venceControversiaEn; as vence) {
                  <p class="flex items-start gap-2">
                    <ng-icon
                      name="lucideHourglass"
                      class="text-warning mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      <span class="font-medium">{{ plazoControversia() }}</span>
                      <span class="text-muted-foreground block"
                        >Último día para controvertir: {{ fechaLarga(vence) }}</span
                      >
                    </span>
                  </p>
                } @else {
                  <p class="text-muted-foreground">
                    El plazo para controvertir aún no está disponible. Aparece aquí en cuanto se
                    calcule.
                  </p>
                }
              </div>
            }

            @if (puedeEscribir() && d.estadoNotificacion === 'PENDIENTE') {
              <div class="border-border flex flex-col gap-2 border-t pt-3 sm:flex-row lg:flex-col">
                <button hlmBtn type="button" (click)="notificando.set(d)">
                  <ng-icon name="lucideSend" aria-hidden="true" />
                  Registrar notificación
                </button>
                <a
                  hlmBtn
                  variant="outline"
                  routerLink="registrar"
                  [queryParams]="{ corrige: d.id }"
                >
                  <ng-icon name="lucideFilePen" aria-hidden="true" />
                  Corregir dictamen
                </a>
              </div>
            }
          </section>
        </div>

        <section aria-labelledby="dictamen-diagnosticos" class="space-y-2">
          <h3 id="dictamen-diagnosticos" class="text-sm font-semibold">Diagnósticos</h3>
          <ul class="flex flex-wrap gap-2">
            @for (dx of d.diagnosticos; track $index) {
              <li
                class="bg-muted ring-border inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm ring-1 ring-inset"
              >
                <span class="text-muted-foreground text-xs">{{ dx.sistema }}</span>
                <span class="font-mono font-medium">{{ dx.codigo }}</span>
              </li>
            }
          </ul>
        </section>

        <section aria-labelledby="dictamen-calificador" class="space-y-2">
          <h3 id="dictamen-calificador" class="text-sm font-semibold">Calificador</h3>
          <dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-muted-foreground">Nombre</dt>
              <dd class="font-medium">
                {{ d.calificador.nombreCompleto || 'Sin nombre registrado' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Documento</dt>
              <dd>
                <halsa-documento-enmascarado
                  [tipo]="d.calificador.identificacion.tipo"
                  [numero]="d.calificador.identificacion.numero"
                />
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Registro RETHUS</dt>
              <dd class="font-mono">{{ d.calificador.registroRethus }}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="dictamen-fundamentos" class="space-y-2">
          <h3 id="dictamen-fundamentos" class="text-sm font-semibold">Fundamentos</h3>
          <div
            class="bg-muted/30 ring-border max-w-prose rounded-lg p-4 text-sm leading-relaxed break-words whitespace-pre-wrap ring-1"
            data-testid="fundamentos"
            [textContent]="d.fundamentos"
          ></div>
        </section>
      </article>

      <app-dialogo-notificar-dictamen
        [dictamen]="notificando()"
        (notificado)="alNotificar()"
        (conflicto)="alConflicto($event)"
        (cerrado)="notificando.set(null)"
      />
    } @else {
      <halsa-estado-vacio
        icono="lucideFileText"
        titulo="Aún no hay dictamen registrado"
        descripcion="Cuando se califique la pérdida de capacidad laboral del caso, el dictamen aparecerá aquí."
      >
        @if (puedeEscribir()) {
          <a hlmBtn routerLink="registrar">
            <ng-icon name="lucideFilePlus2" aria-hidden="true" />
            Registrar dictamen
          </a>
        }
      </halsa-estado-vacio>
    }
  `,
})
export class VistaDictamenPage {
  protected readonly store = inject(DictamenPclStore);
  private readonly permisos = inject(PermisosService);
  private readonly notificaciones = inject(Notificaciones);

  protected readonly porcentaje = formatPorcentaje;
  protected readonly fecha = formatFechaCorta;
  protected readonly fechaLarga = formatFechaLarga;
  protected readonly origen = (o: string) => getEnumLabel(ORIGEN_LABELS, o).toLowerCase();
  protected readonly textoFase = {
    hecha: '(completado)',
    actual: '(estado actual)',
    pendiente: '(pendiente)',
    omitida: '(no hubo controversia)',
  } as const;

  protected readonly notificando = signal<DictamenPclResponse | null>(null);

  /** Writes never happen during an emergency access (plan §5.1.5). */
  protected readonly puedeEscribir = computed(
    () => this.permisos.puede('pcl:dictamen:write') && !this.store.emergenciaActiva(),
  );
  protected readonly etapas = computed(() =>
    etapasNotificacion(this.store.dictamen()?.estadoNotificacion ?? 'PENDIENTE'),
  );
  protected readonly componentes = computed(() => {
    const c = this.store.dictamen()?.componentes;
    if (typeof c?.deficiencias !== 'number' || typeof c.rolLaboralYOtrasAreas !== 'number') {
      return null;
    }
    return { deficiencias: c.deficiencias, rol: c.rolLaboralYOtrasAreas };
  });
  protected readonly plazoControversia = computed(() => {
    const dias = diasParaControversia(this.store.dictamen()?.venceControversiaEn);
    if (dias === null) return '';
    if (dias < 0) return 'Venció el plazo para controvertir';
    if (dias === 0) return 'El plazo para controvertir vence hoy';
    return dias === 1 ? 'Queda 1 día para controvertir' : `Quedan ${dias} días para controvertir`;
  });

  /** The 0–100 track: tiny percentages still show a sliver. */
  protected anchoBarra(total: number): number {
    return Math.min(100, Math.max(1, total));
  }

  protected claseEtapa(fase: FaseEtapa, opcional: boolean): string {
    if (fase === 'hecha') return 'bg-success text-success-foreground';
    if (fase === 'actual') return 'bg-primary text-primary-foreground';
    return opcional
      ? 'text-muted-foreground border-border border border-dashed'
      : 'text-muted-foreground border-border border';
  }

  protected claseEtiqueta(fase: FaseEtapa): string {
    if (fase === 'actual') return 'font-semibold';
    return fase === 'hecha' ? '' : 'text-muted-foreground';
  }

  protected alNotificar(): void {
    this.notificando.set(null);
    this.store.recargar();
  }

  protected alConflicto(mensaje: string): void {
    this.notificando.set(null);
    this.notificaciones.aviso('El dictamen cambió', mensaje);
    this.store.recargar();
  }
}
