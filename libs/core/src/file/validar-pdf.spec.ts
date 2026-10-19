import { PDF_TAMANO_MAXIMO_BYTES, validarPdf } from './validar-pdf';

const pdf = (contenido: BlobPart, nombre = 'soporte.pdf', tipo = 'application/pdf') =>
  new File([contenido], nombre, { type: tipo });

describe('validarPdf (plan §5.3.8)', () => {
  it('accepts a real PDF', async () => {
    await expect(validarPdf(pdf('%PDF-1.7\n...'))).resolves.toBeNull();
  });

  it('rejects other MIME types and extensions', async () => {
    await expect(validarPdf(pdf('%PDF-1.7', 'foto.png', 'image/png'))).resolves.toBe('tipo');
    await expect(validarPdf(pdf('%PDF-1.7', 'soporte.exe'))).resolves.toBe('tipo');
  });

  it('rejects a renamed file without the %PDF- signature', async () => {
    await expect(validarPdf(pdf('MZ\x90\x00 not a pdf'))).resolves.toBe('firma');
  });

  it('rejects empty and oversized files', async () => {
    await expect(validarPdf(pdf(''))).resolves.toBe('vacio');
    const grande = new Uint8Array(PDF_TAMANO_MAXIMO_BYTES + 1);
    grande.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await expect(validarPdf(pdf(grande))).resolves.toBe('tamano');
  });
});
