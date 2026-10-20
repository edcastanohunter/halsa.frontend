import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';

/**
 * `/privacidad`, public (plan §7.12). TODO(privacidad): the data-treatment policy text is provided
 * by the product owner; until then the page says so instead of inventing legal text.
 */
@Component({
  selector: 'app-privacidad',
  imports: [RouterLink, HlmButton, NgIcon],
  providers: [provideIcons({ lucideArrowLeft })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main id="contenido" class="bg-background text-foreground min-h-dvh">
      <div class="mx-auto max-w-2xl space-y-6 px-4 py-10 lg:py-16">
        <a hlmBtn variant="ghost" routerLink="/" class="-ms-3">
          <ng-icon name="lucideArrowLeft" aria-hidden="true" /> Volver
        </a>
        <h1 class="text-3xl font-semibold tracking-tight text-balance">
          Política de tratamiento de datos personales
        </h1>
        <p class="text-muted-foreground text-lg">
          Halsa trata tus datos personales y de salud conforme a la Ley 1581 de 2012 y a la
          Resolución 1995 de 1999.
        </p>
        <p class="bg-muted/60 ring-border rounded-xl p-5 text-sm ring-1">
          El texto completo de la política se publicará en esta página. Mientras tanto, puedes
          consultarla con tu ARL.
        </p>
      </div>
    </main>
  `,
})
export class PrivacidadPage {}
