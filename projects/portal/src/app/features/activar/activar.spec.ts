import { ErrorApi, ProblemaApi } from '@halsa/core';
import { CODIGO_BLOQUEADO, CODIGO_OTRO_DOCUMENTO, CODIGO_VALIDO } from '../../../mocks';
import { abrirPortal, boton, enviar, escribir, h1, texto } from '../../testing/portal';
import {
  codigoCompleto,
  cursorTrasFormato,
  errorDeVinculo,
  formatearCodigo,
} from './codigo-activacion';

const problema = (status: number, cuerpo: Partial<ProblemaApi>) =>
  new ErrorApi({
    status,
    title: null,
    detail: null,
    errorCode: null,
    traceId: null,
    correlationId: null,
    errors: [],
    ...cuerpo,
  });

describe('the activation code formatter (plan §7.12)', () => {
  it.each([
    ['abc123k7q2m9xd4p', 'ABC123-K7Q2M9XD4P'],
    ['ABC 123 K7Q2 M9XD 4P', 'ABC123-K7Q2M9XD4P'],
    ['abc123-k7q2m9xd4p', 'ABC123-K7Q2M9XD4P'],
    ['  abc123—k7q2m9xd4p  ', 'ABC123-K7Q2M9XD4P'],
    ['ABC123-K7Q2M9XD4PEXTRA', 'ABC123-K7Q2M9XD4P'],
    ['abc', 'ABC'],
    // Six characters: no hyphen yet, so backspace can always remove the previous one.
    ['abc123', 'ABC123'],
    ['abc1234', 'ABC123-4'],
  ])('%s → %s', (crudo, esperado) => {
    expect(formatearCodigo(crudo)).toBe(esperado);
  });

  it("keeps Crockford's confusables as typed: the server reads O→0 and I/L→1", () => {
    expect(formatearCodigo('oil123-k7q2m9xd4p')).toBe('OIL123-K7Q2M9XD4P');
  });

  it('puts the caret behind the same characters after formatting', () => {
    // "abc12" + caret, typing "3" then "4": the hyphen jumps in before the 7th character.
    expect(cursorTrasFormato('abc1234', 7)).toBe(8);
    expect(cursorTrasFormato('abc 123', 7)).toBe(6);
    expect(cursorTrasFormato('ABC123-K7Q2', 3)).toBe(3);
  });

  it('is complete with 16 code characters, whatever the separators', () => {
    expect(codigoCompleto('ABC123-K7Q2M9XD4P')).toBe(true);
    expect(codigoCompleto('ABC123-K7Q2M9XD4')).toBe(false);
  });
});

describe('redeem errors (plan §7.12, SPEC 12)', () => {
  it('maps each domain code to its message', () => {
    expect(errorDeVinculo(problema(400, { errorCode: 'Paciente.CodigoInvalido' }))).toEqual({
      mensaje: 'El código no es válido o ya fue usado.',
    });
    expect(errorDeVinculo(problema(409, { errorCode: 'Paciente.VinculoDistinto' }))).toEqual({
      mensaje: 'Tu cuenta ya está vinculada a otro documento.',
    });
    expect(
      errorDeVinculo(problema(423, { errorCode: 'Paciente.CodigoBloqueado' })).mensaje,
    ).toMatch(/Pide uno nuevo a tu ARL/);
  });

  it('a 429 with Retry-After counts down; the 24 h domain limit keeps its wording', () => {
    expect(errorDeVinculo(problema(429, { retryAfterSeg: 42 }))).toEqual({
      mensaje: 'Demasiados intentos.',
      esperaSeg: 42,
    });
    expect(
      errorDeVinculo(
        problema(429, {
          errorCode: 'Paciente.DemasiadosIntentos',
          detail: 'Demasiados intentos fallidos. Vuelve a intentarlo en 24 horas.',
        }),
      ),
    ).toEqual({ mensaje: 'Demasiados intentos fallidos. Vuelve a intentarlo en 24 horas.' });
  });

  it('anything else gets the shared message', () => {
    expect(errorDeVinculo(problema(503, {})).mensaje).toMatch(/Intenta de nuevo en unos minutos/);
  });
});

describe('/activar', () => {
  const campo = () => document.querySelector<HTMLInputElement>('#codigo')!;
  const alerta = () => texto(document.querySelector('#codigo-error'));

  async function canjear(p: Awaited<ReturnType<typeof abrirPortal>>, codigo: string) {
    escribir(campo(), codigo);
    enviar();
    await p.estable();
  }

  it('formats while typing and rejects an incomplete code without a request', async () => {
    const p = await abrirPortal('/activar', { sesion: 'sin-vinculo' });
    expect(h1()).toBe('Vincula tu cuenta');
    escribir(campo(), 'abc 123 k7');
    expect(campo().value).toBe('ABC123-K7');
    const antes = p.peticiones.length;
    enviar();
    await p.estable();
    expect(alerta()).toMatch(/código completo/);
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo());
    expect(p.peticiones.length).toBe(antes);
  });

  it('invalid, other document and locked codes each explain themselves', async () => {
    const p = await abrirPortal('/activar', { sesion: 'sin-vinculo' });
    await canjear(p, 'ZZZ999-K7Q2M9XD4P');
    expect(alerta()).toBe('El código no es válido o ya fue usado.');
    await canjear(p, CODIGO_OTRO_DOCUMENTO);
    expect(alerta()).toBe('Tu cuenta ya está vinculada a otro documento.');
    await canjear(p, CODIGO_BLOQUEADO);
    expect(alerta()).toMatch(/se bloqueó por demasiados intentos/);
    // Typing again clears the message.
    escribir(campo(), 'A');
    p.harness.fixture.detectChanges();
    expect(document.querySelector('#codigo-error')).toBeNull();
  });

  it('429: the button is disabled with a countdown from Retry-After, then comes back', async () => {
    let reloj = Date.now();
    const p = await abrirPortal('/activar', { sesion: 'sin-vinculo', ahora: () => reloj });
    for (let i = 0; i < 5; i++) await canjear(p, 'ZZZ999-K7Q2M9XD4P');
    await canjear(p, CODIGO_VALIDO);
    const espera = document.querySelector('[data-testid="espera-vinculo"]');
    expect(texto(espera)).toContain('Demasiados intentos. Intenta de nuevo en 60 segundos.');
    expect(boton('Vincular cuenta').disabled).toBe(true);

    // The page's clock: jump past the wait, then let its 1 s tick run.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 61_000);
      reloj += 61_000;
      await new Promise((r) => setTimeout(r, 1100));
      await p.estable();
      expect(document.querySelector('[data-testid="espera-vinculo"]')).toBeNull();
      expect(boton('Vincular cuenta').disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a valid code links the account and shows the masked document once', async () => {
    const p = await abrirPortal('/activar', { sesion: 'sin-vinculo' });
    await canjear(p, CODIGO_VALIDO.toLowerCase());
    const cuerpo = p.peticiones.find((r) => r.url === '/paciente/api/vinculos')?.body;
    expect(cuerpo).toEqual({ codigo: CODIGO_VALIDO });
    expect(h1()).toBe('Cuenta vinculada');
    expect(texto(document.querySelector('[data-testid="documento-vinculado"]'))).toBe(
      'Cuenta vinculada al documento CC ******2222',
    );
    expect(p.sesion.estado()).toBe('vinculada');
    // The sections open without another round trip.
    expect(document.querySelector('nav[aria-label="Principal"]')).not.toBeNull();

    await p.ir('/cuenta');
    expect(texto(document.querySelector('[data-testid="documento-cuenta"]'))).toBe('CC ******2222');
  });

  it('from Cuenta, a linked account links another code', async () => {
    await abrirPortal('/activar');
    expect(h1()).toBe('Vincular otro código');
    expect(document.querySelector('a[href="/cuenta"]')).not.toBeNull();
  });
});
