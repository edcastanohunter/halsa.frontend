import { loadAppConfig, renderBootstrapError } from '@halsa/core';

describe('Runtime config loader', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads config.json without caching', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ apiBaseUrl: '', mock: true })));

    await expect(loadAppConfig()).resolves.toEqual({ apiBaseUrl: '', mock: true });
    expect(fetchSpy).toHaveBeenCalledWith('/config.json', { cache: 'no-store' });
  });

  it('fails loudly on HTTP errors instead of falling back', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    await expect(loadAppConfig()).rejects.toThrow('HTTP 404');
  });

  it('rejects a config without apiBaseUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await expect(loadAppConfig()).rejects.toThrow('apiBaseUrl');
  });

  it('renders a Spanish alert when bootstrap fails', () => {
    renderBootstrapError(document);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'No fue posible iniciar la aplicación',
    );
  });
});
