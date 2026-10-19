import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_PREFIX } from '@halsa/core';
import { of } from 'rxjs';
import { authInterceptor, TOKEN_ACCESO } from './auth.interceptor';

describe('authInterceptor (plan §5.1.3)', () => {
  function configurar(token: string | null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_PREFIX, useValue: 'https://api.example.com/v1/' },
        { provide: TOKEN_ACCESO, useValue: () => of(token) },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    return [TestBed.inject(HttpClient), TestBed.inject(HttpTestingController)] as const;
  }

  it('attaches the Bearer token to API requests only', () => {
    const [http, backend] = configurar('tkn');
    http.get('https://api.example.com/v1/casos').subscribe();
    http.get('https://keycloak.example.com/realms/halsa/account').subscribe();
    http.get('https://api.example.com/openapi/v1.json').subscribe();
    expect(
      backend.expectOne('https://api.example.com/v1/casos').request.headers.get('Authorization'),
    ).toBe('Bearer tkn');
    expect(
      backend
        .expectOne('https://keycloak.example.com/realms/halsa/account')
        .request.headers.has('Authorization'),
    ).toBe(false);
    expect(
      backend
        .expectOne('https://api.example.com/openapi/v1.json')
        .request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('sends the request without Authorization when there is no session', () => {
    const [http, backend] = configurar(null);
    http.get('https://api.example.com/v1/casos').subscribe();
    expect(
      backend.expectOne('https://api.example.com/v1/casos').request.headers.has('Authorization'),
    ).toBe(false);
  });
});
