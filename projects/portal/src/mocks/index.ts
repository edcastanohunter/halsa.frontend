import { HttpInterceptorFn } from '@angular/common/http';
import type {
  CanjearCodigoRequest,
  CasoPacienteResponse,
  CrearSolicitudCopiaHcRequest,
  HitoResponse,
  IncapacidadPacienteResponse,
  SolicitudCopiaHcPacienteResponse,
} from '@halsa/api-types';
import {
  creado,
  crearInterceptorMock,
  cuerpoJson,
  noEncontrado,
  ok,
  problema,
  RespuestaMock,
  RutaMock,
  sinContenido,
} from '@halsa/mocks';

/** BFF session states (plan §5.2): no session, logged in but not linked, linked. */
export type SesionMock = 'anonima' | 'sin-vinculo' | 'vinculada';

/** Valid activation code (the plan's example); any other code is `Paciente.CodigoInvalido`. */
export const CODIGO_VALIDO = 'ABC123-K7Q2M9XD4P';
/** A well-formed code for a different worker: `409 Paciente.VinculoDistinto`. */
export const CODIGO_OTRO_DOCUMENTO = 'XYZ789-K7Q2M9XD4P';

const LIMITE_VINCULOS_POR_MINUTO = 5;

export const CASO_PACIENTE = {
  activo: '0199a000-0000-7000-8000-00000000a002',
  calificado: '0199a000-0000-7000-8000-00000000a003',
} as const;

export function crearRutasPortal(
  sesionInicial: SesionMock = 'vinculada',
  ahora: () => number = Date.now,
): RutaMock[] {
  let sesion: SesionMock = sesionInicial;
  const intentosVinculo: number[] = [];
  const iso = (deltaDias = 0) => new Date(ahora() + deltaDias * 86_400_000).toISOString();

  const casos: CasoPacienteResponse[] = [
    {
      casoId: CASO_PACIENTE.activo,
      radicado: '2026-ARLA-000102',
      tipoEvento: 'AccidenteTrabajo',
      estado: 'EnAtencion',
      fechaEvento: iso(-80),
      arl: 'ARL_A',
      ultimoHitoEn: iso(-20),
    },
    {
      casoId: CASO_PACIENTE.calificado,
      radicado: '2026-ARLA-000103',
      tipoEvento: 'EnfermedadLaboral',
      estado: 'EnCalificacionPcl',
      fechaEvento: iso(-200),
      arl: 'ARL_A',
      ultimoHitoEn: iso(-3),
    },
  ];
  const lineasTiempo: Record<string, HitoResponse[]> = {
    [CASO_PACIENTE.activo]: [
      { tipo: 'RADICADO', fecha: iso(-80), descripcion: 'Tu empleador reportó el accidente.' },
      { tipo: 'VALIDADO', fecha: iso(-78), descripcion: 'Tu ARL validó el reporte.' },
      {
        tipo: 'REMITIDO_A_IPS',
        fecha: iso(-20),
        descripcion: 'Te remitieron a una IPS para tu atención.',
      },
      {
        tipo: 'INCAPACIDAD_REGISTRADA',
        fecha: iso(-19),
        descripcion: 'Se registró una incapacidad de 30 días.',
      },
    ],
    [CASO_PACIENTE.calificado]: [
      { tipo: 'RADICADO', fecha: iso(-200), descripcion: 'Se reportó la enfermedad laboral.' },
      { tipo: 'VALIDADO', fecha: iso(-195), descripcion: 'Tu ARL validó el reporte.' },
      {
        tipo: 'DICTAMEN_NOTIFICADO',
        fecha: iso(-3),
        descripcion: 'Te notificaron el dictamen de calificación.',
      },
    ],
  };
  const incapacidades: IncapacidadPacienteResponse[] = [
    {
      id: '0199d000-0000-7000-8000-000000000001',
      casoId: CASO_PACIENTE.activo,
      tipo: 'INICIAL',
      fechaInicio: '2026-10-01',
      fechaFin: '2026-10-30',
      dias: 30,
      diasAcumulados: 30,
      estado: 'REGISTRADA',
    },
  ];
  const solicitudes: SolicitudCopiaHcPacienteResponse[] = [
    {
      id: '0199f100-0000-7000-8000-000000000003',
      casoId: CASO_PACIENTE.activo,
      medioEntrega: 'PRESENCIAL',
      direccionOCorreo: null,
      observaciones: null,
      estado: 'ENTREGADA',
      solicitadaEn: iso(-40),
      atendidaEn: iso(-35),
      notaAtencion: 'Entregada en la oficina principal.',
    },
  ];

  const sinSesion = (): RespuestaMock => ({ status: 401, body: null });

  /** `/paciente/api/*`: a session is required; an unlinked account sees nothing. */
  function api(manejar: () => RespuestaMock | Promise<RespuestaMock>) {
    return sesion === 'anonima' ? sinSesion() : manejar();
  }
  const vinculado = () => sesion === 'vinculada';

  return [
    {
      metodo: 'GET',
      ruta: '/paciente/bff/usuario',
      manejar: () =>
        sesion === 'anonima'
          ? sinSesion()
          : ok({
              nombre: 'Paciente de prueba',
              correo: 'paciente@example.com',
              vinculado: vinculado(),
            }),
    },
    {
      metodo: 'POST',
      ruta: '/paciente/bff/logout',
      manejar: () => {
        sesion = 'anonima';
        return sinContenido();
      },
    },
    {
      metodo: 'POST',
      ruta: '/paciente/api/vinculos',
      manejar: (p) =>
        api(async () => {
          // Rate limited: 5/min per IP (plan §4.3).
          const t = ahora();
          while (intentosVinculo.length && t - intentosVinculo[0]! > 60_000)
            intentosVinculo.shift();
          if (intentosVinculo.length >= LIMITE_VINCULOS_POR_MINUTO) {
            const espera = Math.ceil((60_000 - (t - intentosVinculo[0]!)) / 1000);
            // ASP.NET's rate limiter answers with an empty body.
            return { status: 429, body: null, headers: { 'Retry-After': String(espera) } };
          }
          intentosVinculo.push(t);
          const codigo = (await cuerpoJson<CanjearCodigoRequest>(p.req))?.codigo
            ?.trim()
            .toUpperCase();
          if (codigo === CODIGO_OTRO_DOCUMENTO) {
            return problema(
              409,
              'Paciente.VinculoDistinto',
              'La cuenta ya está vinculada a otro documento.',
            );
          }
          if (codigo !== CODIGO_VALIDO) {
            return problema(
              400,
              'Paciente.CodigoInvalido',
              'El código de activación no es válido.',
            );
          }
          sesion = 'vinculada';
          return creado({ trabajador: { tipo: 'CC', numeroEnmascarado: '******2222' } });
        }),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/resumen',
      manejar: () =>
        api(() =>
          ok(
            vinculado()
              ? {
                  casosActivos: casos,
                  incapacidadesVigentes: incapacidades.map(
                    ({ casoId, fechaInicio, fechaFin, dias }) => ({
                      casoId,
                      fechaInicio,
                      fechaFin,
                      dias,
                    }),
                  ),
                  proximosHitos: [
                    { casoId: CASO_PACIENTE.activo, tipo: 'FIN_INCAPACIDAD', fecha: '2026-10-30' },
                    {
                      casoId: CASO_PACIENTE.calificado,
                      tipo: 'VENCE_CONTROVERSIA',
                      fecha: '2026-10-29',
                    },
                  ],
                }
              : { casosActivos: [], incapacidadesVigentes: [], proximosHitos: [] },
          ),
        ),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/mis-casos',
      manejar: () => api(() => ok(vinculado() ? casos : [])),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/casos/:casoId/linea-tiempo',
      manejar: (p) =>
        api(() => {
          const hitos = vinculado() ? lineasTiempo[p.params['casoId']!] : undefined;
          return hitos ? ok(hitos) : noEncontrado('Caso.NoEncontrado', 'El caso no existe.');
        }),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/incapacidades',
      manejar: () => api(() => ok(vinculado() ? incapacidades : [])),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/solicitudes-copia-hc',
      manejar: () => api(() => ok(vinculado() ? solicitudes : [])),
    },
    {
      metodo: 'POST',
      ruta: '/paciente/api/casos/:casoId/solicitudes-copia-hc',
      manejar: (p) =>
        api(async () => {
          const casoId = p.params['casoId']!;
          if (!vinculado() || !casos.some((c) => c.casoId === casoId)) {
            return noEncontrado('Caso.NoEncontrado', 'El caso no existe.');
          }
          const body = await cuerpoJson<CrearSolicitudCopiaHcRequest>(p.req);
          const medio = body?.medioEntrega;
          const destino = body?.direccionOCorreo?.trim() ?? '';
          if (medio !== 'PRESENCIAL' && medio !== 'CORREO_CERTIFICADO' && medio !== 'ELECTRONICO') {
            return problema(
              400,
              'SolicitudCopiaHc.MedioEntregaInvalido',
              'Elige un medio de entrega.',
            );
          }
          if (medio !== 'PRESENCIAL' && !destino) {
            return problema(
              400,
              'SolicitudCopiaHc.DireccionRequerida',
              'Indica la dirección o el correo.',
            );
          }
          if (medio === 'ELECTRONICO' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
            return problema(
              400,
              'SolicitudCopiaHc.CorreoInvalido',
              'El correo electrónico no es válido.',
            );
          }
          const abierta = solicitudes.some(
            (s) => s.casoId === casoId && (s.estado === 'RECIBIDA' || s.estado === 'EN_TRAMITE'),
          );
          if (abierta) {
            return problema(
              409,
              'SolicitudCopiaHc.YaAbierta',
              'Ya hay una solicitud de copia abierta para este caso.',
            );
          }
          const nueva: SolicitudCopiaHcPacienteResponse = {
            id: crypto.randomUUID(),
            casoId,
            medioEntrega: medio,
            direccionOCorreo: destino || null,
            observaciones: body?.observaciones ?? null,
            estado: 'RECIBIDA',
            solicitadaEn: iso(),
            atendidaEn: null,
            notaAtencion: null,
          };
          solicitudes.unshift(nueva);
          return creado(nueva);
        }),
    },
  ];
}

/** The BFF (`/paciente/`) served from in-memory fixtures. State resets on reload. */
export function crearMockPortal(sesionInicial?: SesionMock, retardoMs?: number): HttpInterceptorFn {
  return crearInterceptorMock(crearRutasPortal(sesionInicial), {
    prefijo: '/paciente/',
    retardoMs,
  });
}
