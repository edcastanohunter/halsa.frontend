import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TemaService } from '@halsa/ui/tema';
import { HlmToaster } from '@halsa/ui/helm/sonner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToaster],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Sonner doesn't read the `.dark` class: without this, toasts stay light in dark mode.
  // Deep entry point: the `@halsa/ui` barrel adds ~13 kB gz to the initial bundle.
  protected readonly tema = inject(TemaService);
  protected readonly title = signal('Halsa Portal');
}
