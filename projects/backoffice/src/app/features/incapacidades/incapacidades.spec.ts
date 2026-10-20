import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { IncapacidadResponse } from '@halsa/api-types';
import { API_PREFIX, APP_CONFIG, ErrorApi, problemaInterceptor, ProblemaApi } from '@halsa/core';
import { ClaimsMock, crearInterceptorMock } from '@halsa/mocks';
import { Notificaciones } from '@halsa/ui';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { throwError } from 'rxjs';
import { CASO, crearDatosBackoffice, crearRutasBackoffice, IPS_DEV, SUB } from '../../../mocks';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { jwt } from '../../testing/tokens';
import { agruparCadenas, diasAcumulados, prorrogables } from './cadenas';
import {
  aRequest,
  crearFormIncapacidad,
  erroresDeCarga,
  fechaFinDe,
  FormIncapacidad,
} from './formulario';
import { INCAPACIDADES_ROUTES } from './incapacidades.routes';

const inc = (p: Partial<IncapacidadResponse> & Pick<IncapacidadResponse, 'id'>) =>
  ({
    casoId: 'c',
    tipo: 'INICIAL',
    fechaInicio: '2026-01-01',
    fechaFin: '2026-01-10',
    dias: 10,
    diasAcumulados: 10,
    estado: 'REGISTRADA',
    soporteId: 's',
    alertas: [],
    ...p,
  }) as IncapacidadResponse;

const problema = (p: Partial<ProblemaApi>) =>
  new ErrorApi({
    status: 400,
    errorCode: null,
    title: null,
    detail: null,
    traceId: null,
    correlationId: null,
    errors: [],
    ...p,
  });

function llenar(form: FormIncapacidad) {
  form.patchValue({
    certificado: { numeroCertificado: ' CERT-1 ', fechaInicio: '2026-10-01', dias: 5 },
    diagnostico: { diagnosticos: [{ codigo: 'S62.6', descripcion: '' }], observaciones: '' },
    ips: { codigoReps: '110011234501', nombre: '' },
  });
}

describe('incapacidad chains (plan §7.6, gap G18)', () => {
  const lista = [
    inc({ id: 'p2', tipo: 'PRORROGA', fechaInicio: '2026-01-21', fechaFin: '2026-01-30' }),
    inc({ id: 'i1', fechaInicio: '2026-01-01', fechaFin: '2026-01-10' }),
    inc({ id: 'p1', tipo: 'PRORROGA', fechaInicio: '2026-01-11', fechaFin: '2026-01-20' }),
    inc({ id: 'i2', fechaInicio: '2026-06-01', fechaFin: '2026-06-05', diasAcumulados: 35 }),
    inc({ id: 'p3', tipo: 'PRORROGA', fechaInicio: '2026-06-06', fechaFin: '2026-06-10' }),
  ];

  it('nests prórrogas under the chain that ends right before them, newest chain first', () => {
    const cadenas = agruparCadenas(lista);
    expect(cadenas.map((c) => [c.inicial?.id, c.prorrogas.map((p) => p.id)])).toEqual([
      ['i2', ['p3']],
      ['i1', ['p1', 'p2']],
    ]);
  });

  it('offers only the last certificate of each chain to extend', () => {
    expect(prorrogables(agruparCadenas(lista)).map((i) => i.id)).toEqual(['p3', 'p2']);
  });

  it('keeps an orphan prórroga visible', () => {
    const cadenas = agruparCadenas([inc({ id: 'p', tipo: 'PRORROGA' })]);
    expect(cadenas).toEqual([{ inicial: null, prorrogas: [expect.objectContaining({ id: 'p' })] }]);
  });

  it('accumulated days are the largest diasAcumulados', () => {
    expect(diasAcumulados(lista)).toBe(35);
    expect(diasAcumulados([])).toBe(0);
  });
});

describe('incapacidad form model (plan §7.6)', () => {
  it('"Termina el" is fechaInicio + dias − 1, across months', () => {
    expect(fechaFinDe('2026-01-30', 3)).toBe('2026-02-01');
    expect(fechaFinDe('2026-10-01', 1)).toBe('2026-10-01');
    expect(fechaFinDe('2026-10-01', 31)).toBeNull();
    expect(fechaFinDe('', 5)).toBeNull();
  });

  it('maps to the datos part: trimmed, no profesional, prorrogaDe only for a prórroga', () => {
    const form = crearFormIncapacidad();
    llenar(form);
    const r = aRequest(form);
    expect(r).toEqual({
      numeroCertificado: 'CERT-1',
      tipo: 'INICIAL',
      fechaInicio: '2026-10-01',
      dias: 5,
      diagnosticoPrincipal: { sistema: 'CIE-10', codigo: 'S62.6' },
      ipsEmisora: { codigoReps: '110011234501' },
      modalidad: 'PRESENCIAL',
    });
    expect(r).not.toHaveProperty('profesional');
  });

  it('the first diagnosis is the principal, the rest are related', () => {
    const form = crearFormIncapacidad();
    llenar(form);
    form.controls.certificado.patchValue({ tipo: 'PRORROGA', prorrogaDe: 'x' });
    const dx = form.controls.diagnostico.controls.diagnosticos;
    dx.push(crearFormIncapacidad().controls.diagnostico.controls.diagnosticos.at(0));
    dx.at(1).setValue({ codigo: 'M54.5', descripcion: ' Lumbago ' });
    const r = aRequest(form);
    expect(r.prorrogaDe).toBe('x');
    expect(r.diagnosticosRelacionados).toEqual([
      { sistema: 'CIE-10', codigo: 'M54.5', descripcion: 'Lumbago' },
    ]);
  });

  it('a prórroga needs prorrogaDe; days stay within 1–30; REPS has 10–12 digits', () => {
    const form = crearFormIncapacidad();
    llenar(form);
    const c = form.controls.certificado;
    c.controls.tipo.setValue('PRORROGA');
    expect(c.hasError('sinOrigen')).toBe(true);
    c.controls.dias.setValue(31);
    expect(c.controls.dias.hasError('max')).toBe(true);
    form.controls.ips.controls.codigoReps.setValue('123');
    expect(form.controls.ips.controls.codigoReps.hasError('pattern')).toBe(true);
  });

  it.each([
    [
      { status: 409, errorCode: 'Incapacidades.CertificadoDuplicado', detail: 'Ya existe.' },
      'numeroCertificado',
      /Ya existe/,
    ],
    [
      { status: 422, errorCode: 'INCAPACIDAD_SOLAPADA', detail: 'Se cruza.' },
      'fechaInicio',
      /Se cruza/,
    ],
    [
      { status: 422, errorCode: 'PRORROGA_NO_ES_ULTIMA', detail: 'No es la última.' },
      'prorrogaDe',
      /última/,
    ],
    [
      { status: 422, errorCode: 'PRORROGA_DIAGNOSTICO_NO_RELACIONADO', detail: 'Otra categoría.' },
      'diagnosticoPrincipal',
      /categoría/,
    ],
    [{ status: 422, errorCode: 'CASO_CERRADO', detail: 'Cerrado.' }, 'general', /Cerrado/],
    [
      { status: 422, errorCode: 'Archivos.SoporteInfectado', detail: 'Amenaza.' },
      'soporte',
      /Amenaza/,
    ],
    [{ status: 413, errorCode: 'Archivos.SoporteDemasiadoGrande' }, 'soporte', /10 MB/],
    [{ status: 415, errorCode: 'Archivos.NoEsPdf' }, 'soporte', /PDF/],
    [{ status: 503, errorCode: 'Archivos.AntivirusNoDisponible' }, 'general', /unos minutos/],
    [{ status: 0 }, 'general', /Sin conexión/],
    [
      { errors: [{ campo: 'datos.ipsEmisora.codigoReps', codigo: null, mensaje: 'Formato.' }] },
      'codigoReps',
      /Formato/,
    ],
    [
      { errors: [{ campo: 'datos.diagnosticoPrincipal.codigo', codigo: null, mensaje: 'CIE.' }] },
      'diagnosticoPrincipal',
      /CIE/,
    ],
    [
      { errors: [{ campo: 'datos.dias', codigo: null, mensaje: 'Entre 1 y 30.' }] },
      'dias',
      /Entre 1 y 30/,
    ],
  ] as [Partial<ProblemaApi>, string, RegExp][])('%j → %s', (p, campo, mensaje) => {
    const errores = erroresDeCarga(problema(p)) as Record<string, string>;
    expect(Object.keys(errores)).toEqual([campo]);
    expect(errores[campo]).toMatch(mensaje);
  });
});

describe('incapacidades against the mock API', () => {
  const avisos: string[] = [];
  let peticiones: HttpRequest<unknown>[];
  /** POSTs to fail with a network error (status 0) before reaching the mock. */
  let fallosDeRed = 0;

  const claimsMedico = (acr: string): ClaimsMock => ({
    sub: SUB.medicoIps,
    actor_tipo: 'ips',
    ips_id: IPS_DEV,
    acr,
    auth_time: Math.floor(Date.now() / 1000) - 60,
    resource_access: { 'halsa-api': { roles: PERSONAS['medico-ips']! } },
  });

  beforeEach(() => {
    // Desktop: the whole form on one page.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  async function abrir(url: string, { acr = 2, persona = 'medico-ips' } = {}) {
    avisos.length = 0;
    peticiones = [];
    fallosDeRed = 0;
    const token = jwt(claimsMedico(String(acr)));
    const bearer: HttpInterceptorFn = (req, next) => {
      peticiones.push(req);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    };
    const red: HttpInterceptorFn = (req, next) => {
      if (req.method === 'POST' && fallosDeRed > 0) {
        fallosDeRed--;
        return throwError(() => new HttpErrorResponse({ status: 0, url: req.url }));
      }
      return next(req);
    };
    TestBed.configureTestingModule({
      providers: [
        sesionFalsa({
          sub: SUB.medicoIps,
          actorTipo: 'ips',
          tenantId: null,
          ipsId: IPS_DEV,
          permisos: new Set(PERSONAS[persona]),
          acr,
          authTime: Math.floor(Date.now() / 1000) - 60,
        }).provider,
        { provide: API_PREFIX, useValue: '/v1/' },
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '', keycloak: { authority: 'http://kc' } } },
        { provide: OidcSecurityService, useValue: { authorizeWithPopUp: vi.fn() } },
        provideHttpClient(
          withInterceptors([
            bearer,
            problemaInterceptor,
            red,
            crearInterceptorMock(crearRutasBackoffice(crearDatosBackoffice()), {
              prefijo: '/v1/',
              retardoMs: 0,
            }),
          ]),
        ),
        provideRouter(
          [
            { path: 'casos/:casoId/incapacidades', children: INCAPACIDADES_ROUTES },
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

  async function estable(harness: RouterTestingHarness) {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r));
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    }
  }

  const texto = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');
  const posts = () => peticiones.filter((r) => r.method === 'POST');

  function boton(nombre: string): HTMLElement {
    const b = [...document.querySelectorAll<HTMLElement>('button, a')].find(
      (e) => e.textContent?.trim() === nombre,
    );
    if (!b) throw new Error(`No "${nombre}"`);
    return b;
  }

  function escribir(selector: string, valor: string) {
    const input = document.querySelector<HTMLInputElement>(selector)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  function adjuntar(archivo: File) {
    const input = document.querySelector<HTMLInputElement>('[data-testid="soporte"] input')!;
    Object.defineProperty(input, 'files', { value: { item: () => archivo, length: 1 } });
    input.dispatchEvent(new Event('change'));
  }

  async function llenarFormulario(harness: RouterTestingHarness) {
    escribir('#inc-numero', 'CERT-2026-001');
    escribir('#inc-inicio', '2026-10-01');
    escribir('#inc-dias', '10');
    escribir('#inc-dx-codigo-0', 'S62.6');
    adjuntar(new File(['%PDF-1.7\n...'], 'certificado.pdf', { type: 'application/pdf' }));
    await estable(harness);
  }

  it('lists the chain with the prórroga nested and the accumulated days', async () => {
    await abrir(`/casos/${CASO.validado}/incapacidades`);
    expect(texto()).toContain('60 días acumulados');
    const filas = [...document.querySelectorAll('[data-testid="incapacidad"]')];
    expect(filas.map((f) => f.getAttribute('data-tipo'))).toEqual(['INICIAL', 'PRORROGA']);
    expect(filas[1]!.classList).toContain('ps-10');
    expect(texto()).toContain('Cargada de forma extemporánea');
    expect(boton('Cargar incapacidad')).toBeTruthy();
  });

  it('the upload form waits behind the step-up gate', async () => {
    await abrir(`/casos/${CASO.validado}/incapacidades/nueva`, { acr: 1 });
    expect(texto()).toContain('Verificar identidad');
    expect(document.querySelector('#inc-numero')).toBeNull();
  });

  it('prefills the REPS code of an IPS actor and previews the end date', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/incapacidades/nueva`);
    expect(document.querySelector<HTMLInputElement>('#inc-reps')!.value).toBe(IPS_DEV);
    escribir('#inc-inicio', '2026-09-28');
    escribir('#inc-dias', '5');
    await estable(harness);
    expect(document.querySelector('[data-testid="termina-el"]')!.textContent).toMatch(
      /Termina el 2 oct 2026/,
    );
  });

  it('rejects a non-PDF on the client, before any request', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/incapacidades/nueva`);
    adjuntar(new File(['MZ fake'], 'certificado.pdf', { type: 'application/pdf' }));
    await new Promise((r) => setTimeout(r, 20));
    await estable(harness);
    expect(texto()).toContain('El archivo no es un PDF válido.');
    boton('Cargar incapacidad').click();
    await estable(harness);
    expect(texto()).toContain('Adjunta el PDF del certificado.');
    expect(posts()).toEqual([]);
  });

  it('uploads as multipart with an Idempotency-Key and shows the alerts', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/incapacidades/nueva`);
    await llenarFormulario(harness);
    boton('Cargar incapacidad').click();
    await estable(harness);

    const [post] = posts();
    expect(post!.body).toBeInstanceOf(FormData);
    const cuerpo = post!.body as FormData;
    expect([...cuerpo.keys()]).toEqual(['datos', 'soporte']);
    expect((cuerpo.get('datos') as Blob).type).toBe('application/json');
    expect(JSON.parse(await (cuerpo.get('datos') as Blob).text())).not.toHaveProperty(
      'profesional',
    );
    expect(post!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(texto()).toContain('Incapacidad cargada');
    expect(texto()).toContain('El caso acumula 70 días de incapacidad.');

    boton('Volver a incapacidades').click();
    await estable(harness);
    expect(TestBed.inject(Router).url).toBe(`/casos/${CASO.validado}/incapacidades`);
    expect(document.querySelectorAll('[data-testid="incapacidad"]')).toHaveLength(3);
  });

  it('a retry after a network failure reuses the same Idempotency-Key (plan §5.3.7)', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/incapacidades/nueva`);
    await llenarFormulario(harness);
    fallosDeRed = 1;
    boton('Cargar incapacidad').click();
    await estable(harness);
    expect(texto()).toContain('Sin conexión');

    boton('Reintentar la carga').click();
    await estable(harness);
    const [primera, segunda] = posts().map((r) => r.headers.get('Idempotency-Key'));
    expect(primera).toBeTruthy();
    expect(segunda).toBe(primera);
    expect(texto()).toContain('Incapacidad cargada');
  });

  it('changing the data after a failure gets a new key', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/incapacidades/nueva`);
    await llenarFormulario(harness);
    fallosDeRed = 1;
    boton('Cargar incapacidad').click();
    await estable(harness);
    escribir('#inc-numero', 'CERT-2026-002');
    await estable(harness);
    boton('Reintentar la carga').click();
    await estable(harness);
    const [primera, segunda] = posts().map((r) => r.headers.get('Idempotency-Key'));
    expect(segunda).not.toBe(primera);
  });

  it('antivirus down (503) is shown above the form', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/incapacidades/nueva`);
    await llenarFormulario(harness);
    escribir('#inc-numero', 'ANTIVIRUS-503');
    await estable(harness);
    boton('Cargar incapacidad').click();
    await estable(harness);
    expect(document.querySelector('[data-testid="error-general"]')!.textContent).toContain(
      'Intenta de nuevo en unos minutos',
    );
  });

  it('without incapacidades:write, "nueva" goes back to the list', async () => {
    await abrir(`/casos/${CASO.validado}/incapacidades/nueva`, { persona: 'analista' });
    expect(avisos).toEqual(['aviso: No puedes cargar incapacidades']);
    expect(TestBed.inject(Router).url).toBe(`/casos/${CASO.validado}/incapacidades`);
    expect(() => boton('Cargar incapacidad')).toThrow();
    expect(() => boton('Descargar soporte')).toThrow();
  });
});
