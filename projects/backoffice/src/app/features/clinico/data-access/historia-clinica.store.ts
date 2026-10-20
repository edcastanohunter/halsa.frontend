import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { RegistroClinicoResponse } from '@halsa/api-types';
import { esErrorApi, MensajeError, mensajeDeError, tieneCodigo } from '@halsa/core';
import { Subscription } from 'rxjs';
import { ClinicoApi } from './clinico-api.service';

export type EstadoHistoria =
  'inicial' | 'cargando' | 'listo' | 'no-asignado' | 'no-encontrado' | 'error';

/**
 * The clinical history of one case (plan §7.5, §5.3.4). Provided by the historia clínica page:
 * records, the emergency motivo and any error live only while that view is open and are dropped
 * with it. Nothing goes to storage.
 */
@Injectable()
export class HistoriaClinicaStore {
  private readonly api = inject(ClinicoApi);
  private peticion: Subscription | undefined;

  readonly casoId = signal<string | null>(null);
  readonly registros = signal<RegistroClinicoResponse[]>([]);
  readonly estado = signal<EstadoHistoria>('inicial');
  readonly error = signal<MensajeError | null>(null);
  /**
   * The break-the-glass motivo (ASCII), sent on this case's clinical reads only, while the user
   * stays in this view (plan §5.1.5).
   */
  readonly motivoEmergencia = signal<string | null>(null);
  readonly emergenciaActiva = computed(() => this.motivoEmergencia() !== null);

  /** Newest care first (plan §7.5). */
  readonly ordenados = computed(() =>
    [...this.registros()].sort((a, b) => Date.parse(b.atendidoEn) - Date.parse(a.atendidoEn)),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.peticion?.unsubscribe();
      this.limpiar();
    });
  }

  cargar(casoId: string): void {
    if (casoId !== this.casoId()) this.limpiar();
    this.casoId.set(casoId);
    this.recargar();
  }

  recargar(): void {
    const casoId = this.casoId();
    if (!casoId) return;
    this.peticion?.unsubscribe();
    this.estado.set('cargando');
    this.error.set(null);
    this.peticion = this.api.listar(casoId, this.motivoEmergencia()).subscribe({
      next: (registros) => {
        this.registros.set(registros);
        this.estado.set('listo');
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  /** Break the glass: reload with the motivo the user just recorded. */
  activarEmergencia(motivo: string): void {
    this.motivoEmergencia.set(motivo);
    this.recargar();
  }

  registro(id: string): RegistroClinicoResponse | undefined {
    return this.registros().find((r) => r.id === id);
  }

  private fallar(error: unknown): void {
    if (esErrorApi(error)) {
      const p = error.problema;
      if (p.status === 403 && tieneCodigo(p, 'Clinico.NoAsignado')) {
        this.registros.set([]);
        this.estado.set('no-asignado');
        return;
      }
      if (p.status === 404) {
        this.registros.set([]);
        this.estado.set('no-encontrado');
        return;
      }
      // A rejected motivo must not stay armed.
      if (tieneCodigo(p, 'Clinico.MotivoEmergenciaInvalido')) this.motivoEmergencia.set(null);
    }
    this.error.set(mensajeDeError(error));
    this.estado.set('error');
  }

  private limpiar(): void {
    this.registros.set([]);
    this.motivoEmergencia.set(null);
    this.error.set(null);
    this.estado.set('inicial');
  }
}
