import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { UsuarioBffResponse, VinculoCreadoResponse } from '@halsa/api-types';
import { esErrorApi } from '@halsa/core';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { firstValueFrom } from 'rxjs';
import { NAVEGADOR_BFF } from './navegador-bff';

/**
 * Plan §5.2, from `GET /paciente/bff/usuario`:
 * - `iniciando`: before the app initializer answers;
 * - `anonima`: `401`, the public welcome page;
 * - `sin-vinculo`: signed in, but no code redeemed yet → `/activar`;
 * - `vinculada`: the normal app;
 * - `error`: the BFF or the API failed; the shell offers retry and logout.
 */
export type EstadoSesion = 'iniciando' | 'anonima' | 'sin-vinculo' | 'vinculada' | 'error';

export type TrabajadorVinculado = VinculoCreadoResponse['trabajador'];

/** Gives the expired-session toast time to be read before the full-page login. */
const ESPERA_RELOGIN_MS = 2000;

/**
 * The patient session. There are no tokens in the browser: the BFF holds them behind an HttpOnly
 * cookie, and this service only knows who is signed in and whether the account is linked.
 */
@Injectable({ providedIn: 'root' })
export class SesionPaciente {
  private readonly http = inject(HttpClient);
  private readonly navegador = inject(NAVEGADOR_BFF);
  private readonly notificaciones = inject(Notificaciones);

  readonly estado = signal<EstadoSesion>('iniciando');
  readonly usuario = signal<UsuarioBffResponse | null>(null);
  readonly error = signal<unknown>(null);
  /**
   * The masked document from the redeem response. The BFF doesn't return it later, so it lasts
   * for this page only (plan §6.4, Cuenta), and it is never stored.
   */
  readonly trabajador = signal<TrabajadorVinculado | null>(null);
  private redirigiendo = false;

  /** App initializer. Never throws. */
  async iniciar(): Promise<void> {
    this.error.set(null);
    try {
      const usuario = await firstValueFrom(
        this.http.get<UsuarioBffResponse>('/paciente/bff/usuario'),
      );
      this.usuario.set(usuario);
      this.estado.set(usuario.vinculado ? 'vinculada' : 'sin-vinculo');
    } catch (error) {
      this.usuario.set(null);
      if (esErrorApi(error) && error.problema.status === 401) {
        this.estado.set('anonima');
        return;
      }
      this.error.set(error);
      this.estado.set('error');
    }
  }

  /** Full-page login through the BFF (registration too: Keycloak offers it on the same page). */
  iniciarSesion(retorno: string): void {
    this.navegador.login(retorno);
  }

  /** After `POST /paciente/api/vinculos`: the app opens up without another round trip. */
  vincular(trabajador: TrabajadorVinculado): void {
    this.trabajador.set(trabajador);
    this.usuario.update((u) => u && { ...u, vinculado: true });
    this.estado.set('vinculada');
  }

  /**
   * A `401` from `/paciente/api/*` (plan §5.2): the BFF session is gone. Say so, then log in again
   * and come back to `retorno`. Only once, however many requests fail together.
   */
  sesionExpirada(retorno: string): void {
    if (this.redirigiendo) return;
    this.redirigiendo = true;
    this.notificaciones.aviso('Tu sesión terminó', 'Te llevamos a iniciar sesión de nuevo.');
    setTimeout(() => this.iniciarSesion(retorno), ESPERA_RELOGIN_MS);
  }

  /**
   * `POST /paciente/bff/logout` ends the Keycloak session too; the reload of `/` drops everything
   * this page held. The logout is idempotent, so a failure still reloads.
   */
  async cerrarSesion(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/paciente/bff/logout', null));
    } catch {
      // Nothing to recover: the reload below starts from whatever the BFF says.
    }
    this.navegador.inicio();
  }
}
