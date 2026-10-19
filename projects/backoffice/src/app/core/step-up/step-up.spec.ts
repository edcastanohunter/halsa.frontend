import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_PREFIX, ErrorApi, problemaInterceptor } from '@halsa/core';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom, Observable } from 'rxjs';
import { jwt } from '../../testing/tokens';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { authInterceptor, TOKEN_ACCESO } from '../http/auth.interceptor';
import { stepUpInterceptor } from '../http/step-up.interceptor';
import { parametros, StepUpService } from './step-up.service';

const ahoraSeg = () => Math.floor(Date.now() / 1000);

describe('StepUpService (plan §5.1.4)', () => {
  let respuestaPopup: Partial<LoginResponse>;
  let abrirPopup: ReturnType<typeof vi.fn>;
  let authorizeWithPopUp: ReturnType<typeof vi.fn>;
  const openOriginal = window.open;

  function configurar(sesion = sesionFalsa({ acr: 1, authTime: ahoraSeg() - 60 })) {
    respuestaPopup = {
      isAuthenticated: true,
      accessToken: jwt({ acr: '2', auth_time: ahoraSeg() }),
    };
    abrirPopup = vi.fn(() => ({}) as Window);
    window.open = abrirPopup as unknown as Window['open'];
    // Like the library: opens the window, and never emits when window.open returns null.
    authorizeWithPopUp = vi.fn(
      () =>
        new Observable<Partial<LoginResponse>>((s) => {
          if (window.open('https://kc/auth', '_blank')) {
            s.next(respuestaPopup);
            s.complete();
          }
        }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        sesion.provider,
        { provide: OidcSecurityService, useValue: { authorizeWithPopUp } },
      ],
    });
    return { servicio: TestBed.inject(StepUpService), sesion: sesion.falsa };
  }

  afterEach(() => (window.open = openOriginal));

  it('meets acr and, with a window, auth_time minus 2 minutes', () => {
    const { servicio, sesion } = configurar();
    expect(servicio.cumple({ acr: 2 })).toBe(false);
    sesion.sesion.update((s) => s && { ...s, acr: 2, authTime: ahoraSeg() - 700 });
    expect(servicio.cumple({ acr: 2 })).toBe(true);
    expect(servicio.cumple({ acr: 2, maxAgeSeg: 900 })).toBe(true);
    sesion.sesion.update((s) => s && { ...s, authTime: ahoraSeg() - 800 });
    expect(servicio.cumple({ acr: 2, maxAgeSeg: 900 })).toBe(false);
  });

  it('asks Keycloak for acr 2, and for max_age minus the margin in a time window', () => {
    expect(parametros({ acr: 2 })).toEqual({ acr_values: '2' });
    expect(parametros({ acr: 2, maxAgeSeg: 900 })).toEqual({ acr_values: '2', max_age: '780' });
  });

  it('a successful popup raises the session level', async () => {
    const { servicio, sesion } = configurar();
    await expect(servicio.verificar({ acr: 2, maxAgeSeg: 900 })).resolves.toBe(true);
    expect(authorizeWithPopUp).toHaveBeenCalledWith({
      customParams: { acr_values: '2', max_age: '780' },
    });
    expect(sesion.actualizarNivel).toHaveBeenCalledWith(respuestaPopup.accessToken);
    expect(servicio.cumple({ acr: 2 })).toBe(true);
    expect(window.open).toBe(abrirPopup);
  });

  it('a closed popup, or one that still ends at acr 1, is not a verification', async () => {
    const { servicio } = configurar();
    respuestaPopup = { isAuthenticated: false, errorMessage: 'User closed popup' };
    await expect(servicio.verificar({ acr: 2 })).resolves.toBe(false);
    respuestaPopup = { isAuthenticated: true, accessToken: jwt({ acr: '1' }) };
    await expect(servicio.verificar({ acr: 2 })).resolves.toBe(false);
  });

  it('a blocked popup asks before redirecting, and keeps only the URL', async () => {
    const { servicio, sesion } = configurar();
    abrirPopup.mockReturnValue(null);
    const resultado = servicio.verificar({ acr: 2 });
    await vi.waitFor(() => expect(servicio.solicitud()?.fase).toBe('bloqueado'));
    expect(window.open).toBe(abrirPopup);

    servicio.continuarEnEstaPestana();
    expect(sesion.iniciarSesion).toHaveBeenCalledWith('/', { acr_values: '2' });

    servicio.cancelar();
    await expect(resultado).resolves.toBe(false);
    expect(servicio.solicitud()).toBeNull();
  });

  it('the reactive flow asks in a dialog first, and concurrent 401s share it', async () => {
    const { servicio } = configurar();
    const a = servicio.solicitar({ acr: 2 });
    const b = servicio.solicitar({ acr: 2 });
    expect(servicio.solicitud()).toEqual({ requisito: { acr: 2 }, fase: 'pedir' });
    expect(authorizeWithPopUp).not.toHaveBeenCalled();

    await servicio.confirmarSolicitud();
    await expect(a).resolves.toBe(true);
    await expect(b).resolves.toBe(true);
    expect(authorizeWithPopUp).toHaveBeenCalledTimes(1);
    expect(servicio.solicitud()).toBeNull();
  });
});

describe('stepUpInterceptor (plan §5.1.3–5.1.4)', () => {
  let token: string;
  let solicitar: ReturnType<typeof vi.fn>;

  function configurar(verifica: boolean) {
    token = 'token-acr1';
    solicitar = vi.fn(async () => {
      if (verifica) token = 'token-acr2';
      return verifica;
    });
    const sesion = sesionFalsa({});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        sesion.provider,
        { provide: API_PREFIX, useValue: '/v1/' },
        { provide: TOKEN_ACCESO, useValue: () => new Observable((s) => s.next(token)) },
        { provide: StepUpService, useValue: { solicitar } },
        provideHttpClient(
          withInterceptors([stepUpInterceptor, authInterceptor, problemaInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    return {
      http: TestBed.inject(HttpClient),
      backend: TestBed.inject(HttpTestingController),
      sesion: sesion.falsa,
    };
  }

  const desafio = {
    status: 401,
    statusText: 'Unauthorized',
    headers: new HttpHeaders({
      'WWW-Authenticate':
        'Bearer error="insufficient_user_authentication", acr_values="2", max_age="900"',
    }),
  };
  const URL = '/v1/casos/c1/dictamen-pcl';

  it('verifies, then retries the original request once with the new token', async () => {
    const { http, backend } = configurar(true);
    const respuesta = firstValueFrom(http.get(URL));
    backend.expectOne(URL).flush({ errorCode: 'Auth.StepUpRequerido' }, desafio);
    const reintento = await vi.waitFor(() => backend.expectOne(URL));
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer token-acr2');
    reintento.flush({ estadoNotificacion: 'PENDIENTE' });
    await expect(respuesta).resolves.toEqual({ estadoNotificacion: 'PENDIENTE' });
    expect(solicitar).toHaveBeenCalledWith({ acr: 2, maxAgeSeg: 900 });
  });

  it('never loops: a second challenge on the retry is returned to the caller', async () => {
    const { http, backend } = configurar(true);
    const respuesta = firstValueFrom(http.get(URL));
    backend.expectOne(URL).flush(null, desafio);
    (await vi.waitFor(() => backend.expectOne(URL))).flush(null, desafio);
    await expect(respuesta).rejects.toBeInstanceOf(ErrorApi);
    expect(solicitar).toHaveBeenCalledTimes(1);
    backend.verify();
  });

  it('a cancelled verification rethrows the step-up error', async () => {
    const { http, backend } = configurar(false);
    const respuesta = firstValueFrom(http.get(URL));
    backend.expectOne(URL).flush(null, desafio);
    const error = await respuesta.catch((e: ErrorApi) => e);
    expect((error as ErrorApi).problema.stepUp).toEqual({ acr: 2, maxAge: 900 });
    backend.verify();
  });

  it('a 401 without a challenge is an expired session', async () => {
    const { http, backend, sesion } = configurar(true);
    const respuesta = firstValueFrom(http.get('/v1/casos'));
    backend.expectOne('/v1/casos').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(respuesta).rejects.toBeInstanceOf(ErrorApi);
    expect(sesion.sesionExpirada).toHaveBeenCalledWith('/');
    expect(solicitar).not.toHaveBeenCalled();
  });

  it('ignores requests outside the API', async () => {
    const { http, backend, sesion } = configurar(true);
    const respuesta = firstValueFrom(http.get('/config.json'));
    backend.expectOne('/config.json').flush(null, desafio);
    await expect(respuesta).rejects.toBeTruthy();
    expect(solicitar).not.toHaveBeenCalled();
    expect(sesion.sesionExpirada).not.toHaveBeenCalled();
  });
});
