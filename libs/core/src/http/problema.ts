/** One validation message, normalized from either backend shape (plan §4.2). */
export interface ErrorValidacion {
  /** JSON path of the field (`errors: { "path": [...] }` shape), when known. */
  campo: string | null;
  /** Machine code (`errors: [{ code, description }]` shape), when known. */
  codigo: string | null;
  mensaje: string;
}

/** RFC 9470 challenge read from `WWW-Authenticate` (plan §5.1.4). */
export interface DesafioStepUp {
  acr: number;
  /** Seconds since the last authentication the policy accepts (`max_age`), when required. */
  maxAge?: number;
}

/** A failed API call, typed (plan §5.1.3). `status` 0 means the request never got an answer. */
export interface ProblemaApi {
  status: number;
  /** Stable machine code: `errorCode ?? code` (gap G13). */
  errorCode: string | null;
  title: string | null;
  /** Spanish, user-presentable text from the server. */
  detail: string | null;
  traceId: string | null;
  /** The `X-Correlation-Id` the client sent with the request. */
  correlationId: string | null;
  errors: ErrorValidacion[];
  stepUp?: DesafioStepUp;
  /** Seconds to wait, from `Retry-After` (429/503). */
  retryAfterSeg?: number;
}

/** What the problem interceptor rethrows, so callers can branch on `problema`. */
export class ErrorApi extends Error {
  constructor(readonly problema: ProblemaApi) {
    super(`HTTP ${problema.status}${problema.errorCode ? ` ${problema.errorCode}` : ''}`);
    this.name = 'ErrorApi';
  }
}

export function esErrorApi(error: unknown): error is ErrorApi {
  return error instanceof ErrorApi;
}

interface Cabeceras {
  get(nombre: string): string | null;
}

const PARAMETRO_AUTH = /([A-Za-z_]+)\s*=\s*(?:"([^"]*)"|([^\s,]+))/g;

/**
 * Parses `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="2",
 * max_age="900"`. Any other challenge (expired or missing token) is not a step-up.
 */
export function parsearWwwAuthenticate(
  valor: string | null | undefined,
): DesafioStepUp | undefined {
  if (!valor || !/^\s*Bearer\b/i.test(valor)) return undefined;
  const parametros = new Map<string, string>();
  for (const [, nombre, citado, simple] of valor.matchAll(PARAMETRO_AUTH)) {
    parametros.set(nombre!.toLowerCase(), citado ?? simple ?? '');
  }
  if (parametros.get('error') !== 'insufficient_user_authentication') return undefined;

  // acr_values is a space-separated list; the strongest numeric level is the one to reach.
  const niveles = (parametros.get('acr_values') ?? '')
    .split(/\s+/)
    .map((v) => Number.parseInt(v, 10))
    .filter((n) => Number.isFinite(n));
  const desafio: DesafioStepUp = { acr: niveles.length ? Math.max(...niveles) : 2 };
  const maxAge = Number.parseInt(parametros.get('max_age') ?? '', 10);
  if (Number.isFinite(maxAge) && maxAge >= 0) desafio.maxAge = maxAge;
  return desafio;
}

/** `Retry-After` as seconds: either delta-seconds or an HTTP date. */
export function parsearRetryAfter(
  valor: string | null | undefined,
  ahora: number = Date.now(),
): number | undefined {
  if (!valor) return undefined;
  const texto = valor.trim();
  if (/^\d+$/.test(texto)) return Number.parseInt(texto, 10);
  const fecha = Date.parse(texto);
  if (Number.isNaN(fecha)) return undefined;
  return Math.max(0, Math.ceil((fecha - ahora) / 1000));
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

function normalizarErrores(errores: unknown): ErrorValidacion[] {
  // Staff endpoints: [{ code, description }].
  if (Array.isArray(errores)) {
    return errores.flatMap((e): ErrorValidacion[] => {
      if (typeof e === 'string') return [{ campo: null, codigo: null, mensaje: e }];
      if (!e || typeof e !== 'object') return [];
      const { code, description } = e as Record<string, unknown>;
      const mensaje = texto(description) ?? texto(code);
      return mensaje ? [{ campo: null, codigo: texto(code), mensaje }] : [];
    });
  }
  // Integration-style validators: { "json.path": ["msg", ...] }.
  if (errores && typeof errores === 'object') {
    return Object.entries(errores as Record<string, unknown>).flatMap(([campo, mensajes]) =>
      (Array.isArray(mensajes) ? mensajes : [mensajes])
        .map(texto)
        .filter((m): m is string => m !== null)
        .map((mensaje) => ({ campo, codigo: null, mensaje })),
    );
  }
  return [];
}

function comoObjeto(cuerpo: unknown): Record<string, unknown> | null {
  if (typeof cuerpo === 'string') {
    try {
      return comoObjeto(JSON.parse(cuerpo));
    } catch {
      return null;
    }
  }
  return cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)
    ? (cuerpo as Record<string, unknown>)
    : null;
}

/**
 * Builds a `ProblemaApi` from any error response: RFC 9457 problem+json, a JSON string (text or
 * blob responses), an empty body or a network failure (`status` 0).
 */
export function parsearProblema(
  status: number,
  cuerpo: unknown,
  cabeceras?: Cabeceras | null,
  correlationId: string | null = null,
): ProblemaApi {
  const json = comoObjeto(cuerpo);
  const problema: ProblemaApi = {
    status,
    errorCode: texto(json?.['errorCode']) ?? texto(json?.['code']),
    title: texto(json?.['title']),
    detail: texto(json?.['detail']),
    traceId: texto(json?.['traceId']),
    correlationId,
    errors: normalizarErrores(json?.['errors']),
  };
  if (status === 401) {
    const stepUp = parsearWwwAuthenticate(cabeceras?.get('WWW-Authenticate'));
    if (stepUp) problema.stepUp = stepUp;
  }
  const retryAfter = parsearRetryAfter(cabeceras?.get('Retry-After'));
  if (retryAfter !== undefined) problema.retryAfterSeg = retryAfter;
  return problema;
}
