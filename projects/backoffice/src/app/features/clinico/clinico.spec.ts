import {
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { RegistroClinicoResponse } from '@halsa/api-types';
import { API_PREFIX, APP_CONFIG, ErrorApi, problemaInterceptor, ProblemaApi } from '@halsa/core';
import { ClaimsMock, crearInterceptorMock } from '@halsa/mocks';
import { Notificaciones } from '@halsa/ui';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { CASO, crearDatosBackoffice, crearRutasBackoffice, SUB } from '../../../mocks';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { jwt } from '../../testing/tokens';
import { CLINICO_ROUTES } from './clinico.routes';
import { aRequest, crearFormRegistro, errorDeRegistro, prellenar } from './formulario';

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

describe('clinical form model (plan §7.5)', () => {
  it('maps to the request: Bogotá time, trimmed text, empty fields as null', () => {
    const form = crearFormRegistro();
    form.patchValue({
      tipo: 'EVOLUCION',
      atendidoEn: '2026-10-17T09:30',
      nota: { motivo: '  Control  ', plan: '' },
    });
    const r = aRequest(form, 'r-1');
    expect(r).toMatchObject({
      tipo: 'EVOLUCION',
      atendidoEn: '2026-10-17T09:30:00-05:00',
      corrigeA: 'r-1',
      contenido: { motivo: 'Control', plan: null, diagnosticos: [], observaciones: null },
    });
  });

  it('needs text in at least one of the five note fields', () => {
    const form = crearFormRegistro();
    expect(form.controls.nota.hasError('notaVacia')).toBe(true);
    form.controls.nota.controls.analisis.setValue('Algo');
    expect(form.controls.nota.hasError('notaVacia')).toBe(false);
  });

  it('a correction starts as a copy of the original', () => {
    const original = crearDatosBackoffice().registrosClinicos[0]!;
    const form = crearFormRegistro();
    prellenar(form, original);
    // REPORTE_INICIAL can't be registered from the backoffice: it falls back to a concepto.
    expect(form.controls.tipo.value).toBe('CONCEPTO_MEDICO');
    expect(form.controls.nota.controls.motivo.value).toBe(original.contenido.motivo);
    expect(form.controls.diagnosticos.getRawValue()).toEqual([
      { codigo: 'S62.6', descripcion: 'Fractura de otro dedo de la mano' },
    ]);
  });

  it.each([
    [{ status: 403, errorCode: 'Clinico.ProfesionalSinRegistro' }, 'general', /RETHUS/],
    [{ errorCode: 'Clinico.RethusRequerido' }, 'general', /RETHUS/],
    [
      { status: 409, errorCode: 'Clinico.CasoNoAdmiteRegistros', detail: 'Caso cerrado.' },
      'general',
      /Caso cerrado/,
    ],
    [{ errorCode: 'Clinico.AtendidoEnFuturo', detail: 'Futuro.' }, 'atendidoEn', /Futuro/],
    [
      {
        errorCode: 'General.Validation',
        errors: [{ campo: null, codigo: 'Clinico.AtendidoEnFuturo', mensaje: 'No futuro.' }],
      },
      'atendidoEn',
      /No futuro/,
    ],
    [{ errorCode: 'Clinico.FechaAtencionAnteriorAlEvento' }, 'atendidoEn', /anterior/],
    [
      {
        errorCode: 'General.Validation',
        errors: [{ campo: null, codigo: 'Clinico.ContenidoVacio', mensaje: 'x' }],
      },
      'nota',
      /al menos uno/,
    ],
    [
      {
        errorCode: 'General.Validation',
        errors: [{ campo: null, codigo: 'Clinico.DiagnosticoCodigoInvalido', mensaje: 'Formato.' }],
      },
      'diagnosticos',
      /Formato/,
    ],
    [{ status: 503 }, 'general', /unos minutos/],
  ] as [Partial<ProblemaApi>, string, RegExp][])('%j → %s', (p, destino, mensaje) => {
    const e = errorDeRegistro(problema(p));
    expect(e.destino).toBe(destino);
    expect(e.mensaje).toMatch(mensaje);
  });
});

describe('historia clínica against the mock API', () => {
  const avisos: string[] = [];
  let peticiones: HttpRequest<unknown>[];

  const claimsCalificador = (acr: string): ClaimsMock => ({
    sub: SUB.calificadorArla,
    actor_tipo: 'arl',
    tenant_id: 'ARL_A',
    acr,
    auth_time: Math.floor(Date.now() / 1000) - 60,
    rethus: 'RM-12345',
    tipo_documento: 'CC',
    numero_documento: '52000111',
    resource_access: { 'halsa-api': { roles: PERSONAS['calificador']! } },
  });

  async function abrir(url: string, acr = 2) {
    avisos.length = 0;
    peticiones = [];
    const token = jwt(claimsCalificador(String(acr)));
    // Plays the authInterceptor: the mock reads the actor from the Bearer token.
    const bearer: HttpInterceptorFn = (req, next) => {
      peticiones.push(req);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    };
    TestBed.configureTestingModule({
      providers: [
        sesionFalsa({
          sub: SUB.calificadorArla,
          permisos: new Set(PERSONAS['calificador']),
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
            crearInterceptorMock(crearRutasBackoffice(crearDatosBackoffice()), {
              prefijo: '/v1/',
              retardoMs: 0,
            }),
          ]),
        ),
        provideRouter(
          [
            { path: 'casos/:casoId/historia-clinica', children: CLINICO_ROUTES },
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
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r));
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    }
  }

  const texto = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');
  const clinicas = () => peticiones.filter((r) => r.url.includes('registros-clinicos'));

  function boton(nombre: string): HTMLElement {
    const b = [...document.querySelectorAll<HTMLElement>('button, a')].find(
      (e) => e.textContent?.trim() === nombre,
    );
    if (!b) throw new Error(`No "${nombre}"`);
    return b;
  }

  it('at acr=1 shows the gate and sends no clinical request', async () => {
    await abrir(`/casos/${CASO.validado}/historia-clinica`, 1);
    expect(texto()).toContain('Información clínica reservada');
    expect(texto()).toContain('Verificar identidad');
    expect(clinicas()).toEqual([]);
  });

  it('lists the records newest first, hiding superseded ones behind the toggle', async () => {
    await abrir(`/casos/${CASO.validado}/historia-clinica`);
    const tipos = () =>
      [...document.querySelectorAll('[data-testid="registros"] li a')].map((a) =>
        a.textContent?.trim(),
      );
    expect(tipos()).toEqual(['Evolución', 'Reporte inicial']);
    expect(texto()).toContain('Corrección');
    expect(texto()).toContain('CIE-10 S62.6');
    expect(texto()).toContain('Res. 1995/1999');
  });

  it('the toggle reveals the corrected version', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/historia-clinica`);
    (document.querySelector('#mostrar-corregidos') as HTMLElement).click();
    await estable(harness);
    expect(document.querySelectorAll('[data-testid="registros"] li')).toHaveLength(3);
    expect(texto()).toContain('Corregido');
  });

  it('not assigned → panel; emergency access sends the motivo only on reads', async () => {
    const harness = await abrir(`/casos/${CASO.noAsignado}/historia-clinica`);
    expect(texto()).toContain('No estás asignado a este caso');
    expect(texto()).toContain(SUB.calificadorArla);

    boton('Acceso de emergencia').click();
    await estable(harness);
    const motivo = document.querySelector<HTMLTextAreaElement>('#halsa-motivo-emergencia')!;
    motivo.value = 'Atención urgente en sala de emergencias, paciente inconsciente';
    motivo.dispatchEvent(new Event('input'));
    (document.querySelector('#halsa-confirma-urgencia') as HTMLElement).click();
    await estable(harness);
    boton('Acceder y registrar motivo').click();
    await estable(harness);

    expect(texto()).toContain('Acceso de emergencia activo — motivo registrado');
    const ultima = clinicas().at(-1)!;
    expect(ultima.method).toBe('GET');
    expect(ultima.headers.get('Halsa-Motivo-Acceso')).toBe(
      'Atencion urgente en sala de emergencias, paciente inconsciente',
    );
    // Writes never use emergency access.
    expect(() => boton('Nuevo registro')).toThrow();
  });

  it('a new concepto is saved and opens its detail', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/historia-clinica/nuevo`);
    const anamnesis = document.querySelector<HTMLTextAreaElement>('#registro-anamnesis')!;
    anamnesis.value = 'Refiere dolor leve al flexionar el dedo.';
    anamnesis.dispatchEvent(new Event('input'));
    await estable(harness);
    boton('Guardar registro').click();
    await estable(harness);

    expect(avisos).toEqual(['exito: Registro clínico guardado']);
    expect(TestBed.inject(Router).url).toMatch(
      new RegExp(`/casos/${CASO.validado}/historia-clinica/[0-9a-f-]{36}$`),
    );
    expect(texto()).toContain('Refiere dolor leve al flexionar el dedo.');
    expect(
      clinicas()
        .filter((r) => r.method === 'POST')[0]!
        .headers.has('Halsa-Motivo-Acceso'),
    ).toBe(false);
  });

  it('an empty note is caught before the request', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/historia-clinica/nuevo`);
    boton('Guardar registro').click();
    await estable(harness);
    expect(texto()).toContain('Escribe al menos uno: motivo, anamnesis');
    expect(clinicas().some((r) => r.method === 'POST')).toBe(false);
  });

  it('correction mode prefills from the original and links both records', async () => {
    const original = '0199e000-0000-7000-8000-000000000001';
    const harness = await abrir(
      `/casos/${CASO.validado}/historia-clinica/nuevo?corrige=${original}`,
    );
    expect(texto()).toContain('Los registros no se modifican');
    const motivo = document.querySelector<HTMLTextAreaElement>('#registro-motivo')!;
    expect(motivo.value).toBe('Trauma en mano derecha con prensa hidráulica.');
    boton('Guardar corrección').click();
    await estable(harness);
    expect(avisos).toEqual(['exito: Corrección registrada']);
    expect(texto()).toContain('Este registro es una corrección.');
    const post = clinicas().find((r) => r.method === 'POST')!;
    expect((post.body as { corrigeA: string }).corrigeA).toBe(original);
  });

  it('a superseded record offers its correction, not "Corregir"', async () => {
    await abrir(`/casos/${CASO.validado}/historia-clinica/0199e000-0000-7000-8000-000000000002`);
    expect(texto()).toContain('Este registro fue corregido.');
    expect(() => boton('Corregir')).toThrow();
    const r = crearDatosBackoffice().registrosClinicos[1] as RegistroClinicoResponse;
    expect(texto()).toContain(r.contenido.examenFisico!);
  });
});
