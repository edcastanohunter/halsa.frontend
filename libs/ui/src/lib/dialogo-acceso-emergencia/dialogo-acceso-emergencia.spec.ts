import { TestBed } from '@angular/core/testing';
import { DialogoAccesoEmergencia, MOTIVO_MAX } from './dialogo-acceso-emergencia';

describe('DialogoAccesoEmergencia (plan §5.1.5)', () => {
  // The dialog renders in a CDK overlay attached to <body>, not inside the host element.
  const $ = <T extends Element>(selector: string) => document.body.querySelector<T>(selector);

  async function abrir() {
    const fixture = TestBed.createComponent(DialogoAccesoEmergencia);
    const emitidos: string[] = [];
    fixture.componentInstance.confirmar.subscribe((motivo) => emitidos.push(motivo));
    fixture.componentRef.setInput('abierto', true);
    await fixture.whenStable();

    const escribir = async (texto: string) => {
      const textarea = $<HTMLTextAreaElement>('#halsa-motivo-emergencia')!;
      textarea.value = texto;
      textarea.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const confirmarUrgencia = async () => {
      $<HTMLButtonElement>('hlm-checkbox button')!.click();
      await fixture.whenStable();
    };
    const botonConfirmar = () =>
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.trim() === 'Acceder y registrar motivo',
      )!;

    return { fixture, emitidos, escribir, confirmarUrgencia, botonConfirmar };
  }

  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
  });

  it('shows the audit warning when open', async () => {
    await abrir();
    expect(document.body.textContent).toContain('genera una revisión obligatoria en 72 horas');
  });

  it('stays disabled until there are 20 characters and the urgency is confirmed', async () => {
    const d = await abrir();
    expect(d.botonConfirmar().disabled).toBe(true);

    await d.escribir('Paciente inconsciente');
    expect(d.botonConfirmar().disabled).toBe(true);

    await d.confirmarUrgencia();
    expect(d.botonConfirmar().disabled).toBe(false);

    await d.escribir('Muy corto');
    expect(d.botonConfirmar().disabled).toBe(true);
  });

  it('counts by the ASCII result: diacritics and emojis do not help reach the minimum', async () => {
    const d = await abrir();
    await d.confirmarUrgencia();
    // 19 ASCII characters plus an emoji that transliteration drops.
    await d.escribir('Paro cardiaco movil🚑');
    expect(d.botonConfirmar().disabled).toBe(true);
  });

  it('previews the exact text that will be recorded and emits it on confirm', async () => {
    const d = await abrir();
    await d.escribir('Síncope en urgencias, señal de trauma craneal');
    expect(document.body.textContent).toContain(
      'Se registrará como: Sincope en urgencias, senal de trauma craneal',
    );
    expect(document.body.textContent).toContain(`45/${MOTIVO_MAX}`);

    await d.confirmarUrgencia();
    d.botonConfirmar().click();
    await d.fixture.whenStable();

    expect(d.emitidos).toEqual(['Sincope en urgencias, senal de trauma craneal']);
    expect(d.fixture.componentInstance.abierto()).toBe(false);
  });

  it('forgets the motivo when closed, so reopening starts empty', async () => {
    const d = await abrir();
    await d.escribir('Paciente inconsciente tras caída de altura');
    await d.confirmarUrgencia();

    d.fixture.componentRef.setInput('abierto', false);
    await d.fixture.whenStable();
    d.fixture.componentRef.setInput('abierto', true);
    await d.fixture.whenStable();

    expect($<HTMLTextAreaElement>('#halsa-motivo-emergencia')!.value).toBe('');
    expect(d.botonConfirmar().disabled).toBe(true);
  });
});
