import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@halsa/core';
import {
  EventTypes,
  LoginResponse,
  OidcClientNotification,
  OidcSecurityService,
  PublicEventsService,
} from 'angular-auth-oidc-client';
import { of, Subject, throwError } from 'rxjs';
import { jwt } from '../../testing/tokens';
import { SesionService } from './sesion.service';

const SUB = '01999000-0000-7000-8000-000000000a02';

describe('SesionService (plan §5.1.1)', () => {
  let eventos: Subject<OidcClientNotification<unknown>>;
  let tokenActual: string;
  let oidc: {
    checkAuth: ReturnType<typeof vi.fn>;
    getAccessToken: () => unknown;
    authorize: ReturnType<typeof vi.fn>;
    logoff: ReturnType<typeof vi.fn>;
  };

  function configurar(login: Partial<LoginResponse> | Error) {
    eventos = new Subject();
    tokenActual = jwt({ acr: '1', auth_time: 1000 });
    oidc = {
      checkAuth: vi.fn(() =>
        login instanceof Error
          ? throwError(() => login)
          : of({ isAuthenticated: false, accessToken: '', idToken: '', userData: null, ...login }),
      ),
      getAccessToken: () => of(tokenActual),
      authorize: vi.fn(),
      logoff: vi.fn(() => of(null)),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: '' } },
        { provide: OidcSecurityService, useValue: oidc },
        { provide: PublicEventsService, useValue: { registerForEvents: () => eventos } },
      ],
    });
    return {
      sesion: TestBed.inject(SesionService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  const autenticado = {
    isAuthenticated: true,
    accessToken: jwt({ acr: '1', auth_time: 1000 }),
    idToken: jwt({ name: 'Calificador ARL-A', preferred_username: 'calificador.arla' }),
  };

  async function iniciarCon(sesion: SesionService, http: HttpTestingController, yo: object) {
    const inicio = sesion.iniciar();
    (await vi.waitFor(() => http.expectOne('/v1/identidad/yo'))).flush(yo);
    await inicio;
  }

  it('builds the session from identidad/yo, the id token and the access token', async () => {
    const { sesion, http } = configurar(autenticado);
    await iniciarCon(sesion, http, {
      sub: SUB,
      actorTipo: 'arl',
      tenantId: 'ARL_A',
      ipsId: null,
      permisos: ['casos:read', 'clinico:read'],
    });
    expect(sesion.estado()).toBe('lista');
    expect(sesion.sesion()).toMatchObject({
      sub: SUB,
      nombre: 'Calificador ARL-A',
      correo: null,
      actorTipo: 'arl',
      tenantId: 'ARL_A',
      acr: 1,
      authTime: 1000,
    });
    expect([...sesion.sesion()!.permisos]).toEqual(['casos:read', 'clinico:read']);
  });

  it('follows new tokens (silent renew, step-up)', async () => {
    const { sesion, http } = configurar(autenticado);
    await iniciarCon(sesion, http, {
      sub: SUB,
      actorTipo: 'arl',
      tenantId: 'ARL_A',
      ipsId: null,
      permisos: [],
    });
    tokenActual = jwt({ acr: '2', auth_time: 2000 });
    eventos.next({ type: EventTypes.NewAuthenticationResult });
    expect(sesion.sesion()).toMatchObject({ acr: 2, authTime: 2000 });
  });

  it('a non ARL/IPS actor has no backoffice access', async () => {
    const { sesion, http } = configurar(autenticado);
    await iniciarCon(sesion, http, {
      sub: SUB,
      actorTipo: 'paciente',
      tenantId: null,
      ipsId: null,
      permisos: [],
    });
    expect(sesion.estado()).toBe('sin-acceso');
    expect(sesion.sesion()).toBeNull();
  });

  it('without tokens the session is anonymous and no API call is made', async () => {
    const { sesion, http } = configurar({ isAuthenticated: false });
    await sesion.iniciar();
    expect(sesion.estado()).toBe('anonima');
    http.verify();
  });

  it('Keycloak or identidad/yo failures end in `error`, never in a login loop', async () => {
    const caida = configurar(new Error('well-known unreachable'));
    await caida.sesion.iniciar();
    expect(caida.sesion.estado()).toBe('error');
    expect(oidc.authorize).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const { sesion, http } = configurar(autenticado);
    const inicio = sesion.iniciar();
    (await vi.waitFor(() => http.expectOne('/v1/identidad/yo'))).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    await inicio;
    expect(sesion.estado()).toBe('error');
    sesion.sesionExpirada('/inicio');
    expect(oidc.authorize).not.toHaveBeenCalled();
  });

  it('an expired session logs in again once, returning to the same URL', async () => {
    const { sesion, http } = configurar(autenticado);
    await iniciarCon(sesion, http, {
      sub: SUB,
      actorTipo: 'ips',
      tenantId: null,
      ipsId: '110011234501',
      permisos: [],
    });
    sesion.sesionExpirada('/casos?estado=Validado');
    sesion.sesionExpirada('/casos?estado=Validado');
    expect(oidc.authorize).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('halsa.retorno')).toBe('/casos?estado=Validado');
    sessionStorage.clear();
  });

  it('logout clears the identity and calls the end-session endpoint', async () => {
    const { sesion, http } = configurar(autenticado);
    await iniciarCon(sesion, http, {
      sub: SUB,
      actorTipo: 'arl',
      tenantId: 'ARL_A',
      ipsId: null,
      permisos: ['casos:read'],
    });
    sesion.cerrarSesion();
    expect(sesion.sesion()).toBeNull();
    expect(oidc.logoff).toHaveBeenCalled();
  });
});
