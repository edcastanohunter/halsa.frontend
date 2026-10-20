import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_PREFIX, problemaInterceptor } from '@halsa/core';
import { crearInterceptorMock } from '@halsa/mocks';
import { crearDatosBackoffice, crearRutasBackoffice, SUB } from '../../../../mocks';
import { PERSONAS } from '../../../testing/personas';
import { jwt } from '../../../testing/tokens';
import { WidgetRevisionesPendientes } from './revisiones-pendientes.widget';
import { WidgetSolicitudesAbiertas } from './solicitudes-abiertas.widget';

const texto = (el: Element | null | undefined) =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe("the privacy officer's /inicio widgets (plan §7.2)", () => {
  const urls: string[] = [];

  beforeEach(() => {
    urls.length = 0;
    const token = jwt({
      sub: SUB.privacidadArla,
      actor_tipo: 'arl',
      tenant_id: 'ARL_A',
      acr: '1',
      resource_access: { 'halsa-api': { roles: PERSONAS['privacidad']! } },
    });
    const bearer: HttpInterceptorFn = (req, next) => {
      urls.push(req.urlWithParams);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: API_PREFIX, useValue: '/v1/' },
        provideRouter([]),
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
      ],
    });
  });

  async function montar<T>(tipo: Type<T>) {
    const fixture = TestBed.createComponent(tipo);
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r));
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return fixture.nativeElement as HTMLElement;
  }

  it('pending reviews: the count and the most urgent first', async () => {
    const el = await montar(WidgetRevisionesPendientes);
    const widget = el.querySelector('[data-testid="revisiones-pendientes"]')!;
    expect(texto(widget.querySelector('p'))).toBe('3 por revisar');
    const plazos = [...widget.querySelectorAll('[data-testid="vencimiento-revision"]')].map(texto);
    expect(plazos[0]).toBe('Vencida hace 8 h');
    expect(plazos).toHaveLength(3);
  });

  it('open copy requests: received and in progress, one request each', async () => {
    const el = await montar(WidgetSolicitudesAbiertas);
    expect(urls).toEqual([
      '/v1/solicitudes-copia-hc?estado=RECIBIDA',
      '/v1/solicitudes-copia-hc?estado=EN_TRAMITE',
    ]);
    const enlaces = [...el.querySelectorAll('[data-testid="solicitudes-abiertas"] a')].map(texto);
    expect(enlaces).toEqual(['Recibidas 2', 'En trámite 1']);
  });
});
