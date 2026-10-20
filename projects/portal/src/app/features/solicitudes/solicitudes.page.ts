import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SolicitudCopiaHcPacienteResponse } from '@halsa/api-types';
import {
  formatFechaDiaBogota,
  getEnumLabel,
  MEDIO_ENTREGA_LABELS,
  MensajeError,
  mensajeDeError,
} from '@halsa/core';
import { EstadoError, EstadoVacio } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideFileText, lucideX } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PacienteApi } from '../../shared/paciente-api.service';
import { estaCerrada, PasoSolicitud, pasosDe } from './pasos';

type Fase = 'cargando' | 'listo' | 'error';

interface SolicitudVista extends SolicitudCopiaHcPacienteResponse {
  radicado: string | null;
  pasos: PasoSolicitud[];
  cerrada: boolean;
}

/**
 * `/solicitudes` (plan §7.12): the patient's clinical-record copy requests, newest first, each
 * with its stepper and, once closed, the ARL's note.
 */
@Component({
  selector: 'app-solicitudes',
  imports: [RouterLink, NgIcon, EstadoError, EstadoVacio, HlmButton, HlmSkeletonImports],
  providers: [provideIcons({ lucideCheck, lucideFileText, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">Mis solicitudes</h1>
        <p class="text-muted-foreground">
          Tus solicitudes de copia de historia clínica. Tu ARL tiene 10 días hábiles para entregarte
          cada copia.
        </p>
      </header>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando solicitudes" class="grid gap-4 lg:grid-cols-2">
            @for (i of [1, 2]; track i) {
              <hlm-skeleton class="h-44 w-full rounded-xl" />
            }
          </div>
        }
        @case ('error') {
          <halsa-estado-error
            [titulo]="error()?.titulo ?? 'No pudimos cargar tus solicitudes'"
            [mensaje]="error()?.mensaje"
            [traza]="error()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          @if (!solicitudes().length) {
            <halsa-estado-vacio
              icono="lucideFileText"
              titulo="No has solicitado copias de tu historia clínica"
              descripcion="Puedes pedirla desde el detalle de cada caso."
            >
              <a hlmBtn variant="outline" routerLink="/casos">Ver mis casos</a>
            </halsa-estado-vacio>
          } @else {
            <ul class="grid gap-4 lg:grid-cols-2" data-testid="solicitudes">
              @for (s of solicitudes(); track s.id) {
                <li>
                  <article
                    class="bg-card ring-border flex h-full flex-col gap-4 rounded-xl p-4 ring-1 lg:p-5"
                    [attr.aria-labelledby]="'solicitud-' + s.id"
                  >
                    <div class="space-y-1">
                      <h2 [id]="'solicitud-' + s.id" class="text-base font-semibold">
                        Copia de historia clínica
                        @if (s.radicado) {
                          <span class="text-muted-foreground font-mono text-sm font-medium">
                            · {{ s.radicado }}</span
                          >
                        }
                      </h2>
                      <p class="text-muted-foreground text-sm">
                        Solicitada el {{ dia(s.solicitadaEn) }} ·
                        {{ medio(s.medioEntrega) }}
                        @if (s.direccionOCorreo) {
                          <span class="text-foreground break-words"
                            >({{ s.direccionOCorreo }})</span
                          >
                        }
                      </p>
                    </div>

                    <ol class="flex items-start" aria-label="Estado de la solicitud">
                      @for (p of s.pasos; track $index; let ultimo = $last) {
                        <li
                          class="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
                          [attr.aria-current]="p.estado === 'actual' ? 'step' : null"
                        >
                          @if (!ultimo) {
                            <span
                              class="absolute top-4 left-1/2 h-0.5 w-full"
                              [class]="p.estado === 'hecho' ? 'bg-primary' : 'bg-border'"
                              aria-hidden="true"
                            ></span>
                          }
                          <span
                            class="relative inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold ring-2"
                            [class]="claseMarca(p)"
                            aria-hidden="true"
                          >
                            @if (p.resultado === 'rechazada') {
                              <ng-icon name="lucideX" />
                            } @else if (p.estado === 'hecho' || p.resultado === 'entregada') {
                              <ng-icon name="lucideCheck" />
                            } @else {
                              {{ $index + 1 }}
                            }
                          </span>
                          <span
                            class="px-1 text-xs leading-tight"
                            [class]="
                              p.estado === 'pendiente' ? 'text-muted-foreground' : 'font-semibold'
                            "
                            >{{ p.etiqueta }} <span class="sr-only">{{ textoPaso(p) }}</span></span
                          >
                        </li>
                      }
                    </ol>

                    @if (s.cerrada) {
                      <div class="bg-muted/60 space-y-1 rounded-lg p-3 text-sm">
                        <p class="font-medium">
                          Respuesta de tu ARL
                          @if (s.atendidaEn) {
                            <span class="text-muted-foreground font-normal">
                              · {{ dia(s.atendidaEn) }}</span
                            >
                          }
                        </p>
                        <p class="whitespace-pre-wrap">{{ s.notaAtencion || 'Sin nota.' }}</p>
                      </div>
                    }
                  </article>
                </li>
              }
            </ul>
          }
        }
      }
    </div>
  `,
})
export class SolicitudesPage implements OnInit {
  private readonly api = inject(PacienteApi);

  protected readonly fase = signal<Fase>('cargando');
  protected readonly error = signal<MensajeError | null>(null);
  protected readonly solicitudes = signal<SolicitudVista[]>([]);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.fase.set('cargando');
    try {
      const [solicitudes, casos] = await Promise.all([
        firstValueFrom(this.api.solicitudes()),
        firstValueFrom(this.api.misCasos()),
      ]);
      this.solicitudes.set(
        [...solicitudes]
          .sort((a, b) => Date.parse(b.solicitadaEn) - Date.parse(a.solicitadaEn))
          .map((s) => ({
            ...s,
            radicado: casos.find((c) => c.casoId === s.casoId)?.radicado ?? null,
            pasos: pasosDe(s.estado),
            cerrada: estaCerrada(s.estado),
          })),
      );
      this.fase.set('listo');
    } catch (error) {
      this.error.set(mensajeDeError(error));
      this.fase.set('error');
    }
  }

  protected claseMarca(p: PasoSolicitud): string {
    if (p.resultado === 'rechazada') {
      return 'bg-destructive text-destructive-foreground ring-destructive';
    }
    if (p.resultado === 'entregada') return 'bg-success text-success-foreground ring-success';
    if (p.estado === 'hecho') return 'bg-primary text-primary-foreground ring-primary';
    if (p.estado === 'actual') return 'bg-card text-primary ring-primary';
    return 'bg-card text-muted-foreground ring-border';
  }

  protected textoPaso(p: PasoSolicitud): string {
    return p.estado === 'hecho'
      ? '(completado)'
      : p.estado === 'actual'
        ? '(estado actual)'
        : '(pendiente)';
  }

  protected medio(valor: string): string {
    return getEnumLabel(MEDIO_ENTREGA_LABELS, valor);
  }

  protected dia(iso: string): string {
    return formatFechaDiaBogota(iso);
  }
}
