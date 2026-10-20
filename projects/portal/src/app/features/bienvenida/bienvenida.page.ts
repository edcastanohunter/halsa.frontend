import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarDays,
  lucideEyeOff,
  lucideFileText,
  lucideFolderOpen,
  lucideKeyRound,
} from '@ng-icons/lucide';
import { SesionPaciente } from '../../core/sesion/sesion.service';

const BENEFICIOS = [
  {
    icono: 'lucideFolderOpen',
    titulo: 'El estado de tu caso',
    texto: 'Sigue cada paso, desde el reporte hasta la calificación, en lenguaje claro.',
  },
  {
    icono: 'lucideCalendarDays',
    titulo: 'Tus incapacidades',
    texto: 'Consulta las fechas de cada incapacidad y cuántos días llevas acumulados.',
  },
  {
    icono: 'lucideFileText',
    titulo: 'Copia de tu historia clínica',
    texto: 'Solícitala en línea y tu ARL te la entrega por el medio que elijas.',
  },
] as const;

const PASOS = [
  'Ingresa o crea tu cuenta con tu correo.',
  'Escribe el código de activación que te entregó tu ARL.',
  'Listo: verás tus casos de cualquier ARL con tu documento.',
] as const;

/**
 * `/` for anonymous visitors (plan §7.12): what the portal is, the privacy promise, and the two
 * ways in. Both CTAs start the same BFF login; Keycloak's page offers "Crear cuenta".
 */
@Component({
  selector: 'app-bienvenida',
  imports: [RouterLink, HlmButton, NgIcon],
  providers: [
    provideIcons({
      lucideCalendarDays,
      lucideEyeOff,
      lucideFileText,
      lucideFolderOpen,
      lucideKeyRound,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-background text-foreground flex min-h-dvh flex-col">
      <header class="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 lg:px-8">
        <span
          class="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-lg font-bold"
          aria-hidden="true"
          >H</span
        >
        <span class="text-lg font-semibold tracking-tight">Halsa</span>
        <span class="flex-1"></span>
        <button hlmBtn variant="ghost" type="button" (click)="ingresar()">Ingresar</button>
      </header>

      <main id="contenido" class="flex-1">
        <section class="mx-auto max-w-5xl px-4 pt-8 pb-12 lg:px-8 lg:pt-16 lg:pb-20">
          <div class="max-w-2xl space-y-6">
            <p class="text-primary text-sm font-semibold tracking-wide uppercase">
              Portal del paciente
            </p>
            <h1
              class="text-3xl leading-tight font-semibold tracking-tight text-balance lg:text-5xl"
            >
              Consulta el estado de tu caso de accidente o enfermedad laboral
            </h1>
            <p class="text-muted-foreground text-lg text-pretty">
              Si sufriste un accidente de trabajo o tienes una enfermedad laboral, aquí puedes ver
              cómo avanza tu caso con tu ARL, sin llamadas ni filas.
            </p>
            <div class="flex flex-col gap-3 sm:flex-row">
              <button hlmBtn size="lg" type="button" class="sm:min-w-40" (click)="ingresar()">
                Ingresar
              </button>
              <button
                hlmBtn
                size="lg"
                variant="outline"
                type="button"
                class="sm:min-w-40"
                (click)="ingresar()"
              >
                Crear cuenta
              </button>
            </div>
          </div>
        </section>

        <section aria-labelledby="titulo-beneficios" class="bg-muted/50 border-border border-y">
          <div class="mx-auto max-w-5xl px-4 py-12 lg:px-8">
            <h2 id="titulo-beneficios" class="mb-6 text-xl font-semibold tracking-tight">
              Lo que puedes hacer
            </h2>
            <ul class="grid gap-4 md:grid-cols-3">
              @for (b of beneficios; track b.titulo) {
                <li class="bg-card ring-border space-y-3 rounded-xl p-5 ring-1">
                  <span
                    class="bg-primary/10 text-primary inline-flex size-11 items-center justify-center rounded-full"
                    aria-hidden="true"
                  >
                    <ng-icon [name]="b.icono" class="text-xl" />
                  </span>
                  <h3 class="text-base font-semibold">{{ b.titulo }}</h3>
                  <p class="text-muted-foreground text-sm">{{ b.texto }}</p>
                </li>
              }
            </ul>
          </div>
        </section>

        <section class="mx-auto grid max-w-5xl gap-6 px-4 py-12 lg:grid-cols-2 lg:px-8">
          <div class="bg-card ring-border space-y-3 rounded-xl p-5 ring-1">
            <h2 class="flex items-center gap-2 text-lg font-semibold">
              <ng-icon name="lucideEyeOff" class="text-primary text-xl" aria-hidden="true" />
              Nunca mostramos diagnósticos en línea
            </h2>
            <p class="text-muted-foreground text-sm">
              Tus datos de salud están protegidos por la ley. En el portal ves el avance de tu caso,
              no tu información médica. Si necesitas tu historia clínica, la pides aquí y tu ARL te
              entrega la copia por un canal formal.
            </p>
          </div>

          <div class="bg-card ring-border space-y-3 rounded-xl p-5 ring-1">
            <h2 class="flex items-center gap-2 text-lg font-semibold">
              <ng-icon name="lucideKeyRound" class="text-primary text-xl" aria-hidden="true" />
              ¿Tienes un código de activación?
            </h2>
            <p class="text-muted-foreground text-sm">
              Tu ARL te lo entrega cuando valida tu caso. Sirve una sola vez y conecta tu cuenta con
              tu documento.
            </p>
            <ol class="space-y-2 text-sm">
              @for (paso of pasos; track paso; let i = $index) {
                <li class="flex gap-3">
                  <span
                    class="bg-primary text-primary-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
                    aria-hidden="true"
                    >{{ i + 1 }}</span
                  >
                  <span>{{ paso }}</span>
                </li>
              }
            </ol>
          </div>
        </section>
      </main>

      <footer class="border-border border-t">
        <div
          class="text-muted-foreground mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"
        >
          <span>Halsa · Portal del paciente</span>
          <a routerLink="/privacidad" class="hover:text-foreground underline underline-offset-4">
            Política de tratamiento de datos personales
          </a>
        </div>
      </footer>
    </div>
  `,
})
export class BienvenidaPage {
  private readonly sesion = inject(SesionPaciente);

  protected readonly beneficios = BENEFICIOS;
  protected readonly pasos = PASOS;

  /** New and returning patients alike land on `/inicio`; the guards send the unlinked to `/activar`. */
  protected ingresar(): void {
    this.sesion.iniciarSesion('/inicio');
  }
}
