import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { injectCasoId } from '../../../shared/casos/caso-id';
import { IncapacidadesApi } from '../data-access/incapacidades-api.service';
import { IncapacidadesStore } from '../data-access/incapacidades.store';

/**
 * Incapacidades tab (plan §7.6): provides the API and the case's list to the list and the upload
 * form, and drops them when the user leaves the tab.
 */
@Component({
  selector: 'app-incapacidades',
  imports: [RouterOutlet],
  providers: [IncapacidadesApi, IncapacidadesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<router-outlet />`,
})
export class IncapacidadesPage {
  private readonly store = inject(IncapacidadesStore);
  private readonly casoId = injectCasoId();

  constructor() {
    effect(() => {
      const id = this.casoId();
      if (id) untracked(() => this.store.cargar(id));
    });
  }
}
