/**
 * The file name in `Content-Disposition` (`filename*=UTF-8''…` first, then `filename="…"`), or
 * `defecto`. Path separators are stripped: the name comes from the server, not the user.
 */
export function nombreDeContentDisposition(
  valor: string | null | undefined,
  defecto: string,
): string {
  if (!valor) return defecto;
  const extendido = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(valor)?.[1];
  let nombre: string | null = null;
  if (extendido) {
    try {
      nombre = decodeURIComponent(extendido.trim());
    } catch {
      nombre = null;
    }
  }
  nombre ??= /filename\s*=\s*(?:"([^"]*)"|([^;\s]+))/.exec(valor)?.slice(1).find(Boolean) ?? null;
  const limpio = nombre?.replace(/[/\\]/g, '').trim();
  return limpio || defecto;
}

/**
 * Saves a blob through a one-shot object URL, revoked right after the click (plan §5.3.4): the
 * document is never previewed nor kept around.
 */
export function guardarBlob(documento: Document, blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const enlace = documento.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    enlace.style.display = 'none';
    documento.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
