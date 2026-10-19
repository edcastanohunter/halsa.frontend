import { HttpErrorResponse } from '@angular/common/http';
import {
  EnvironmentProviders,
  ErrorHandler,
  Injectable,
  makeEnvironmentProviders,
} from '@angular/core';
import { ErrorApi } from '../http/problema';

const REEMPLAZOS: readonly [RegExp, string][] = [
  // JWTs (access/id tokens) and anything after "Bearer".
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[jwt]'],
  [/\bBearer\s+\S+/gi, 'Bearer [token]'],
  // Activation codes (ABC123-K7Q2M9XD4P).
  [/\b[A-Z0-9]{6}-[A-Z0-9]{10}\b/g, '[codigo]'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]'],
  // Query strings may carry filters or ids.
  [/(\/[\w./-]*)\?[^\s"'`)]*/g, '$1?[…]'],
  // Documents, phones: long digit runs that aren't part of a UUID or a word.
  [/(?<![\w-])\d{5,}(?![\w-])/g, '[numero]'],
];

const MAX_LINEAS_PILA = 8;

/** Removes tokens, codes, e-mails, query strings and document-like numbers from free text. */
export function anonimizar(texto: string): string {
  return REEMPLAZOS.reduce((t, [patron, reemplazo]) => t.replace(patron, reemplazo), texto);
}

function sinConsulta(url: string | null): string {
  return url ? url.replace(/[?#].*$/, '') : '';
}

/**
 * One line that is safe to log: never a response body, a problem `detail` (it may quote patient
 * data) or a request payload. Only status, codes, ids and a scrubbed message/stack.
 */
export function describirErrorSeguro(error: unknown): string {
  const causa =
    error && typeof error === 'object' && 'rejection' in error
      ? (error as { rejection: unknown }).rejection
      : error;

  if (causa instanceof ErrorApi) {
    const { status, errorCode, traceId, correlationId } = causa.problema;
    return anonimizar(
      `ErrorApi status=${status} errorCode=${errorCode ?? '-'} traceId=${traceId ?? '-'} correlationId=${correlationId ?? '-'}`,
    );
  }
  if (causa instanceof HttpErrorResponse) {
    return anonimizar(`HttpErrorResponse status=${causa.status} url=${sinConsulta(causa.url)}`);
  }
  if (causa instanceof Error) {
    const pila = (causa.stack ?? '')
      .split('\n')
      .slice(1, MAX_LINEAS_PILA + 1)
      .join('\n');
    return anonimizar(`${causa.name}: ${causa.message}${pila ? `\n${pila}` : ''}`);
  }
  return `Error no estándar (${typeof causa})`;
}

/**
 * Global `ErrorHandler` (plan §5.3.1): the only place allowed to use `console.error`, and only
 * with scrubbed text. No error reporter is wired, so nothing leaves the browser.
 */
@Injectable()
export class ManejadorErroresGlobal implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[halsa]', describirErrorSeguro(error));
  }
}

export function provideManejadorErrores(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: ErrorHandler, useClass: ManejadorErroresGlobal }]);
}
