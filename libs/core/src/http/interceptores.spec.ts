import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  API_PREFIX,
  CABECERA_CORRELACION,
  correlacionInterceptor,
  problemaInterceptor,
} from './interceptores';
import { ErrorApi } from './problema';

describe('core HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_PREFIX, useValue: '/v1/' },
        provideHttpClient(withInterceptors([correlacionInterceptor, problemaInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('adds a UUID X-Correlation-Id to API requests only', () => {
    http.get('/v1/casos').subscribe();
    http.get('/config.json').subscribe();
    const api = backend.expectOne('/v1/casos');
    const otra = backend.expectOne('/config.json');
    expect(api.request.headers.get(CABECERA_CORRELACION)).toMatch(/^[0-9a-f-]{36}$/);
    expect(otra.request.headers.has(CABECERA_CORRELACION)).toBe(false);
    api.flush([]);
    otra.flush({});
  });

  it('rethrows API failures as a typed ErrorApi with step-up and correlation id', async () => {
    const resultado = firstValueFrom(http.get('/v1/casos/x/dictamen-pcl')).catch((e: unknown) => e);
    const req = backend.expectOne('/v1/casos/x/dictamen-pcl');
    req.flush(
      {
        title: 'Unauthorized',
        status: 401,
        errorCode: 'Auth.StepUpRequerido',
        detail: 'Verifica.',
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          'WWW-Authenticate':
            'Bearer error="insufficient_user_authentication", acr_values="2", max_age="900"',
        },
      },
    );
    const error = await resultado;
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).problema).toMatchObject({
      status: 401,
      errorCode: 'Auth.StepUpRequerido',
      stepUp: { acr: 2, maxAge: 900 },
      correlationId: req.request.headers.get(CABECERA_CORRELACION),
    });
  });

  it('reads problem+json from blob responses (PDF downloads)', async () => {
    const resultado = firstValueFrom(http.get('/v1/soporte', { responseType: 'blob' })).catch(
      (e: unknown) => e,
    );
    backend
      .expectOne('/v1/soporte')
      .flush(new Blob([JSON.stringify({ errorCode: 'Clinico.NoAsignado' })]), {
        status: 403,
        statusText: 'Forbidden',
      });
    const error = (await resultado) as ErrorApi;
    expect(error.problema.errorCode).toBe('Clinico.NoAsignado');
  });

  it('maps network failures to status 0 and leaves non-API errors untouched', async () => {
    const red = firstValueFrom(http.get('/v1/casos')).catch((e: unknown) => e);
    backend.expectOne('/v1/casos').error(new ProgressEvent('error'));
    expect(((await red) as ErrorApi).problema.status).toBe(0);

    const externa = firstValueFrom(http.get('/otra')).catch((e: unknown) => e);
    backend.expectOne('/otra').flush(null, { status: 500, statusText: 'x' });
    expect(await externa).not.toBeInstanceOf(ErrorApi);
  });

  it('never retries', async () => {
    const resultado = firstValueFrom(http.post('/v1/casos/x/remisiones', {})).catch(
      (e: unknown) => e,
    );
    backend.expectOne('/v1/casos/x/remisiones').flush(null, { status: 503, statusText: 'x' });
    await resultado;
    backend.expectNone('/v1/casos/x/remisiones');
  });
});
