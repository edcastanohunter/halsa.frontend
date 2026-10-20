import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatPorcentaje, getEnumLabel, TIPO_EVENTO_LABELS } from '@halsa/core';
import { DocumentoEnmascarado, FechaBogota } from '@halsa/ui';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { separarDocumento } from '../../../shared/casos/caso';
import { CasoStore } from '../data-access/caso.store';

/**
 * Resumen tab (plan §7.4): the event, the parties and, once rated, only the PCL percentage. The
 * rationale is clinical and lives in the Dictamen tab.
 */
@Component({
  selector: 'app-caso-resumen',
  imports: [DocumentoEnmascarado, FechaBogota, HlmCardImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.detalle(); as d) {
      <div class="grid gap-4 md:grid-cols-2">
        <section hlmCard aria-labelledby="t-evento">
          <div hlmCardHeader>
            <h2 hlmCardTitle id="t-evento">Evento</h2>
          </div>
          <dl hlmCardContent class="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground">Tipo de evento</dt>
              <dd class="font-medium">{{ tipoEvento() }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Fecha del evento</dt>
              <dd class="font-medium">
                <halsa-fecha-bogota [valor]="d.resumen.fechaEvento" />
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Municipio (código DIVIPOLA)</dt>
              <dd class="font-mono font-medium">{{ d.municipioDivipola }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Grave o mortal</dt>
              <dd class="font-medium" [class.text-destructive]="d.esGraveOMortal">
                {{ d.esGraveOMortal ? 'Sí' : 'No' }}
              </dd>
            </div>
          </dl>
        </section>

        <section hlmCard aria-labelledby="t-partes">
          <div hlmCardHeader>
            <h2 hlmCardTitle id="t-partes">Partes</h2>
          </div>
          <dl hlmCardContent class="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted-foreground">Trabajador</dt>
              <dd>
                <halsa-documento-enmascarado
                  [tipo]="trabajador().tipo ?? undefined"
                  [numero]="trabajador().numero"
                />
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Empleador</dt>
              <dd class="font-mono font-medium">{{ d.empleadorDocumento }}</dd>
            </div>
          </dl>
        </section>

        @if (d.resumen.tieneCalificacion) {
          <section hlmCard aria-labelledby="t-calificacion">
            <div hlmCardHeader>
              <h2 hlmCardTitle id="t-calificacion">Calificación</h2>
              <p hlmCardDescription>Pérdida de capacidad laboral calificada.</p>
            </div>
            <div hlmCardContent>
              <p class="text-clinical text-3xl font-semibold tabular-nums">
                {{ porcentaje() }}
              </p>
            </div>
          </section>
        }
      </div>
    }
  `,
})
export class ResumenPage {
  protected readonly store = inject(CasoStore);

  protected readonly tipoEvento = computed(() =>
    getEnumLabel(TIPO_EVENTO_LABELS, this.store.resumen()?.tipoEvento),
  );
  protected readonly trabajador = computed(() =>
    separarDocumento(this.store.resumen()?.trabajadorDocumento ?? ''),
  );
  protected readonly porcentaje = computed(() =>
    formatPorcentaje(this.store.resumen()?.porcentajePcl),
  );
}
