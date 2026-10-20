import { problema } from '@halsa/mocks';
import { CABECERA_CSRF } from './http/interceptores';
import { retornoSeguro } from './sesion/navegador-bff';
import { abrirPortal, h1 } from '../testing/portal';

describe('BFF session (plan §5.2)', () => {
  it('anonymous: the welcome page; a protected URL starts the BFF login back to it', async () => {
    const p = await abrirPortal('/', { sesion: 'anonima' });
    expect(p.sesion.estado()).toBe('anonima');
    expect(h1()).toContain('Consulta el estado de tu caso');

    await p.ir('/casos/0199a000-0000-7000-8000-00000000a002');
    expect(p.logins).toEqual(['/casos/0199a000-0000-7000-8000-00000000a002']);
  });

  it('signed in but not linked: every section goes to /activar first', async () => {
    const p = await abrirPortal('/', { sesion: 'sin-vinculo' });
    expect(p.sesion.estado()).toBe('sin-vinculo');
    expect(p.router.url).toBe('/activar');
    for (const ruta of ['/inicio', '/casos', '/incapacidades', '/solicitudes']) {
      await p.ir(ruta);
      expect(p.router.url).toBe('/activar');
    }
    // Cuenta is reachable: it's how to log out or see who is signed in.
    await p.ir('/cuenta');
    expect(p.router.url).toBe('/cuenta');
    // No section navigation before the account is linked.
    expect(document.querySelector('nav[aria-label="Principal"]')).toBeNull();
  });

  it('linked: / goes to /inicio, with the five sections', async () => {
    const p = await abrirPortal('/');
    expect(p.router.url).toBe('/inicio');
    const secciones = [
      ...document.querySelectorAll('nav[aria-label="Principal"]')[0]!.querySelectorAll('a'),
    ].map((a) => a.textContent?.trim());
    expect(secciones).toEqual(['Inicio', 'Casos', 'Incapacidades', 'Solicitudes', 'Cuenta']);
  });

  it('a failing BFF is an error state with retry, not an anonymous visitor', async () => {
    const p = await abrirPortal('/', {
      rutas: (base) => [
        {
          metodo: 'GET',
          ruta: '/paciente/bff/usuario',
          manejar: () => problema(502, 'Bff.Api', 'Bad gateway'),
        },
        ...base,
      ],
    });
    expect(p.sesion.estado()).toBe('error');
    expect(p.router.url).toBe('/inicio');
    expect(h1()).toBe('No pudimos abrir tu sesión');
    expect(p.logins).toEqual([]);
  });

  it('every /paciente/ request carries X-Halsa-Csrf: 1 (the BFF answers 403 without it)', async () => {
    const p = await abrirPortal('/inicio');
    expect(p.peticiones.length).toBeGreaterThan(1);
    for (const req of p.peticiones) {
      expect(req.url.startsWith('/paciente/')).toBe(true);
      expect(req.headers.get(CABECERA_CSRF)).toBe('1');
    }
  });

  it('a 401 from /paciente/api/* says the session ended and logs in again to the same page', async () => {
    const p = await abrirPortal('/inicio', {
      rutas: (base) => [
        { metodo: 'GET', ruta: '/paciente/api/mis-casos', manejar: () => ({ status: 401 }) },
        ...base,
      ],
    });
    await p.ir('/casos');
    expect(p.avisos).toEqual(['aviso: Tu sesión terminó']);
    // The toast is read first; the full-page login follows.
    expect(p.logins).toEqual([]);
    await new Promise((r) => setTimeout(r, 2100));
    expect(p.logins).toEqual(['/casos']);
  });

  it('logout posts to the BFF, then reloads /', async () => {
    const p = await abrirPortal('/cuenta');
    const salir = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Cerrar sesión',
    )!;
    salir.click();
    await p.estable();
    const logout = p.peticiones.find((r) => r.url === '/paciente/bff/logout');
    expect(logout?.method).toBe('POST');
    expect(logout?.headers.get(CABECERA_CSRF)).toBe('1');
    expect(p.inicios.total).toBe(1);
  });

  it('only relative return URLs reach the BFF login (BffEndpoints.EsUrlLocal)', () => {
    expect(retornoSeguro('/casos/1?x=1')).toBe('/casos/1?x=1');
    expect(retornoSeguro('//evil.example')).toBe('/');
    expect(retornoSeguro('/\\evil.example')).toBe('/');
    expect(retornoSeguro('https://evil.example')).toBe('/');
  });
});
