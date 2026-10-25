import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_PREFIX, problemaInterceptor } from '@halsa/core';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { crearInterceptorMock } from '@halsa/mocks';
import { CASO, crearDatosBackoffice, crearRutasBackoffice, IPS_DEV, SUB } from '../../../mocks';
import { filtrarPorPermiso } from '../../core/permisos/permisos';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { crearRutasCasos } from './casos.routes';
import { PESTANAS_CASO } from './pestanas';
import { normalizarReps, validarReps, validarSub } from './validacion';

// Plan §6.3, bottom table ("Case tabs"), as tab routes in display order.
const PESTANAS_ESPERADAS: Record<string, string[]> = {
  analista: ['resumen', 'equipo', 'plazos', 'incapacidades', 'portal-paciente'],
  'medico-laboral': ['resumen', 'equipo', 'plazos', 'incapacidades', 'historia-clinica'],
  calificador: ['resumen', 'equipo', 'plazos', 'incapacidades', 'historia-clinica', 'dictamen-pcl'],
  privacidad: [],
  'medico-ips': ['resumen', 'equipo', 'incapacidades', 'historia-clinica'],
  'coordinador-ips': ['resumen', 'equipo'],
};

describe('case tabs per persona (plan §6.3)', () => {
  it.each(Object.keys(PERSONAS))('%s sees exactly its tabs', (persona) => {
    const visibles = filtrarPorPermiso(PESTANAS_CASO, new Set(PERSONAS[persona]));
    expect(visibles.map((p) => p.ruta)).toEqual(PESTANAS_ESPERADAS[persona]);
  });

  it('marks only the clinical tabs with a lock', () => {
    expect(PESTANAS_CASO.filter((p) => p.clinica).map((p) => p.ruta)).toEqual([
      'historia-clinica',
      'dictamen-pcl',
    ]);
  });
});

describe('equipo validators', () => {
  const valida = (validador: typeof validarReps, valor: string) =>
    validador(new FormControl(valor)) === null;

  it('a REPS code is exactly 12 digits', () => {
    expect(valida(validarReps, IPS_DEV)).toBe(true);
    expect(valida(validarReps, '11001123450')).toBe(false);
    expect(valida(validarReps, '1100112345012')).toBe(false);
    expect(valida(validarReps, '11001123450A')).toBe(false);
    // Empty is `required`'s job.
    expect(valida(validarReps, '')).toBe(true);
  });

  it('pasted REPS codes keep their digits only', () => {
    expect(normalizarReps(' 1100-1123 4501 ')).toBe(IPS_DEV);
  });

  it('a sub is a UUID', () => {
    expect(valida(validarSub, SUB.medicoIps)).toBe(true);
    expect(valida(validarSub, SUB.medicoIps.toUpperCase())).toBe(true);
    expect(valida(validarSub, '01999000-0000-7000-8000')).toBe(false);
    expect(valida(validarSub, 'medico.ips')).toBe(false);
  });
});

describe('case screens against the mock API', () => {
  const avisos: string[] = [];

  async function abrir(url: string, persona = 'analista', sub: string = SUB.analistaArla) {
    avisos.length = 0;
    const sesion = sesionFalsa({ sub, permisos: new Set(PERSONAS[persona]) });
    TestBed.configureTestingModule({
      providers: [
        sesion.provider,
        { provide: API_PREFIX, useValue: '/v1/' },
        provideHttpClient(
          withInterceptors([
            problemaInterceptor,
            crearInterceptorMock(crearRutasBackoffice(crearDatosBackoffice()), {
              prefijo: '/v1/',
              retardoMs: 0,
            }),
          ]),
        ),
        provideRouter(
          [
            { path: 'casos', children: crearRutasCasos() },
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

  /** Lets the mock's promise-based responses and the follow-up renders settle. */
  async function estable(harness: RouterTestingHarness) {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r));
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    }
  }

  const texto = (harness: RouterTestingHarness) =>
    (harness.routeNativeElement?.textContent ?? '').replace(/\s+/g, ' ');

  function boton(harness: RouterTestingHarness, nombre: string): HTMLButtonElement {
    const botones = [
      ...(harness.fixture.nativeElement as HTMLElement).ownerDocument.querySelectorAll('button'),
    ];
    const encontrado = botones.find((b) => b.textContent?.trim() === nombre);
    if (!encontrado) throw new Error(`No button "${nombre}"`);
    return encontrado;
  }

  function escribir(harness: RouterTestingHarness, selector: string, valor: string) {
    const input = harness.routeNativeElement!.querySelector<HTMLInputElement>(selector)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    harness.fixture.detectChanges();
  }

  it('a cross-tenant case id shows the neutral not-found state', async () => {
    const harness = await abrir(`/casos/${CASO.arlB}`);
    expect(texto(harness)).toContain('Caso no encontrado o no disponible para tu usuario');
  });

  it('the analyst gets no clinical tab, and its URL redirects to resumen with a toast', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/historia-clinica`);
    expect(TestBed.inject(Router).url).toBe(`/casos/${CASO.validado}/resumen`);
    expect(avisos).toEqual(['aviso: No tienes acceso a esa sección del caso']);
    const pestanas = [
      ...harness.routeNativeElement!.querySelectorAll('nav[aria-label="Secciones del caso"] a'),
    ].map((a) => a.textContent?.trim());
    expect(pestanas).toEqual(['Resumen', 'Equipo', 'Plazos', 'Incapacidades', 'Portal paciente']);
  });

  it('resumen masks the worker document and shows the PCL percentage only', async () => {
    const harness = await abrir(`/casos/${CASO.enCalificacion}/resumen`);
    const t = texto(harness);
    expect(t).toContain('CE ••••5566');
    expect(t).not.toContain('445566');
    expect(t).toContain('23,45 %');
  });

  it('"Asignarme" adds the own sub, shown as "Tú"', async () => {
    const harness = await abrir(`/casos/${CASO.radicado}/equipo`);
    expect(texto(harness)).toContain('Nadie está asignado todavía');
    boton(harness, 'Asignarme').click();
    await estable(harness);
    expect(avisos).toContain('exito: Te asignaste al caso');
    expect(texto(harness)).toMatch(/01999000…0a01\s*Tú/);
    expect(() => boton(harness, 'Asignarme')).toThrow();
  });

  it('a malformed REPS code is caught before the request', async () => {
    const harness = await abrir(`/casos/${CASO.radicado}/equipo`);
    escribir(harness, '#remitir-reps', '12345');
    boton(harness, 'Remitir').click();
    await estable(harness);
    expect(texto(harness)).toContain('El código REPS debe tener exactamente 12 dígitos.');
    expect(avisos).toEqual([]);
  });

  it('Caso.RemisionDuplicada shows inline under the REPS field, not as a toast', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/equipo`);
    escribir(harness, '#remitir-reps', IPS_DEV);
    boton(harness, 'Remitir').click();
    await estable(harness);
    const error = harness.routeNativeElement!.querySelector('[data-testid="error-reps"]');
    expect(error?.textContent).toContain('El caso ya está remitido a esa IPS.');
    expect(avisos).toEqual([]);
  });

  it('remitting to a new IPS lists it as a current remission', async () => {
    const harness = await abrir(`/casos/${CASO.radicado}/equipo`);
    escribir(harness, '#remitir-reps', '760011234501');
    boton(harness, 'Remitir').click();
    await estable(harness);
    expect(avisos).toContain('exito: Caso remitido a la IPS');
    expect(texto(harness)).toContain('IPS 760011234501');
  });

  it('IPS physicians see the team read-only', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/equipo`, 'medico-ips', SUB.medicoIps);
    const t = texto(harness);
    expect(t).toMatch(/01999000…0c01\s*Tú/);
    expect(t).toContain(`IPS ${IPS_DEV}`);
    expect(() => boton(harness, 'Asignar')).toThrow();
    expect(() => boton(harness, 'Remitir')).toThrow();
  });

  it('portal paciente: the button is off for a Radicado case', async () => {
    const harness = await abrir(`/casos/${CASO.radicado}/portal-paciente`);
    expect(boton(harness, 'Generar código').disabled).toBe(true);
    expect(texto(harness)).toContain('todavía no admite códigos');
  });

  it('portal paciente: a Validado case gets a one-time code, wiped on close', async () => {
    const harness = await abrir(`/casos/${CASO.validado}/portal-paciente`);
    boton(harness, 'Generar código').click();
    await estable(harness);
    const documento = (harness.fixture.nativeElement as HTMLElement).ownerDocument;
    const dialogo = documento.querySelector('[role="alertdialog"]');
    expect(dialogo?.textContent).toContain('No se volverá a mostrar');
    expect(dialogo?.textContent).toMatch(/[A-Z0-9]{6}\s*-\s*[A-Z0-9]{10}/);

    boton(harness, 'Ya lo guardé, cerrar').click();
    await estable(harness);
    expect(documento.body.textContent).not.toContain('No se volverá a mostrar');
  });
});
