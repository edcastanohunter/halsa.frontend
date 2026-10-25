import {
  HttpInterceptorFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  aBogotaLocal,
  API_PREFIX,
  APP_CONFIG,
  ErrorApi,
  hoyBogota,
  problemaInterceptor,
  ProblemaApi,
  sumarDias,
} from '@halsa/core';
import { ClaimsMock, crearInterceptorMock } from '@halsa/mocks';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of } from 'rxjs';
import { CASO, crearDatosBackoffice, crearRutasBackoffice, SUB } from '../../../mocks';
import type { DatosBackoffice } from '../../../mocks/fixtures';
import { StepUpService } from '../../core/step-up/step-up.service';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { jwt } from '../../testing/tokens';
import { DICTAMEN_PCL_ROUTES } from './dictamen-pcl.routes';
import {
  aRequest,
  conflictoDictamen,
  crearFormDictamen,
  crearFormNotificacion,
  diasParaControversia,
  errorDeNotificacion,
  erroresDeDictamen,
  etapasNotificacion,
  FormDictamen,
  sumaComponentes,
} from './formulario';

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

const FUNDAMENTOS = 'Se califica conforme al Manual Único de Calificación (Decreto 1507). '.repeat(
  2,
);

function llenar(form: FormDictamen) {
  form.patchValue({
    porcentajePcl: 23.45,
    origen: 'LABORAL',
    fechaEstructuracion: '2026-09-15',
    fechaDictamen: '2026-10-10',
    fundamentos: FUNDAMENTOS,
  });
  form.controls.diagnosticos.at(0).setValue({ codigo: 'G56.0', descripcion: '' });
}

describe('dictamen form model (plan §7.7)', () => {
  it('maps to the request with two decimals; no componentes unless detailed', () => {
    const form = crearFormDictamen();
    llenar(form);
    form.controls.porcentajePcl.setValue(0.1 + 0.2);
    expect(aRequest(form)).toEqual({
      porcentajePcl: 0.3,
      origen: 'LABORAL',
      fechaEstructuracion: '2026-09-15',
      fechaDictamen: '2026-10-10',
      fundamentos: FUNDAMENTOS,
      diagnosticos: [{ sistema: 'CIE-10', codigo: 'G56.0' }],
    });
  });

  it('percentage: required, 0–100, two decimals at most', () => {
    const c = crearFormDictamen().controls.porcentajePcl;
    expect(c.hasError('required')).toBe(true);
    c.setValue(100.01);
    expect(c.hasError('max')).toBe(true);
    c.setValue(-1);
    expect(c.hasError('min')).toBe(true);
    c.setValue(23.456);
    expect(c.hasError('decimales')).toBe(true);
    c.setValue(Number.NaN);
    expect(c.hasError('numero')).toBe(true);
    c.setValue(0);
    expect(c.valid).toBe(true);
  });

  it('componentes must add up to the total ±0.01, and only when detailed', () => {
    const form = crearFormDictamen();
    llenar(form);
    form.controls.componentes.setValue({ deficiencias: 15, rolLaboralYOtrasAreas: 8 });
    expect(form.valid).toBe(true); // toggle off: ignored and disabled
    form.controls.conComponentes.setValue(true);
    expect(form.errors).toEqual({ componentesNoSuman: { suma: 23, total: 23.45 } });
    form.controls.componentes.controls.deficiencias.setValue(15.44);
    expect(form.errors).toBeNull(); // 23.44 vs 23.45: within the tolerance
    expect(sumaComponentes(form)).toEqual({ suma: 23.44, total: 23.45 });
    expect(aRequest(form).componentes).toEqual({ deficiencias: 15.44, rolLaboralYOtrasAreas: 8 });
    form.controls.componentes.controls.deficiencias.setValue(15.43);
    expect(form.hasError('componentesNoSuman')).toBe(true);
  });

  it('estructuración ≤ dictamen ≤ today in Bogotá, rechecked when either moves', () => {
    const form = crearFormDictamen();
    llenar(form);
    const { fechaEstructuracion: e, fechaDictamen: d } = form.controls;
    e.setValue('2026-10-11');
    expect(e.hasError('posterior')).toBe(true);
    d.setValue('2026-10-12');
    expect(e.valid).toBe(true);
    d.setValue(sumarDias(hoyBogota(), 1)!);
    expect(d.hasError('futura')).toBe(true);
    expect(crearFormDictamen().controls.fechaDictamen.value).toBe(hoyBogota());
  });

  it('fundamentos: 50–20 000 characters, whitespace alone is empty', () => {
    const c = crearFormDictamen().controls.fundamentos;
    c.setValue(' '.repeat(60));
    expect(c.hasError('required')).toBe(true);
    c.setValue('x'.repeat(49));
    expect(c.hasError('minlength')).toBe(true);
    c.setValue('x'.repeat(50));
    expect(c.valid).toBe(true);
    c.setValue('x'.repeat(20_001));
    expect(c.hasError('maxlength')).toBe(true);
  });

  it('a correction starts from the current dictamen and links to it', () => {
    const original = crearDatosBackoffice().dictamenes[0]!;
    const form = crearFormDictamen(original);
    expect(form.getRawValue()).toMatchObject({
      porcentajePcl: 23.45,
      origen: 'LABORAL',
      conComponentes: true,
      componentes: { deficiencias: 15.45, rolLaboralYOtrasAreas: 8 },
      fundamentos: original.fundamentos,
      diagnosticos: [{ codigo: 'G56.0', descripcion: '' }],
    });
    expect(aRequest(form, original.id).corrigeA).toBe(original.id);
  });

  it('server errors go to their field, in either 400 shape', () => {
    expect(
      erroresDeDictamen(
        problema({
          errorCode: 'General.Validation',
          errors: [
            { campo: null, codigo: 'Dictamen.ComponentesNoSuman', mensaje: 'No suman.' },
            { campo: null, codigo: 'Dictamen.FechasInvalidas', mensaje: 'Fechas.' },
            { campo: null, codigo: 'Clinico.DiagnosticoCodigoInvalido', mensaje: 'CIE-10.' },
            { campo: null, codigo: 'Dictamen.FundamentosLongitud', mensaje: 'Largo.' },
          ],
        }),
      ),
    ).toEqual({
      componentes: 'No suman.',
      fechas: 'Fechas.',
      diagnosticos: 'CIE-10.',
      fundamentos: 'Largo.',
    });
    expect(
      erroresDeDictamen(
        problema({ errorCode: 'Dictamen.PorcentajeFueraDeRango', detail: 'De 0 a 100.' }),
      ),
    ).toEqual({ porcentajePcl: 'De 0 a 100.' });
    expect(
      erroresDeDictamen(problema({ status: 403, errorCode: 'Clinico.ProfesionalSinRegistro' }))
        .general,
    ).toContain('RETHUS');
    expect(erroresDeDictamen(problema({ status: 500 }))).toEqual({
      general: expect.any(String),
    });
  });

  it('a stale-view 409 is explained, anything else is not a conflict', () => {
    expect(conflictoDictamen(problema({ status: 409, errorCode: 'Dictamen.YaExiste' }))).toContain(
      'ya tiene un dictamen',
    );
    expect(
      conflictoDictamen(problema({ status: 409, errorCode: 'Dictamen.YaNotificado' })),
    ).toContain('ya fue notificado');
    expect(conflictoDictamen(problema({ status: 409, errorCode: 'Caso.Otro' }))).toBeNull();
    expect(conflictoDictamen(new Error('x'))).toBeNull();
  });

  it('notificación: not future, not before the dictamen date (Bogotá)', () => {
    const form = crearFormNotificacion('2026-10-10');
    const c = form.controls.notificadoEn;
    c.setValue('2026-10-09T23:59');
    expect(c.hasError('anteriorAlDictamen')).toBe(true);
    c.setValue('2026-10-10T00:00');
    expect(c.valid).toBe(true);
    c.setValue(aBogotaLocal(Date.now() + 3_600_000)!);
    expect(c.hasError('futura')).toBe(true);
    expect(form.controls.medio.hasError('required')).toBe(true);
    expect(
      errorDeNotificacion(
        problema({ errorCode: 'Dictamen.NotificacionFueraDeRango', detail: 'Fuera.' }),
      ),
    ).toEqual({ notificadoEn: 'Fuera.' });
  });

  it('stepper: the optional dispute is skipped when the dictamen goes firm without it', () => {
    const fases = (estado: string) => etapasNotificacion(estado).map((e) => e.fase);
    expect(fases('PENDIENTE')).toEqual(['actual', 'pendiente', 'pendiente', 'pendiente']);
    expect(fases('NOTIFICADO')).toEqual(['hecha', 'actual', 'pendiente', 'pendiente']);
    expect(fases('EN_CONTROVERSIA')).toEqual(['hecha', 'hecha', 'actual', 'pendiente']);
    expect(fases('EN_FIRME')).toEqual(['hecha', 'hecha', 'omitida', 'actual']);
  });

  it('days left to dispute, in calendar days', () => {
    expect(diasParaControversia('2026-10-30', '2026-10-20')).toBe(10);
    expect(diasParaControversia('2026-10-20', '2026-10-20')).toBe(0);
    expect(diasParaControversia(null)).toBeNull();
  });
});

describe('dictamen PCL against the mock API', () => {
  const avisos: string[] = [];
  let peticiones: HttpRequest<unknown>[];
  let db: DatosBackoffice;
  let authorizeWithPopUp: ReturnType<typeof vi.fn>;
  let sesion: ReturnType<typeof sesionFalsa>['falsa'];
  const ahoraSeg = () => Math.floor(Date.now() / 1000);

  const claimsCalificador = (acr: string): ClaimsMock => ({
    sub: SUB.calificadorArla,
    actor_tipo: 'arl',
    tenant_id: 'ARL_A',
    acr,
    auth_time: ahoraSeg() - 60,
    rethus: 'RM-DEV-0001',
    tipo_documento: 'CC',
    numero_documento: '52000111',
    resource_access: { 'halsa-api': { roles: PERSONAS['calificador']! } },
  });

  async function abrir(
    url: string,
    { acr = 2, edadSeg = 60, permisos = PERSONAS['calificador']! } = {},
  ) {
    avisos.length = 0;
    peticiones = [];
    db = crearDatosBackoffice();
    const token = jwt(claimsCalificador(String(acr)));
    // Plays the authInterceptor: the mock reads the actor from the Bearer token.
    const bearer: HttpInterceptorFn = (req, next) => {
      peticiones.push(req);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    };
    authorizeWithPopUp = vi.fn(() =>
      of({ isAuthenticated: true, accessToken: jwt({ acr: '2', auth_time: ahoraSeg() }) }),
    );
    const falsa = sesionFalsa({
      sub: SUB.calificadorArla,
      permisos: new Set(permisos),
      acr,
      authTime: ahoraSeg() - edadSeg,
    });
    sesion = falsa.falsa;
    TestBed.configureTestingModule({
      providers: [
        falsa.provider,
        { provide: API_PREFIX, useValue: '/v1/' },
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '', keycloak: { authority: 'http://kc' } } },
        { provide: OidcSecurityService, useValue: { authorizeWithPopUp } },
        provideHttpClient(
          withInterceptors([
            bearer,
            problemaInterceptor,
            crearInterceptorMock(crearRutasBackoffice(db), { prefijo: '/v1/', retardoMs: 0 }),
          ]),
        ),
        provideRouter(
          [
            { path: 'casos/:casoId/dictamen-pcl', children: DICTAMEN_PCL_ROUTES },
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
  const delDictamen = () => peticiones.filter((r) => r.url.includes('dictamen-pcl'));
  const posts = () => delDictamen().filter((r) => r.method === 'POST');
  const url = () => TestBed.inject(Router).url;

  function boton(nombre: string): HTMLElement {
    const b = [...document.querySelectorAll<HTMLElement>('button, a')].find(
      (e) => e.textContent?.trim() === nombre,
    );
    if (!b) throw new Error(`No "${nombre}"`);
    return b;
  }

  function escribir(selector: string, valor: string) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!el) throw new Error(`No ${selector}`);
    el.value = valor;
    el.dispatchEvent(new Event('input'));
  }

  /** The radio card whose label starts with `etiqueta`. */
  function radio(etiqueta: string): HTMLInputElement {
    const label = [...document.querySelectorAll('label')].find((l) =>
      l.textContent?.trim().startsWith(etiqueta),
    );
    const input = label?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!input) throw new Error(`No radio "${etiqueta}"`);
    return input;
  }

  const valorDe = (selector: string) =>
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value;

  async function llenarFormulario(harness: RouterTestingHarness, fundamentos = FUNDAMENTOS) {
    escribir('#dictamen-porcentaje', '23,45');
    radio('Laboral').click();
    escribir('#dictamen-estructuracion', sumarDias(hoyBogota(), -30)!);
    escribir('#dictamen-fundamentos', fundamentos);
    escribir('#dictamen-dx-codigo-0', 'G56.0');
    await estable(harness);
  }

  it('at acr=1 shows the gate and sends no dictamen request', async () => {
    await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`, { acr: 1 });
    expect(texto()).toContain('Verificar identidad');
    expect(delDictamen()).toEqual([]);
  });

  it('an auth_time older than 15 minutes asks for verification again, before any request', async () => {
    await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl/registrar`, { edadSeg: 16 * 60 });
    expect(texto()).toContain('Verificar identidad');
    expect(document.querySelector('#dictamen-fundamentos')).toBeNull();
    expect(delDictamen()).toEqual([]);
  });

  it('re-gates when less than 2 minutes of the window remain', async () => {
    await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`, { edadSeg: 13 * 60 + 5 });
    expect(texto()).toContain('Verificar identidad');
    expect(delDictamen()).toEqual([]);
  });

  it('shows the dictamen: figure, stepper, componentes, calificador and fundamentos', async () => {
    await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`);
    expect(document.querySelector('[data-testid="porcentaje"]')!.textContent).toContain('23,45 %');
    expect(texto()).toContain('Origen laboral');
    expect(texto()).toContain('Pendiente de notificar');
    expect(texto()).toContain('Decreto 1507/2014');
    expect(document.querySelector('[aria-current="step"]')!.textContent).toContain('Pendiente');
    expect(
      document.querySelector('[data-testid="barra-componentes"]')!.getAttribute('aria-label'),
    ).toBe('Deficiencias 15,45 % más rol laboral y otras áreas 8,00 %: total 23,45 %');
    expect(texto()).toContain('••••0111');
    expect(texto()).not.toContain('52000111');
    expect(texto()).toContain('RM-DEV-0001');
    expect(texto()).toContain('nervio mediano bilateral');
    expect(texto()).toContain('Verificación vigente por');
    expect(boton('Corregir dictamen')).toBeTruthy();
    expect(boton('Registrar notificación')).toBeTruthy();
  });

  it('no dictamen yet: empty state, then registers one', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/dictamen-pcl`);
    expect(texto()).toContain('Aún no hay dictamen registrado');
    boton('Registrar dictamen').click();
    await estable(harness);
    expect(url()).toBe(`/casos/${CASO.validado}/dictamen-pcl/registrar`);

    await llenarFormulario(harness);
    (document.querySelector('input[formcontrolname="conComponentes"]') as HTMLElement).click();
    await estable(harness);
    escribir('#dictamen-deficiencias', '15');
    escribir('#dictamen-rol', '8');
    await estable(harness);
    expect(document.querySelector('[data-testid="suma-componentes"]')!.textContent).toContain(
      'suman 23,00 %, pero el total es 23,45 %',
    );
    escribir('#dictamen-deficiencias', '15,45');
    await estable(harness);
    expect(document.querySelector('[data-testid="suma-componentes"]')!.textContent).toContain(
      'Suman 23,45 %, igual al total',
    );

    boton('Registrar dictamen').click();
    await estable(harness);
    const [post] = posts();
    expect(post!.body).toMatchObject({
      porcentajePcl: 23.45,
      origen: 'LABORAL',
      fechaDictamen: hoyBogota(),
      componentes: { deficiencias: 15.45, rolLaboralYOtrasAreas: 8 },
      diagnosticos: [{ sistema: 'CIE-10', codigo: 'G56.0' }],
    });
    expect(post!.body).not.toHaveProperty('corrigeA');
    expect(post!.headers.has('Halsa-Motivo-Acceso')).toBe(false);
    expect(avisos).toContain('exito: Dictamen registrado');
    expect(url()).toBe(`/casos/${CASO.validado}/dictamen-pcl`);
    expect(document.querySelector('[data-testid="porcentaje"]')!.textContent).toContain('23,45 %');
    expect(
      db.casos.find((c) => c.detalle.resumen.id === CASO.validado)!.detalle.resumen.estado,
    ).toBe('EnCalificacionPcl');
  });

  it('client checks stop an incomplete dictamen before any request', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/dictamen-pcl/registrar`);
    await llenarFormulario(harness, 'Muy corto');
    boton('Registrar dictamen').click();
    await estable(harness);
    expect(texto()).toContain('Escribe al menos 50 caracteres.');
    expect(posts()).toEqual([]);
  });

  it('corrects a pending dictamen from a prefilled form, with corrigeA', async () => {
    const harness = await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`);
    boton('Corregir dictamen').click();
    await estable(harness);
    expect(texto()).toContain('La corrección reemplaza el dictamen');
    expect(valorDe('#dictamen-porcentaje')).toBe('23,45');
    expect(valorDe('#dictamen-deficiencias')).toBe('15,45');

    escribir('#dictamen-porcentaje', '25');
    escribir('#dictamen-deficiencias', '17');
    await estable(harness);
    boton('Guardar corrección').click();
    await estable(harness);

    expect(posts()[0]!.body).toMatchObject({
      porcentajePcl: 25,
      corrigeA: '0199f000-0000-7000-8000-000000000001',
    });
    expect(avisos).toContain('exito: Corrección registrada');
    expect(document.querySelector('[data-testid="porcentaje"]')!.textContent).toContain('25,00 %');
    expect(texto()).toContain('Este dictamen corrige uno anterior');
  });

  it('the medio error clears as soon as one is chosen', async () => {
    const harness = await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`);
    boton('Registrar notificación').click();
    await estable(harness);
    document.querySelector<HTMLElement>('button[form="form-notificar"]')!.click();
    await estable(harness);
    expect(texto()).toContain('Elige el medio de notificación.');
    radio('Personal').click();
    await estable(harness);
    expect(texto()).not.toContain('Elige el medio de notificación.');
    expect(posts()).toEqual([]);
  });

  it('registers the notification and shows the dispute deadline', async () => {
    const harness = await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`);
    boton('Registrar notificación').click();
    await estable(harness);
    escribir('#notificar-fecha', aBogotaLocal(Date.now() - 60_000)!);
    radio('Personal').click();
    await estable(harness);
    document.querySelector<HTMLElement>('button[form="form-notificar"]')!.click();
    await estable(harness);

    const notificar = posts().find((r) => r.url.endsWith('/notificar'))!;
    expect(notificar.body).toEqual({
      notificadoEn: expect.stringMatching(/-05:00$/),
      medio: 'PERSONAL',
    });
    expect(avisos).toContain('exito: Notificación registrada');
    expect(document.querySelector('[aria-current="step"]')!.textContent).toContain('Notificado');
    expect(texto()).toMatch(/Quedan \d+ días para controvertir/);
    expect(() => boton('Corregir dictamen')).toThrow();
  });

  it('a 409 keeps what was typed, explains, and refreshes the dictamen', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/dictamen-pcl/registrar`);
    await llenarFormulario(harness);
    // Someone else registers one meanwhile.
    db.dictamenes.push({ ...db.dictamenes[0]!, id: 'otro', casoId: CASO.validado });
    boton('Registrar dictamen').click();
    await estable(harness);

    expect(document.querySelector('[data-testid="conflicto"]')!.textContent).toContain(
      'ya tiene un dictamen',
    );
    expect(valorDe('#dictamen-fundamentos')).toBe(FUNDAMENTOS);
    expect((boton('Registrar dictamen') as HTMLButtonElement).disabled).toBe(true);
    expect(delDictamen().filter((r) => r.method === 'GET')).toHaveLength(2);
  });

  it('the draft survives the window closing and a popup verification, and never hits storage', async () => {
    const guardado = vi.spyOn(Storage.prototype, 'setItem');
    const harness = await abrir(`/casos/${CASO.validado}/dictamen-pcl/registrar`);
    const largo = 'Hallazgos del examen físico y de la valoración funcional. '.repeat(90);
    expect(largo.length).toBeGreaterThan(5000);
    await llenarFormulario(harness, largo);

    // 13+ minutes later: the window closes and the gate drops the form view.
    sesion.sesion.update((s) => s && { ...s, authTime: ahoraSeg() - 13 * 60 - 5 });
    TestBed.inject(StepUpService).actualizarReloj();
    await estable(harness);
    expect(document.querySelector('#dictamen-fundamentos')).toBeNull();
    expect(texto()).toContain('Verificar identidad');

    boton('Verificar identidad').click();
    await estable(harness);
    expect(authorizeWithPopUp).toHaveBeenCalledWith({
      customParams: { acr_values: '2', max_age: '780' },
    });
    expect(valorDe('#dictamen-fundamentos')).toBe(largo);
    expect(valorDe('#dictamen-porcentaje')).toBe('23,45');
    expect(radio('Laboral').checked).toBe(true);

    const escrito = guardado.mock.calls.map(([, v]) => String(v)).join(' ');
    expect(escrito).not.toContain('valoración funcional');
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain(
      'valoración funcional',
    );
    guardado.mockRestore();

    boton('Registrar dictamen').click();
    await estable(harness);
    expect((posts()[0]!.body as { fundamentos: string }).fundamentos).toBe(largo);
  });

  it('"Renovar verificación" restarts the window through the popup', async () => {
    const harness = await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`, { edadSeg: 600 });
    boton('Renovar verificación').click();
    await estable(harness);
    expect(authorizeWithPopUp).toHaveBeenCalledWith({
      customParams: { acr_values: '2', max_age: '780' },
    });
    expect(sesion.sesion()!.authTime).toBeGreaterThan(ahoraSeg() - 5);
  });

  it('not assigned → panel; emergency access reads with the motivo and hides writes', async () => {
    const harness = await abrir(`/casos/${CASO.noAsignado}/dictamen-pcl`);
    expect(texto()).toContain('No estás asignado a este caso');

    boton('Acceso de emergencia').click();
    await estable(harness);
    escribir(
      '#halsa-motivo-emergencia',
      'Valoración urgente: el paciente llegó inconsciente a urgencias',
    );
    (document.querySelector('#halsa-confirma-urgencia') as HTMLElement).click();
    await estable(harness);
    boton('Acceder y registrar motivo').click();
    await estable(harness);

    expect(texto()).toContain('Acceso de emergencia activo — motivo registrado');
    expect(delDictamen().at(-1)!.headers.get('Halsa-Motivo-Acceso')).toBe(
      'Valoracion urgente: el paciente llego inconsciente a urgencias',
    );
    expect(texto()).toContain('Aún no hay dictamen registrado');
    expect(() => boton('Registrar dictamen')).toThrow();
  });

  it('read without write: no actions, and "registrar" goes back with a notice', async () => {
    const soloLectura = PERSONAS['calificador']!.filter((p) => p !== 'pcl:dictamen:write');
    const harness = await abrir(`/casos/${CASO.enCalificacion}/dictamen-pcl`, {
      permisos: soloLectura,
    });
    expect(texto()).toContain('23,45 %');
    expect(() => boton('Corregir dictamen')).toThrow();
    expect(() => boton('Registrar notificación')).toThrow();

    await harness.navigateByUrl(`/casos/${CASO.enCalificacion}/dictamen-pcl/registrar`);
    await estable(harness);
    expect(avisos).toContain('aviso: No puedes registrar ni corregir el dictamen');
    expect(url()).toBe(`/casos/${CASO.enCalificacion}/dictamen-pcl`);
  });
});
