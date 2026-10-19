/**
 * Transliterates free text to printable ASCII for HTTP header values (plan §5.1.5, gap G10):
 * NFD-normalize, strip combining marks (á→a, ü→u), ñ→n, Ñ→N, drop anything else outside
 * printable ASCII and collapse whitespace. The UI shows the result before sending it.
 */
export function transliterarAscii(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/\s/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}
