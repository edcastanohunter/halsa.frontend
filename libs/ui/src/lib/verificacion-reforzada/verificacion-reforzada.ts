import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck } from '@ng-icons/lucide';

/**
 * Marks the gated content: `<div *halsaContenidoReforzado>…</div>`. A template (not projected
 * content) on purpose: projected content is instantiated even when hidden, which would fire the
 * clinical requests before the step-up.
 */
@Directive({ selector: '[halsaContenidoReforzado]' })
export class ContenidoReforzado {
  readonly template = inject(TemplateRef);
}

/**
 * Step-up gate (plan §5.1.4): renders the clinical content only when `satisfecha`; otherwise a
 * calm panel with "Verificar identidad". Presentational: the backoffice's `<app-compuerta-reforzada>`
 * wires `satisfecha` to the token's acr/auth_time and forwards its own content as `plantilla`.
 */
@Component({
  selector: 'halsa-verificacion-reforzada',
  imports: [NgTemplateOutlet, HlmButton, HlmSpinner, NgIcon],
  providers: [provideIcons({ lucideShieldCheck })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (satisfecha()) {
      <ng-container [ngTemplateOutlet]="plantilla() ?? contenido()?.template ?? null" />
    } @else {
      <section
        aria-labelledby="halsa-verificacion-titulo"
        class="bg-card ring-clinical/30 flex flex-col items-center gap-4 rounded-xl px-6 py-10 text-center shadow-xs ring-1"
      >
        <span
          class="bg-clinical/12 text-clinical inline-flex size-12 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <ng-icon name="lucideShieldCheck" class="text-2xl" />
        </span>
        <div class="max-w-sm space-y-1.5">
          <h2 id="halsa-verificacion-titulo" class="text-base font-semibold">
            Información clínica reservada
          </h2>
          <p class="text-muted-foreground text-sm">
            Confirma tu identidad con tu código de verificación. Cada acceso queda registrado.
          </p>
        </div>
        <button
          hlmBtn
          size="lg"
          type="button"
          [disabled]="verificando()"
          (click)="verificar.emit()"
        >
          @if (verificando()) {
            <hlm-spinner class="size-4" aria-hidden="true" />
            Verificando…
          } @else {
            Verificar identidad
          }
        </button>
        @if (urlConfigurarOtp()) {
          <a
            class="text-primary text-sm font-medium underline-offset-4 hover:underline"
            [href]="urlConfigurarOtp()"
            target="_blank"
            rel="noopener"
          >
            Configurar mi código de verificación
          </a>
        }
      </section>
    }
  `,
})
export class VerificacionReforzada {
  readonly satisfecha = input.required<boolean>();
  readonly verificando = input(false);
  /** `{authority}/account`, for users without an OTP configured. */
  readonly urlConfigurarOtp = input<string>();
  readonly verificar = output<void>();
  /** Gated content forwarded by a wrapper, which can't project `*halsaContenidoReforzado` through. */
  readonly plantilla = input<TemplateRef<unknown>>();

  protected readonly contenido = contentChild(ContenidoReforzado);
}
