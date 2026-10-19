import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { APP_CONFIG, mensajeDeError } from '@halsa/core';
import { ContenidoReforzado } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmLabel } from '@halsa/ui/helm/label';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { firstValueFrom } from 'rxjs';
import { CASO } from '../../mocks';
import { SesionService } from '../core/sesion/sesion.service';
import { CompuertaReforzada } from '../core/step-up/compuerta-reforzada';

/**
 * Dev-only dummy route for the M3 step-up AC (`/_dev/step-up`, mock configuration): both gates,
 * a draft that must survive the popup, and a clinical read that triggers the reactive 401 flow.
 * Only `dev.routes.ts` references it, and production builds replace that file.
 */
@Component({
  selector: 'app-dev-step-up',
  imports: [
    CompuertaReforzada,
    ContenidoReforzado,
    HlmButton,
    HlmCardImports,
    HlmLabel,
    HlmTextarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <header class="space-y-1">
        <p class="text-primary text-xs font-medium tracking-wide uppercase">Solo desarrollo</p>
        <h1 class="text-2xl font-semibold tracking-tight">Prueba de verificación reforzada</h1>
        <p class="text-muted-foreground text-sm" data-testid="nivel">
          Nivel actual: acr {{ nivel().acr }}
        </p>
      </header>

      <div class="grid gap-2">
        <label hlmLabel for="borrador">Borrador (debe sobrevivir a la verificación)</label>
        <textarea hlmTextarea id="borrador" rows="3" class="w-full"></textarea>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="t-acr2" class="space-y-3">
          <h2 id="t-acr2" class="text-lg font-semibold">Sección clínica (acr 2)</h2>
          <app-compuerta-reforzada [acr]="2">
            <div *halsaContenidoReforzado hlmCard data-testid="contenido-acr2">
              <div hlmCardContent>Contenido clínico de prueba visible con acr 2.</div>
            </div>
          </app-compuerta-reforzada>
        </section>
        <section aria-labelledby="t-dictamen" class="space-y-3">
          <h2 id="t-dictamen" class="text-lg font-semibold">Dictamen (acr 2, 15 minutos)</h2>
          <app-compuerta-reforzada [acr]="2" [maxAgeSeg]="900">
            <div *halsaContenidoReforzado hlmCard data-testid="contenido-dictamen">
              <div hlmCardContent>Contenido de dictamen de prueba.</div>
            </div>
          </app-compuerta-reforzada>
        </section>
      </div>

      <section aria-labelledby="t-reactivo" class="space-y-3">
        <h2 id="t-reactivo" class="text-lg font-semibold">Flujo reactivo (401 con desafío)</h2>
        <button hlmBtn variant="outline" type="button" (click)="leerClinico()">
          Leer registros clínicos sin compuerta
        </button>
        <p class="text-sm" role="status" data-testid="resultado">{{ resultado() }}</p>
      </section>
    </div>
  `,
})
export class DevStepUpPage {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly sesion = inject(SesionService);

  protected readonly nivel = computed(() => this.sesion.sesion() ?? { acr: 0 });
  protected readonly resultado = signal('');

  protected async leerClinico(): Promise<void> {
    this.resultado.set('Consultando…');
    try {
      const registros = await firstValueFrom(
        this.http.get<unknown[]>(
          `${this.config.apiBaseUrl}/v1/casos/${CASO.validado}/registros-clinicos`,
        ),
      );
      this.resultado.set(`Respuesta 200: ${registros.length} registros.`);
    } catch (error) {
      this.resultado.set(`Error: ${mensajeDeError(error).titulo}`);
    }
  }
}
