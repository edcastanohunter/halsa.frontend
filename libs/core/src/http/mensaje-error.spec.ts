import { formatEspera, mensajeDeError, mensajeError } from './mensaje-error';
import { ErrorApi, parsearProblema, ProblemaApi } from './problema';

const problema = (status: number, extra: Partial<ProblemaApi> = {}): ProblemaApi => ({
  ...parsearProblema(status, null),
  ...extra,
});

describe('mensajeError (error → UI, plan §4.2)', () => {
  it('shows the server detail for 400/403/409/422', () => {
    for (const status of [400, 403, 409, 422]) {
      expect(mensajeError(problema(status, { detail: 'Texto del servidor' })).mensaje).toBe(
        'Texto del servidor',
      );
    }
  });

  it('never claims a resource does not exist on 404', () => {
    const m = mensajeError(
      problema(404, { detail: 'El caso no existe.', errorCode: 'Caso.NoEncontrado' }),
    );
    expect(m).toMatchObject({
      titulo: 'No disponible',
      mensaje: 'No existe o no está disponible para tu usuario.',
    });
  });

  it('separates step-up from an expired session on 401', () => {
    expect(mensajeError(problema(401, { stepUp: { acr: 2 } })).titulo).toBe(
      'Verificación requerida',
    );
    expect(mensajeError(problema(401)).titulo).toBe('Tu sesión terminó');
  });

  it('has special copy for Clinico.NoAsignado', () => {
    expect(mensajeError(problema(403, { errorCode: 'Clinico.NoAsignado' })).titulo).toBe(
      'No estás asignado a este caso',
    );
  });

  it('honours Retry-After on 429', () => {
    expect(mensajeError(problema(429, { retryAfterSeg: 45 })).mensaje).toBe(
      'Espera 45 segundos e intenta de nuevo.',
    );
    expect(mensajeError(problema(429)).mensaje).toBe('Espera un momento e intenta de nuevo.');
  });

  it('maps files, availability and network failures', () => {
    expect(mensajeError(problema(413)).titulo).toBe('Archivo demasiado grande');
    expect(mensajeError(problema(415)).mensaje).toBe('El archivo debe ser un PDF.');
    expect(mensajeError(problema(503)).mensaje).toBe('Intenta de nuevo en unos minutos.');
    expect(mensajeError(problema(0)).titulo).toBe('Sin conexión');
  });

  it('hides 5xx details (generic English from the server)', () => {
    const m = mensajeError(problema(500, { detail: 'An unexpected error occurred.' }));
    expect(m.titulo).toBe('Error inesperado');
    expect(m.mensaje).not.toContain('unexpected');
  });

  it('exposes traceId, else the correlation id, as the support code', () => {
    expect(mensajeError(problema(409, { traceId: 't-1', correlationId: 'c-1' })).traza).toBe('t-1');
    expect(mensajeError(problema(409, { correlationId: 'c-1' })).traza).toBe('c-1');
  });

  it('handles non-API errors', () => {
    expect(mensajeDeError(new TypeError('boom'))).toMatchObject({
      titulo: 'Error inesperado',
      traza: null,
    });
    expect(mensajeDeError(new ErrorApi(problema(404))).titulo).toBe('No disponible');
  });
});

describe('formatEspera', () => {
  it('rounds to coarse Spanish units', () => {
    expect(formatEspera(1)).toBe('1 segundo');
    expect(formatEspera(59)).toBe('59 segundos');
    expect(formatEspera(60)).toBe('1 minuto');
    expect(formatEspera(121)).toBe('3 minutos');
  });
});
