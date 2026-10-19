export const PDF_TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

export type ErrorPdf = 'tipo' | 'tamano' | 'vacio' | 'firma';

export const ERROR_PDF_MENSAJES: Record<ErrorPdf, string> = {
  tipo: 'El archivo debe ser un PDF.',
  tamano: 'El archivo supera el tamaño máximo de 10 MB.',
  vacio: 'El archivo está vacío.',
  firma: 'El archivo no es un PDF válido.',
};

/**
 * Client-side checks before uploading a soporte (plan §5.3.8): `application/pdf`, ≤ 10 MB and
 * the `%PDF-` signature in the first bytes. The server re-validates and runs the antivirus.
 */
export async function validarPdf(archivo: Blob & { name?: string }): Promise<ErrorPdf | null> {
  const extensionPdf = archivo.name === undefined || /\.pdf$/i.test(archivo.name);
  if (archivo.type !== 'application/pdf' || !extensionPdf) return 'tipo';
  if (archivo.size === 0) return 'vacio';
  if (archivo.size > PDF_TAMANO_MAXIMO_BYTES) return 'tamano';
  const firma = new Uint8Array(await archivo.slice(0, 5).arrayBuffer());
  const esPdf = String.fromCharCode(...firma) === '%PDF-';
  return esPdf ? null : 'firma';
}
