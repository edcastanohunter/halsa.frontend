import { HttpHeaders } from '@angular/common/http';
import {
  ErrorApi,
  esErrorApi,
  parsearProblema,
  parsearRetryAfter,
  parsearWwwAuthenticate,
} from './problema';

describe('parsearProblema (RFC 9457, plan §4.2)', () => {
  it('reads the backend shape with errorCode and traceId', () => {
    const p = parsearProblema(404, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
      title: 'Not found',
      status: 404,
      detail: 'El caso no existe.',
      errorCode: 'Caso.NoEncontrado',
      traceId: '00-abc-01',
    });
    expect(p).toEqual({
      status: 404,
      errorCode: 'Caso.NoEncontrado',
      title: 'Not found',
      detail: 'El caso no existe.',
      traceId: '00-abc-01',
      correlationId: null,
      errors: [],
    });
  });

  it('falls back to `code` when `errorCode` is missing (gap G13)', () => {
    expect(parsearProblema(400, { code: 'FURAT_FECHA_FUTURA' }).errorCode).toBe(
      'FURAT_FECHA_FUTURA',
    );
    expect(parsearProblema(400, { errorCode: 'A', code: 'B' }).errorCode).toBe('A');
  });

  it('normalizes staff validation errors: [{ code, description }]', () => {
    const p = parsearProblema(400, {
      errorCode: 'General.Validation',
      errors: [
        { code: 'nota', description: 'La nota debe tener entre 10 y 1000 caracteres.' },
        { code: 'Solo.Codigo' },
      ],
    });
    expect(p.errors).toEqual([
      { campo: null, codigo: 'nota', mensaje: 'La nota debe tener entre 10 y 1000 caracteres.' },
      { campo: null, codigo: 'Solo.Codigo', mensaje: 'Solo.Codigo' },
    ]);
  });

  it('normalizes integration validation errors: { "json.path": [msg] }', () => {
    const p = parsearProblema(400, {
      errors: { dias: ['Los días deben estar entre 1 y 30.'], 'ipsEmisora.codigoReps': ['A', 'B'] },
    });
    expect(p.errors).toEqual([
      { campo: 'dias', codigo: null, mensaje: 'Los días deben estar entre 1 y 30.' },
      { campo: 'ipsEmisora.codigoReps', codigo: null, mensaje: 'A' },
      { campo: 'ipsEmisora.codigoReps', codigo: null, mensaje: 'B' },
    ]);
  });

  it('parses JSON text bodies and tolerates empty or non-JSON ones', () => {
    expect(parsearProblema(409, '{"errorCode":"Plazo.NoCumplible"}').errorCode).toBe(
      'Plazo.NoCumplible',
    );
    expect(parsearProblema(502, '<html>Bad gateway</html>')).toMatchObject({
      status: 502,
      errorCode: null,
      detail: null,
    });
    expect(parsearProblema(0, null)).toMatchObject({ status: 0, errorCode: null, errors: [] });
  });

  it('attaches the step-up challenge only to 401s', () => {
    const cabeceras = new HttpHeaders({
      'WWW-Authenticate':
        'Bearer error="insufficient_user_authentication", acr_values="2", max_age="900"',
    });
    expect(parsearProblema(401, {}, cabeceras).stepUp).toEqual({ acr: 2, maxAge: 900 });
    expect(parsearProblema(403, {}, cabeceras).stepUp).toBeUndefined();
    expect(parsearProblema(401, {}, new HttpHeaders()).stepUp).toBeUndefined();
  });

  it('keeps the correlation id and Retry-After', () => {
    const p = parsearProblema(429, null, new HttpHeaders({ 'Retry-After': '42' }), 'corr-1');
    expect(p.correlationId).toBe('corr-1');
    expect(p.retryAfterSeg).toBe(42);
  });
});

describe('parsearWwwAuthenticate (RFC 9470)', () => {
  it('reads acr_values without max_age (incapacidad upload)', () => {
    expect(
      parsearWwwAuthenticate('Bearer error="insufficient_user_authentication", acr_values="2"'),
    ).toEqual({ acr: 2 });
  });

  it('takes the strongest level of a list and unquoted params', () => {
    expect(
      parsearWwwAuthenticate(
        'Bearer error=insufficient_user_authentication, acr_values="1 2", max_age=300',
      ),
    ).toEqual({ acr: 2, maxAge: 300 });
  });

  it('ignores other challenges (expired token is a re-login, not a step-up)', () => {
    expect(
      parsearWwwAuthenticate('Bearer error="invalid_token", error_description="expired"'),
    ).toBeUndefined();
    expect(parsearWwwAuthenticate('Bearer')).toBeUndefined();
    expect(parsearWwwAuthenticate('Basic realm="x"')).toBeUndefined();
    expect(parsearWwwAuthenticate(null)).toBeUndefined();
  });
});

describe('parsearRetryAfter', () => {
  it('accepts delta-seconds and HTTP dates', () => {
    const ahora = Date.parse('2026-10-19T15:00:00Z');
    expect(parsearRetryAfter('120', ahora)).toBe(120);
    expect(parsearRetryAfter('Mon, 19 Oct 2026 15:00:30 GMT', ahora)).toBe(30);
    expect(parsearRetryAfter('Mon, 19 Oct 2026 14:00:00 GMT', ahora)).toBe(0);
    expect(parsearRetryAfter('pronto', ahora)).toBeUndefined();
  });
});

describe('ErrorApi', () => {
  it('is a typed Error whose message carries no detail text', () => {
    const e = new ErrorApi(
      parsearProblema(403, { errorCode: 'Clinico.NoAsignado', detail: 'Juan Pérez' }),
    );
    expect(esErrorApi(e)).toBe(true);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('HTTP 403 Clinico.NoAsignado');
    expect(esErrorApi(new Error('x'))).toBe(false);
  });
});
