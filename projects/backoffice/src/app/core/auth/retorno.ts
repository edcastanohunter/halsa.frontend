// Where to land after a login or a redirect step-up (plan §5.1.4). Only an in-app path is stored:
// never form contents, and never an absolute URL (open redirect).
const CLAVE = 'halsa.retorno';
export const RUTA_CALLBACK = '/auth/callback';

/** An in-app path (`/casos/…`), never `//host`, a scheme, or the callback itself. */
export function esRutaInterna(ruta: string | null | undefined): ruta is string {
  return (
    typeof ruta === 'string' &&
    ruta.startsWith('/') &&
    !ruta.startsWith('//') &&
    !ruta.includes('\\') &&
    !ruta.startsWith(RUTA_CALLBACK)
  );
}

export function guardarRetorno(ruta: string, almacen: Storage | null = sesion()): void {
  if (!esRutaInterna(ruta)) return;
  try {
    almacen?.setItem(CLAVE, ruta);
  } catch {
    // Storage blocked: the user lands on /inicio instead.
  }
}

/** Reads and clears the stored path. */
export function tomarRetorno(almacen: Storage | null = sesion()): string | null {
  try {
    const ruta = almacen?.getItem(CLAVE) ?? null;
    almacen?.removeItem(CLAVE);
    return esRutaInterna(ruta) ? ruta : null;
  } catch {
    return null;
  }
}

function sesion(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
