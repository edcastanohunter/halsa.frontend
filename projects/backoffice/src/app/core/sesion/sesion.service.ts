import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { UsuarioYo } from '@halsa/api-types';
import { APP_CONFIG } from '@halsa/core';
import { EventTypes, OidcSecurityService, PublicEventsService } from 'angular-auth-oidc-client';
import { filter, firstValueFrom, switchMap } from 'rxjs';
import { decodificarJwt, NivelVerificacion, nivelDesdeClaims } from '../auth/claims';
import { guardarRetorno, RUTA_CALLBACK } from '../auth/retorno';

/** Plan §5.1.1. */
export interface SesionPersonal extends NivelVerificacion {
  sub: string;
  nombre: string | null;
  correo: string | null;
  actorTipo: 'arl' | 'ips';
  tenantId: string | null;
  ipsId: string | null;
  permisos: ReadonlySet<string>;
}

/**
 * - `iniciando`: before `checkAuth` (or inside the step-up popup, which only hands the code back);
 * - `anonima`: no tokens, the auth guard starts the login;
 * - `sin-acceso`: authenticated, but not an ARL/IPS actor;
 * - `error`: Keycloak or `identidad/yo` failed; the shell offers retry and logout.
 */
export type EstadoSesion = 'iniciando' | 'anonima' | 'lista' | 'sin-acceso' | 'error';

type Identidad = Omit<SesionPersonal, keyof NivelVerificacion>;

/** The staff session: tokens from the OIDC client, identity and permissions from the API. */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly oidc = inject(OidcSecurityService);
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  readonly estado = signal<EstadoSesion>('iniciando');
  readonly error = signal<unknown>(null);
  private readonly identidad = signal<Identidad | null>(null);
  private readonly nivel = signal<NivelVerificacion>({ acr: 0, authTime: null });
  private idToken = '';
  private redirigiendo = false;

  readonly sesion = computed<SesionPersonal | null>(() => {
    const identidad = this.identidad();
    return identidad && { ...identidad, ...this.nivel() };
  });

  constructor() {
    // Silent renew and step-ups replace the tokens; acr/auth_time follow the newest one.
    inject(PublicEventsService)
      .registerForEvents()
      .pipe(
        filter((evento) => evento.type === EventTypes.NewAuthenticationResult),
        switchMap(() => this.oidc.getAccessToken()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((token) => this.actualizarNivel(token));
  }

  /** App initializer: resolves the OIDC callback, then loads `identidad/yo`. Never throws. */
  async iniciar(): Promise<void> {
    try {
      const resultado = await firstValueFrom(this.oidc.checkAuth());
      // In the step-up popup, checkAuth only posts the code to the opener, which closes it.
      if (this.enVentanaVerificacion()) return;
      if (!resultado.isAuthenticated) {
        this.estado.set('anonima');
        return;
      }
      this.idToken = resultado.idToken;
      this.actualizarNivel(resultado.accessToken);
      await this.cargarIdentidad();
    } catch (error) {
      this.fallar(error);
    }
  }

  /** Retry after an `error` state. */
  async cargarIdentidad(): Promise<void> {
    this.error.set(null);
    try {
      const yo = await firstValueFrom(
        this.http.get<UsuarioYo>(`${this.config.apiBaseUrl}/v1/identidad/yo`),
      );
      const id = (decodificarJwt(this.idToken) ?? {}) as Record<string, unknown>;
      const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
      if (yo.actorTipo !== 'arl' && yo.actorTipo !== 'ips') {
        this.identidad.set(null);
        this.estado.set('sin-acceso');
        return;
      }
      this.identidad.set({
        sub: yo.sub,
        nombre: texto(id['name']) ?? texto(id['preferred_username']),
        correo: texto(id['email']),
        actorTipo: yo.actorTipo,
        tenantId: yo.tenantId,
        ipsId: yo.ipsId,
        permisos: new Set(yo.permisos),
      });
      this.estado.set('lista');
    } catch (error) {
      this.fallar(error);
    }
  }

  /** Full-page login; `retorno` is where the callback lands. */
  iniciarSesion(retorno: string, customParams?: Record<string, string>): void {
    guardarRetorno(retorno);
    this.oidc.authorize(undefined, customParams ? { customParams } : undefined);
  }

  /**
   * A 401 without a step-up challenge (plan §5.1.3): the refresh token is gone too, so log in again
   * and come back here. Only for a ready session, so a failing bootstrap can't loop on Keycloak.
   */
  sesionExpirada(retorno: string): void {
    if (this.estado() !== 'lista' || this.redirigiendo) return;
    this.redirigiendo = true;
    this.iniciarSesion(retorno);
  }

  /**
   * Keycloak end-session, which redirects to `/`: the full reload is what guarantees that no
   * clinical data stays in memory (plan §5.1.6).
   */
  cerrarSesion(): void {
    this.identidad.set(null);
    this.oidc.logoff().subscribe({ error: () => globalThis.location.assign('/') });
  }

  actualizarNivel(accessToken: string | null | undefined): void {
    if (accessToken) this.nivel.set(nivelDesdeClaims(decodificarJwt(accessToken)));
  }

  private enVentanaVerificacion(): boolean {
    const ventana = globalThis.window;
    return (
      !!ventana?.opener && ventana.opener !== ventana && ventana.location.pathname === RUTA_CALLBACK
    );
  }

  private fallar(error: unknown): void {
    this.error.set(error);
    this.estado.set('error');
  }
}
