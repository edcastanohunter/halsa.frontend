import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import type { CasoPacienteResponse } from '@halsa/api-types';
import { MensajeError, mensajeDeError } from '@halsa/core';
import { EstadoError, EstadoVacio } from '@halsa/ui';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { provideIcons } from '@ng-icons/core';
import { lucideFolderOpen } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PacienteApi } from '../../../shared/paciente-api.service';
import { TarjetaCaso } from '../../../shared/tarjeta-caso';

type Fase = 'cargando' | 'listo' | 'error';

/**
 * `/casos` (plan §7.12): every case linked to the patient's document, of any ARL, most recently
 * updated first.
 */
@Component({
  selector: 'app-casos',
  imports: [EstadoError, EstadoVacio, HlmSkeletonImports, TarjetaCaso],
  providers: [provideIcons({ lucideFolderOpen })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">Mis casos</h1>
        <p class="text-muted-foreground">
          Los casos de accidente o enfermedad laboral registrados con tu documento.
        </p>
      </header>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando casos" class="grid gap-3 lg:grid-cols-2">
            @for (i of [1, 2]; track i) {
              <div class="bg-card ring-border space-y-3 rounded-xl p-4 ring-1">
                <hlm-skeleton class="h-4 w-40" />
                <hlm-skeleton class="h-5 w-48" />
                <hlm-skeleton class="h-6 w-56 rounded-full" />
              </div>
            }
          </div>
        }
        @case ('error') {
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar tus casos'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (!casos().length) {
            <halsa-estado-vacio
              icono="lucideFolderOpen"
              titulo="No tienes casos vinculados"
              descripcion="Cuando tu ARL registre un caso con tu documento, lo verás aquí."
            />
          } @else {
            <ul class="grid gap-3 lg:grid-cols-2" data-testid="casos">
              @for (c of casos(); track c.casoId) {
                <li><app-tarjeta-caso [caso]="c" /></li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
})
export class CasosPage implements OnInit {
  private readonly api = inject(PacienteApi);

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly casos = signal<CasoPacienteResponse[]>([]);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.fase.set('cargando');
    try {
      const casos = await firstValueFrom(this.api.misCasos());
      this.casos.set(
        [...casos].sort((a, b) => Date.parse(b.ultimoHitoEn) - Date.parse(a.ultimoHitoEn)),
      );
      this.fase.set('listo');
    } catch (error) {
      this.error.set(mensajeDeError(error));
      this.fase.set('error');
    }
  }
}
