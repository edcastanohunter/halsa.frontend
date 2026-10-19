// Test helpers only (imported by *.spec.ts files).

const base64Url = (texto: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/** An unsigned JWT with these claims: the UI only reads levels, it never verifies. */
export const jwt = (claims: object) =>
  `${base64Url('{"alg":"none"}')}.${base64Url(JSON.stringify(claims))}.firma`;
