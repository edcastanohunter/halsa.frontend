import type {
  AccesoAuditadoResponse,
  CasoDetalleResponse,
  DictamenPclResponse,
  IncapacidadResponse,
  PlazoResponse,
  RegistroClinicoResponse,
  RevisionEmergenciaResponse,
  SolicitudCopiaHcResponse,
} from '@halsa/api-types';

/** Subs of the dev realm users (dev/keycloak/realms/halsa-realm.json). */
export const SUB = {
  analistaArla: '01999000-0000-7000-8000-000000000a01',
  calificadorArla: '01999000-0000-7000-8000-000000000a02',
  privacidadArla: '01999000-0000-7000-8000-000000000a03',
  analistaArlb: '01999000-0000-7000-8000-000000000b01',
  medicoIps: '01999000-0000-7000-8000-000000000c01',
  coordinadorIps: '01999000-0000-7000-8000-000000000c02',
} as const;

export const IPS_DEV = '110011234501';

/**
 * Case ids, each one a UI scenario:
 * - `radicado`: new case, nobody assigned (activation code → 409 `Paciente.CasoNoValidado`).
 * - `validado`: remitted to the dev IPS, calificador + medico.ips assigned, incapacidades.
 * - `enCalificacion`: dictamen PENDIENTE, 155 accumulated days (150-day alert).
 * - `noAsignado`: clinical reads → 403 `Clinico.NoAsignado` (emergency access path).
 * - `arlB`: another tenant's case → 404 for ARL_A users.
 */
export const CASO = {
  radicado: '0199a000-0000-7000-8000-00000000a001',
  validado: '0199a000-0000-7000-8000-00000000a002',
  enCalificacion: '0199a000-0000-7000-8000-00000000a003',
  noAsignado: '0199a000-0000-7000-8000-00000000a004',
  arlB: '0199a000-0000-7000-8000-00000000b001',
} as const;

export interface CasoMock {
  tenantId: string;
  detalle: CasoDetalleResponse;
}

export interface DatosBackoffice {
  casos: CasoMock[];
  plazos: PlazoResponse[];
  incapacidades: IncapacidadResponse[];
  registrosClinicos: RegistroClinicoResponse[];
  dictamenes: DictamenPclResponse[];
  solicitudesCopiaHc: SolicitudCopiaHcResponse[];
  accesos: AccesoAuditadoResponse[];
  revisionesEmergencia: RevisionEmergenciaResponse[];
  /** Idempotency-Key → the incapacidad it created (replays return the same response). */
  idempotencia: Map<string, IncapacidadResponse>;
}

const HORA = 3_600_000;
const DIA = 24 * HORA;

function caso(
  id: string,
  tenantId: string,
  radicado: string,
  resumen: Partial<CasoDetalleResponse['resumen']>,
  detalle: Partial<Omit<CasoDetalleResponse, 'resumen'>>,
  fechaEvento: string,
): CasoMock {
  return {
    tenantId,
    detalle: {
      resumen: {
        id,
        radicado,
        tipoEvento: 'AccidenteTrabajo',
        estado: 'Radicado',
        fechaEvento,
        trabajadorDocumento: 'CC 1020304050',
        tieneCalificacion: false,
        porcentajePcl: null,
        ...resumen,
      },
      empleadorDocumento: 'NIT 900123456',
      municipioDivipola: '11001',
      esGraveOMortal: false,
      remisionesVigentes: [],
      equipoAsignado: [],
      ...detalle,
    },
  };
}

const ESTADOS_HISTORICO = ['Cerrado', 'EnAtencion', 'Validado', 'Cerrado', 'Rechazado'] as const;

/** Older ARL_A cases with no other data, so the list paginates (page size 20, plan §7.3). */
function historicoArlA(iso: (deltaMs: number) => string): CasoMock[] {
  return Array.from({ length: CASOS_HISTORICOS }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return caso(
      `0199a100-0000-7000-8000-000000000${n}`,
      'ARL_A',
      `2026-ARLA-000${String(i + 1).padStart(3, '0')}`,
      {
        estado: ESTADOS_HISTORICO[i % ESTADOS_HISTORICO.length],
        tipoEvento: i % 3 === 0 ? 'EnfermedadLaboral' : 'AccidenteTrabajo',
        trabajadorDocumento: `CC ${String(52_000_000 + i * 7_919)}`,
      },
      {},
      iso(-(220 + i * 9) * DIA),
    );
  });
}

/** How many filler cases `historicoArlA` adds (all ARL_A, older than the scenario cases). */
export const CASOS_HISTORICOS = 20;

/** A fresh, mutable data set. Timestamps are relative to `ahora` so deadlines stay meaningful. */
export function crearDatosBackoffice(ahora: number = Date.now()): DatosBackoffice {
  const iso = (deltaMs: number) => new Date(ahora + deltaMs).toISOString();

  const casos: CasoMock[] = [
    caso(CASO.radicado, 'ARL_A', '2026-ARLA-000101', {}, {}, iso(-2 * DIA)),
    caso(
      CASO.validado,
      'ARL_A',
      '2026-ARLA-000102',
      { estado: 'Validado', trabajadorDocumento: 'CC 79111222' },
      {
        esGraveOMortal: true,
        remisionesVigentes: [
          {
            id: '0199b000-0000-7000-8000-000000000001',
            ipsId: IPS_DEV,
            remitidoEn: iso(-20 * DIA),
          },
        ],
        equipoAsignado: [SUB.calificadorArla, SUB.medicoIps],
      },
      iso(-80 * DIA),
    ),
    caso(
      CASO.enCalificacion,
      'ARL_A',
      '2026-ARLA-000103',
      {
        tipoEvento: 'EnfermedadLaboral',
        estado: 'EnCalificacionPcl',
        trabajadorDocumento: 'CE 445566',
        tieneCalificacion: true,
        porcentajePcl: 23.45,
      },
      { equipoAsignado: [SUB.calificadorArla] },
      iso(-200 * DIA),
    ),
    caso(
      CASO.noAsignado,
      'ARL_A',
      '2026-ARLA-000104',
      { estado: 'EnAtencion', trabajadorDocumento: 'CC 1098765432' },
      {},
      iso(-10 * DIA),
    ),
    caso(CASO.arlB, 'ARL_B', '2026-ARLB-000201', {}, {}, iso(-3 * DIA)),
    ...historicoArlA(iso),
  ];

  const plazo = (p: Partial<PlazoResponse> & Pick<PlazoResponse, 'id' | 'casoId' | 'regla'>) => {
    const radicado = casos.find((c) => c.detalle.resumen.id === p.casoId)!.detalle.resumen.radicado;
    return {
      radicado,
      baseLegal: 'Decreto 1072 de 2015',
      referenciaId: null,
      iniciaEn: iso(-2 * DIA),
      venceEn: iso(5 * DIA),
      alertaEn: iso(3 * DIA),
      estado: 'ABIERTO',
      extemporaneo: false,
      cumplidoEn: null,
      ...p,
    } satisfies PlazoResponse;
  };

  const plazos: PlazoResponse[] = [
    // < 24 h left and past the alert: red outline.
    plazo({
      id: '0199c000-0000-7000-8000-000000000001',
      casoId: CASO.radicado,
      regla: 'REPORTE_FURAT',
      baseLegal: 'Resolución 156 de 2005, art. 4',
      venceEn: iso(20 * HORA),
      alertaEn: iso(-4 * HORA),
    }),
    // Past the alert, days left: amber.
    plazo({
      id: '0199c000-0000-7000-8000-000000000002',
      casoId: CASO.enCalificacion,
      regla: 'CONTROVERSIA_DICTAMEN',
      baseLegal: 'Decreto 1352 de 2013',
      venceEn: iso(4 * DIA),
      alertaEn: iso(-1 * DIA),
    }),
    // Calm: alert in the future.
    plazo({
      id: '0199c000-0000-7000-8000-000000000003',
      casoId: CASO.validado,
      regla: 'INVESTIGACION_AT',
      baseLegal: 'Resolución 1401 de 2007',
      venceEn: iso(12 * DIA),
      alertaEn: iso(9 * DIA),
    }),
    plazo({
      id: '0199c000-0000-7000-8000-000000000004',
      casoId: CASO.validado,
      regla: 'REPORTE_FURAT',
      estado: 'CUMPLIDO',
      extemporaneo: true,
      iniciaEn: iso(-75 * DIA),
      alertaEn: iso(-62 * DIA),
      venceEn: iso(-60 * DIA),
      cumplidoEn: iso(-58 * DIA),
    }),
    plazo({
      id: '0199c000-0000-7000-8000-000000000005',
      casoId: CASO.noAsignado,
      regla: 'TOPE_IT_180',
      estado: 'VENCIDO',
      venceEn: iso(-2 * DIA),
      alertaEn: iso(-9 * DIA),
    }),
    plazo({
      id: '0199c000-0000-7000-8000-000000000006',
      casoId: CASO.radicado,
      regla: 'SOLICITUD_COPIA_HC',
      estado: 'SUSPENDIDO',
    }),
    // A rule the frontend doesn't know yet: must render as the raw code (plan §4.3).
    plazo({
      id: '0199c000-0000-7000-8000-000000000007',
      casoId: CASO.validado,
      regla: 'REGLA_FUTURA_DESCONOCIDA',
      venceEn: iso(30 * DIA),
      alertaEn: iso(25 * DIA),
    }),
    plazo({
      id: '0199c000-0000-7000-8000-000000000008',
      casoId: CASO.arlB,
      regla: 'REPORTE_FURAT',
    }),
  ];

  const incapacidades: IncapacidadResponse[] = [
    {
      id: '0199d000-0000-7000-8000-000000000001',
      casoId: CASO.validado,
      tipo: 'INICIAL',
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-30',
      dias: 30,
      diasAcumulados: 30,
      estado: 'REGISTRADA',
      soporteId: '0199d100-0000-7000-8000-000000000001',
      alertas: [],
    },
    {
      id: '0199d000-0000-7000-8000-000000000002',
      casoId: CASO.validado,
      tipo: 'PRORROGA',
      fechaInicio: '2026-08-31',
      fechaFin: '2026-09-29',
      dias: 30,
      diasAcumulados: 60,
      estado: 'REGISTRADA',
      soporteId: '0199d100-0000-7000-8000-000000000002',
      alertas: [{ code: 'CARGA_EXTEMPORANEA', mensaje: 'Cargada 35 días después de su inicio.' }],
    },
    {
      id: '0199d000-0000-7000-8000-000000000003',
      casoId: CASO.enCalificacion,
      tipo: 'INICIAL',
      fechaInicio: '2026-04-01',
      fechaFin: '2026-09-02',
      dias: 155,
      diasAcumulados: 155,
      estado: 'REGISTRADA',
      soporteId: '0199d100-0000-7000-8000-000000000003',
      alertas: [
        { code: 'ACUMULADO_150_DIAS', mensaje: 'El caso acumula 155 días de incapacidad.' },
      ],
    },
  ];

  const firmaCalificador = {
    sub: SUB.calificadorArla,
    tipoDocumento: 'CC',
    numeroDocumento: '52000111',
    registroRethus: 'RM-DEV-0001',
  };

  const registrosClinicos: RegistroClinicoResponse[] = [
    {
      id: '0199e000-0000-7000-8000-000000000001',
      casoId: CASO.validado,
      tipo: 'REPORTE_INICIAL',
      profesional: firmaCalificador,
      atendidoEn: iso(-80 * DIA),
      registradoEn: iso(-80 * DIA),
      retenerHasta: '2046-08-01',
      corrigeA: null,
      corregidoPor: null,
      contenido: {
        motivo: 'Trauma en mano derecha con prensa hidráulica.',
        anamnesis: 'Trabajador refiere atrapamiento de la mano derecha durante el turno.',
        examenFisico: 'Edema y limitación funcional del quinto dedo.',
        analisis: null,
        plan: 'Inmovilización y control por ortopedia.',
        diagnosticos: [
          { sistema: 'CIE-10', codigo: 'S62.6', descripcion: 'Fractura de otro dedo de la mano' },
        ],
        observaciones: null,
      },
    },
    {
      id: '0199e000-0000-7000-8000-000000000002',
      casoId: CASO.validado,
      tipo: 'EVOLUCION',
      profesional: firmaCalificador,
      atendidoEn: iso(-30 * DIA),
      registradoEn: iso(-30 * DIA),
      retenerHasta: '2046-08-01',
      corrigeA: null,
      corregidoPor: '0199e000-0000-7000-8000-000000000003',
      contenido: {
        motivo: 'Control.',
        anamnesis: null,
        examenFisico: 'Consolidación parcial.',
        analisis: null,
        plan: 'Fisioterapia, 10 sesiones.',
        diagnosticos: [{ sistema: 'CIE-10', codigo: 'S62.6' }],
        observaciones: null,
      },
    },
    {
      id: '0199e000-0000-7000-8000-000000000003',
      casoId: CASO.validado,
      tipo: 'EVOLUCION',
      profesional: firmaCalificador,
      atendidoEn: iso(-30 * DIA),
      registradoEn: iso(-29 * DIA),
      retenerHasta: '2046-08-01',
      corrigeA: '0199e000-0000-7000-8000-000000000002',
      corregidoPor: null,
      contenido: {
        motivo: 'Control.',
        anamnesis: null,
        examenFisico: 'Consolidación parcial, sin signos de infección.',
        analisis: null,
        plan: 'Fisioterapia, 10 sesiones.',
        diagnosticos: [{ sistema: 'CIE-10', codigo: 'S62.6' }],
        observaciones: 'Corrige el examen físico del registro anterior.',
      },
    },
    {
      id: '0199e000-0000-7000-8000-000000000004',
      casoId: CASO.enCalificacion,
      tipo: 'CONCEPTO_MEDICO',
      profesional: firmaCalificador,
      atendidoEn: iso(-15 * DIA),
      registradoEn: iso(-15 * DIA),
      retenerHasta: '2046-04-01',
      corrigeA: null,
      corregidoPor: null,
      contenido: {
        motivo: 'Concepto para calificación de PCL.',
        anamnesis: 'Síndrome de túnel carpiano bilateral de 2 años de evolución.',
        examenFisico: 'Phalen y Tinel positivos bilaterales.',
        analisis: 'Patología compatible con exposición a movimientos repetitivos.',
        plan: 'Remitir a calificación.',
        diagnosticos: [{ sistema: 'CIE-10', codigo: 'G56.0' }],
        observaciones: null,
      },
    },
  ];

  const dictamenes: DictamenPclResponse[] = [
    {
      id: '0199f000-0000-7000-8000-000000000001',
      casoId: CASO.enCalificacion,
      porcentajePcl: 23.45,
      origen: 'LABORAL',
      fechaEstructuracion: '2026-09-15',
      fechaDictamen: '2026-10-10',
      manual: 'Decreto 1507/2014',
      componentes: { deficiencias: 15.45, rolLaboralYOtrasAreas: 8 },
      fundamentos:
        'Se califica la pérdida de capacidad laboral conforme al Manual Único de Calificación. ' +
        'La deficiencia por compromiso de nervio mediano bilateral se valora según el capítulo 12.',
      diagnosticos: [{ sistema: 'CIE-10', codigo: 'G56.0' }],
      calificador: {
        identificacion: { tipo: 'CC', numero: '52000111' },
        nombreCompleto: 'Calificador ARL A',
        registroRethus: 'RM-DEV-0001',
      },
      estadoNotificacion: 'PENDIENTE',
      venceControversiaEn: null,
      corrigeA: null,
    },
  ];

  const solicitudesCopiaHc: SolicitudCopiaHcResponse[] = [
    {
      id: '0199f100-0000-7000-8000-000000000001',
      casoId: CASO.validado,
      radicado: '2026-ARLA-000102',
      pacienteSub: '0199aa00-0000-7000-8000-00000000f001',
      medioEntrega: 'ELECTRONICO',
      direccionOCorreo: 'paciente@example.com',
      observaciones: null,
      estado: 'RECIBIDA',
      solicitadaEn: iso(-1 * DIA),
      atendidaEn: null,
      atendidaPor: null,
      notaAtencion: null,
    },
    {
      id: '0199f100-0000-7000-8000-000000000002',
      casoId: CASO.enCalificacion,
      radicado: '2026-ARLA-000103',
      pacienteSub: '0199aa00-0000-7000-8000-00000000f002',
      medioEntrega: 'CORREO_CERTIFICADO',
      direccionOCorreo: 'Calle 10 # 20-30, Bogotá',
      observaciones: 'Entregar en horario de oficina.',
      estado: 'EN_TRAMITE',
      solicitadaEn: iso(-6 * DIA),
      atendidaEn: null,
      atendidaPor: null,
      notaAtencion: null,
    },
    {
      id: '0199f100-0000-7000-8000-000000000003',
      casoId: CASO.validado,
      radicado: '2026-ARLA-000102',
      pacienteSub: '0199aa00-0000-7000-8000-00000000f001',
      medioEntrega: 'PRESENCIAL',
      direccionOCorreo: null,
      observaciones: null,
      estado: 'ENTREGADA',
      solicitadaEn: iso(-40 * DIA),
      atendidaEn: iso(-35 * DIA),
      atendidaPor: SUB.privacidadArla,
      notaAtencion: 'Entregada en la oficina principal.',
    },
  ];

  const ACCIONES = ['Leer', 'Leer', 'Crear', 'Actualizar', 'Corregir'] as const;
  const RESULTADOS = ['Exito', 'Exito', 'Exito', 'Denegado', 'NoEncontrado', 'Error'] as const;
  const accesos: AccesoAuditadoResponse[] = Array.from({ length: 45 }, (_, i) => ({
    id: `0199f200-0000-7000-8000-${String(i + 1).padStart(12, '0')}`,
    ocurridoEn: iso(-i * 5 * HORA),
    tenantId: 'ARL_A',
    actorId: i % 3 === 0 ? SUB.calificadorArla : SUB.analistaArla,
    actorTipo: 'arl',
    actorTenantId: 'ARL_A',
    actorIpsId: null,
    actorRoles: i % 3 === 0 ? ['medico-calificador'] : ['analista-arl'],
    clientId: 'halsa-backoffice',
    ip: '10.0.0.15',
    userAgent: 'Mozilla/5.0',
    correlationId: crypto.randomUUID(),
    accion: ACCIONES[i % ACCIONES.length]!,
    resultado: RESULTADOS[i % RESULTADOS.length]!,
    recursoTipo: i % 3 === 0 ? 'RegistroClinico' : 'Caso',
    recursoId: null,
    casoMedicoId: i % 2 === 0 ? CASO.validado : CASO.enCalificacion,
    motivo: i === 6 ? 'Paciente en urgencias con sincope, se requiere antecedente' : null,
    acr: i % 3 === 0 ? '2' : '1',
  }));

  const revisionesEmergencia: RevisionEmergenciaResponse[] = [
    {
      id: '0199f300-0000-7000-8000-000000000001',
      casoMedicoId: CASO.noAsignado,
      accesoId: accesos[6]!.id,
      actorId: SUB.calificadorArla,
      motivo: 'Paciente en urgencias con sincope, se requiere antecedente',
      ocurridoEn: iso(-10 * HORA),
      venceRevisionEn: iso(62 * HORA),
      estado: 'PENDIENTE',
    },
    {
      // Past its 72 h deadline: destructive badge.
      id: '0199f300-0000-7000-8000-000000000002',
      casoMedicoId: CASO.noAsignado,
      accesoId: accesos[12]!.id,
      actorId: SUB.calificadorArla,
      motivo: 'Valoracion urgente por trauma craneoencefalico en turno nocturno',
      ocurridoEn: iso(-80 * HORA),
      venceRevisionEn: iso(-8 * HORA),
      estado: 'PENDIENTE',
    },
    {
      id: '0199f300-0000-7000-8000-000000000003',
      casoMedicoId: CASO.validado,
      accesoId: accesos[18]!.id,
      actorId: SUB.calificadorArla,
      motivo: 'Consulta de antecedentes por reingreso a urgencias del paciente',
      ocurridoEn: iso(-12 * DIA),
      venceRevisionEn: iso(-9 * DIA),
      estado: 'CERRADA',
      revisadoEn: iso(-11 * DIA),
      revisadoPor: SUB.privacidadArla,
      conclusion: 'JUSTIFICADO',
      observaciones: 'Urgencia verificada con la IPS.',
    },
  ];

  return {
    casos,
    plazos,
    incapacidades,
    registrosClinicos,
    dictamenes,
    solicitudesCopiaHc,
    accesos,
    revisionesEmergencia,
    idempotencia: new Map(),
  };
}
