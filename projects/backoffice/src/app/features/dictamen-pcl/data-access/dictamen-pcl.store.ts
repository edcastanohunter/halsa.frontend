import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { DictamenPclResponse } from '@halsa/api-types';
import { esErrorApi, MensajeError, mensajeDeError, tieneCodigo } from '@halsa/core';
import { Subscription } from 'rxjs';
import { crearFormDictamen, FormDictamen } from '../formulario';
import { DictamenPclApi } from './dictamen-pcl-api.service';

export type EstadoDictamenPcl =
  | 'inicial'
  | 'cargando'
  | 'listo'
  /** `404 Dictamen.NoEncontrado`: the case has no dictamen yet. */
  | 'sin-dictamen'
  | 'no-asignado'
  | 'no-encontrado'
  | 'error';

interface Borrador {
  /** `nuevo`, or the id of the dictamen being corrected. */
  clave: string;
  form: FormDictamen;
}

/**
 * The dictamen PCL of one case (plan §7.7, §5.3.4). Provided by the dictamen page, **above** the
 * step-up gate: when the 15-minute window closes, the gate drops the form view, but the draft
 * (up to 20 000 characters of fundamentos) waits here, in memory only, until the user verifies
 * again. Everything goes when the user leaves the tab. Nothing goes to storage.
 */
@Injectable()
export class DictamenPclStore {
  private readonly api = inject(DictamenPclApi);
  private peticion: Subscription | undefined;
  private borrador: Borrador | null = null;

  readonly casoId = signal<string | null>(null);
  readonly dictamen = signal<DictamenPclResponse | null>(null);
  readonly estado = signal<EstadoDictamenPcl>('inicial');
  readonly error = signal<MensajeError | null>(null);
  /** Break-the-glass motivo (ASCII): this case's dictamen read only, while in this view. */
  readonly motivoEmergencia = signal<string | null>(null);
  readonly emergenciaActiva = computed(() => this.motivoEmergencia() !== null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.peticion?.unsubscribe();
      this.limpiar();
    });
  }

  /** Loads once per case: reopening the gate shows what was there, it doesn't refetch. */
  asegurar(casoId: string): void {
    if (casoId === this.casoId() && this.estado() !== 'inicial') return;
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
    this.peticion = this.api.obtener(casoId, this.motivoEmergencia()).subscribe({
      next: (dictamen) => {
        this.dictamen.set(dictamen);
        this.estado.set('listo');
      },
      error: (error: unknown) => this.fallar(error),
    });
  }

  /** A 201 answer is the new current dictamen. */
  registrado(dictamen: DictamenPclResponse): void {
    this.descartarBorrador();
    this.dictamen.set(dictamen);
    this.estado.set('listo');
  }

  /** Break the glass: reload with the motivo the user just recorded. */
  activarEmergencia(motivo: string): void {
    this.motivoEmergencia.set(motivo);
    this.recargar();
  }

  /**
   * The draft for `clave`, created by `crear` the first time. The same instance comes back after
   * the gate closes and opens again; another `clave` starts over.
   */
  formulario(clave: string, crear: () => FormDictamen = crearFormDictamen): FormDictamen {
    // Called from a `computed`: no reset here (it would emit), the old draft is just dropped.
    if (this.borrador?.clave !== clave) this.borrador = { clave, form: crear() };
    return this.borrador.form;
  }

  descartarBorrador(): void {
    this.borrador?.form.reset();
    this.borrador = null;
  }

  private fallar(error: unknown): void {
    this.dictamen.set(null);
    if (esErrorApi(error)) {
      const p = error.problema;
      if (p.status === 404 && tieneCodigo(p, 'Dictamen.NoEncontrado')) {
        this.estado.set('sin-dictamen');
        return;
      }
      if (p.status === 403 && tieneCodigo(p, 'Clinico.NoAsignado')) {
        this.estado.set('no-asignado');
        return;
      }
      if (p.status === 404) {
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
    this.descartarBorrador();
    this.dictamen.set(null);
    this.motivoEmergencia.set(null);
    this.error.set(null);
    this.estado.set('inicial');
  }
}
