import {
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_PREFIX, ErrorApi, problemaInterceptor, ProblemaApi } from '@halsa/core';
import { crearInterceptorMock } from '@halsa/mocks';
import { Notificaciones } from '@halsa/ui';
import { CASO, crearDatosBackoffice, crearRutasBackoffice, SUB } from '../../../mocks';
import type { DatosBackoffice } from '../../../mocks/fixtures';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { jwt } from '../../testing/tokens';
import { AUDITORIA_ROUTES } from './auditoria.routes';
import {
  aConsulta,
  aParametrosUrl,
  contarFiltros,
  leerFiltro,
  rangoPorDefecto,
  validarRango,
} from './filtros';
import { erroresDeRevision, leerPestanaRevisiones } from './revision';

const AHORA = Date.parse('2026-10-20T10:00:00-05:00');

const problema = (status: number, cuerpo: Partial<ProblemaApi>) =>
  new ErrorApi({
    status,
    title: 'x',
    detail: null,
    errorCode: null,
    traceId: null,
    correlationId: null,
    errors: [],
    ...cuerpo,
  });

describe('audit filters (plan §7.10)', () => {
  it('default to the last 7 Bogotá days, today included', () => {
    expect(rangoPorDefecto(AHORA)).toEqual({ desde: '2026-10-14', hasta: '2026-10-20' });
    // 23:30 in Bogotá is already the next day in UTC: still the 20th here.
    expect(rangoPorDefecto(Date.parse('2026-10-20T23:30:00-05:00')).hasta).toBe('2026-10-20');
  });

  it('read the URL, dropping malformed values', () => {
    expect(
      leerFiltro(
        {
          desde: '2026-10-01',
          hasta: 'ayer',
          casoId: ' 0199A000-0000-7000-8000-00000000A002 ',
          actorId: 'x'.repeat(65),
          accion: 'LEER',
          resultado: 'Denegado',
          page: '3',
        },
        AHORA,
      ),
    ).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-20',
      casoId: '0199a000-0000-7000-8000-00000000a002',
      actorId: null,
      accion: 'LEER',
      // The wire codes are UPPER_SNAKE (backend AuditoriaCodigos); the enum name isn't one.
      resultado: null,
      page: 3,
    });
  });

  it('leave the defaults out of the URL and reset the page', () => {
    const defecto = rangoPorDefecto(AHORA);
    expect(
      aParametrosUrl(
        {
          ...defecto,
          casoId: null,
          actorId: SUB.calificadorArla,
          accion: null,
          resultado: 'ERROR',
        },
        AHORA,
      ),
    ).toEqual({
      desde: null,
      hasta: null,
      casoId: null,
      actorId: SUB.calificadorArla,
      accion: null,
      resultado: 'ERROR',
      page: null,
    });
  });

  it('allow up to 31 days, both ends included', () => {
    expect(validarRango('2026-09-20', '2026-10-20')).toBeNull();
    expect(validarRango('2026-09-19', '2026-10-20')).toBe('excedido');
    expect(validarRango('2026-10-21', '2026-10-20')).toBe('invertido');
    expect(validarRango('2026-10-20', '2026-10-20')).toBeNull();
  });

  it('query Bogotá midnight to the next midnight (the API `hasta` is exclusive), 50 per page', () => {
    expect(aConsulta(leerFiltro({}, AHORA))).toEqual({
      desde: '2026-10-14T00:00:00-05:00',
      hasta: '2026-10-21T00:00:00-05:00',
      casoId: null,
      actorId: null,
      accion: null,
      resultado: null,
      page: 1,
      pageSize: 50,
    });
  });

  it('count the active filters for "Filtros (n)"', () => {
    expect(contarFiltros(leerFiltro({}, AHORA), AHORA)).toBe(0);
    expect(
      contarFiltros(
        leerFiltro({ desde: '2026-10-01', accion: 'CREAR', resultado: 'EXITO' }, AHORA),
        AHORA,
      ),
    ).toBe(3);
  });
});

describe('review closure errors (plan §7.11)', () => {
  it('a review already closed is a refresh, validation goes to its field', () => {
    expect(
      erroresDeRevision(
        problema(409, { errorCode: 'Auditoria.RevisionYaCerrada', detail: 'Ya cerrada.' }),
      ),
    ).toEqual({ conflicto: true, mensaje: 'Ya cerrada.' });
    expect(
      erroresDeRevision(
        problema(400, {
          errors: [
            {
              campo: null,
              codigo: 'Auditoria.ObservacionesDemasiadoLargas',
              mensaje: 'Máximo 2000.',
            },
          ],
        }),
      ),
    ).toEqual({ observaciones: 'Máximo 2000.' });
    expect(erroresDeRevision(problema(503, {}))).toHaveProperty('general');
  });

  it('opens on Pendientes', () => {
    expect(leerPestanaRevisiones(undefined)).toBe('pendientes');
    expect(leerPestanaRevisiones('cerradas')).toBe('cerradas');
    expect(leerPestanaRevisiones('CERRADA')).toBe('pendientes');
  });
});

describe('audit screens against the mock API (privacidad.arla)', () => {
  const avisos: string[] = [];
  let db: DatosBackoffice;
  let peticiones: HttpRequest<unknown>[];

  async function estable(harness: RouterTestingHarness) {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r));
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    }
  }

  async function abrir(url: string, permisos = PERSONAS['privacidad']!) {
    avisos.length = 0;
    peticiones = [];
    db = crearDatosBackoffice();
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
        sesionFalsa({ sub: SUB.privacidadArla, permisos: new Set(permisos) }).provider,
        { provide: API_PREFIX, useValue: '/v1/' },
        provideHttpClient(
          withInterceptors([
            bearer,
            problemaInterceptor,
            crearInterceptorMock(crearRutasBackoffice(db), { prefijo: '/v1/', retardoMs: 0 }),
          ]),
        ),
        provideRouter(
          [
            { path: 'auditoria', children: AUDITORIA_ROUTES },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        {
          provide: Notificaciones,
          useValue: {
            exito: (t: string) => avisos.push(`exito: ${t}`),
            aviso: (t: string) => avisos.push(`aviso: ${t}`),
            error: () => avisos.push('error'),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await estable(harness);
    return harness;
  }

  const filas = () => [...document.querySelectorAll('table tbody tr')];
  const texto = (el: Element | null | undefined) =>
    (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const lecturas = () => peticiones.filter((p) => p.url.endsWith('/auditoria/accesos'));
  function boton(nombre: string | RegExp): HTMLButtonElement {
    const b = [...document.querySelectorAll('button')].find((x) => {
      const n = x.getAttribute('aria-label') ?? x.textContent?.trim() ?? '';
      return typeof nombre === 'string' ? n === nombre : nombre.test(n);
    });
    if (!b) throw new Error(`No button ${nombre}`);
    return b;
  }
  function escribir(selector: string, valor: string) {
    const input = document.querySelector(selector) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  describe('/auditoria/accesos', () => {
    it('loads the last 7 days, 50 per page, with server pagination', async () => {
      await abrir('/auditoria/accesos');
      const p = lecturas()[0]!;
      const defecto = rangoPorDefecto();
      expect(p.params.get('desde')).toBe(`${defecto.desde}T00:00:00-05:00`);
      expect(p.params.get('pageSize')).toBe('50');
      expect(p.params.get('page')).toBe('1');
      expect(filas()).toHaveLength(50);
      expect(document.querySelector('nav[aria-label="Paginación de accesos"]')).not.toBeNull();
      // Gap G8: auditoria:export has no endpoint, so there is no export button.
      expect(document.body.textContent).not.toMatch(/Export/i);
    });

    it('page and filters come from the URL', async () => {
      await abrir('/auditoria/accesos?resultado=DENEGADO');
      expect(lecturas()[0]!.params.get('resultado')).toBe('DENEGADO');
      const badges = filas().map((f) => texto(f.querySelector('halsa-estado-badge')));
      expect(badges.length).toBeGreaterThan(0);
      expect(new Set(badges)).toEqual(new Set(['Denegado']));
      TestBed.resetTestingModule();

      await abrir('/auditoria/accesos?page=2');
      expect(lecturas()[0]!.params.get('page')).toBe('2');
      expect(filas().length).toBeGreaterThan(0);
    });

    it('an invalid range in the URL is explained and nothing is fetched', async () => {
      await abrir('/auditoria/accesos?desde=2026-08-01&hasta=2026-10-20');
      expect(lecturas()).toHaveLength(0);
      expect(document.body.textContent).toContain('El rango admite como máximo 31 días.');
    });

    it('applies the typed filters to the URL; a malformed case id stays in the form', async () => {
      const harness = await abrir('/auditoria/accesos');
      const router = TestBed.inject(Router);
      escribir('#filtro-caso', 'no-es-un-uuid');
      boton('Aplicar filtros').click();
      await estable(harness);
      expect(document.body.textContent).toContain('El identificador del caso tiene el formato');
      expect(router.url).toBe('/auditoria/accesos');

      escribir('#filtro-caso', CASO.noAsignado);
      boton('Aplicar filtros').click();
      await estable(harness);
      expect(router.url).toBe(`/auditoria/accesos?casoId=${CASO.noAsignado}`);
      expect(lecturas().at(-1)!.params.get('casoId')).toBe(CASO.noAsignado);
      // Three emergency accesses to the unassigned case, each with the amber badge.
      expect(filas().map((f) => texto(f.lastElementChild))).toEqual([
        'Emergencia',
        'Emergencia',
        'Emergencia',
      ]);
    });

    it('a row opens the drawer with every field copyable', async () => {
      const harness = await abrir(`/auditoria/accesos?casoId=${CASO.noAsignado}`);
      boton(/^Ver detalle del acceso/).click();
      await estable(harness);
      const hoja = document.querySelector('[role="dialog"]')!;
      expect(texto(hoja)).toContain('Detalle del acceso');
      expect(texto(hoja)).toContain('Paciente en urgencias con sincope, se requiere antecedente');
      expect(texto(hoja)).toContain('Acceso de emergencia');
      for (const campo of [
        'actor',
        'identificador del caso',
        'identificador de correlación',
        'identificador del registro',
        'cliente',
        'IP',
        'user agent',
      ]) {
        expect(hoja.querySelector(`button[aria-label="Copiar ${campo}"]`)).not.toBeNull();
      }
    });
  });

  describe('/auditoria/revisiones-emergencia', () => {
    const tarjetas = () => [...document.querySelectorAll('[data-testid="revisiones"] article')];
    const vencimientos = () =>
      [...document.querySelectorAll('[data-testid="vencimiento-revision"]')].map(texto);

    it('lists the pending reviews soonest deadline first, motivo in full', async () => {
      await abrir('/auditoria/revisiones-emergencia');
      expect(tarjetas()).toHaveLength(3);
      expect(vencimientos()[0]).toBe('Vencida hace 8 h');
      expect(vencimientos()[1]).toMatch(/^Vence en (11 h 5\d min|12 h)$/);
      expect(vencimientos()[2]).toMatch(/^Vence en 2 d 1[34] h$/);
      expect(texto(tarjetas()[0])).toContain(
        'Valoracion urgente por trauma craneoencefalico en turno nocturno',
      );
      expect(texto(tarjetas()[0])).toContain('Pendiente · vencida');
    });

    it('closes a review with its conclusion', async () => {
      const harness = await abrir('/auditoria/revisiones-emergencia');
      boton(`Cerrar revisión del acceso de ${SUB.calificadorArla}`).click();
      await estable(harness);
      const enviar = () =>
        (
          document.querySelector('button[form="form-cerrar-revision"]') as HTMLButtonElement
        ).click();
      enviar();
      await estable(harness);
      expect(document.body.textContent).toContain('Elige la conclusión de la revisión.');

      const justificado = [...document.querySelectorAll('label')]
        .find((l) => l.textContent?.trim().startsWith('Justificado'))!
        .querySelector('input')!;
      justificado.click();
      escribir('#revision-observaciones', 'Urgencia confirmada con el jefe de turno de la IPS.');
      enviar();
      await estable(harness);

      const post = peticiones.find((p) => p.method === 'POST')!;
      expect(post.url).toBe(
        '/v1/auditoria/revisiones-emergencia/0199f300-0000-7000-8000-000000000002/cerrar',
      );
      expect(post.body).toEqual({
        conclusion: 'JUSTIFICADO',
        observaciones: 'Urgencia confirmada con el jefe de turno de la IPS.',
      });
      expect(avisos).toEqual(['exito: Revisión cerrada']);
      expect(tarjetas()).toHaveLength(2);
    });

    it('a review closed by someone else (409) refreshes the list', async () => {
      const harness = await abrir('/auditoria/revisiones-emergencia');
      boton(`Cerrar revisión del acceso de ${SUB.calificadorArla}`).click();
      await estable(harness);
      Object.assign(
        db.revisionesEmergencia.find((r) => r.id.endsWith('2'))!,
        {
          estado: 'CERRADA',
          conclusion: 'INJUSTIFICADO',
        },
      );
      [...document.querySelectorAll('label')]
        .find((l) => l.textContent?.trim().startsWith('Injustificado'))!
        .querySelector('input')!
        .click();
      (document.querySelector('button[form="form-cerrar-revision"]') as HTMLButtonElement).click();
      await estable(harness);
      expect(avisos).toEqual(['aviso: Otra persona ya cerró esta revisión']);
      expect(document.querySelector('#revision-observaciones')).toBeNull();
      expect(tarjetas()).toHaveLength(2);
    });

    it('Cerradas shows the conclusion and who reviewed', async () => {
      await abrir('/auditoria/revisiones-emergencia?estado=cerradas');
      expect(peticiones[0]!.urlWithParams).toBe(
        '/v1/auditoria/revisiones-emergencia?estado=CERRADA&page=1&pageSize=50',
      );
      expect(tarjetas()).toHaveLength(1);
      expect(texto(tarjetas()[0])).toContain('Justificado');
      expect(texto(tarjetas()[0])).toContain('Urgencia verificada con la IPS.');
      expect(document.querySelector('[aria-label^="Cerrar revisión"]')).toBeNull();
    });
  });
});
