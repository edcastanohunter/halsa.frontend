import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { API_PREFIX, ErrorApi, problemaInterceptor, ProblemaApi } from '@halsa/core';
import { crearInterceptorMock } from '@halsa/mocks';
import { firstValueFrom } from 'rxjs';
import {
  CASO_PACIENTE,
  CODIGO_OTRO_DOCUMENTO,
  CODIGO_VALIDO,
  crearRutasPortal,
  SesionMock,
} from '.';

describe('portal mock adapter (BFF)', () => {
  let http: HttpClient;
  let reloj: number;

  function configurar(sesion: SesionMock) {
    reloj = Date.parse('2026-10-19T15:00:00Z');
    TestBed.configureTestingModule({
      providers: [
        { provide: API_PREFIX, useValue: '/paciente/' },
        provideHttpClient(
          withInterceptors([
            problemaInterceptor,
            crearInterceptorMock(
              crearRutasPortal(sesion, () => reloj),
              {
                prefijo: '/paciente/',
                retardoMs: 0,
              },
            ),
          ]),
        ),
      ],
    });
    http = TestBed.inject(HttpClient);
  }

  const error = (p: Promise<unknown>): Promise<ProblemaApi> =>
    p.then(
      () => expect.unreachable('expected an error'),
      (e: ErrorApi) => e.problema,
    );
  const canjear = (codigo: string) =>
    firstValueFrom(http.post('/paciente/api/vinculos', { codigo }));

  it('no session → 401 on the BFF and the API', async () => {
    configurar('anonima');
    expect((await error(firstValueFrom(http.get('/paciente/bff/usuario')))).status).toBe(401);
    expect((await error(firstValueFrom(http.get('/paciente/api/mis-casos')))).status).toBe(401);
  });

  it('activation: invalid, other document, valid', async () => {
    configurar('sin-vinculo');
    expect((await error(canjear('MAL'))).errorCode).toBe('Paciente.CodigoInvalido');
    expect((await error(canjear(CODIGO_OTRO_DOCUMENTO))).errorCode).toBe(
      'Paciente.VinculoDistinto',
    );
    await canjear(CODIGO_VALIDO);
    await expect(firstValueFrom(http.get('/paciente/bff/usuario'))).resolves.toMatchObject({
      vinculado: true,
    });
  });

  it('activation is rate limited to 5/min with Retry-After', async () => {
    configurar('sin-vinculo');
    for (let i = 0; i < 5; i++) await error(canjear('X'));
    reloj += 15_000;
    expect(await error(canjear(CODIGO_VALIDO))).toMatchObject({ status: 429, retryAfterSeg: 45 });
    reloj += 46_000;
    await expect(canjear(CODIGO_VALIDO)).resolves.toBeTruthy();
  });

  it('a second open copy request for a case is a 409', async () => {
    configurar('vinculada');
    const url = `/paciente/api/casos/${CASO_PACIENTE.activo}/solicitudes-copia-hc`;
    await firstValueFrom(http.post(url, { medioEntrega: 'PRESENCIAL' }));
    const p = await error(firstValueFrom(http.post(url, { medioEntrega: 'PRESENCIAL' })));
    expect(p.errorCode).toBe('SolicitudCopiaHc.YaAbierta');
  });

  it('logout ends the session', async () => {
    configurar('vinculada');
    await firstValueFrom(http.post('/paciente/bff/logout', null));
    expect((await error(firstValueFrom(http.get('/paciente/api/resumen')))).status).toBe(401);
  });
});
