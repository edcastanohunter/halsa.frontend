import {
  HttpClient,
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { RevisionEmergenciaResponse } from '@halsa/api-types';
import { API_PREFIX, ErrorApi, problemaInterceptor } from '@halsa/core';
import { crearInterceptorMock } from '@halsa/mocks';
import { firstValueFrom } from 'rxjs';
import { CASO, crearDatosBackoffice, crearRutasBackoffice, SUB } from '../../../mocks';
import type { DatosBackoffice } from '../../../mocks/fixtures';
import { PERSONAS } from '../../testing/personas';
import { jwt } from '../../testing/tokens';
import { RevisionesEmergenciaApi } from './revisiones-emergencia-api.service';
import { formatPlazoRestante, nivelRevision } from './vencimiento-revision';

const HORA = 3_600_000;

describe('review deadline (plan §7.11)', () => {
  const ahora = Date.parse('2026-10-20T10:00:00-05:00');
  const en = (horas: number) => new Date(ahora + horas * HORA).toISOString();

  it('is red under 24 h and once the 72 h have passed', () => {
    expect(nivelRevision(en(62), ahora)).toBe('normal');
    expect(nivelRevision(en(24), ahora)).toBe('normal');
    expect(nivelRevision(en(23.9), ahora)).toBe('critica');
    expect(nivelRevision(en(0), ahora)).toBe('vencida');
    expect(nivelRevision(en(-8), ahora)).toBe('vencida');
  });

  it('formats a coarse duration', () => {
    expect(formatPlazoRestante(62 * HORA)).toBe('2 d 14 h');
    expect(formatPlazoRestante(48 * HORA)).toBe('2 d');
    expect(formatPlazoRestante(11 * HORA + 5 * 60_000)).toBe('11 h 5 min');
    expect(formatPlazoRestante(-8 * HORA)).toBe('8 h');
    expect(formatPlazoRestante(40 * 60_000)).toBe('40 min');
    expect(formatPlazoRestante(5_000)).toBe('1 min');
  });
});

/** The mock as privacidad.arla: it reads the actor from the Bearer token, like the API. */
function configurar(db: DatosBackoffice, peticiones: HttpRequest<unknown>[] = []) {
  const token = jwt({
    sub: SUB.privacidadArla,
    actor_tipo: 'arl',
    tenant_id: 'ARL_A',
    acr: '1',
    resource_access: { 'halsa-api': { roles: PERSONAS['privacidad']! } },
  });
  const bearer: HttpInterceptorFn = (req, next) => {
    peticiones.push(req);
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: API_PREFIX, useValue: '/v1/' },
      provideHttpClient(
        withInterceptors([
          bearer,
          problemaInterceptor,
          crearInterceptorMock(crearRutasBackoffice(db), { prefijo: '/v1/', retardoMs: 0 }),
        ]),
      ),
    ],
  });
}

describe('RevisionesEmergenciaApi.pendientes()', () => {
  it('reads the whole queue and sorts it by deadline, overdue first (gap G21)', async () => {
    const db = crearDatosBackoffice();
    const base = db.revisionesEmergencia[0]!;
    // 450 extra pending reviews: three pages of 200 in the API's newest-first order.
    for (let i = 0; i < 450; i++) {
      const ocurrido = Date.now() - (i + 1) * 60_000;
      db.revisionesEmergencia.push({
        ...base,
        id: `0199f3ff-0000-7000-8000-${String(i).padStart(12, '0')}`,
        ocurridoEn: new Date(ocurrido).toISOString(),
        venceRevisionEn: new Date(ocurrido + 72 * HORA).toISOString(),
      });
    }
    const peticiones: HttpRequest<unknown>[] = [];
    configurar(db, peticiones);

    const { items, total } = await firstValueFrom(
      TestBed.inject(RevisionesEmergenciaApi).pendientes(),
    );

    expect(peticiones.map((p) => p.urlWithParams)).toEqual([
      '/v1/auditoria/revisiones-emergencia?estado=PENDIENTE&page=1&pageSize=200',
      '/v1/auditoria/revisiones-emergencia?estado=PENDIENTE&page=2&pageSize=200',
      '/v1/auditoria/revisiones-emergencia?estado=PENDIENTE&page=3&pageSize=200',
    ]);
    expect(total).toBe(453);
    expect(items).toHaveLength(453);
    const vencimientos = items.map((r: RevisionEmergenciaResponse) =>
      Date.parse(r.venceRevisionEn),
    );
    expect(vencimientos).toEqual([...vencimientos].sort((a, b) => a - b));
    // The fixture 8 h past its deadline leads, though the API returns it last.
    expect(items[0]!.motivo).toMatch(/^Valoracion urgente/);
  });
});

describe('mock aligned with the backend audit contract', () => {
  const desde = (dias: number) => new Date(Date.now() - dias * 24 * HORA).toISOString();
  const get = (url: string) =>
    firstValueFrom(
      TestBed.inject(HttpClient).get<{
        items: { accion: string; resultado: string; tenantId: string }[];
        pageSize: number;
      }>(url),
    );

  beforeEach(() => configurar(crearDatosBackoffice()));

  it('requires desde and hasta, at most 31 days apart', async () => {
    const sinFechas = await get('/v1/auditoria/accesos').catch((e: ErrorApi) => e);
    expect((sinFechas as ErrorApi).problema.errors.map((e) => e.codigo)).toEqual([
      'Auditoria.DesdeRequerido',
      'Auditoria.HastaRequerido',
    ]);
    const largo = await get(
      `/v1/auditoria/accesos?desde=${encodeURIComponent(desde(40))}&hasta=${encodeURIComponent(desde(0))}`,
    ).catch((e: ErrorApi) => e);
    expect((largo as ErrorApi).problema.errors.map((e) => e.codigo)).toEqual([
      'Auditoria.RangoExcedido',
    ]);
  });

  it('answers stored codes, takes either casing in the filters, 50 per page, own tenant only', async () => {
    const rango = `desde=${encodeURIComponent(desde(11))}&hasta=${encodeURIComponent(desde(0))}`;
    const todos = await get(`/v1/auditoria/accesos?${rango}`);
    expect(todos.pageSize).toBe(50);
    expect(new Set(todos.items.map((a) => a.tenantId))).toEqual(new Set(['ARL_A']));
    const porNombre = await get(
      `/v1/auditoria/accesos?${rango}&resultado=NoEncontrado&pageSize=200`,
    );
    const porCodigo = await get(
      `/v1/auditoria/accesos?${rango}&resultado=NO_ENCONTRADO&pageSize=200`,
    );
    expect(porNombre.items.length).toBeGreaterThan(0);
    expect(porNombre.items).toEqual(porCodigo.items);
    expect(new Set(porCodigo.items.map((a) => a.resultado))).toEqual(new Set(['NO_ENCONTRADO']));
  });

  it('lists the pending reviews newest first, as the API does', async () => {
    const pagina = await firstValueFrom(
      TestBed.inject(RevisionesEmergenciaApi).listar({ estado: 'PENDIENTE' }),
    );
    expect(pagina.items.map((r) => r.casoMedicoId)).toEqual([
      CASO.noAsignado,
      CASO.noAsignado,
      CASO.noAsignado,
    ]);
    const ocurridos = pagina.items.map((r) => Date.parse(r.ocurridoEn));
    expect(ocurridos).toEqual([...ocurridos].sort((a, b) => b - a));
  });
});
