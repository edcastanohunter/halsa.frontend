import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { CasoDetalleResponse } from '@halsa/api-types';
import { esErrorApi } from '@halsa/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { CasosApi } from '../../../shared/casos/casos-api.service';

export type EstadoCarga = 'cargando' | 'listo' | 'no-encontrado' | 'error';

/**
 * The case detail, loaded once per case shell and shared with its tabs (plan §7.4). Provided by
 * the shell component, so it lives exactly as long as the user stays inside one case.
 */
@Injectable()
export class CasoStore {
  private readonly api = inject(CasosApi);
  private peticion: Subscription | undefined;

  readonly casoId = signal<string | null>(null);
  readonly detalle = signal<CasoDetalleResponse | null>(null);
  readonly estado = signal<EstadoCarga>('cargando');
  readonly error = signal<unknown>(null);

  readonly resumen = computed(() => this.detalle()?.resumen ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  /** Loads a case; a previous in-flight load is cancelled. */
  cargar(casoId: string): void {
    this.peticion?.unsubscribe();
    if (casoId !== this.casoId()) this.detalle.set(null);
    this.casoId.set(casoId);
    this.estado.set('cargando');
    this.error.set(null);
    this.peticion = this.api.detalle(casoId).subscribe({
      next: (detalle) => {
        this.detalle.set(detalle);
        this.estado.set('listo');
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  reintentar(): void {
    const id = this.casoId();
    if (id) this.cargar(id);
  }

  /**
   * After a mutation: refetch without dropping the current view (no skeleton flash). A failure
   * keeps the last good data; the action that triggered it already reported its own result.
   */
  async refrescar(): Promise<void> {
    const id = this.casoId();
    if (!id) return;
    try {
      this.detalle.set(await firstValueFrom(this.api.detalle(id)));
      this.estado.set('listo');
    } catch (error) {
      if (esErrorApi(error) && error.problema.status === 404) this.fallar(error);
    }
  }

  private fallar(error: unknown): void {
    this.error.set(error);
    this.estado.set(esErrorApi(error) && error.problema.status === 404 ? 'no-encontrado' : 'error');
  }
}
