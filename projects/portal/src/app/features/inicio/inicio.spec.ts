import { formatFechaLarga, hoyBogota, sumarDias } from '@halsa/core';
import { abrirPortal, h1, texto } from '../../testing/portal';

describe('/inicio (plan §7.12)', () => {
  it('greets by first name, then the sick leave in force, the next milestones and the cases', async () => {
    await abrirPortal('/inicio');
    expect(h1()).toBe('Hola, Paciente');

    // The mock's leave runs from 20 days ago to 9 days from now: day 21 of 30.
    const vigente = document.querySelector('[data-testid="incapacidad-vigente"]');
    const fin = sumarDias(hoyBogota(), 9)!;
    expect(texto(vigente)).toContain(`Termina el ${formatFechaLarga(fin)}`);
    expect(texto(vigente)).toContain('Faltan 9 días');
    expect(vigente?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext')).toBe(
      'Día 21 de 30',
    );

    const hitos = [...document.querySelectorAll('[data-testid="proximos-hitos"] > li')].map(texto);
    expect(hitos).toHaveLength(2);
    expect(hitos[0]).toContain('Termina tu incapacidad');
    expect(hitos[0]).toContain('En 9 días');
    expect(hitos[1]).toContain('Último día para controvertir el dictamen');
    expect(hitos[1]).toContain('presentar tu inconformidad ante tu ARL');
    expect(hitos[1]).toContain('Caso 2026-ARLA-000103');

    const casos = document.querySelector('[data-testid="casos-activos"]');
    expect(texto(casos?.querySelector('h2'))).toBe('Casos activos 2');
    expect(casos?.querySelectorAll('app-tarjeta-caso')).toHaveLength(2);
  });

  it('no active cases: an empty state', async () => {
    await abrirPortal('/inicio', {
      rutas: (base) => [
        {
          metodo: 'GET',
          ruta: '/paciente/api/resumen',
          manejar: () => ({
            status: 200,
            body: { casosActivos: [], incapacidadesVigentes: [], proximosHitos: [] },
          }),
        },
        ...base,
      ],
    });
    expect(document.body.textContent).toContain('No tienes casos activos');
  });
});
