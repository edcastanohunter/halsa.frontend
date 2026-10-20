import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { CasoResumenResponse, IncapacidadResponse, PagedList } from '@halsa/api-types';
import {
  API_PREFIX,
  correlacionInterceptor,
  ErrorApi,
  problemaInterceptor,
  ProblemaApi,
} from '@halsa/core';
import { ClaimsMock, crearInterceptorMock } from '@halsa/mocks';
import { firstValueFrom } from 'rxjs';
import {
  CASO,
  CASOS_HISTORICOS,
  crearDatosBackoffice,
  crearRutasBackoffice,
  IPS_DEV,
  SUB,
} from '.';

const base64Url = (s: string) => btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (claims: ClaimsMock) =>
  `${base64Url('{"alg":"none"}')}.${base64Url(JSON.stringify(claims))}.firma`;

const ahora = Date.parse('2026-10-19T15:00:00Z');
const roles = (...r: string[]) => ({ 'halsa-api': { roles: r } });
const CALIFICADOR: ClaimsMock = {
  sub: SUB.calificadorArla,
  actor_tipo: 'arl',
  tenant_id: 'ARL_A',
  acr: '2',
  auth_time: ahora / 1000 - 60,
  resource_access: roles(
    'clinico:read',
    'clinico:write',
    'clinico:emergencia',
    'pcl:dictamen:read',
    'casos:read',
  ),
};
const MEDICO_IPS: ClaimsMock = {
  sub: SUB.medicoIps,
  actor_tipo: 'ips',
  ips_id: IPS_DEV,
  acr: '2',
  resource_access: roles('casos:read', 'incapacidades:read', 'incapacidades:write', 'clinico:read'),
};

describe('backoffice mock adapter (plan §9)', () => {
  let http: HttpClient;

  beforeEach(() => {
    const db = crearDatosBackoffice(ahora);
    TestBed.configureTestingModule({
      providers: [
        { provide: API_PREFIX, useValue: '/v1/' },
        provideHttpClient(
          withInterceptors([
            correlacionInterceptor,
            problemaInterceptor,
            crearInterceptorMock(
              crearRutasBackoffice(db, () => ahora),
              {
                prefijo: '/v1/',
                retardoMs: 0,
              },
            ),
          ]),
        ),
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  const como = (claims?: ClaimsMock) =>
    claims ? new HttpHeaders({ Authorization: `Bearer ${jwt(claims)}` }) : new HttpHeaders();

  async function fallo(peticion: Promise<unknown>): Promise<ProblemaApi> {
    const error = await peticion.then(
      () => expect.unreachable('expected an error'),
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ErrorApi);
    return (error as ErrorApi).problema;
  }

  it('answers as analista.arla without a token, filtered by tenant', async () => {
    const yo = await firstValueFrom(
      http.get<{ sub: string; permisos: string[] }>('/v1/identidad/yo'),
    );
    expect(yo.sub).toBe(SUB.analistaArla);
    expect(yo.permisos).toContain('pacientes:activar');
    const pagina = await firstValueFrom(
      http.get<PagedList<CasoResumenResponse>>('/v1/casos?pageSize=2'),
    );
    const total = 4 + CASOS_HISTORICOS;
    expect(pagina).toMatchObject({ totalCount: total, totalPages: total / 2, hasNextPage: true });
    // Newest first, like the API (`RadicadoEn` descending).
    expect(pagina.items.map((c) => c.id)).toEqual([CASO.radicado, CASO.noAsignado]);
    expect(pagina.items.every((c) => c.radicado.includes('ARLA'))).toBe(true);
  });

  it('IPS actors only see remitted cases', async () => {
    const pagina = await firstValueFrom(
      http.get<PagedList<CasoResumenResponse>>('/v1/casos', { headers: como(MEDICO_IPS) }),
    );
    expect(pagina.items.map((c) => c.id)).toEqual([CASO.validado]);
  });

  it('a cross-tenant case is a neutral 404', async () => {
    const p = await fallo(firstValueFrom(http.get(`/v1/casos/${CASO.arlB}`)));
    expect(p).toMatchObject({ status: 404, errorCode: 'Caso.NoEncontrado' });
    expect(p.traceId).toBeTruthy();
  });

  it('clinical reads at acr=1 get the RFC 9470 challenge', async () => {
    const p = await fallo(
      firstValueFrom(
        http.get(`/v1/casos/${CASO.validado}/registros-clinicos`, {
          headers: como({ ...CALIFICADOR, acr: '1' }),
        }),
      ),
    );
    expect(p).toMatchObject({ status: 401, errorCode: 'Auth.StepUpRequerido', stepUp: { acr: 2 } });
  });

  it('the dictamen also needs auth_time within 15 minutes', async () => {
    const url = `/v1/casos/${CASO.enCalificacion}/dictamen-pcl`;
    const viejo = { ...CALIFICADOR, auth_time: ahora / 1000 - 1000 };
    const p = await fallo(firstValueFrom(http.get(url, { headers: como(viejo) })));
    expect(p.stepUp).toEqual({ acr: 2, maxAge: 900 });
    const dictamen = await firstValueFrom(
      http.get<{ estadoNotificacion: string }>(url, { headers: como(CALIFICADOR) }),
    );
    expect(dictamen.estadoNotificacion).toBe('PENDIENTE');
  });

  it('unassigned clinical reads → 403 Clinico.NoAsignado, unless breaking the glass', async () => {
    const url = `/v1/casos/${CASO.noAsignado}/registros-clinicos`;
    const p = await fallo(firstValueFrom(http.get(url, { headers: como(CALIFICADOR) })));
    expect(p).toMatchObject({ status: 403, errorCode: 'Clinico.NoAsignado' });

    const corto = como(CALIFICADOR).set('Halsa-Motivo-Acceso', 'urgente');
    expect((await fallo(firstValueFrom(http.get(url, { headers: corto })))).errorCode).toBe(
      'Clinico.MotivoEmergenciaInvalido',
    );

    const motivo = como(CALIFICADOR).set(
      'Halsa-Motivo-Acceso',
      'Paciente en urgencias con sincope severo',
    );
    await expect(firstValueFrom(http.get(url, { headers: motivo }))).resolves.toEqual([]);
  });

  it('a duplicate remission is a 409, an invalid REPS a 400 with errors', async () => {
    const url = `/v1/casos/${CASO.validado}/remisiones`;
    const p = await fallo(firstValueFrom(http.post(url, { ipsId: IPS_DEV })));
    expect(p).toMatchObject({ status: 409, errorCode: 'Caso.RemisionDuplicada' });
    const invalido = await fallo(firstValueFrom(http.post(url, { ipsId: '123' })));
    expect(invalido).toMatchObject({ status: 400, errorCode: 'Caso.IpsIdInvalido' });
    expect(invalido.errors).toHaveLength(1);
  });

  it('activation codes require a Validado case', async () => {
    const p = await fallo(
      firstValueFrom(http.post(`/v1/casos/${CASO.radicado}/codigos-activacion`, null)),
    );
    expect(p.errorCode).toBe('Paciente.CasoNoValidado');
    const codigo = await firstValueFrom(
      http.post<{ codigo: string }>(`/v1/casos/${CASO.validado}/codigos-activacion`, null),
    );
    expect(codigo.codigo).toMatch(/^[A-Z0-9]{6}-[A-Z0-9]{10}$/);
  });

  it('the incapacidad upload replays the same response for the same Idempotency-Key', async () => {
    const form = () => {
      const f = new FormData();
      const datos = {
        numeroCertificado: 'C-1',
        tipo: 'INICIAL',
        fechaInicio: '2026-10-01',
        dias: 10,
      };
      f.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
      f.append('soporte', new Blob(['%PDF-1.7 x'], { type: 'application/pdf' }), 'soporte.pdf');
      return f;
    };
    const url = `/v1/casos/${CASO.validado}/incapacidades`;
    const headers = como(MEDICO_IPS).set('Idempotency-Key', crypto.randomUUID());
    const a = await firstValueFrom(http.post<IncapacidadResponse>(url, form(), { headers }));
    const b = await firstValueFrom(http.post<IncapacidadResponse>(url, form(), { headers }));
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ fechaFin: '2026-10-10', diasAcumulados: 70 });

    const sinClave = await fallo(
      firstValueFrom(http.post(url, form(), { headers: como(MEDICO_IPS) })),
    );
    expect(sinClave.errorCode).toBe('Integracion.IdempotencyKeyInvalida');
  });

  it('unmocked endpoints answer 501 instead of hitting the network', async () => {
    const p = await fallo(firstValueFrom(http.get('/v1/no-existe')));
    expect(p).toMatchObject({ status: 501, errorCode: 'Mock.SinFixture' });
  });
});
