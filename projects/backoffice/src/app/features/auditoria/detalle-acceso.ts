import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AccesoAuditadoResponse } from '@halsa/api-types';
import { EstadoBadge } from '@halsa/ui/estado-badge';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { injectMediaQuery } from '@halsa/ui/media';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert } from '@ng-icons/lucide';
import { IdentificadorCopiable } from '../../shared/identificador-copiable';
import {
  contextoActor,
  esEmergencia,
  etiquetaAccion,
  etiquetaRecurso,
  nivelVerificacion,
} from './acceso';

/**
 * The detail drawer of one audit row (plan §7.10): every field, the technical ones copyable. A
 * side sheet on desktop, a bottom sheet on mobile. Opens while `acceso` is set.
 */
@Component({
  selector: 'app-detalle-acceso',
  imports: [NgIcon, EstadoBadge, FechaBogota, HlmButton, HlmSheetImports, IdentificadorCopiable],
  providers: [provideIcons({ lucideShieldAlert })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-sheet
      [side]="escritorio() ? 'right' : 'bottom'"
      [state]="acceso() ? 'open' : 'closed'"
      (closed)="cerrado.emit()"
    >
      <hlm-sheet-content *hlmSheetPortal="let ctx" class="max-h-dvh overflow-y-auto sm:max-w-lg">
        @if (acceso(); as a) {
          <hlm-sheet-header>
            <h2 hlmSheetTitle>Detalle del acceso</h2>
            <p hlmSheetDescription>
              {{ accion(a.accion) }} · {{ recurso(a.recursoTipo) }} ·
              <halsa-fecha-bogota [valor]="a.ocurridoEn" />
            </p>
          </hlm-sheet-header>
          <div class="space-y-6 px-4 pb-4">
            <div class="flex flex-wrap gap-2">
              <halsa-estado-badge tipo="resultadoAuditoria" [valor]="a.resultado" />
              @if (emergencia(a)) {
                <span
                  class="bg-warning/12 text-warning ring-warning/30 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset"
                >
                  <ng-icon name="lucideShieldAlert" aria-hidden="true" />
                  Acceso de emergencia
                </span>
              }
            </div>

            @if (a.motivo) {
              <section aria-labelledby="t-motivo" class="space-y-1">
                <h3 id="t-motivo" class="text-muted-foreground text-xs font-medium">
                  Motivo registrado
                </h3>
                <p
                  class="bg-warning/8 ring-warning/25 rounded-lg p-3 text-sm whitespace-pre-line ring-1 ring-inset"
                >
                  {{ a.motivo }}
                </p>
              </section>
            }

            <section aria-labelledby="t-actor" class="space-y-3">
              <h3 id="t-actor" class="text-sm font-semibold">Quién</h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div class="col-span-2 space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Actor</dt>
                  <dd>
                    <app-identificador-copiable [valor]="a.actorId" etiqueta="actor" />
                  </dd>
                </div>
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Tipo y organización</dt>
                  <dd>{{ contexto(a) }}</dd>
                </div>
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Verificación</dt>
                  <dd>{{ nivel(a.acr) }}</dd>
                </div>
                <div class="col-span-2 space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Roles</dt>
                  <dd class="flex flex-wrap gap-1.5">
                    @for (r of a.actorRoles; track r) {
                      <code class="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{{ r }}</code>
                    } @empty {
                      <span class="text-muted-foreground">Sin roles</span>
                    }
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="t-recurso" class="space-y-3">
              <h3 id="t-recurso" class="text-sm font-semibold">Sobre qué</h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Acción</dt>
                  <dd>{{ accion(a.accion) }}</dd>
                </div>
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Recurso</dt>
                  <dd>{{ recurso(a.recursoTipo) }}</dd>
                </div>
                @if (a.recursoId) {
                  <div class="col-span-2 space-y-0.5">
                    <dt class="text-muted-foreground text-xs">Identificador del recurso</dt>
                    <dd>
                      <app-identificador-copiable
                        [valor]="a.recursoId"
                        etiqueta="identificador del recurso"
                      />
                    </dd>
                  </div>
                }
                @if (a.casoMedicoId) {
                  <div class="col-span-2 space-y-0.5">
                    <dt class="text-muted-foreground text-xs">Caso</dt>
                    <dd>
                      <app-identificador-copiable
                        [valor]="a.casoMedicoId"
                        etiqueta="identificador del caso"
                      />
                    </dd>
                  </div>
                }
                @if (a.tenantId) {
                  <div class="col-span-2 space-y-0.5">
                    <dt class="text-muted-foreground text-xs">Tenant del recurso</dt>
                    <dd>{{ a.tenantId }}</dd>
                  </div>
                }
              </dl>
            </section>

            <section aria-labelledby="t-tecnico" class="space-y-3">
              <h3 id="t-tecnico" class="text-sm font-semibold">Datos técnicos</h3>
              <dl class="grid grid-cols-2 gap-3 text-sm">
                <div class="col-span-2 space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Correlación</dt>
                  <dd>
                    <app-identificador-copiable
                      [valor]="a.correlationId"
                      etiqueta="identificador de correlación"
                    />
                  </dd>
                </div>
                <div class="col-span-2 space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Registro de auditoría</dt>
                  <dd>
                    <app-identificador-copiable
                      [valor]="a.id"
                      etiqueta="identificador del registro"
                    />
                  </dd>
                </div>
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Cliente</dt>
                  <dd>
                    @if (a.clientId) {
                      <app-identificador-copiable [valor]="a.clientId" etiqueta="cliente" />
                    } @else {
                      <span class="text-muted-foreground">No registrado</span>
                    }
                  </dd>
                </div>
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground text-xs">IP</dt>
                  <dd>
                    @if (a.ip) {
                      <app-identificador-copiable [valor]="a.ip" etiqueta="IP" />
                    } @else {
                      <span class="text-muted-foreground">No registrada</span>
                    }
                  </dd>
                </div>
                <div class="col-span-2 space-y-0.5">
                  <dt class="text-muted-foreground text-xs">Navegador (user agent)</dt>
                  <dd>
                    @if (a.userAgent) {
                      <app-identificador-copiable [valor]="a.userAgent" etiqueta="user agent" />
                    } @else {
                      <span class="text-muted-foreground">No registrado</span>
                    }
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <hlm-sheet-footer>
            <button hlmBtn variant="outline" type="button" (click)="cerrado.emit()">Cerrar</button>
          </hlm-sheet-footer>
        }
      </hlm-sheet-content>
    </hlm-sheet>
  `,
})
export class DetalleAcceso {
  readonly acceso = input<AccesoAuditadoResponse | null>(null);
  readonly cerrado = output<void>();

  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');
  protected readonly accion = etiquetaAccion;
  protected readonly recurso = etiquetaRecurso;
  protected readonly contexto = contextoActor;
  protected readonly nivel = nivelVerificacion;
  protected readonly emergencia = esEmergencia;
}
