import {
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { SolicitudCopiaHcResponse } from '@halsa/api-types';
import { API_PREFIX, ErrorApi, problemaInterceptor, ProblemaApi } from '@halsa/core';
import { crearInterceptorMock } from '@halsa/mocks';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { crearDatosBackoffice, crearRutasBackoffice, SUB } from '../../../mocks';
import type { DatosBackoffice } from '../../../mocks/fixtures';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { jwt } from '../../testing/tokens';
import { agruparBandeja, erroresDeCierre, esCerrable, leerPestana } from './bandeja';
import { SOLICITUDES_COPIA_HC_ROUTES } from './solicitudes-copia-hc.routes';

const solicitud = (
  estado: SolicitudCopiaHcResponse['estado'],
  extra: Partial<SolicitudCopiaHcResponse> = {},
): SolicitudCopiaHcResponse => ({
  id: crypto.randomUUID(),
  casoId: '0199a000-0000-7000-8000-00000000a002',
  radicado: '2026-ARLA-000102',
  pacienteSub: '0199aa00-0000-7000-8000-00000000f001',
  medioEntrega: 'PRESENCIAL',
  estado,
  solicitadaEn: '2026-10-01T10:00:00-05:00',
  ...extra,
});

const problema = (status: number, cuerpo: Partial<ProblemaApi>) =>
  new ErrorApi({
    status,
    title: 'x',
    detail: null,
    errorCode: null,
    traceId: null,
    errors: [],
    ...cuerpo,
  } as ProblemaApi);

describe('the inbox model (plan §7.9)', () => {
  it('splits one list into the three tabs; closed ones by latest closure', () => {
    const viejaCerrada = solicitud('ENTREGADA', { atendidaEn: '2026-10-02T10:00:00-05:00' });
    const nuevaCerrada = solicitud('RECHAZADA', { atendidaEn: '2026-10-09T10:00:00-05:00' });
    const recibida = solicitud('RECIBIDA');
    const enTramite = solicitud('EN_TRAMITE');
    const b = agruparBandeja([viejaCerrada, recibida, nuevaCerrada, enTramite]);
    expect(b.recibidas).toEqual([recibida]);
    expect(b['en-tramite']).toEqual([enTramite]);
    expect(b.cerradas).toEqual([nuevaCerrada, viejaCerrada]);
  });

  it('reads the tab from the URL, Recibidas by default', () => {
    expect(leerPestana(undefined)).toBe('recibidas');
    expect(leerPestana('en-tramite')).toBe('en-tramite');
    expect(leerPestana('cerradas')).toBe('cerradas');
    expect(leerPestana('EN_TRAMITE')).toBe('recibidas');
  });

  it('closes from any open state (backend SolicitudCopiaHc.Cerrar)', () => {
    expect(esCerrable(solicitud('RECIBIDA'))).toBe(true);
    expect(esCerrable(solicitud('EN_TRAMITE'))).toBe(true);
    expect(esCerrable(solicitud('ENTREGADA'))).toBe(false);
  });

  it('maps the closure errors to their field, a transition conflict to a refresh', () => {
    expect(
      erroresDeCierre(
        problema(400, {
          errorCode: 'General.Validation',
          errors: [
            { campo: null, codigo: 'SolicitudCopiaHc.NotaRequerida', mensaje: 'Mínimo 10.' },
          ],
        }),
      ),
    ).toEqual({ nota: 'Mínimo 10.' });
    expect(
      erroresDeCierre(
        problema(400, {
          errors: [
            { campo: null, codigo: 'SolicitudCopiaHc.ResultadoInvalido', mensaje: 'Elige uno.' },
          ],
        }),
      ),
    ).toEqual({ resultado: 'Elige uno.' });
    expect(
      erroresDeCierre(
        problema(409, {
          errorCode: 'SolicitudCopiaHc.TransicionInvalida',
          detail: 'No admite esta transición.',
        }),
      ),
    ).toEqual({ conflicto: true, mensaje: 'No admite esta transición.' });
    expect(erroresDeCierre(problema(500, {}))).toHaveProperty('general');
  });
});

describe('/solicitudes-copia-hc against the mock API', () => {
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

  async function abrir(url: string) {
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
        sesionFalsa({ sub: SUB.privacidadArla, permisos: new Set(PERSONAS['privacidad']) })
          .provider,
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
            { path: 'solicitudes-copia-hc', children: SOLICITUDES_COPIA_HC_ROUTES },
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

  const tarjetas = () =>
    [...document.querySelectorAll('[data-testid="solicitudes"] article')].map((a) =>
      a.getAttribute('aria-label'),
    );
  const pestanas = () =>
    [...document.querySelectorAll('nav[aria-label="Estado de las solicitudes"] a')].map((a) =>
      a.textContent?.replace(/\s+/g, ' ').trim(),
    );
  /** A radio card by its visible label (Angular binds `value` as a property, not an attribute). */
  function radio(etiqueta: string): HTMLInputElement {
    const label = [...document.querySelectorAll('label')].find((l) =>
      l.textContent?.trim().startsWith(etiqueta),
    );
    const input = label?.querySelector('input[type="radio"]');
    if (!input) throw new Error(`No radio ${etiqueta}`);
    return input as HTMLInputElement;
  }
  function boton(nombre: string): HTMLButtonElement {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.getAttribute('aria-label') ?? x.textContent?.trim()) === nombre,
    );
    if (!b) throw new Error(`No button ${nombre}`);
    return b;
  }

  it('opens on Recibidas, oldest first, with every tab count from one request', async () => {
    await abrir('/solicitudes-copia-hc');
    expect(peticiones.map((p) => p.urlWithParams)).toEqual(['/v1/solicitudes-copia-hc']);
    expect(pestanas()).toEqual(['Recibidas 2', 'En trámite 1', 'Cerradas 2']);
    expect(tarjetas()).toEqual(['Solicitud 2026-ARLA-000102', 'Solicitud 2026-ARLA-000104']);
    // The officer has no casos:read: the radicado is text, never a link to the case.
    expect(document.querySelector('a[href*="/casos/"]')).toBeNull();
  });

  it('"Pasar a trámite" moves a request to En trámite', async () => {
    const harness = await abrir('/solicitudes-copia-hc');
    boton('Pasar a trámite: 2026-ARLA-000102').click();
    await estable(harness);
    expect(avisos).toEqual(['exito: Solicitud en trámite']);
    expect(pestanas()).toEqual(['Recibidas 1', 'En trámite 2', 'Cerradas 2']);
    expect(db.solicitudesCopiaHc[0]).toMatchObject({
      estado: 'EN_TRAMITE',
      atendidaPor: SUB.privacidadArla,
    });
  });

  it('closes a received request straight away, after validating the note', async () => {
    const harness = await abrir('/solicitudes-copia-hc');
    boton('Cerrar solicitud: 2026-ARLA-000104').click();
    await estable(harness);
    const enviar = () =>
      (document.querySelector('button[form="form-cerrar-solicitud"]') as HTMLButtonElement).click();
    enviar();
    await estable(harness);
    expect(document.body.textContent).toContain('Elige el resultado.');
    expect(document.body.textContent).toContain('Escribe al menos 10 caracteres.');
    expect(peticiones.filter((p) => p.method === 'POST')).toHaveLength(0);

    radio('Entregada').click();
    const nota = document.querySelector('#cerrar-nota') as HTMLTextAreaElement;
    nota.value = '  Entregada en la oficina principal con constancia.  ';
    nota.dispatchEvent(new Event('input'));
    enviar();
    await estable(harness);

    const post = peticiones.find((p) => p.method === 'POST')!;
    expect(post.url).toBe('/v1/solicitudes-copia-hc/0199f100-0000-7000-8000-000000000004/cerrar');
    expect(post.body).toEqual({
      resultado: 'ENTREGADA',
      nota: 'Entregada en la oficina principal con constancia.',
    });
    expect(avisos).toEqual(['exito: Solicitud cerrada como entregada']);
    expect(pestanas()).toEqual(['Recibidas 1', 'En trámite 1', 'Cerradas 3']);
  });

  it('a request closed meanwhile (TransicionInvalida) closes the sheet and refreshes', async () => {
    const harness = await abrir('/solicitudes-copia-hc?estado=en-tramite');
    expect(tarjetas()).toEqual(['Solicitud 2026-ARLA-000103']);
    boton('Cerrar solicitud: 2026-ARLA-000103').click();
    await estable(harness);
    // Another officer closes it first.
    db.solicitudesCopiaHc[1]!.estado = 'RECHAZADA';
    radio('Rechazada').click();
    const nota = document.querySelector('#cerrar-nota') as HTMLTextAreaElement;
    nota.value = 'El paciente desistió de la solicitud.';
    nota.dispatchEvent(new Event('input'));
    (document.querySelector('button[form="form-cerrar-solicitud"]') as HTMLButtonElement).click();
    await estable(harness);
    expect(avisos).toEqual(['aviso: La solicitud ya cambió de estado']);
    expect(document.querySelector('#cerrar-nota')).toBeNull();
    expect(tarjetas()).toEqual([]);
    expect(document.body.textContent).toContain('No hay solicitudes en trámite');
  });

  it('closed requests show the result note and no actions', async () => {
    await abrir('/solicitudes-copia-hc?estado=cerradas');
    expect(tarjetas()).toEqual(['Solicitud 2026-ARLA-000102', 'Solicitud 2026-ARLA-000103']);
    expect(document.body.textContent).toContain('Entregada en la oficina principal.');
    expect(document.querySelector('[aria-label^="Cerrar solicitud"]')).toBeNull();
  });
});
