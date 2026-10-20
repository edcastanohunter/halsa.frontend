import { ErrorApi, ProblemaApi } from '@halsa/core';
import { CASO_PACIENTE } from '../../../mocks';
import { abrirPortal, enlace, enviar, escribir, h1, radio, texto } from '../../testing/portal';
import { crearFormularioSolicitud, cuerpoSolicitud, erroresDeSolicitud } from './solicitud';

const problema = (status: number, cuerpo: Partial<ProblemaApi>) =>
  new ErrorApi({
    status,
    title: null,
    detail: null,
    errorCode: null,
    traceId: null,
    correlationId: null,
    errors: [],
    ...cuerpo,
  });

describe('the copy request form (plan §7.12)', () => {
  it('asks only for the destination of the chosen method', () => {
    const form = crearFormularioSolicitud();
    expect(form.controls.medio.hasError('required')).toBe(true);

    form.controls.medio.setValue('PRESENCIAL');
    form.controls.direccion.updateValueAndValidity();
    form.controls.correo.updateValueAndValidity();
    expect(form.valid).toBe(true);

    form.controls.medio.setValue('CORREO_CERTIFICADO');
    form.controls.direccion.updateValueAndValidity();
    expect(form.controls.direccion.hasError('required')).toBe(true);
    form.controls.direccion.setValue('   ');
    expect(form.controls.direccion.hasError('required')).toBe(true);

    form.controls.medio.setValue('ELECTRONICO');
    form.controls.direccion.updateValueAndValidity();
    form.controls.correo.updateValueAndValidity();
    expect(form.controls.direccion.valid).toBe(true);
    expect(form.controls.correo.hasError('required')).toBe(true);
    form.controls.correo.setValue('no-es-correo');
    expect(form.controls.correo.hasError('email')).toBe(true);
  });

  it('sends the destination of the chosen method only, trimmed', () => {
    const form = crearFormularioSolicitud();
    form.setValue({
      medio: 'ELECTRONICO',
      direccion: 'Calle 1 # 2-3',
      correo: ' yo@example.com ',
      observaciones: '  ',
    });
    expect(cuerpoSolicitud(form)).toEqual({
      medioEntrega: 'ELECTRONICO',
      direccionOCorreo: 'yo@example.com',
      observaciones: null,
    });
    form.controls.medio.setValue('PRESENCIAL');
    expect(cuerpoSolicitud(form).direccionOCorreo).toBeNull();
  });

  it('maps the validator codes to fields, an open request to its own outcome', () => {
    const validacion = (codigo: string) =>
      problema(400, {
        errorCode: 'General.Validation',
        errors: [{ campo: null, codigo, mensaje: 'x' }],
      });
    expect(erroresDeSolicitud(validacion('SolicitudCopiaHc.CorreoInvalido'))).toEqual({
      destino: 'Escribe un correo electrónico válido.',
    });
    expect(erroresDeSolicitud(validacion('SolicitudCopiaHc.DireccionRequerida'))).toHaveProperty(
      'destino',
    );
    expect(
      erroresDeSolicitud(validacion('SolicitudCopiaHc.ObservacionesDemasiadoLargas')),
    ).toHaveProperty('observaciones');
    expect(erroresDeSolicitud(problema(409, { errorCode: 'SolicitudCopiaHc.YaAbierta' }))).toEqual({
      yaAbierta: true,
    });
    expect(erroresDeSolicitud(problema(500, {}))).toHaveProperty('general');
  });
});

describe('/casos', () => {
  it('lists the linked cases, most recently updated first, with patient labels', async () => {
    await abrirPortal('/casos');
    const tarjetas = [...document.querySelectorAll('[data-testid="casos"] a')];
    expect(tarjetas.map((a) => a.getAttribute('href'))).toEqual([
      `/casos/${CASO_PACIENTE.activo}`,
      `/casos/${CASO_PACIENTE.calificado}`,
    ]);
    expect(texto(tarjetas[0])).toContain('2026-ARLA-000102');
    expect(texto(tarjetas[0])).toContain('ARL_A');
    expect(texto(tarjetas[0])).toContain('Accidente de trabajo');
    expect(texto(tarjetas[0])).toContain('Estás en atención médica');
    expect(texto(tarjetas[1])).toContain('Se está calificando tu pérdida de capacidad laboral');
  });

  it('the timeline: newest first, server descriptions, and the copy request CTA', async () => {
    await abrirPortal(`/casos/${CASO_PACIENTE.activo}`);
    expect(h1()).toBe('Accidente de trabajo');
    const hitos = [...document.querySelectorAll('[data-testid="linea-tiempo"] > li')].map(texto);
    expect(hitos).toHaveLength(5);
    expect(hitos[0]).toMatch(/^Incapacidad registrada, Lo más reciente/);
    expect(hitos[0]).toContain('Se registró una prórroga de 20 días.');
    expect(hitos.at(-1)).toMatch(/^Caso radicado/);
    expect(enlace('Solicitar copia de mi historia clínica').getAttribute('href')).toBe(
      `/casos/${CASO_PACIENTE.activo}/solicitar-copia`,
    );
    // The patient never sees diagnoses, percentages or rationales (plan §5.2).
    expect(document.body.textContent).not.toMatch(/diagn[oó]stico|%|fundamento/i);
  });

  it('a case not linked to the account is "not available", never "doesn\'t exist"', async () => {
    await abrirPortal('/casos/0199a000-0000-7000-8000-00000000ffff');
    expect(h1()).toBe('Caso no disponible');
    expect(document.body.textContent).toContain('No existe o no está vinculado a tu cuenta.');
  });
});

describe('/casos/:casoId/solicitar-copia', () => {
  const url = `/casos/${CASO_PACIENTE.calificado}/solicitar-copia`;
  const errorDe = (id: string) =>
    texto(
      document
        .querySelector(`#${id}`)
        ?.closest('hlm-field')
        ?.querySelector('hlm-field-error:not([hidden])'),
    );

  it('requires a method, then the field it needs; focus goes to the first invalid one', async () => {
    const p = await abrirPortal(url);
    expect(h1()).toBe('Solicitar copia de tu historia clínica');
    expect(document.body.textContent).toContain('no se muestra en línea');
    expect(document.body.textContent).toContain('10 días hábiles');
    expect(document.body.textContent).toContain('Resolución 1995 de 1999');

    const antes = p.peticiones.length;
    enviar('#form-solicitud');
    await p.estable();
    expect(texto(document.querySelector('#error-medio'))).toBe(
      'Elige cómo quieres recibir la copia.',
    );
    expect(document.activeElement).toBe(radio('Correo electrónico'));

    radio('Correo certificado').click();
    await p.estable();
    enviar('#form-solicitud');
    await p.estable();
    expect(errorDe('solicitud-direccion')).toBe('Indica la dirección de envío.');
    expect(document.activeElement?.id).toBe('solicitud-direccion');
    expect(p.peticiones.length).toBe(antes);
  });

  it('electronic delivery suggests the account email and validates it', async () => {
    const p = await abrirPortal(url);
    radio('Correo electrónico').click();
    await p.estable();
    const correo = document.querySelector<HTMLInputElement>('#solicitud-correo')!;
    expect(correo.value).toBe('paciente@example.com');
    escribir(correo, 'no-es-correo');
    enviar('#form-solicitud');
    await p.estable();
    expect(errorDe('solicitud-correo')).toBe('Escribe un correo electrónico válido.');
  });

  it('sends the request, then shows it in /solicitudes; a second one is "already open"', async () => {
    const p = await abrirPortal(url);
    radio('Correo certificado').click();
    await p.estable();
    escribir(
      document.querySelector<HTMLTextAreaElement>('#solicitud-direccion')!,
      'Calle 10 # 20-30, Bogotá',
    );
    enviar('#form-solicitud');
    await p.estable();
    const post = p.peticiones.find((r) => r.method === 'POST');
    expect(post?.url).toBe(`/paciente/api/casos/${CASO_PACIENTE.calificado}/solicitudes-copia-hc`);
    expect(post?.body).toEqual({
      medioEntrega: 'CORREO_CERTIFICADO',
      direccionOCorreo: 'Calle 10 # 20-30, Bogotá',
      observaciones: null,
    });
    expect(p.avisos).toEqual(['exito: Solicitud enviada']);
    expect(p.router.url).toBe('/solicitudes');

    await p.ir(url);
    radio('Presencial').click();
    await p.estable();
    enviar('#form-solicitud');
    await p.estable();
    const alerta = document.querySelector('[data-testid="solicitud-ya-abierta"]');
    expect(texto(alerta)).toContain('Ya tienes una solicitud abierta para este caso');
    expect(alerta?.querySelector('a')?.getAttribute('href')).toBe('/solicitudes');
  });
});
