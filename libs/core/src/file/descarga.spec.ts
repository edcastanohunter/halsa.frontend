import { guardarBlob, nombreDeContentDisposition } from './descarga';

describe('nombreDeContentDisposition', () => {
  it('reads the quoted filename', () => {
    expect(nombreDeContentDisposition('attachment; filename="incapacidad-12.pdf"', 'x.pdf')).toBe(
      'incapacidad-12.pdf',
    );
  });

  it('prefers filename* (RFC 5987)', () => {
    expect(
      nombreDeContentDisposition(
        `attachment; filename="a.pdf"; filename*=UTF-8''incapacidad-se%C3%B1al.pdf`,
        'x.pdf',
      ),
    ).toBe('incapacidad-señal.pdf');
  });

  it('falls back when the header is missing or empty', () => {
    expect(nombreDeContentDisposition(null, 'incapacidad-1.pdf')).toBe('incapacidad-1.pdf');
    expect(nombreDeContentDisposition('attachment', 'incapacidad-1.pdf')).toBe('incapacidad-1.pdf');
  });

  it('strips path separators', () => {
    expect(nombreDeContentDisposition('attachment; filename="../../x.pdf"', 'y.pdf')).toBe(
      '....x.pdf',
    );
  });
});

describe('guardarBlob (plan §5.3.4)', () => {
  it('clicks a one-shot link and revokes the object URL right away', () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    guardarBlob(document, new Blob(['%PDF-']), 'soporte.pdf');

    expect(clic).toHaveBeenCalledOnce();
    expect(revocar).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
    crear.mockRestore();
    revocar.mockRestore();
    clic.mockRestore();
  });
});
