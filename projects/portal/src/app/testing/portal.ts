import {
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_PREFIX, problemaInterceptor } from '@halsa/core';
import { crearInterceptorMock, RutaMock } from '@halsa/mocks';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { crearRutasPortal, SesionMock } from '../../mocks';
import { routes } from '../app.routes';
import { csrfInterceptor, sesionExpiradaInterceptor } from '../core/http/interceptores';
import { NAVEGADOR_BFF } from '../core/sesion/navegador-bff';
import { SesionPaciente } from '../core/sesion/sesion.service';

export interface OpcionesPortal {
  sesion?: SesionMock;
  /** The mock BFF's clock (its 5/min limiter); the real one by default. */
  ahora?: () => number;
  /** Replaces the mock routes, e.g. to force an error. */
  rutas?: (base: RutaMock[]) => RutaMock[];
}

export interface PortalDePrueba {
  harness: RouterTestingHarness;
  router: Router;
  sesion: SesionPaciente;
  /** Every request the app sent, after the real interceptors (CSRF header included). */
  peticiones: HttpRequest<unknown>[];
  /** `returnUrl`s passed to the BFF login. */
  logins: string[];
  /** Hard reloads of `/` (logout). */
  inicios: { total: number };
  avisos: string[];
  /** Lets pending requests and renders settle. */
  estable(): Promise<void>;
  ir(url: string): Promise<void>;
}

/**
 * The whole portal (real routes, guards, session and interceptors) against the mock BFF, as
 * the e2e suite runs it, minus the full-page navigations, which are recorded instead.
 */
export async function abrirPortal(
  url: string,
  opciones: OpcionesPortal = {},
): Promise<PortalDePrueba> {
  const peticiones: HttpRequest<unknown>[] = [];
  const logins: string[] = [];
  const inicios = { total: 0 };
  const avisos: string[] = [];
  const registro: HttpInterceptorFn = (req, next) => {
    peticiones.push(req);
    return next(req);
  };
  const base = crearRutasPortal(opciones.sesion ?? 'vinculada', opciones.ahora);
  TestBed.configureTestingModule({
    providers: [
      { provide: API_PREFIX, useValue: '/paciente/' },
      provideHttpClient(
        withInterceptors([
          sesionExpiradaInterceptor,
          csrfInterceptor,
          problemaInterceptor,
          registro,
          crearInterceptorMock(opciones.rutas?.(base) ?? base, {
            prefijo: '/paciente/',
            retardoMs: 0,
          }),
        ]),
      ),
      provideRouter(routes, withComponentInputBinding()),
      {
        provide: NAVEGADOR_BFF,
        useValue: { login: (r: string) => logins.push(r), inicio: () => inicios.total++ },
      },
      {
        provide: Notificaciones,
        useValue: {
          exito: (t: string) => avisos.push(`exito: ${t}`),
          info: (t: string) => avisos.push(`info: ${t}`),
          aviso: (t: string) => avisos.push(`aviso: ${t}`),
          error: () => avisos.push('error'),
        },
      },
    ],
  });
  const sesion = TestBed.inject(SesionPaciente);
  await sesion.iniciar();
  const harness = await RouterTestingHarness.create();
  const estable = async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r));
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    }
  };
  const ir = async (destino: string) => {
    await harness.navigateByUrl(destino);
    await estable();
  };
  await ir(url);
  return {
    harness,
    router: TestBed.inject(Router),
    sesion,
    peticiones,
    logins,
    inicios,
    avisos,
    estable,
    ir,
  };
}

/* ---------- DOM helpers ---------- */

export const texto = (el: Element | null | undefined) =>
  el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

export const h1 = () => texto(document.querySelector('h1'));

export function boton(nombre: string | RegExp): HTMLButtonElement {
  const b = [...document.querySelectorAll('button')].find((x) =>
    typeof nombre === 'string' ? texto(x) === nombre : nombre.test(texto(x)),
  );
  if (!b) throw new Error(`No button ${nombre}`);
  return b;
}

export function enlace(nombre: string): HTMLAnchorElement {
  const a = [...document.querySelectorAll('a')].find((x) => texto(x) === nombre);
  if (!a) throw new Error(`No link ${nombre}`);
  return a;
}

/** Types into an input the way a user does: value, then the `input` event. */
export function escribir(campo: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

/** A radio card by its visible label (Angular binds `value` as a property, not an attribute). */
export function radio(etiqueta: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find((l) => texto(l).startsWith(etiqueta));
  const input = label?.querySelector('input[type="radio"]');
  if (!input) throw new Error(`No radio ${etiqueta}`);
  return input as HTMLInputElement;
}

export function enviar(selector = 'form'): void {
  document
    .querySelector(selector)!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
