import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorApi, mensajeError, parsearProblema } from '@halsa/core';
import { HlmBadgeImports } from '@halsa/ui/helm/badge';
import { HlmButtonImports } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { toast } from '@spartan-ng/brain/sonner';
import { EstadoError } from '../lib/estado-error/estado-error';
import { Notificaciones } from '../lib/notificaciones/notificaciones';
import { SelectorTema } from '../lib/selector-tema/selector-tema';

// Fixed ids so the visual baselines (e2e/errores.spec.ts) stay stable.
const TRAZA = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';
const CORRELACION = '0199a1b2-3c4d-7e5f-8a9b-0c1d2e3f4a5b';

interface Escenario {
  etiqueta: string;
  status: number;
  cuerpo?: Record<string, unknown>;
  cabeceras?: Record<string, string>;
}

/** One case per branch of `mensajeError` (plan §4.2), as the backend would answer it. */
const ESCENARIOS: Escenario[] = [
  { etiqueta: 'Sin respuesta', status: 0 },
  { etiqueta: 'Sesión vencida', status: 401 },
  {
    etiqueta: 'Step-up',
    status: 401,
    cuerpo: { errorCode: 'Auth.StepUpRequerido', traceId: TRAZA },
    cabeceras: {
      'WWW-Authenticate':
        'Bearer error="insufficient_user_authentication", acr_values="2", max_age="900"',
    },
  },
  {
    etiqueta: 'Clinico.NoAsignado',
    status: 403,
    cuerpo: {
      errorCode: 'Clinico.NoAsignado',
      detail: 'No estás asignado a este caso. Pide a un analista que te asigne.',
      traceId: TRAZA,
    },
  },
  { etiqueta: 'Sin permiso', status: 403, cuerpo: { traceId: TRAZA } },
  {
    etiqueta: 'Caso.NoEncontrado',
    status: 404,
    cuerpo: { errorCode: 'Caso.NoEncontrado', detail: 'El caso no existe.', traceId: TRAZA },
  },
  {
    etiqueta: 'General.Validation',
    status: 400,
    cuerpo: {
      errorCode: 'General.Validation',
      detail: 'La solicitud tiene datos inválidos.',
      traceId: TRAZA,
      errors: [{ code: 'nota', description: 'La nota debe tener entre 10 y 1000 caracteres.' }],
    },
  },
  {
    etiqueta: 'Caso.RemisionDuplicada',
    status: 409,
    cuerpo: {
      errorCode: 'Caso.RemisionDuplicada',
      detail: 'Ya existe una remisión vigente a esta IPS para este caso.',
      traceId: TRAZA,
    },
  },
  { etiqueta: 'Archivo grande', status: 413 },
  { etiqueta: 'No es PDF', status: 415, cuerpo: { errorCode: 'Archivos.NoEsPdf' } },
  {
    etiqueta: 'Archivos.SoporteInfectado',
    status: 422,
    cuerpo: {
      errorCode: 'Archivos.SoporteInfectado',
      detail: 'El antivirus encontró una amenaza en el soporte. El archivo no se guardó.',
      traceId: TRAZA,
    },
  },
  { etiqueta: 'Límite de intentos', status: 429, cabeceras: { 'Retry-After': '45' } },
  {
    etiqueta: 'Archivos.AntivirusNoDisponible',
    status: 503,
    cuerpo: { errorCode: 'Archivos.AntivirusNoDisponible', traceId: TRAZA },
  },
  {
    etiqueta: 'Error del servidor',
    status: 500,
    cuerpo: { detail: 'An unexpected error occurred.', traceId: TRAZA },
  },
];

const REINTENTABLES = new Set([0, 429, 500, 503]);

function problemaDe({ status, cuerpo, cabeceras }: Escenario) {
  const mapa = new Map(Object.entries(cabeceras ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return parsearProblema(
    status,
    cuerpo ?? null,
    { get: (n) => mapa.get(n.toLowerCase()) ?? null },
    CORRELACION,
  );
}

/**
 * Dev-only gallery of the M2 error→UI mapping and the toast variants, used by the visual
 * baselines in `e2e/errores.spec.ts`. Reached at `/_ui/errores` in both apps; never bundled in
 * production (see `ui-showcase.page.ts`).
 */
@Component({
  selector: 'halsa-ui-showcase-errores',
  imports: [HlmBadgeImports, HlmButtonImports, HlmCardImports, EstadoError, SelectorTema],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-background min-h-dvh">
      <header class="border-border border-b">
        <div
          class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8"
        >
          <div>
            <p class="text-primary text-xs font-medium tracking-wide uppercase">
              Halsa · solo desarrollo
            </p>
            <h1 class="text-lg font-semibold tracking-tight">Errores y notificaciones</h1>
          </div>
          <halsa-selector-tema />
        </div>
      </header>

      <div class="mx-auto max-w-6xl space-y-12 px-4 py-8 md:px-8 md:py-12">
        <section aria-labelledby="t-notificaciones" class="space-y-4">
          <h2 id="t-notificaciones" class="text-2xl font-semibold tracking-tight">
            Notificaciones
          </h2>
          <div class="flex flex-wrap gap-3">
            <button hlmBtn variant="outline" type="button" (click)="exito()">Éxito</button>
            <button hlmBtn variant="outline" type="button" (click)="info()">Información</button>
            <button hlmBtn variant="outline" type="button" (click)="aviso()">Aviso</button>
            <button hlmBtn variant="outline" type="button" (click)="errorApi()">
              Error con código
            </button>
            <button hlmBtn variant="outline" type="button" (click)="errorDesconocido()">
              Error inesperado
            </button>
            <button hlmBtn variant="ghost" type="button" (click)="descartar()">
              Descartar todas
            </button>
          </div>
        </section>

        <section aria-labelledby="t-mensajes" class="space-y-4">
          <h2 id="t-mensajes" class="text-2xl font-semibold tracking-tight">Mensajes de error</h2>
          <ul class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            @for (caso of casos; track $index) {
              <li hlmCard class="gap-0 py-0">
                <div class="flex flex-wrap items-center gap-2 px-4 pt-4">
                  <span hlmBadge variant="outline" class="font-mono tabular-nums">{{
                    caso.status === 0 ? 'red' : caso.status
                  }}</span>
                  <span class="text-muted-foreground font-mono text-xs break-all">{{
                    caso.etiqueta
                  }}</span>
                </div>
                <halsa-estado-error
                  [titulo]="caso.mensaje.titulo"
                  [mensaje]="caso.mensaje.mensaje"
                  [traza]="caso.mensaje.traza ?? undefined"
                  [reintentable]="caso.reintentable"
                />
                @if (caso.errores.length) {
                  <ul class="text-muted-foreground -mt-8 list-disc px-10 pb-6 text-sm">
                    @for (e of caso.errores; track $index) {
                      <li>{{ e.mensaje }}</li>
                    }
                  </ul>
                }
              </li>
            }
          </ul>
        </section>
      </div>
    </div>
  `,
})
export class UiErroresPage {
  private readonly notificaciones = inject(Notificaciones);

  protected readonly casos = ESCENARIOS.map((escenario) => {
    const problema = problemaDe(escenario);
    return {
      etiqueta: escenario.etiqueta,
      status: escenario.status,
      mensaje: mensajeError(problema),
      errores: problema.errors,
      reintentable: REINTENTABLES.has(escenario.status),
    };
  });

  protected exito(): void {
    this.notificaciones.exito(
      'Plazo marcado como cumplido',
      'Investigación del accidente · 2026-ARLA-000123',
    );
  }

  protected info(): void {
    this.notificaciones.info('Código de activación generado', 'Vence en 72 horas.');
  }

  protected aviso(): void {
    this.notificaciones.aviso('El plazo vence hoy', 'Reporte de calificación · 2026-ARLA-000123');
  }

  protected errorApi(): void {
    this.notificaciones.error(
      new ErrorApi(
        problemaDe({
          etiqueta: '',
          status: 409,
          cuerpo: {
            errorCode: 'Caso.RemisionDuplicada',
            detail: 'Ya existe una remisión vigente a esta IPS para este caso.',
            traceId: TRAZA,
          },
        }),
      ),
    );
  }

  protected errorDesconocido(): void {
    this.notificaciones.error(new Error('fallo de prueba'));
  }

  protected descartar(): void {
    toast.dismiss();
  }
}
