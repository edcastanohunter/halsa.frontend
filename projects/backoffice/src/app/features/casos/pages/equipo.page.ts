import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { RemisionResponse } from '@halsa/api-types';
import { ErrorApi, esErrorApi, tieneCodigo } from '@halsa/core';
import { FechaBogota } from '@halsa/ui/fecha-bogota';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { HlmAlertDialogImports } from '@halsa/ui/helm/alert-dialog';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTooltipImports } from '@halsa/ui/helm/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBuilding2,
  lucideUserMinus,
  lucideUserPlus,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { PermisosService } from '../../../core/permisos/permisos';
import { SesionService } from '../../../core/sesion/sesion.service';
import { subCorto } from '../../../shared/casos/caso';
import { CasosApi } from '../../../shared/casos/casos-api.service';
import { CasoStore } from '../data-access/caso.store';
import { normalizarReps, validarReps, validarSub } from '../validacion';

type Confirmacion =
  { tipo: 'desasignar'; sub: string } | { tipo: 'revocar'; remision: RemisionResponse };

/** The first message of a 400 for the given field, if the server sent one. */
function errorDeCampo(error: unknown): string | null {
  if (!esErrorApi(error) || error.problema.status !== 400) return null;
  const p = error.problema;
  return p.errors[0]?.mensaje ?? p.detail;
}

/**
 * Equipo y remisiones tab (plan §7.4). Assignments take a raw `sub` (gap G4: no user directory);
 * remissions take a typed 12-digit REPS code (gap G5: no IPS catalog).
 */
@Component({
  selector: 'app-caso-equipo',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    FechaBogota,
    HlmAlertDialogImports,
    HlmButton,
    HlmCardImports,
    HlmFieldImports,
    HlmInput,
    HlmSpinner,
    HlmTooltipImports,
  ],
  providers: [
    provideIcons({ lucideBuilding2, lucideUserMinus, lucideUserPlus, lucideUsers, lucideX }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipo.page.html',
})
export class EquipoPage {
  protected readonly store = inject(CasoStore);
  private readonly api = inject(CasosApi);
  private readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosService);
  private readonly notificaciones = inject(Notificaciones);

  protected readonly puedeAsignar = computed(() => this.permisos.puede('casos:asignar'));
  protected readonly puedeRemitir = computed(() => this.permisos.puede('casos:write'));
  protected readonly miSub = computed(() => this.sesion.sesion()?.sub ?? null);
  protected readonly equipo = computed(() => this.store.detalle()?.equipoAsignado ?? []);
  protected readonly remisiones = computed(() => this.store.detalle()?.remisionesVigentes ?? []);
  protected readonly estoyAsignado = computed(() => {
    const yo = this.miSub();
    return yo !== null && this.equipo().includes(yo);
  });
  protected readonly corto = subCorto;

  /** The action in flight: `asignarme`, `asignar`, `remitir` or `confirmar`. */
  protected readonly ocupado = signal<string | null>(null);
  protected readonly confirmacion = signal<Confirmacion | null>(null);

  protected readonly sub = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, validarSub],
  });
  protected readonly errorSub = signal<string | null>(null);

  protected readonly reps = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, validarReps],
  });
  protected readonly errorReps = signal<string | null>(null);

  protected async asignarme(): Promise<void> {
    const yo = this.miSub();
    if (!yo) return;
    await this.ejecutar('asignarme', () => this.asignarSub(yo), 'Te asignaste al caso');
  }

  protected async asignarPorIdentificador(evento?: Event): Promise<void> {
    evento?.preventDefault();
    this.errorSub.set(null);
    this.sub.markAsTouched();
    if (this.sub.invalid) return;
    const sub = this.sub.value.trim().toLowerCase();
    let ok = false;
    await this.ejecutar(
      'asignar',
      async () => {
        await this.asignarSub(sub);
        ok = true;
      },
      'Profesional asignado',
      (error) => {
        const mensaje = errorDeCampo(error);
        if (mensaje) this.errorSub.set(mensaje);
        return !!mensaje;
      },
    );
    if (ok) this.sub.reset();
  }

  protected normalizarReps(): void {
    const limpio = normalizarReps(this.reps.value);
    if (limpio !== this.reps.value) this.reps.setValue(limpio);
    this.errorReps.set(null);
  }

  protected async remitir(evento?: Event): Promise<void> {
    evento?.preventDefault();
    this.errorReps.set(null);
    this.reps.markAsTouched();
    if (this.reps.invalid) return;
    const casoId = this.store.casoId()!;
    let ok = false;
    await this.ejecutar(
      'remitir',
      async () => {
        await firstValueFrom(this.api.remitir(casoId, this.reps.value));
        ok = true;
      },
      'Caso remitido a la IPS',
      (error) => {
        // Plan §7.4: these two go inline under the field.
        if (
          esErrorApi(error) &&
          (tieneCodigo(error.problema, 'Caso.RemisionDuplicada') ||
            tieneCodigo(error.problema, 'Caso.IpsIdInvalido'))
        ) {
          this.errorReps.set(error.problema.detail ?? errorDeCampo(error));
          return true;
        }
        return false;
      },
    );
    if (ok) this.reps.reset();
  }

  protected pedirConfirmacion(confirmacion: Confirmacion): void {
    this.confirmacion.set(confirmacion);
  }

  protected cancelarConfirmacion(): void {
    if (this.ocupado() !== 'confirmar') this.confirmacion.set(null);
  }

  protected async confirmar(): Promise<void> {
    const c = this.confirmacion();
    const casoId = this.store.casoId();
    if (!c || !casoId) return;
    if (c.tipo === 'desasignar') {
      await this.ejecutar(
        'confirmar',
        () => firstValueFrom(this.api.desasignar(casoId, c.sub)),
        c.sub === this.miSub() ? 'Ya no estás asignado al caso' : 'Asignación retirada',
      );
    } else {
      await this.ejecutar(
        'confirmar',
        () => firstValueFrom(this.api.revocarRemision(casoId, c.remision.id)),
        'Remisión revocada',
      );
    }
    this.confirmacion.set(null);
  }

  private asignarSub(sub: string): Promise<void> {
    return firstValueFrom(this.api.asignar(this.store.casoId()!, sub));
  }

  /**
   * Runs one action: busy flag, success toast and refetch. `enLinea` may claim an error to show
   * it next to its field; anything else becomes a toast.
   */
  private async ejecutar(
    accion: string,
    hacer: () => Promise<unknown>,
    exito: string,
    enLinea?: (error: unknown) => boolean,
  ): Promise<void> {
    if (this.ocupado()) return;
    this.ocupado.set(accion);
    try {
      await hacer();
      this.notificaciones.exito(exito);
      await this.store.refrescar();
    } catch (error) {
      if (!enLinea?.(error)) this.notificaciones.error(error);
      // A 404 here means the case is gone for this user; the store shows the neutral page.
      if (error instanceof ErrorApi && error.problema.status === 404) await this.store.refrescar();
    } finally {
      this.ocupado.set(null);
    }
  }
}
