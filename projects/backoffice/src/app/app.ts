import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HlmToaster } from '@halsa/ui/helm/sonner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HlmToaster],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('Halsa Backoffice');
}
