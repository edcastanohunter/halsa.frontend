import { HttpErrorResponse } from '@angular/common/http';
import { ErrorApi, parsearProblema } from '../http/problema';
import { anonimizar, describirErrorSeguro, ManejadorErroresGlobal } from './manejador-errores';

describe('anonimizar (plan §5.3.1)', () => {
  it('removes tokens, activation codes, e-mails, query strings and documents', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';
    const texto = anonimizar(
      `Authorization: Bearer ${jwt} codigo ABC123-K7Q2M9XD4P para ana.perez@correo.co ` +
        `GET /v1/plazos?estado=ABIERTO&page=2 documento CC 1020304050`,
    );
    expect(texto).not.toContain(jwt);
    expect(texto).not.toContain('ABC123-K7Q2M9XD4P');
    expect(texto).not.toContain('ana.perez');
    expect(texto).not.toContain('estado=ABIERTO');
    expect(texto).not.toContain('1020304050');
    expect(texto).toContain('/v1/plazos?[…]');
  });

  it('keeps UUIDs (case ids are not PII)', () => {
    const id = '0199a000-0000-7000-8000-000000000a02';
    expect(anonimizar(`caso ${id}`)).toBe(`caso ${id}`);
  });
});

describe('describirErrorSeguro', () => {
  it('logs only status, codes and ids of an ErrorApi, never its detail', () => {
    const e = new ErrorApi(
      parsearProblema(403, {
        errorCode: 'Clinico.NoAsignado',
        detail: 'Paciente Juan Pérez',
        traceId: 't-1',
      }),
    );
    const linea = describirErrorSeguro(e);
    expect(linea).toContain('status=403');
    expect(linea).toContain('Clinico.NoAsignado');
    expect(linea).toContain('t-1');
    expect(linea).not.toContain('Juan');
  });

  it('drops the response body and query of an HttpErrorResponse', () => {
    const e = new HttpErrorResponse({
      status: 500,
      url: '/v1/casos?trabajador=1020304050',
      error: { detail: 'secreto clínico' },
    });
    const linea = describirErrorSeguro(e);
    expect(linea).toBe('HttpErrorResponse status=500 url=/v1/casos');
  });

  it('scrubs messages and unwraps promise rejections', () => {
    const linea = describirErrorSeguro({ rejection: new Error('falló para pepe@x.com') });
    expect(linea).toMatch(/^Error: falló para \[correo\]/);
    expect(describirErrorSeguro('cadena')).toBe('Error no estándar (string)');
  });
});

describe('ManejadorErroresGlobal', () => {
  it('writes a single scrubbed console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new ManejadorErroresGlobal().handleError(new Error('token Bearer abc.def.ghi'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![1])).not.toContain('abc.def.ghi');
    spy.mockRestore();
  });
});
