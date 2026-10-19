import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';

/**
 * Page title row: optional back link, title, subtitle and projected actions (`[acciones]`).
 * Sticky; the collapse-on-scroll behavior arrives with the M3 shell, which owns the scroller.
 */
@Component({
  selector: 'halsa-page-header',
  imports: [RouterLink, HlmButton, NgIcon],
  providers: [provideIcons({ lucideArrowLeft })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'sticky top-0 z-10 block border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70',
  },
  template: `
    <div class="flex items-start gap-2 px-4 py-3 md:px-6 md:py-4">
      @if (volverA()) {
        <a
          hlmBtn
          variant="ghost"
          size="icon"
          class="-ms-2 shrink-0"
          [routerLink]="volverA()"
          aria-label="Volver"
        >
          <ng-icon name="lucideArrowLeft" aria-hidden="true" />
        </a>
      }
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-lg font-semibold tracking-tight md:text-xl">{{ titulo() }}</h1>
        @if (subtitulo()) {
          <p class="text-muted-foreground truncate text-sm">{{ subtitulo() }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-2 empty:hidden">
        <ng-content select="[acciones]" />
      </div>
    </div>
  `,
})
export class PageHeader {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  readonly volverA = input<string | readonly unknown[]>();
}
