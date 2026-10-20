import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { injectAhora } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideCircleCheck, lucideKeyRound, lucideTimer } from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { SesionPaciente, TrabajadorVinculado } from '../../core/sesion/sesion.service';
import { PacienteApi } from '../../shared/paciente-api.service';
import {
  codigoCompleto,
  cursorTrasFormato,
  errorDeVinculo,
  formatearCodigo,
} from './codigo-activacion';

/**
 * `/activar` (plan §7.12): redeem the one-time code the ARL handed over. A new account lands here
 * until it is linked; a linked one comes from Cuenta to link another code. The code is cleared
 * from memory as soon as it is redeemed.
 */
@Component({
  selector: 'app-activar',
  imports: [ReactiveFormsModule, RouterLink, HlmButton, HlmSpinner, NgIcon],
  providers: [provideIcons({ lucideArrowLeft, lucideCircleCheck, lucideKeyRound, lucideTimer })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg space-y-6">
      @if (vinculado(); as t) {
        <section
          class="bg-card ring-border flex flex-col items-center gap-4 rounded-2xl px-6 py-10 text-center ring-1"
          aria-labelledby="titulo-vinculada"
        >
          <span
            class="bg-success/12 text-success inline-flex size-16 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <ng-icon name="lucideCircleCheck" class="text-4xl" />
          </span>
          <h1 id="titulo-vinculada" tabindex="-1" class="text-2xl font-semibold tracking-tight">
            Cuenta vinculada
          </h1>
          <p class="text-muted-foreground text-lg" data-testid="documento-vinculado">
            Cuenta vinculada al documento
            <span class="text-foreground font-mono font-medium whitespace-nowrap"
              >{{ t.tipo }} {{ t.numeroEnmascarado }}</span
            >
          </p>
          <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a hlmBtn size="lg" routerLink="/casos">Ver mis casos</a>
            <a hlmBtn size="lg" variant="outline" routerLink="/inicio">Ir al inicio</a>
          </div>
        </section>
      } @else {
        @if (yaVinculada) {
          <a hlmBtn variant="ghost" routerLink="/cuenta" class="-ms-3">
            <ng-icon name="lucideArrowLeft" aria-hidden="true" /> Mi cuenta
          </a>
        }
        <div class="space-y-2">
          <span
            class="bg-primary/10 text-primary inline-flex size-12 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <ng-icon name="lucideKeyRound" class="text-2xl" />
          </span>
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ yaVinculada ? 'Vincular otro código' : 'Vincula tu cuenta' }}
          </h1>
          <p class="text-muted-foreground">
            Escribe el código de activación para ver tus casos. Así confirmamos que eres tú.
          </p>
        </div>

        <form class="space-y-4" novalidate (submit)="enviar($event)">
          <div class="space-y-2">
            <label for="codigo" class="text-base font-medium">Código de activación</label>
            <input
              #campo
              id="codigo"
              type="text"
              inputmode="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="40"
              placeholder="ABC123-K7Q2M9XD4P"
              [formControl]="codigo"
              [attr.aria-invalid]="error() ? true : null"
              [attr.aria-describedby]="error() ? 'codigo-ayuda codigo-error' : 'codigo-ayuda'"
              class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 placeholder:text-muted-foreground/60 h-16 w-full rounded-xl border px-4 text-center font-mono text-2xl tracking-wider uppercase outline-none focus-visible:ring-3 sm:text-[1.625rem]"
              (input)="alEscribir($event)"
            />
            <p id="codigo-ayuda" class="text-muted-foreground text-sm">
              Tu ARL te entregó este código. Es de un solo uso.
            </p>
          </div>

          @if (restanteSeg() > 0) {
            <div
              id="codigo-error"
              role="alert"
              class="bg-warning/12 text-warning ring-warning/30 flex items-start gap-2 rounded-xl p-4 text-sm ring-1 ring-inset"
              data-testid="espera-vinculo"
            >
              <ng-icon name="lucideTimer" class="mt-0.5 shrink-0 text-base" aria-hidden="true" />
              <!-- Announced once; the visible seconds tick without re-announcing. -->
              <span class="sr-only"
                >Demasiados intentos. Intenta de nuevo en {{ esperaInicial() }} segundos.</span
              >
              <span aria-hidden="true"
                >Demasiados intentos. Intenta de nuevo en
                <span class="font-semibold tabular-nums">{{ restanteSeg() }}</span>
                {{ restanteSeg() === 1 ? 'segundo' : 'segundos' }}.</span
              >
            </div>
          } @else if (error(); as e) {
            <p
              id="codigo-error"
              role="alert"
              class="bg-destructive/10 text-destructive ring-destructive/25 rounded-xl p-4 text-sm ring-1 ring-inset"
            >
              {{ e }}
            </p>
          }

          <button
            hlmBtn
            size="lg"
            type="submit"
            class="w-full"
            [disabled]="enviando() || restanteSeg() > 0"
          >
            @if (enviando()) {
              <hlm-spinner class="size-4" aria-hidden="true" />
            }
            Vincular cuenta
          </button>
        </form>

        <p class="text-muted-foreground text-sm">
          ¿No tienes un código? Pídelo a tu ARL: lo entrega cuando valida tu caso.
        </p>
      }
    </div>
  `,
})
export class ActivarPage {
  private readonly api = inject(PacienteApi);
  private readonly sesion = inject(SesionPaciente);
  private readonly ahora = injectAhora(1000);
  private readonly injector = inject(Injector);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  /** Linking once more, from Cuenta (`Paciente.VinculoDistinto` if it's another document). */
  protected readonly yaVinculada = this.sesion.estado() === 'vinculada';
  protected readonly codigo = new FormControl('', { nonNullable: true });
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly vinculado = signal<TrabajadorVinculado | null>(null);

  private readonly esperaHasta = signal<number | null>(null);
  protected readonly esperaInicial = signal(0);
  protected readonly restanteSeg = computed(() => {
    const hasta = this.esperaHasta();
    if (hasta === null) return 0;
    // The clock ticks once a second, so it may lag the moment the wait started.
    const restante = Math.ceil((hasta - this.ahora()) / 1000);
    return Math.max(0, Math.min(restante, this.esperaInicial()));
  });

  constructor() {
    // The countdown is over: the button comes back and the message goes away.
    effect(() => {
      if (this.esperaHasta() !== null && this.restanteSeg() === 0) {
        this.esperaHasta.set(null);
        this.error.set(null);
      }
    });
  }

  protected alEscribir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const formateado = formatearCodigo(campo.value);
    if (formateado !== campo.value) {
      const cursor = cursorTrasFormato(campo.value, campo.selectionStart ?? campo.value.length);
      campo.value = formateado;
      campo.setSelectionRange(cursor, cursor);
    }
    this.codigo.setValue(formateado, { emitEvent: false });
    if (this.restanteSeg() === 0) this.error.set(null);
  }

  /** A plain `<form>` (no `[formGroup]`), so the native submit is the one to stop. */
  protected async enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.enviando() || this.restanteSeg() > 0) return;
    const codigo = this.codigo.value;
    if (!codigoCompleto(codigo)) {
      this.error.set('Escribe el código completo: 6 caracteres, un guion y 10 más.');
      this.campo()?.nativeElement.focus();
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    try {
      const { trabajador } = await firstValueFrom(this.api.vincular(codigo));
      this.codigo.reset();
      this.sesion.vincular(trabajador);
      this.vinculado.set(trabajador);
      // The form is gone: move focus to the confirmation so it's announced.
      afterNextRender(() => document.getElementById('titulo-vinculada')?.focus(), {
        injector: this.injector,
      });
    } catch (error) {
      const { mensaje, esperaSeg } = errorDeVinculo(error);
      this.error.set(mensaje);
      if (esperaSeg) {
        this.esperaInicial.set(esperaSeg);
        this.esperaHasta.set(Date.now() + esperaSeg * 1000);
      } else {
        this.campo()?.nativeElement.focus();
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
