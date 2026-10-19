import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
// Deep entry point: this service is in the initial bundle (via the interceptor), the barrel isn't.
import { Notificaciones } from '@halsa/ui/notificaciones';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom, Observable } from 'rxjs';
import { cumpleNivel } from '../auth/claims';
import { SesionService } from '../sesion/sesion.service';

/** What a clinical section or a 401 challenge asks for (plan §5.1.4). */
export interface RequisitoVerificacion {
  acr: number;
  /** Max seconds since the last authentication (the dictamen's 15-minute window). */
  maxAgeSeg?: number;
}

/** A gate with a time window closes this long before the server's does. */
export const MARGEN_VENTANA_SEG = 120;
const TICK_MS = 15_000;

export type FaseSolicitud = 'pedir' | 'bloqueado';

interface Solicitud {
  requisito: RequisitoVerificacion;
  /** Proactive gates open the dialog only when the popup is blocked. */
  fase: FaseSolicitud;
  resolver: (verificado: boolean) => void;
}

const BLOQUEADO = Symbol('popup bloqueado');

/**
 * Step-up to `acr=2` (RFC 9470) through a Keycloak popup, so unsaved forms survive. A blocked
 * popup falls back, after confirmation, to a full redirect that returns to the same URL.
 */
@Injectable({ providedIn: 'root' })
export class StepUpService {
  private readonly oidc = inject(OidcSecurityService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(Notificaciones);
  private readonly ventana = inject(DOCUMENT).defaultView;

  /** Wall clock in seconds, so time-windowed gates close on their own. */
  private readonly ahoraSeg = signal(Math.floor(Date.now() / 1000));
  readonly verificando = signal(false);
  private readonly solicitudActual = signal<Solicitud | null>(null);
  readonly solicitud = computed(() => {
    const s = this.solicitudActual();
    return s && { requisito: s.requisito, fase: s.fase };
  });
  private enCurso: Promise<boolean> | null = null;

  constructor() {
    const id = setInterval(() => this.ahoraSeg.set(Math.floor(Date.now() / 1000)), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  /** Reactive: whether the current token meets `requisito` (with the window margin). */
  cumple(requisito: RequisitoVerificacion): boolean {
    const sesion = this.sesion.sesion();
    return (
      !!sesion &&
      cumpleNivel(sesion, { ...requisito, margenSeg: MARGEN_VENTANA_SEG }, this.ahoraSeg())
    );
  }

  /** Proactive gate: "Verificar identidad" opens the popup right away (user activation). */
  verificar(requisito: RequisitoVerificacion): Promise<boolean> {
    return this.compartido(() => this.conPopup(requisito));
  }

  /** Reactive: a step-up 401 asks first in a dialog; the interceptor retries on `true`. */
  solicitar(requisito: RequisitoVerificacion): Promise<boolean> {
    return this.compartido(
      () =>
        new Promise<boolean>((resolver) =>
          this.solicitudActual.set({ requisito, fase: 'pedir', resolver }),
        ),
    );
  }

  /** Dialog "Verificar identidad". */
  async confirmarSolicitud(): Promise<void> {
    const actual = this.solicitudActual();
    if (!actual || actual.fase !== 'pedir') return;
    const verificado = await this.abrirPopup(actual.requisito);
    if (verificado === BLOQUEADO) {
      this.solicitudActual.set({ ...actual, fase: 'bloqueado' });
      return;
    }
    this.terminar(verificado);
  }

  /** Blocked popup: continue in this tab. Only the URL is kept, never the form (plan §5.1.4). */
  continuarEnEstaPestana(): void {
    const actual = this.solicitudActual();
    if (!actual) return;
    this.sesion.iniciarSesion(this.router.url, parametros(actual.requisito));
  }

  cancelar(): void {
    this.terminar(false);
  }

  private async conPopup(requisito: RequisitoVerificacion): Promise<boolean> {
    const verificado = await this.abrirPopup(requisito);
    if (verificado !== BLOQUEADO) return verificado;
    return new Promise<boolean>((resolver) =>
      this.solicitudActual.set({ requisito, fase: 'bloqueado', resolver }),
    );
  }

  private async abrirPopup(requisito: RequisitoVerificacion): Promise<boolean | typeof BLOQUEADO> {
    this.verificando.set(true);
    try {
      const respuesta = await firstValueFrom(
        this.detectarBloqueo(this.oidc.authorizeWithPopUp({ customParams: parametros(requisito) })),
      );
      if (respuesta === BLOQUEADO) return BLOQUEADO;
      if (!respuesta.isAuthenticated) return false; // closed by the user: no toast
      this.sesion.actualizarNivel(respuesta.accessToken);
      this.ahoraSeg.set(Math.floor(Date.now() / 1000));
      if (this.cumple(requisito)) return true;
      this.notificaciones.aviso(
        'No se completó la verificación reforzada',
        'Revisa que tengas configurado tu código de verificación e intenta de nuevo.',
      );
      return false;
    } catch (error) {
      this.notificaciones.error(error);
      return false;
    } finally {
      this.verificando.set(false);
    }
  }

  /**
   * `authorizeWithPopUp` never emits when `window.open` returns null, so the one call it makes is
   * observed here and turned into `BLOQUEADO`.
   */
  private detectarBloqueo(
    flujo: Observable<LoginResponse>,
  ): Observable<LoginResponse | typeof BLOQUEADO> {
    const ventana = this.ventana;
    if (!ventana) return flujo;
    return new Observable((suscriptor) => {
      const original = ventana.open;
      ventana.open = function (...args: Parameters<Window['open']>) {
        ventana.open = original;
        const abierta = original.apply(ventana, args);
        if (!abierta) {
          suscriptor.next(BLOQUEADO);
          suscriptor.complete();
        }
        return abierta;
      };
      const suscripcion = flujo.subscribe(suscriptor);
      return () => {
        ventana.open = original;
        suscripcion.unsubscribe();
      };
    });
  }

  private terminar(verificado: boolean): void {
    const actual = this.solicitudActual();
    this.solicitudActual.set(null);
    actual?.resolver(verificado);
  }

  /** Concurrent 401s (or a double click) share one verification. */
  private compartido(iniciar: () => Promise<boolean>): Promise<boolean> {
    this.enCurso ??= iniciar().finally(() => (this.enCurso = null));
    return this.enCurso;
  }
}

/**
 * `acr_values` plus, for a time window, `max_age` minus the margin, so Keycloak re-authenticates
 * whenever the gate would still be closed afterwards.
 */
export function parametros(requisito: RequisitoVerificacion): Record<string, string> {
  const params: Record<string, string> = { acr_values: String(requisito.acr) };
  if (requisito.maxAgeSeg !== undefined) {
    params['max_age'] = String(Math.max(0, requisito.maxAgeSeg - MARGEN_VENTANA_SEG));
  }
  return params;
}
