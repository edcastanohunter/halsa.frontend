import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { CodigoActivacionResponse } from '@halsa/api-types';
import { ESTADO_CASO_STAFF_LABELS, getEnumLabel, MensajeError, mensajeDeError } from '@halsa/core';
import { CodigoUnaVez } from '@halsa/ui';
import { HlmAlertDialogImports } from '@halsa/ui/helm/alert-dialog';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleAlert, lucideKeyRound } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { CasosApi } from '../../../shared/casos/casos-api.service';
import { CasoStore } from '../data-access/caso.store';

/** Plan §7.4: the button stays off for these; the server still enforces `Validado`. */
const ESTADOS_SIN_CODIGO = new Set(['Radicado', 'Rechazado']);

/**
 * Portal del paciente tab (plan §7.4). The code lives only in this component's signal while the
 * dialog is open, and is wiped on close: it is shown once and never stored.
 */
@Component({
  selector: 'app-caso-portal-paciente',
  imports: [CodigoUnaVez, HlmAlertDialogImports, HlmButton, HlmCardImports, HlmSpinner, NgIcon],
  providers: [provideIcons({ lucideCircleAlert, lucideKeyRound })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section hlmCard class="max-w-2xl" aria-labelledby="t-portal">
      <div hlmCardHeader>
        <h2 hlmCardTitle id="t-portal">Portal del paciente</h2>
        <p hlmCardDescription>
          Genera un código de un solo uso para que el trabajador vincule su cuenta en el portal.
        </p>
      </div>
      <div hlmCardContent class="space-y-4">
        <ul class="text-muted-foreground list-disc space-y-1 ps-5 text-sm">
          <li>
            Entrégalo al trabajador por un canal seguro; con él podrá ver el avance de su caso.
          </li>
          <li>Se muestra una sola vez. Si se pierde, genera uno nuevo.</li>
        </ul>

        @if (bloqueado()) {
          <p
            class="bg-muted text-muted-foreground flex gap-2 rounded-lg p-3 text-sm"
            data-testid="aviso-estado"
          >
            <ng-icon name="lucideCircleAlert" class="mt-0.5 shrink-0" aria-hidden="true" />
            Un caso en estado «{{ estado() }}» todavía no admite códigos: primero debe validarse.
          </p>
        }

        @if (error(); as e) {
          <p
            role="alert"
            class="bg-destructive/10 text-destructive ring-destructive/25 rounded-lg p-3 text-sm ring-1 ring-inset"
          >
            <span class="font-medium">{{ e.titulo }}.</span> {{ e.mensaje }}
          </p>
        }

        <button
          hlmBtn
          type="button"
          class="w-full sm:w-auto"
          [disabled]="bloqueado() || generando()"
          (click)="generar()"
        >
          @if (generando()) {
            <hlm-spinner class="size-4" aria-hidden="true" />
            Generando…
          } @else {
            <ng-icon name="lucideKeyRound" aria-hidden="true" />
            Generar código
          }
        </button>
      </div>
    </section>

    <!-- An alert dialog: an outside click can't dismiss it (plan §7.4). -->
    <hlm-alert-dialog [state]="codigo() ? 'open' : 'closed'" (closed)="cerrar()">
      <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx" class="sm:max-w-md">
        @if (codigo(); as c) {
          <hlm-alert-dialog-header>
            <h2 hlmAlertDialogTitle>Código de activación</h2>
            <p hlmAlertDialogDescription>
              Compártelo con el trabajador. Lo necesitará para vincular su cuenta.
            </p>
          </hlm-alert-dialog-header>
          <halsa-codigo-una-vez [codigo]="c.codigo" [expiraEn]="c.expiraEn" />
          <hlm-alert-dialog-footer>
            <button hlmBtn variant="outline" type="button" (click)="cerrar()">
              Ya lo guardé, cerrar
            </button>
          </hlm-alert-dialog-footer>
        }
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  `,
})
export class PortalPacientePage {
  private readonly store = inject(CasoStore);
  private readonly api = inject(CasosApi);

  protected readonly estado = computed(() =>
    getEnumLabel(ESTADO_CASO_STAFF_LABELS, this.store.resumen()?.estado),
  );
  protected readonly bloqueado = computed(() =>
    ESTADOS_SIN_CODIGO.has(this.store.resumen()?.estado ?? ''),
  );
  protected readonly generando = signal(false);
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly codigo = signal<CodigoActivacionResponse | null>(null);

  protected async generar(): Promise<void> {
    const casoId = this.store.casoId();
    if (!casoId || this.generando()) return;
    this.error.set(null);
    this.generando.set(true);
    try {
      this.codigo.set(await firstValueFrom(this.api.generarCodigoActivacion(casoId)));
    } catch (error) {
      // `Paciente.CasoNoValidado` and the rest: the server's detail is already Spanish.
      this.error.set(mensajeDeError(error));
    } finally {
      this.generando.set(false);
    }
  }

  protected cerrar(): void {
    this.codigo.set(null);
  }
}
