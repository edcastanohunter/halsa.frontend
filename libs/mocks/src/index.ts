// @halsa/mocks: dev-only mock adapter plumbing (plan §9). Never imported by production code
// paths: the lint rule bans `**/mocks` imports outside mocks/ and dev.providers.ts, and
// scripts/check-bundles.mjs fails the build if the `__mock` marker reaches a production chunk.
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHeaders,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, switchMap, throwError, timer } from 'rxjs';

/** Header every mocked response carries; also the marker the bundle check looks for. */
export const CABECERA_ORIGEN_MOCK = { 'X-Halsa-Origen': '__mock' } as const;

export interface PeticionMock {
  req: HttpRequest<unknown>;
  params: Readonly<Record<string, string>>;
  query: URLSearchParams;
  /** Unverified access-token claims, when the request carries a Bearer token. */
  claims: ClaimsMock | null;
}

export interface RespuestaMock {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RutaMock {
  metodo: Metodo;
  /** Path with `:params`, e.g. `/v1/casos/:casoId`. */
  ruta: string;
  /** Async for handlers that read multipart bodies. */
  manejar: (peticion: PeticionMock) => RespuestaMock | Promise<RespuestaMock>;
}

export interface ClaimsMock {
  sub?: string;
  acr?: string | number;
  auth_time?: number;
  tenant_id?: string;
  ips_id?: string;
  actor_tipo?: string;
  resource_access?: Record<string, { roles?: string[] }>;
  [claim: string]: unknown;
}

export interface OpcionesMock {
  /** Only requests under this prefix are mocked; the rest go to the network. */
  prefijo: string;
  /** Simulated latency, so loading states are visible. */
  retardoMs?: number;
}

/* ---------- responses ---------- */

export const ok = (body: unknown, headers?: Record<string, string>): RespuestaMock => ({
  status: 200,
  body,
  headers,
});
export const creado = (body: unknown, location?: string): RespuestaMock => ({
  status: 201,
  body,
  headers: location ? { Location: location } : undefined,
});
export const sinContenido = (): RespuestaMock => ({ status: 204, body: null });

const TITULOS: Record<number, string> = {
  400: 'Validation failed',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  413: 'Content too large',
  415: 'Unsupported media type',
  422: 'Unprocessable content',
  429: 'Too many requests',
  503: 'Service unavailable',
};

/** An RFC 9457 body shaped like the backend's `CustomResults.Problem` (`errorCode`, `traceId`). */
export function problema(
  status: number,
  errorCode: string,
  detail: string,
  extra: { headers?: Record<string, string>; errors?: unknown } = {},
): RespuestaMock {
  return {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...extra.headers },
    body: {
      type: 'https://tools.ietf.org/html/rfc9110',
      title: TITULOS[status] ?? 'Error',
      status,
      detail,
      errorCode,
      traceId: `00-${crypto.randomUUID().replaceAll('-', '')}-${'0'.repeat(15)}1-01`,
      ...(extra.errors !== undefined ? { errors: extra.errors } : {}),
    },
  };
}

export const noEncontrado = (errorCode: string, detail = 'El recurso no existe.') =>
  problema(404, errorCode, detail);

/** RFC 9470 challenge, exactly as `AuditingAuthorizationResultHandler.WwwAuthenticate` builds it. */
export function stepUp(maxAgeSeg?: number): RespuestaMock {
  const desafio =
    'Bearer error="insufficient_user_authentication", acr_values="2"' +
    (maxAgeSeg !== undefined ? `, max_age="${maxAgeSeg}"` : '');
  return problema(
    401,
    'Auth.StepUpRequerido',
    'Esta operación requiere verificación reforzada de identidad.',
    { headers: { 'WWW-Authenticate': desafio } },
  );
}

/* ---------- request helpers ---------- */

/** Decodes the JWT payload without verifying it: good enough to read acr/auth_time in dev. */
export function leerClaims(req: HttpRequest<unknown>): ClaimsMock | null {
  const auth = req.headers.get('Authorization');
  const payload = auth?.match(/^Bearer\s+[\w-]+\.([\w-]+)\.[\w-]*$/)?.[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) =>
        c.charCodeAt(0),
      ),
    );
    return JSON.parse(json) as ClaimsMock;
  } catch {
    return null;
  }
}

export function nivelAcr(claims: ClaimsMock | null): number {
  const acr = Number.parseInt(String(claims?.acr ?? ''), 10);
  return Number.isFinite(acr) ? acr : 0;
}

/** Step-up check of the clinical policies: `acr ≥ 2`, plus a recent `auth_time` if `maxAgeSeg`. */
export function exigirStepUp(
  claims: ClaimsMock | null,
  maxAgeSeg?: number,
  ahora: number = Date.now(),
): RespuestaMock | null {
  if (nivelAcr(claims) < 2) return stepUp(maxAgeSeg);
  if (maxAgeSeg !== undefined) {
    const autenticadoEn = claims?.auth_time;
    if (!autenticadoEn || ahora / 1000 - autenticadoEn > maxAgeSeg) return stepUp(maxAgeSeg);
  }
  return null;
}

export interface PaginaMock<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** `PagedList<T>` from the `page`/`pageSize` query params (plan §4.1). */
export function paginar<T>(
  items: readonly T[],
  query: URLSearchParams,
  maximo = 100,
): PaginaMock<T> {
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    maximo,
    Math.max(1, Number.parseInt(query.get('pageSize') ?? '20', 10) || 20),
  );
  const totalPages = Math.ceil(items.length / pageSize);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalCount: items.length,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/** The JSON body of a request, or the `datos` part of a multipart one (incapacidad upload). */
export async function cuerpoJson<T>(req: HttpRequest<unknown>): Promise<T | null> {
  const body = req.body;
  if (body instanceof FormData) {
    const datos = body.get('datos');
    if (datos instanceof Blob) return JSON.parse(await datos.text()) as T;
    return typeof datos === 'string' ? (JSON.parse(datos) as T) : null;
  }
  return (body ?? null) as T | null;
}

/* ---------- interceptor ---------- */

interface RutaCompilada extends RutaMock {
  patron: RegExp;
  nombres: string[];
}

function compilar(ruta: RutaMock): RutaCompilada {
  const nombres: string[] = [];
  const fuente = ruta.ruta
    .split('/')
    .map((segmento) => {
      if (!segmento.startsWith(':')) return segmento.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      nombres.push(segmento.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { ...ruta, patron: new RegExp(`^${fuente}/?$`), nombres };
}

/**
 * Like a real response, every JSON body is a fresh object: handlers return fixture references,
 * and sharing them would let a later mutation leak into data the app already holds.
 */
function copiaJson(body: unknown): unknown {
  const esJson =
    Array.isArray(body) ||
    (typeof body === 'object' && body !== null && Object.getPrototypeOf(body) === Object.prototype);
  return esJson ? structuredClone(body) : body;
}

function responder(req: HttpRequest<unknown>, r: RespuestaMock): Observable<HttpEvent<unknown>> {
  const headers = new HttpHeaders({ ...CABECERA_ORIGEN_MOCK, ...r.headers });
  if (r.status < 400) {
    return of(
      new HttpResponse({
        status: r.status,
        body: copiaJson(r.body) ?? null,
        headers,
        url: req.url,
      }),
    );
  }
  return throwError(
    () => new HttpErrorResponse({ status: r.status, error: r.body, headers, url: req.url }),
  );
}

/**
 * An interceptor that answers API requests from in-memory handlers. It must be the last one in
 * the chain, so the real interceptors (auth, correlation, problem parsing) still run.
 */
export function crearInterceptorMock(
  rutas: readonly RutaMock[],
  opciones: OpcionesMock,
): HttpInterceptorFn {
  const compiladas = rutas.map(compilar);
  const retardo = opciones.retardoMs ?? 350;

  return (req, next) => {
    const url = new URL(req.urlWithParams, 'http://mock.local');
    if (!url.pathname.startsWith(opciones.prefijo)) return next(req);

    let params: Record<string, string> | null = null;
    const ruta = compiladas.find((r) => {
      if (r.metodo !== req.method) return false;
      const m = r.patron.exec(url.pathname);
      if (!m) return false;
      params = Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1]!)]));
      return true;
    });

    const peticion: PeticionMock = {
      req,
      params: params ?? {},
      query: url.searchParams,
      claims: leerClaims(req),
    };
    const respuesta = ruta
      ? Promise.resolve().then(() => ruta.manejar(peticion))
      : Promise.resolve(
          problema(501, 'Mock.SinFixture', `No hay fixture para ${req.method} ${url.pathname}.`),
        );

    return timer(retardo).pipe(
      switchMap(() => respuesta),
      switchMap((r) => responder(req, r)),
    );
  };
}
