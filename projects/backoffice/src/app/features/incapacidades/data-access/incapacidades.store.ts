import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { IncapacidadResponse } from '@halsa/api-types';
import { esErrorApi, MensajeError, mensajeDeError } from '@halsa/core';
import { Subscription } from 'rxjs';
import { agruparCadenas, diasAcumulados, prorrogables } from '../cadenas';
import { IncapacidadesApi } from './incapacidades-api.service';

export type EstadoIncapacidades = 'inicial' | 'cargando' | 'listo' | 'no-encontrado' | 'error';

/** The incapacidades of one case (plan §7.6), shared by the list and the upload form. */
@Injectable()
export class IncapacidadesStore {
  private readonly api = inject(IncapacidadesApi);
  private peticion: Subscription | undefined;

  readonly casoId = signal<string | null>(null);
  readonly incapacidades = signal<IncapacidadResponse[]>([]);
  readonly estado = signal<EstadoIncapacidades>('inicial');
  readonly error = signal<MensajeError | null>(null);

  readonly cadenas = computed(() => agruparCadenas(this.incapacidades()));
  readonly prorrogables = computed(() => prorrogables(this.cadenas()));
  readonly diasAcumulados = computed(() => diasAcumulados(this.incapacidades()));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  cargar(casoId: string): void {
    if (casoId !== this.casoId()) this.incapacidades.set([]);
    this.casoId.set(casoId);
    this.recargar();
  }

  recargar(): void {
    const casoId = this.casoId();
    if (!casoId) return;
    this.peticion?.unsubscribe();
    this.estado.set('cargando');
    this.error.set(null);
    this.peticion = this.api.listar(casoId).subscribe({
      next: (lista) => {
        this.incapacidades.set(lista);
        this.estado.set('listo');
      },
      error: (error: unknown) => {
        if (esErrorApi(error) && error.problema.status === 404) {
          this.estado.set('no-encontrado');
          return;
        }
        this.error.set(mensajeDeError(error));
        this.estado.set('error');
      },
    });
  }

  /** A 201 answer goes in right away; the list reload brings the recomputed alerts. */
  agregar(incapacidad: IncapacidadResponse): void {
    this.incapacidades.update((lista) =>
      lista.some((i) => i.id === incapacidad.id) ? lista : [...lista, incapacidad],
    );
    this.recargar();
  }
}
