import { TestBed } from '@angular/core/testing';
import { ContadorRegresivo } from './contador-regresivo';

describe('ContadorRegresivo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  function crear(restanteMs: number) {
    const fixture = TestBed.createComponent(ContadorRegresivo);
    fixture.componentRef.setInput('hasta', new Date(Date.now() + restanteMs).toISOString());
    fixture.componentRef.setInput('etiqueta', 'Vence en');
    let emisiones = 0;
    fixture.componentInstance.vencido.subscribe(() => emisiones++);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      el,
      timer: () => el.querySelector('[role="timer"]') as HTMLElement,
      emisiones: () => emisiones,
      avanzar: (ms: number) => {
        vi.advanceTimersByTime(ms);
        fixture.detectChanges();
      },
    };
  }

  it('shows m:ss and a per-minute accessible label', () => {
    const c = crear(15 * 60_000);
    expect(c.el.textContent).toContain('15:00');
    expect(c.timer().getAttribute('aria-label')).toBe('Vence en 15 minutos');

    c.avanzar(61_000);
    expect(c.el.textContent).toContain('13:59');
    expect(c.timer().getAttribute('aria-label')).toBe('Vence en 14 minutos');
  });

  it('turns amber in the last 2 minutes', () => {
    const c = crear(3 * 60_000);
    expect(c.timer().className).not.toContain('text-warning');
    c.avanzar(61_000);
    expect(c.timer().className).toContain('text-warning');
  });

  it('emits vencido exactly once at zero and shows the expired text', () => {
    const c = crear(3000);
    expect(c.emisiones()).toBe(0);

    c.avanzar(3000);
    expect(c.emisiones()).toBe(1);
    expect(c.el.textContent).toContain('Tiempo agotado');
    expect(c.timer().className).toContain('text-destructive');

    c.avanzar(10_000);
    expect(c.emisiones()).toBe(1);
  });

  it('re-arms when `hasta` moves into the future (e.g. after re-verifying)', () => {
    const c = crear(1000);
    c.avanzar(1000);
    expect(c.emisiones()).toBe(1);

    c.fixture.componentRef.setInput('hasta', new Date(Date.now() + 2000).toISOString());
    c.avanzar(0);
    expect(c.el.textContent).toContain('0:02');

    c.avanzar(2000);
    expect(c.emisiones()).toBe(2);
  });
});
