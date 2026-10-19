import { LogLevel } from 'angular-auth-oidc-client';
import { jwt } from '../../testing/tokens';
import { cumpleNivel, decodificarJwt, nivelDesdeClaims } from './claims';
import { configuracionOidc } from './oidc';
import { esRutaInterna, guardarRetorno, tomarRetorno } from './retorno';

describe('token claims', () => {
  it('decodes base64url UTF-8 payloads and tolerates garbage', () => {
    expect(decodificarJwt(jwt({ name: 'Calificador Núñez', acr: '2' }))).toEqual({
      name: 'Calificador Núñez',
      acr: '2',
    });
    expect(decodificarJwt('no-es-un-jwt')).toBeNull();
    expect(decodificarJwt('a.@@@.b')).toBeNull();
    expect(decodificarJwt(null)).toBeNull();
  });

  it('reads Keycloak string acr and auth_time', () => {
    expect(nivelDesdeClaims({ acr: '2', auth_time: 1_760_000_000 })).toEqual({
      acr: 2,
      authTime: 1_760_000_000,
    });
    expect(nivelDesdeClaims({ acr: 'x' })).toEqual({ acr: 0, authTime: null });
    expect(nivelDesdeClaims(null)).toEqual({ acr: 0, authTime: null });
  });

  it('checks the level, then the time window minus the margin', () => {
    const ahora = 10_000;
    const nivel = { acr: 2, authTime: ahora - 700 };
    expect(cumpleNivel({ acr: 1, authTime: ahora }, { acr: 2 }, ahora)).toBe(false);
    expect(cumpleNivel(nivel, { acr: 2 }, ahora)).toBe(true);
    expect(cumpleNivel(nivel, { acr: 2, maxAgeSeg: 900 }, ahora)).toBe(true);
    // 700 s old: still inside 900, but less than 2 minutes would remain at 790+.
    expect(cumpleNivel(nivel, { acr: 2, maxAgeSeg: 900, margenSeg: 120 }, ahora + 81)).toBe(false);
    expect(cumpleNivel({ acr: 2, authTime: null }, { acr: 2, maxAgeSeg: 900 }, ahora)).toBe(false);
  });
});

describe('return URL', () => {
  it('only accepts in-app paths (no open redirect)', () => {
    expect(esRutaInterna('/casos/0199?tab=equipo')).toBe(true);
    for (const malo of [
      '//evil.example',
      'https://evil.example',
      '/\\evil',
      '/auth/callback?code=x',
      '',
      null,
    ]) {
      expect(esRutaInterna(malo)).toBe(false);
    }
  });

  it('is read once', () => {
    const almacen = new Map<string, string>();
    const storage = {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
      removeItem: (k: string) => void almacen.delete(k),
    } as Storage;
    guardarRetorno('/cuenta', storage);
    guardarRetorno('https://evil.example', storage);
    expect(tomarRetorno(storage)).toBe('/cuenta');
    expect(tomarRetorno(storage)).toBeNull();
  });
});

describe('OIDC settings (plan §5.1.1)', () => {
  const config = configuracionOidc(
    {
      apiBaseUrl: '',
      keycloak: { authority: 'http://localhost:8180/realms/halsa', clientId: 'halsa-backoffice' },
    },
    'http://localhost:3000',
  );

  it('is a PKCE code flow with refresh tokens and no email scope', () => {
    expect(config).toMatchObject({
      authority: 'http://localhost:8180/realms/halsa',
      clientId: 'halsa-backoffice',
      responseType: 'code',
      scope: 'openid',
      redirectUrl: 'http://localhost:3000/auth/callback',
      postLogoutRedirectUri: 'http://localhost:3000/',
      useRefreshToken: true,
      silentRenew: true,
      renewTimeBeforeTokenExpiresInSeconds: 30,
      triggerAuthorizationResultEvent: true,
      secureRoutes: ['/v1/'],
      logLevel: LogLevel.None,
    });
    expect(config.disablePkce).toBeFalsy();
  });

  it('fails loudly without a keycloak section', () => {
    expect(() => configuracionOidc({ apiBaseUrl: '' }, 'http://x')).toThrow('keycloak');
  });
});
