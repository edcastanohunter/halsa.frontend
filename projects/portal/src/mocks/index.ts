import { HttpInterceptorFn } from '@angular/common/http';
import type {
  CanjearCodigoRequest,
  CasoPacienteResponse,
  CrearSolicitudCopiaHcRequest,
  HitoResponse,
  IncapacidadPacienteResponse,
  SolicitudCopiaHcPacienteResponse,
} from '@halsa/api-types';
import { hoyBogota, sumarDias } from '@halsa/core';
import {
  creado,
  crearInterceptorMock,
  cuerpoJson,
  noEncontrado,
  ok,
  PeticionMock,
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
/** A code locked after too many attempts: `423 Paciente.CodigoBloqueado` (SPEC 12). */
export const CODIGO_BLOQUEADO = 'BQK000-K7Q2M9XD4P';

const LIMITE_VINCULOS_POR_MINUTO = 5;

/** Like the server (`FormatoCodigoActivacion.TryLeer`): no spaces, uppercase, O→0 and I/L→1. */
function normalizarCodigo(codigo: string | null | undefined): string {
  return (codigo ?? '').replace(/\s/g, '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
}

export const CASO_PACIENTE = {
  activo: '0199a000-0000-7000-8000-00000000a002',
  calificado: '0199a000-0000-7000-8000-00000000a003',
} as const;

export function crearRutasPortal(
  sesionInicial: SesionMock = 'vinculada',
  ahora: () => number = Date.now,
  /** Dev server: keeps the mocked session across reloads (see dev.interceptors.ts). */
  alCambiarSesion: (sesion: SesionMock) => void = () => undefined,
): RutaMock[] {
  let sesion: SesionMock = sesionInicial;
  const cambiarSesion = (nueva: SesionMock) => {
    sesion = nueva;
    alCambiarSesion(nueva);
  };
  const intentosVinculo: number[] = [];
  const iso = (deltaDias = 0) => new Date(ahora() + deltaDias * 86_400_000).toISOString();
  /** A Bogotá calendar day relative to today, so the fixtures never go stale. */
  const dia = (deltaDias: number) => sumarDias(hoyBogota(ahora()), deltaDias)!;

  const casos: CasoPacienteResponse[] = [
    {
      casoId: CASO_PACIENTE.activo,
      radicado: '2026-ARLA-000102',
      tipoEvento: 'AccidenteTrabajo',
      estado: 'EnAtencion',
      fechaEvento: iso(-80),
      arl: 'ARL_A',
      ultimoHitoEn: iso(-1),
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
        fecha: iso(-21),
        descripcion: 'Te remitieron a una IPS para tu atención.',
      },
      {
        tipo: 'INCAPACIDAD_REGISTRADA',
        fecha: iso(-20),
        descripcion: 'Se registró una incapacidad de 30 días.',
      },
      {
        tipo: 'INCAPACIDAD_REGISTRADA',
        fecha: iso(-1),
        descripcion: 'Se registró una prórroga de 20 días.',
      },
    ],
    [CASO_PACIENTE.calificado]: [
      { tipo: 'RADICADO', fecha: iso(-200), descripcion: 'Se reportó la enfermedad laboral.' },
      { tipo: 'VALIDADO', fecha: iso(-195), descripcion: 'Tu ARL validó el reporte.' },
      {
        tipo: 'INCAPACIDAD_REGISTRADA',
        fecha: iso(-150),
        descripcion: 'Se registró una incapacidad de 15 días.',
      },
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
      fechaInicio: dia(-20),
      fechaFin: dia(9),
      dias: 30,
      diasAcumulados: 30,
      estado: 'REGISTRADA',
    },
    {
      id: '0199d000-0000-7000-8000-000000000002',
      casoId: CASO_PACIENTE.activo,
      tipo: 'PRORROGA',
      fechaInicio: dia(10),
      fechaFin: dia(29),
      dias: 20,
      diasAcumulados: 50,
      estado: 'REGISTRADA',
    },
    {
      id: '0199d000-0000-7000-8000-000000000003',
      casoId: CASO_PACIENTE.calificado,
      tipo: 'INICIAL',
      fechaInicio: dia(-150),
      fechaFin: dia(-136),
      dias: 15,
      diasAcumulados: 15,
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
  // The BFF answers 403 with an empty body before anything else (GuardasBff, SPEC 12).
  const sinCsrf = (p: PeticionMock) => p.req.headers.get('X-Halsa-Csrf') !== '1';

  /** `/paciente/api/*`: the CSRF header, then a session; an unlinked account sees nothing. */
  function api(p: PeticionMock, manejar: () => RespuestaMock | Promise<RespuestaMock>) {
    if (sinCsrf(p)) return { status: 403, body: null };
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
      manejar: (p) => {
        if (sinCsrf(p)) return { status: 403, body: null };
        cambiarSesion('anonima');
        return sinContenido();
      },
    },
    {
      metodo: 'POST',
      ruta: '/paciente/api/vinculos',
      manejar: (p) =>
        api(p, async () => {
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
          const codigo = normalizarCodigo((await cuerpoJson<CanjearCodigoRequest>(p.req))?.codigo);
          if (codigo === CODIGO_BLOQUEADO) {
            return problema(
              423,
              'Paciente.CodigoBloqueado',
              'El código se bloqueó por demasiados intentos. Pide uno nuevo a tu ARL.',
            );
          }
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
          cambiarSesion('vinculada');
          return creado({ trabajador: { tipo: 'CC', numeroEnmascarado: '******2222' } });
        }),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/resumen',
      manejar: (p) =>
        api(p, () =>
          ok(
            vinculado()
              ? {
                  casosActivos: casos,
                  // The one in force today (fechaInicio ≤ hoy ≤ fechaFin).
                  incapacidadesVigentes: incapacidades
                    .filter((i) => i.fechaInicio <= dia(0) && dia(0) <= i.fechaFin)
                    .map(({ casoId, fechaInicio, fechaFin, dias }) => ({
                      casoId,
                      fechaInicio,
                      fechaFin,
                      dias,
                    })),
                  proximosHitos: [
                    { casoId: CASO_PACIENTE.activo, tipo: 'FIN_INCAPACIDAD', fecha: dia(9) },
                    {
                      casoId: CASO_PACIENTE.calificado,
                      tipo: 'VENCE_CONTROVERSIA',
                      fecha: dia(11),
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
      manejar: (p) => api(p, () => ok(vinculado() ? casos : [])),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/casos/:casoId/linea-tiempo',
      manejar: (p) =>
        api(p, () => {
          const hitos = vinculado() ? lineasTiempo[p.params['casoId']!] : undefined;
          return hitos ? ok(hitos) : noEncontrado('Caso.NoEncontrado', 'El caso no existe.');
        }),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/incapacidades',
      manejar: (p) => api(p, () => ok(vinculado() ? incapacidades : [])),
    },
    {
      metodo: 'GET',
      ruta: '/paciente/api/solicitudes-copia-hc',
      manejar: (p) => api(p, () => ok(vinculado() ? solicitudes : [])),
    },
    {
      metodo: 'POST',
      ruta: '/paciente/api/casos/:casoId/solicitudes-copia-hc',
      manejar: (p) =>
        api(p, async () => {
          const casoId = p.params['casoId']!;
          if (!vinculado() || !casos.some((c) => c.casoId === casoId)) {
            return noEncontrado('Caso.NoEncontrado', 'El caso no existe.');
          }
          const body = await cuerpoJson<CrearSolicitudCopiaHcRequest>(p.req);
          const medio = body?.medioEntrega;
          const destino = body?.direccionOCorreo?.trim() ?? '';
          // CrearSolicitudCopiaHcCommandValidator: one `General.Validation` with every failure.
          const errores: { code: string; description: string }[] = [];
          if (medio !== 'PRESENCIAL' && medio !== 'CORREO_CERTIFICADO' && medio !== 'ELECTRONICO') {
            errores.push({
              code: 'SolicitudCopiaHc.MedioEntregaInvalido',
              description: 'Debe ser CORREO_CERTIFICADO, PRESENCIAL o ELECTRONICO.',
            });
          } else if (medio !== 'PRESENCIAL' && !destino) {
            errores.push({
              code: 'SolicitudCopiaHc.DireccionRequerida',
              description: 'La dirección o el correo es obligatorio para este medio de entrega.',
            });
          } else if (medio === 'ELECTRONICO' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destino)) {
            errores.push({
              code: 'SolicitudCopiaHc.CorreoInvalido',
              description: 'Debe ser un correo electrónico.',
            });
          }
          if (destino.length > 500) {
            errores.push({
              code: 'SolicitudCopiaHc.DireccionDemasiadoLarga',
              description: 'La dirección o el correo admite como máximo 500 caracteres.',
            });
          }
          if ((body?.observaciones?.length ?? 0) > 1000) {
            errores.push({
              code: 'SolicitudCopiaHc.ObservacionesDemasiadoLargas',
              description: 'Las observaciones admiten como máximo 1000 caracteres.',
            });
          }
          if (errores.length) {
            return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
              errors: errores,
            });
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
            medioEntrega: medio!,
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
export function crearMockPortal(
  sesionInicial?: SesionMock,
  alCambiarSesion?: (sesion: SesionMock) => void,
  retardoMs?: number,
): HttpInterceptorFn {
  return crearInterceptorMock(crearRutasPortal(sesionInicial, Date.now, alCambiarSesion), {
    prefijo: '/paciente/',
    retardoMs,
  });
}
