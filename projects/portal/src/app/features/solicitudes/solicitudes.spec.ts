import { abrirPortal, texto } from '../../testing/portal';
import { pasosDe } from './pasos';

const resumen = (estado: string) =>
  pasosDe(estado).map((p) => `${p.etiqueta}:${p.estado}${p.resultado ? `:${p.resultado}` : ''}`);

describe('the copy request stepper (plan §7.12)', () => {
  it('Recibida → En trámite → Entregada / Rechazada', () => {
    expect(resumen('RECIBIDA')).toEqual([
      'Recibida:actual',
      'En trámite:pendiente',
      'Entrega:pendiente',
    ]);
    expect(resumen('EN_TRAMITE')).toEqual([
      'Recibida:hecho',
      'En trámite:actual',
      'Entrega:pendiente',
    ]);
    expect(resumen('ENTREGADA')).toEqual([
      'Recibida:hecho',
      'En trámite:hecho',
      'Entregada:actual:entregada',
    ]);
    expect(resumen('RECHAZADA')).toEqual([
      'Recibida:hecho',
      'En trámite:hecho',
      'Rechazada:actual:rechazada',
    ]);
  });

  it('an unknown state renders raw instead of crashing', () => {
    expect(resumen('ANULADA')).toEqual(['Recibida:hecho', 'ANULADA:actual']);
  });
});

describe('/solicitudes', () => {
  it('lists the requests with the radicado, the stepper and the ARL note once closed', async () => {
    await abrirPortal('/solicitudes');
    const tarjetas = [...document.querySelectorAll('[data-testid="solicitudes"] article')];
    expect(tarjetas).toHaveLength(1);
    expect(texto(tarjetas[0]!.querySelector('h2'))).toBe(
      'Copia de historia clínica · 2026-ARLA-000102',
    );
    expect(texto(tarjetas[0])).toContain('Presencial (recoger en oficina)');
    expect(tarjetas[0]!.querySelector('[aria-current="step"]')?.textContent).toContain('Entregada');
    expect(texto(tarjetas[0])).toContain('Respuesta de tu ARL');
    expect(texto(tarjetas[0])).toContain('Entregada en la oficina principal.');
  });

  it('none yet: an empty state that points to the cases', async () => {
    await abrirPortal('/solicitudes', {
      rutas: (base) => [
        {
          metodo: 'GET',
          ruta: '/paciente/api/solicitudes-copia-hc',
          manejar: () => ({ status: 200, body: [] }),
        },
        ...base,
      ],
    });
    expect(document.body.textContent).toContain('No has solicitado copias de tu historia clínica');
    expect(document.querySelector('a[href="/casos"]')).not.toBeNull();
  });
});
