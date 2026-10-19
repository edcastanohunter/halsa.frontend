/** Assurance level of the current token (plan §5.1.4): `acr` 1 = password, 2 = password + OTP. */
export interface NivelVerificacion {
  acr: number;
  /** Epoch seconds of the last interactive authentication (`auth_time`). */
  authTime: number | null;
}

const SIN_VERIFICACION: NivelVerificacion = { acr: 0, authTime: null };

/** Reads `acr` / `auth_time` from a decoded token payload. Keycloak sends `acr` as a string. */
export function nivelDesdeClaims(payload: unknown): NivelVerificacion {
  if (!payload || typeof payload !== 'object') return SIN_VERIFICACION;
  const { acr, auth_time } = payload as Record<string, unknown>;
  const nivel = typeof acr === 'number' ? acr : Number.parseInt(String(acr ?? ''), 10);
  return {
    acr: Number.isFinite(nivel) ? nivel : 0,
    authTime: typeof auth_time === 'number' && Number.isFinite(auth_time) ? auth_time : null,
  };
}

/** Decodes a JWT payload without verifying it (the API verifies; the UI only reads levels). */
export function decodificarJwt(token: string | null | undefined): unknown {
  const parte = token?.split('.')[1];
  if (!parte) return null;
  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

/**
 * Whether a level meets a requirement. With `maxAgeSeg`, `auth_time` must also be recent, minus a
 * `margenSeg` so a dictamen gate closes before the server's window does (plan §5.1.4: re-gate
 * when less than 2 minutes remain).
 */
export function cumpleNivel(
  nivel: NivelVerificacion,
  requerido: { acr: number; maxAgeSeg?: number; margenSeg?: number },
  ahoraSeg: number,
): boolean {
  if (nivel.acr < requerido.acr) return false;
  if (requerido.maxAgeSeg === undefined) return true;
  if (nivel.authTime === null) return false;
  return ahoraSeg - nivel.authTime <= requerido.maxAgeSeg - (requerido.margenSeg ?? 0);
}
