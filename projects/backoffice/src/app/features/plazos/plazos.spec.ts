import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { PlazoResponse } from '@halsa/api-types';
import { API_PREFIX, ErrorApi, problemaInterceptor, ProblemaApi } from '@halsa/core';
import { crearInterceptorMock } from '@halsa/mocks';
import { nivelPlazo } from '@halsa/ui/nivel-plazo';
import { Notificaciones } from '@halsa/ui/notificaciones';
import { throwError } from 'rxjs';
import { crearDatosBackoffice, crearRutasBackoffice } from '../../../mocks';
import { DialogoCumplirPlazo } from '../../shared/plazos/dialogo-cumplir-plazo';
import { PlazosApi } from '../../shared/plazos/plazos-api.service';
import { PERSONAS } from '../../testing/personas';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { PLAZOS_ROUTES } from './plazos.routes';

const avisos: string[] = [];
const notificaciones = {
  provide: Notificaciones,
  useValue: {
    exito: (t: string) => avisos.push(`exito: ${t}`),
    aviso: (t: string) => avisos.push(`aviso: ${t}`),
    error: () => avisos.push('error'),
  },
};

/** Lets the mock's promise-based responses and the follow-up renders settle. */
async function estable(harness: {
  fixture: { whenStable(): Promise<unknown>; detectChanges(): void };
}) {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r));
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  }
}

const textoDe = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ');

function boton(nombre: string | RegExp): HTMLButtonElement {
  const encontrado = [...document.querySelectorAll('button')].find((b) => {
    const n = b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '';
    return typeof nombre === 'string' ? n === nombre : nombre.test(n);
  });
  if (!encontrado) throw new Error(`No button ${nombre}`);
  return encontrado;
}

describe('mock fixtures drive the semaphore (plan §8.3)', () => {
  it('alerta, crítico and vencido land where the fixtures say', () => {
    const ahora = Date.parse('2026-10-17T10:00:00-05:00');
    const nivel = new Map(
      crearDatosBackoffice(ahora).plazos.map((p) => [p.id.slice(-1), nivelPlazo(p, ahora)]),
    );
    expect(Object.fromEntries(nivel)).toEqual({
      '1': 'critico',
      '2': 'alerta',
      '3': 'normal',
      '4': 'cumplido',
      '5': 'vencido',
      '6': 'suspendido',
      '7': 'normal',
      '8': 'normal',
    });
  });
});

describe('/plazos board against the mock API', () => {
  async function abrir(url: string, persona = 'analista') {
    avisos.length = 0;
    TestBed.configureTestingModule({
      providers: [
        sesionFalsa({ permisos: new Set(PERSONAS[persona]) }).provider,
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
            { path: 'plazos', children: PLAZOS_ROUTES },
            { path: '**', children: [] },
          ],
          withComponentInputBinding(),
        ),
        notificaciones,
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await estable(harness);
    return harness;
  }

  const reglas = () =>
    [...document.querySelectorAll('[data-testid="plazos-movil"] h3')].map((h) =>
      h.textContent?.trim(),
    );

  it('opens on the tenant open deadlines, unknown rules as their raw code', async () => {
    await abrir('/plazos');
    expect(reglas()).toEqual([
      'Reporte del accidente (FURAT)',
      'Controversia del dictamen',
      'Investigación del accidente',
      'REGLA_FUTURA_DESCONOCIDA',
    ]);
  });

  it('reads estado, regla and venceAntesDe from the URL', async () => {
    await abrir('/plazos?estado=VENCIDO');
    expect(reglas()).toEqual(['Tope de incapacidad temporal (180 días)']);
    TestBed.resetTestingModule();

    await abrir('/plazos?regla=CONTROVERSIA_DICTAMEN');
    expect(reglas()).toEqual(['Controversia del dictamen']);
    TestBed.resetTestingModule();

    await abrir('/plazos?estado=todos&venceAntesDe=2000-01-01');
    expect(textoDe(document.body)).toContain('No hay plazos con estos filtros');
  });

  it('a filter change writes the URL and resets the page', async () => {
    const harness = await abrir('/plazos?page=2');
    harness.routeDebugElement!.componentInstance.filtrarRegla('INVESTIGACION_AT');
    await estable(harness);
    expect(TestBed.inject(Router).url).toBe('/plazos?regla=INVESTIGACION_AT');
    expect(reglas()).toEqual(['Investigación del accidente']);
  });

  it('readers without plazos:write get no "Cumplir"', async () => {
    await abrir('/plazos', 'medico-laboral');
    expect(() => boton(/^Marcar como cumplido/)).toThrow();
  });

  it('cumplir: client validation, then success reloads the board', async () => {
    const harness = await abrir('/plazos?regla=CONTROVERSIA_DICTAMEN');
    boton(/^Marcar como cumplido: Controversia/).click();
    await estable(harness);
    const nota = document.querySelector<HTMLTextAreaElement>('#cumplir-nota')!;
    nota.value = 'corta';
    nota.dispatchEvent(new Event('input'));
    boton('Marcar como cumplido').click();
    await estable(harness);
    expect(textoDe(document.body)).toContain('Escribe al menos 10 caracteres.');

    nota.value = 'Se radicó la respuesta a la controversia ante la junta.';
    nota.dispatchEvent(new Event('input'));
    boton('Marcar como cumplido').click();
    await estable(harness);
    expect(avisos).toEqual(['exito: Plazo marcado como cumplido']);
    expect(textoDe(document.body)).toContain('No hay plazos con estos filtros');
  });
});

@Component({
  imports: [DialogoCumplirPlazo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-dialogo-cumplir-plazo [plazo]="plazo()" />`,
})
class Anfitrion {
  readonly plazo = signal<PlazoResponse | null>(null);
}

describe('DialogoCumplirPlazo error mapping (plan §7.4)', () => {
  function con(problema: Partial<ProblemaApi>) {
    TestBed.configureTestingModule({
      providers: [
        notificaciones,
        {
          provide: PlazosApi,
          useValue: {
            cumplir: () =>
              throwError(
                () =>
                  new ErrorApi({
                    status: 400,
                    errorCode: null,
                    title: null,
                    detail: null,
                    traceId: 't',
                    correlationId: null,
                    errors: [],
                    ...problema,
                  }),
              ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.plazo.set(crearDatosBackoffice().plazos[1]!);
    fixture.detectChanges();
    return fixture;
  }

  async function enviar(fixture: ReturnType<typeof con>, nota = 'Una nota suficientemente larga.') {
    await estable({ fixture });
    const campo = document.querySelector<HTMLTextAreaElement>('#cumplir-nota')!;
    campo.value = nota;
    campo.dispatchEvent(new Event('input'));
    boton('Marcar como cumplido').click();
    await estable({ fixture });
  }

  it('a server note error goes under the note', async () => {
    const fixture = con({
      errorCode: 'General.Validation',
      errors: [
        {
          campo: null,
          codigo: 'Plazo.NotaRequerida',
          mensaje: 'Debe tener al menos 10 caracteres.',
        },
      ],
    });
    await enviar(fixture);
    expect(textoDe(document.querySelector('[data-testid="error-nota"]'))).toContain(
      'Debe tener al menos 10 caracteres.',
    );
  });

  it('Plazo.CumplidoEnFuturo goes under the date', async () => {
    const fixture = con({
      errorCode: 'Plazo.CumplidoEnFuturo',
      detail: 'La fecha de cumplimiento no puede ser futura.',
    });
    await enviar(fixture);
    const campoFecha = document.querySelector('#cumplir-fecha')!.closest('hlm-field');
    expect(textoDe(campoFecha)).toContain('La fecha de cumplimiento no puede ser futura.');
  });

  it('Plazo.NoCumplible shows its detail inside the sheet', async () => {
    const fixture = con({
      status: 409,
      errorCode: 'Plazo.NoCumplible',
      detail: 'Solo un plazo ABIERTO o VENCIDO se puede cumplir.',
    });
    await enviar(fixture);
    expect(textoDe(document.querySelector('p[role="alert"]'))).toContain(
      'Solo un plazo ABIERTO o VENCIDO se puede cumplir.',
    );
  });
});
