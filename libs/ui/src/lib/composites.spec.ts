import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CampoPorcentaje } from './campo-porcentaje/campo-porcentaje';
import { formatDuracion } from './contador-regresivo/contador-regresivo';
import {
  DocumentoEnmascarado,
  enmascararDocumento,
} from './documento-enmascarado/documento-enmascarado';
import { EstadoBadge } from './estado-badge/estado-badge';
import { TemaService } from './tema/tema.service';
import {
  ContenidoReforzado,
  VerificacionReforzada,
} from './verificacion-reforzada/verificacion-reforzada';

describe('formatDuracion', () => {
  it('formats m:ss and h:mm:ss, never negative', () => {
    expect(formatDuracion(15 * 60_000)).toBe('15:00');
    expect(formatDuracion(61_500)).toBe('1:02');
    expect(formatDuracion(3_725_000)).toBe('1:02:05');
    expect(formatDuracion(-5000)).toBe('0:00');
  });
});

describe('CampoPorcentaje', () => {
  @Component({
    imports: [ReactiveFormsModule, CampoPorcentaje],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<input halsaCampoPorcentaje [formControl]="control" />`,
  })
  class Anfitrion {
    readonly control = new FormControl<number | null>(23.45);
  }

  async function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const escribir = (texto: string) => {
      input.value = texto;
      input.dispatchEvent(new Event('input'));
    };
    return { control: fixture.componentInstance.control, input, escribir };
  }

  it('shows the es-CO comma and hands the form a number', async () => {
    const { control, input, escribir } = await montar();
    expect(input.value).toBe('23,45');
    expect(input.inputMode).toBe('decimal');
    escribir('8,5');
    expect(control.value).toBe(8.5);
    escribir('');
    expect(control.value).toBeNull();
  });

  it('flags text that is not a number and more than two decimals', async () => {
    const { control, escribir } = await montar();
    escribir('veinte');
    expect(control.value).toBeNaN();
    expect(control.errors).toEqual({ numero: true });
    escribir('23,456');
    expect(control.errors).toEqual({ decimales: { maximo: 2 } });
    escribir('23,45');
    expect(control.errors).toBeNull();
  });

  it('rewrites a readable number on blur, keeps a typo as typed', async () => {
    const { input, escribir } = await montar();
    escribir('23.5');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('23,5');
    escribir('23,x');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('23,x');
  });
});

describe('DocumentoEnmascarado', () => {
  it('keeps only the last 4 characters', () => {
    expect(enmascararDocumento('1020304050')).toBe('••••4050');
    expect(enmascararDocumento('123')).toBe('123');
  });

  it('reveals on demand', async () => {
    const fixture = TestBed.createComponent(DocumentoEnmascarado);
    fixture.componentRef.setInput('numero', '1020304050');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('••••4050');
    expect(el.textContent).not.toContain('1020304050');

    el.querySelector('button')!.click();
    await fixture.whenStable();
    expect(el.textContent).toContain('1020304050');
    expect(el.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('EstadoBadge', () => {
  async function render(tipo: string, valor: string, vencida = false) {
    const fixture = TestBed.createComponent(EstadoBadge);
    fixture.componentRef.setInput('tipo', tipo);
    fixture.componentRef.setInput('valor', valor);
    fixture.componentRef.setInput('vencida', vencida);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('span') as HTMLElement;
  }

  it('uses the Spanish label and the plan §8.3 tone', async () => {
    const badge = await render('caso', 'EnCalificacionPcl');
    expect(badge.textContent?.trim()).toBe('Calificación PCL');
    expect(badge.className).toContain('text-clinical');
  });

  it('renders an audit Error as a destructive outline', async () => {
    const badge = await render('resultadoAuditoria', 'ERROR');
    expect(badge.className).toContain('ring-destructive');
    expect(badge.className).toContain('bg-transparent');
  });

  it('turns an overdue emergency review destructive', async () => {
    const badge = await render('revisionEmergencia', 'PENDIENTE', true);
    expect(badge.textContent?.trim()).toBe('Pendiente · vencida');
    expect(badge.className).toContain('text-destructive');
  });

  it('shows unknown values raw in a neutral tone', async () => {
    const badge = await render('caso', 'EstadoNuevo');
    expect(badge.textContent?.trim()).toBe('EstadoNuevo');
    expect(badge.className).toContain('bg-muted');
  });
});

describe('VerificacionReforzada', () => {
  let creados = 0;

  @Component({
    selector: 'halsa-test-clinico',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: 'contenido clínico',
  })
  class ContenidoClinicoFalso {
    constructor() {
      creados++;
    }
  }

  @Component({
    imports: [VerificacionReforzada, ContenidoReforzado, ContenidoClinicoFalso],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      <halsa-verificacion-reforzada [satisfecha]="satisfecha()">
        <halsa-test-clinico *halsaContenidoReforzado />
      </halsa-verificacion-reforzada>
    `,
  })
  class Anfitrion {
    readonly satisfecha = signal(false);
  }

  it('does not instantiate the clinical content before the step-up', async () => {
    creados = 0;
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(creados).toBe(0);
    expect(el.textContent).toContain('Verificar identidad');

    fixture.componentInstance.satisfecha.set(true);
    await fixture.whenStable();
    expect(creados).toBe(1);
    expect(el.textContent).toContain('contenido clínico');
    expect(el.textContent).not.toContain('Verificar identidad');
  });
});

describe('TemaService', () => {
  // jsdom in this test runner exposes no `localStorage` (and Node 22.4+/26 shadow the global with
  // an experimental, non-functional one). Install a memory-backed Storage so the persistence
  // assertions run against a real Storage, like the browser's.
  function crearStorage(): Storage {
    const datos = new Map<string, string>();
    return {
      get length() {
        return datos.size;
      },
      clear: () => datos.clear(),
      getItem: (clave) => (datos.has(clave) ? datos.get(clave)! : null),
      key: (indice) => [...datos.keys()][indice] ?? null,
      removeItem: (clave) => void datos.delete(clave),
      setItem: (clave, valor) => void datos.set(clave, valor),
    };
  }

  const almacen = crearStorage();

  beforeAll(() => {
    Object.defineProperty(document.defaultView!, 'localStorage', {
      value: almacen,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    almacen.clear();
    document.documentElement.classList.remove('dark');
  });

  it('applies and persists an explicit choice, and forgets it for "system"', async () => {
    const tema = TestBed.inject(TemaService);

    tema.establecer('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(almacen.getItem('halsa.tema')).toBe('dark');

    tema.establecer('system');
    TestBed.tick();
    expect(almacen.getItem('halsa.tema')).toBeNull();
    // jsdom has no matchMedia, so "system" resolves to light.
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
