import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SelectorTema } from '@halsa/ui/selector-tema';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideLogOut } from '@ng-icons/lucide';
import { SesionPaciente } from '../../core/sesion/sesion.service';

/**
 * `/cuenta` (plan §6.4, §7.12): who is signed in, the linked document when this page redeemed
 * it (the BFF doesn't return it later), linking another code, and logout.
 */
@Component({
  selector: 'app-cuenta',
  imports: [RouterLink, NgIcon, SelectorTema, HlmButton, HlmSpinner],
  providers: [provideIcons({ lucideKeyRound, lucideLogOut })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl space-y-6">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">Mi cuenta</h1>
        <p class="text-muted-foreground">Tus datos de acceso al portal.</p>
      </header>

      <section class="bg-card ring-border rounded-2xl p-5 ring-1" aria-labelledby="t-datos">
        <h2 id="t-datos" class="mb-4 text-lg font-semibold">Datos</h2>
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-muted-foreground text-sm">Nombre</dt>
            <dd class="font-medium">{{ sesion.usuario()?.nombre ?? 'No disponible' }}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Correo</dt>
            <dd class="font-medium break-words">
              {{ sesion.usuario()?.correo ?? 'No disponible' }}
            </dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-muted-foreground text-sm">Documento vinculado</dt>
            <dd class="font-medium" data-testid="documento-cuenta">
              @if (sesion.trabajador(); as t) {
                <span class="font-mono">{{ t.tipo }} {{ t.numeroEnmascarado }}</span>
              } @else if (sesion.estado() === 'vinculada') {
                Tu cuenta está vinculada a tu documento.
              } @else {
                Aún no has vinculado tu cuenta.
              }
            </dd>
          </div>
        </dl>
      </section>

      <section
        class="bg-card ring-border space-y-3 rounded-2xl p-5 ring-1"
        aria-labelledby="t-codigo"
      >
        <h2 id="t-codigo" class="text-lg font-semibold">Código de activación</h2>
        <p class="text-muted-foreground text-sm">
          Si tu ARL te entregó un código nuevo, por ejemplo por otro caso, vincúlalo aquí.
        </p>
        <a hlmBtn variant="outline" routerLink="/activar">
          <ng-icon name="lucideKeyRound" aria-hidden="true" />
          {{ sesion.estado() === 'vinculada' ? 'Vincular otro código' : 'Vincular mi cuenta' }}
        </a>
      </section>

      <section
        class="bg-card ring-border space-y-3 rounded-2xl p-5 ring-1"
        aria-labelledby="t-tema"
      >
        <h2 id="t-tema" class="text-lg font-semibold">Apariencia</h2>
        <halsa-selector-tema />
      </section>

      <button
        hlmBtn
        size="lg"
        variant="outline"
        type="button"
        class="text-destructive hover:text-destructive w-full sm:w-auto"
        [disabled]="saliendo()"
        (click)="cerrarSesion()"
      >
        @if (saliendo()) {
          <hlm-spinner class="size-4" aria-hidden="true" />
        } @else {
          <ng-icon name="lucideLogOut" aria-hidden="true" />
        }
        Cerrar sesión
      </button>
    </div>
  `,
})
export class CuentaPage {
  protected readonly sesion = inject(SesionPaciente);
  protected readonly saliendo = signal(false);

  protected cerrarSesion(): void {
    this.saliendo.set(true);
    void this.sesion.cerrarSesion();
  }
}
