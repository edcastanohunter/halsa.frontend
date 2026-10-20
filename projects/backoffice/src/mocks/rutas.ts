import type {
  AsignarCasoRequest,
  CerrarRevisionEmergenciaRequest,
  CerrarSolicitudCopiaHcRequest,
  CumplirPlazoRequest,
  DictamenPclResponse,
  IncapacidadRequest,
  IncapacidadResponse,
  NotificarDictamenPclRequest,
  RegistrarDictamenPclRequest,
  RegistroClinicoRequest,
  RemitirCasoRequest,
} from '@halsa/api-types';
import {
  ClaimsMock,
  creado,
  cuerpoJson,
  exigirStepUp,
  noEncontrado,
  ok,
  paginar,
  PeticionMock,
  problema,
  RespuestaMock,
  RutaMock,
  sinContenido,
} from '@halsa/mocks';
import { CasoMock, DatosBackoffice, SUB } from './fixtures';

/** Dictamen PCL policy: `acr=2` and `auth_time` within 15 minutes (plan §5.1.4). */
const MAX_AGE_DICTAMEN_SEG = 900;
/** Tolerance of `atendidoEn` before the event (backend `ToleranciaFechaEvento`). */
const DIA_MS = 86_400_000;

const PERMISOS_ANALISTA = [
  'casos:read',
  'casos:write',
  'casos:asignar',
  'incapacidades:read',
  'plazos:read',
  'plazos:write',
  'pacientes:activar',
];

/** Without a token (M2, before OIDC) the mock answers as analista.arla at acr=1. */
const IDENTIDAD_POR_DEFECTO: ClaimsMock = {
  sub: SUB.analistaArla,
  acr: '1',
  actor_tipo: 'arl',
  tenant_id: 'ARL_A',
  resource_access: { 'halsa-api': { roles: ['analista-arl', ...PERMISOS_ANALISTA] } },
};

interface Actor {
  sub: string;
  actorTipo: string;
  tenantId: string | null;
  ipsId: string | null;
  permisos: ReadonlySet<string>;
  claims: ClaimsMock;
}

function actor(p: PeticionMock): Actor {
  const claims = p.claims ?? IDENTIDAD_POR_DEFECTO;
  // Keycloak puts effective (composite-expanded) client roles in the token; permissions are the
  // ones with a colon (`casos:read`), the rest are role names (`analista-arl`).
  const roles = claims.resource_access?.['halsa-api']?.roles ?? [];
  return {
    sub: claims.sub ?? '',
    actorTipo: claims.actor_tipo ?? 'arl',
    tenantId: claims.tenant_id ?? null,
    ipsId: claims.ips_id ?? null,
    permisos: new Set(roles.filter((r) => r.includes(':'))),
    claims,
  };
}

const prohibido = (): RespuestaMock => ({ status: 403, body: null });

function casoVisible(a: Actor, c: CasoMock): boolean {
  if (a.actorTipo === 'ips') {
    return c.detalle.remisionesVigentes.some((r) => r.ipsId === a.ipsId);
  }
  return c.tenantId === a.tenantId;
}

function textoEntre(valor: unknown, min: number, max: number): valor is string {
  return typeof valor === 'string' && valor.trim().length >= min && valor.length <= max;
}

export function crearRutasBackoffice(
  db: DatosBackoffice,
  ahora: () => number = Date.now,
): RutaMock[] {
  const iso = () => new Date(ahora()).toISOString();

  /** Permission → tenant/IPS visibility → the case. Out-of-tenant is a neutral 404. */
  function conCaso(
    p: PeticionMock,
    permiso: string,
    manejar: (c: CasoMock, a: Actor) => RespuestaMock | Promise<RespuestaMock>,
  ): RespuestaMock | Promise<RespuestaMock> {
    const a = actor(p);
    if (!a.permisos.has(permiso)) return prohibido();
    const c = db.casos.find((x) => x.detalle.resumen.id === p.params['casoId']);
    if (!c || !casoVisible(a, c)) return noEncontrado('Caso.NoEncontrado', 'El caso no existe.');
    return manejar(c, a);
  }

  /**
   * Clinical policy (🔒): permission, step-up, then ABAC (assigned to the case). A read may
   * break the glass with `Halsa-Motivo-Acceso` when the actor holds `clinico:emergencia`.
   */
  function conCasoClinico(
    p: PeticionMock,
    permiso: string,
    opciones: { lectura: boolean; maxAgeSeg?: number },
    manejar: (c: CasoMock, a: Actor) => RespuestaMock | Promise<RespuestaMock>,
  ): RespuestaMock | Promise<RespuestaMock> {
    const a = actor(p);
    if (!a.permisos.has(permiso)) return prohibido();
    const desafio = exigirStepUp(p.claims, opciones.maxAgeSeg, ahora());
    if (desafio) return desafio;
    const c = db.casos.find((x) => x.detalle.resumen.id === p.params['casoId']);
    if (!c || !casoVisible(a, c)) {
      return noEncontrado('Clinico.CasoNoEncontrado', 'El caso no existe.');
    }
    if (!c.detalle.equipoAsignado.includes(a.sub)) {
      const motivo = p.req.headers.get('Halsa-Motivo-Acceso');
      if (opciones.lectura && motivo !== null && a.permisos.has('clinico:emergencia')) {
        if (!textoEntre(motivo, 20, 500) || /[^\x20-\x7E]/.test(motivo)) {
          return problema(
            400,
            'Clinico.MotivoEmergenciaInvalido',
            'El motivo del acceso de emergencia debe tener entre 20 y 500 caracteres.',
          );
        }
        return manejar(c, a);
      }
      return problema(403, 'Clinico.NoAsignado', 'No estás asignado a este caso.');
    }
    return manejar(c, a);
  }

  const rutas: RutaMock[] = [
    /* ---------- identidad ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/identidad/yo',
      manejar: (p) => {
        const a = actor(p);
        return ok({
          sub: a.sub,
          actorTipo: a.actorTipo,
          tenantId: a.tenantId,
          ipsId: a.ipsId,
          permisos: [...a.permisos],
        });
      },
    },

    /* ---------- casos ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/casos',
      manejar: (p) => {
        const a = actor(p);
        if (!a.permisos.has('casos:read')) return prohibido();
        const estado = p.query.get('estado');
        const visibles = db.casos
          .filter((c) => casoVisible(a, c))
          .filter((c) => !estado || c.detalle.resumen.estado === estado)
          .map((c) => c.detalle.resumen)
          // The API orders by `RadicadoEn` descending; the event date stands in for it here.
          .sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento));
        return ok(paginar(visibles, p.query));
      },
    },
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId',
      manejar: (p) => conCaso(p, 'casos:read', (c) => ok(c.detalle)),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/asignaciones',
      manejar: (p) =>
        conCaso(p, 'casos:asignar', async (c) => {
          const body = await cuerpoJson<AsignarCasoRequest>(p.req);
          if (!textoEntre(body?.sub, 1, 200)) {
            return problema(400, 'General.Validation', 'Indica el identificador del profesional.', {
              errors: [{ code: 'sub', description: 'El identificador es obligatorio.' }],
            });
          }
          if (!c.detalle.equipoAsignado.includes(body!.sub))
            c.detalle.equipoAsignado.push(body!.sub);
          return sinContenido();
        }),
    },
    {
      metodo: 'DELETE',
      ruta: '/v1/casos/:casoId/asignaciones/:sub',
      manejar: (p) =>
        conCaso(p, 'casos:asignar', (c) => {
          const i = c.detalle.equipoAsignado.indexOf(p.params['sub']!);
          if (i < 0) return noEncontrado('Caso.AsignacionNoEncontrada', 'La asignación no existe.');
          c.detalle.equipoAsignado.splice(i, 1);
          return sinContenido();
        }),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/remisiones',
      manejar: (p) =>
        conCaso(p, 'casos:write', async (c) => {
          const body = await cuerpoJson<RemitirCasoRequest>(p.req);
          if (!/^\d{12}$/.test(body?.ipsId ?? '')) {
            return problema(
              400,
              'Caso.IpsIdInvalido',
              'El código REPS de la IPS debe tener 12 dígitos.',
              {
                errors: [
                  {
                    code: 'Caso.IpsIdInvalido',
                    description: 'El código REPS debe tener 12 dígitos.',
                  },
                ],
              },
            );
          }
          if (c.detalle.remisionesVigentes.some((r) => r.ipsId === body!.ipsId)) {
            return problema(409, 'Caso.RemisionDuplicada', 'El caso ya está remitido a esa IPS.');
          }
          const remision = { id: crypto.randomUUID(), ipsId: body!.ipsId, remitidoEn: iso() };
          c.detalle.remisionesVigentes.push(remision);
          return creado(
            { remisionId: remision.id },
            `/v1/casos/${c.detalle.resumen.id}/remisiones/${remision.id}`,
          );
        }),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/remisiones/:remisionId/revocar',
      manejar: (p) =>
        conCaso(p, 'casos:write', (c) => {
          const i = c.detalle.remisionesVigentes.findIndex((r) => r.id === p.params['remisionId']);
          if (i < 0) return noEncontrado('Caso.RemisionNoEncontrada', 'La remisión no existe.');
          c.detalle.remisionesVigentes.splice(i, 1);
          return sinContenido();
        }),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/codigos-activacion',
      manejar: (p) =>
        conCaso(p, 'pacientes:activar', (c) => {
          if (c.detalle.resumen.estado !== 'Validado') {
            return problema(
              409,
              'Paciente.CasoNoValidado',
              'Solo se pueden generar códigos para casos validados.',
            );
          }
          const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
          const al = (n: number) =>
            Array.from(
              { length: n },
              () => alfabeto[Math.floor(Math.random() * alfabeto.length)],
            ).join('');
          return creado({
            codigo: `${al(6)}-${al(10)}`,
            expiraEn: new Date(ahora() + 7 * 86_400_000).toISOString(),
          });
        }),
    },

    /* ---------- plazos ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/plazos',
      manejar: (p) => {
        const a = actor(p);
        if (!a.permisos.has('plazos:read')) return prohibido();
        const estado = p.query.get('estado');
        const regla = p.query.get('regla');
        const venceAntesDe = p.query.get('venceAntesDe');
        const casosVisibles = new Set(
          db.casos.filter((c) => casoVisible(a, c)).map((c) => c.detalle.resumen.id),
        );
        const items = db.plazos
          .filter((x) => casosVisibles.has(x.casoId))
          .filter((x) => !estado || x.estado === estado)
          .filter((x) => !regla || x.regla === regla)
          .filter((x) => !venceAntesDe || Date.parse(x.venceEn) < Date.parse(venceAntesDe))
          .sort((x, y) => Date.parse(x.venceEn) - Date.parse(y.venceEn));
        return ok(paginar(items, p.query));
      },
    },
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId/plazos',
      manejar: (p) =>
        conCaso(p, 'plazos:read', (c) =>
          ok(db.plazos.filter((x) => x.casoId === c.detalle.resumen.id)),
        ),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/plazos/:plazoId/cumplir',
      manejar: (p) =>
        conCaso(p, 'plazos:write', async (c) => {
          const plazo = db.plazos.find(
            (x) => x.id === p.params['plazoId'] && x.casoId === c.detalle.resumen.id,
          );
          if (!plazo) return noEncontrado('Plazo.NoEncontrado', 'El plazo no existe.');
          const body = await cuerpoJson<CumplirPlazoRequest>(p.req);
          if (!textoEntre(body?.nota, 10, 1000)) {
            // Like CumplirPlazoCommandValidator: FluentValidation codes in `errors`.
            const larga = String(body?.nota ?? '').length > 1000;
            return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
              errors: [
                larga
                  ? {
                      code: 'Plazo.NotaDemasiadoLarga',
                      description: 'Admite como máximo 1000 caracteres.',
                    }
                  : {
                      code: 'Plazo.NotaRequerida',
                      description: 'Debe tener al menos 10 caracteres.',
                    },
              ],
            });
          }
          if (body?.cumplidoEn && Date.parse(body.cumplidoEn) > ahora()) {
            return problema(
              400,
              'Plazo.CumplidoEnFuturo',
              'La fecha de cumplimiento no puede ser futura.',
            );
          }
          if (plazo.estado !== 'ABIERTO' && plazo.estado !== 'VENCIDO') {
            return problema(
              409,
              'Plazo.NoCumplible',
              'El plazo no admite cumplimiento en su estado actual.',
            );
          }
          const cumplidoEn = body?.cumplidoEn ?? iso();
          plazo.extemporaneo = Date.parse(cumplidoEn) > Date.parse(plazo.venceEn);
          plazo.estado = 'CUMPLIDO';
          plazo.cumplidoEn = cumplidoEn;
          return sinContenido();
        }),
    },

    /* ---------- incapacidades ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId/incapacidades',
      manejar: (p) =>
        conCaso(p, 'incapacidades:read', (c) =>
          ok(db.incapacidades.filter((x) => x.casoId === c.detalle.resumen.id)),
        ),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/incapacidades',
      manejar: (p) => {
        // incapacidades:write + acr=2 (no max age), before the case lookup.
        const a = actor(p);
        if (!a.permisos.has('incapacidades:write')) return prohibido();
        const desafio = exigirStepUp(p.claims);
        if (desafio) return desafio;
        return conCaso(p, 'incapacidades:write', async (c) => {
          const clave = p.req.headers.get('Idempotency-Key') ?? '';
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clave)
          ) {
            return problema(
              400,
              'Integracion.IdempotencyKeyInvalida',
              'La cabecera Idempotency-Key debe ser un UUID v4.',
            );
          }
          const previa = db.idempotencia.get(clave);
          if (previa) {
            return previa.casoId === c.detalle.resumen.id
              ? creado(previa)
              : problema(
                  409,
                  'Integracion.IdempotenciaConflicto',
                  'La clave ya se usó con otros datos.',
                );
          }
          const soporte = p.req.body instanceof FormData ? p.req.body.get('soporte') : null;
          const datos = await cuerpoJson<IncapacidadRequest>(p.req);
          if (!datos || !(soporte instanceof Blob)) {
            return problema(
              400,
              'Incapacidades.PartesInvalidas',
              'Faltan las partes datos o soporte.',
            );
          }
          if (soporte.size > 10 * 1024 * 1024) {
            return problema(413, 'Archivos.SoporteDemasiadoGrande', 'El soporte supera 10 MB.');
          }
          const firma = new TextDecoder().decode(await soporte.slice(0, 5).arrayBuffer());
          if (firma !== '%PDF-') {
            return problema(415, 'Archivos.NoEsPdf', 'El soporte debe ser un PDF.');
          }
          // Dev switch: this certificate number simulates the antivirus being down.
          if (datos.numeroCertificado === 'ANTIVIRUS-503') {
            return problema(
              503,
              'Archivos.AntivirusNoDisponible',
              'El antivirus no está disponible.',
              {
                headers: { 'Retry-After': '120' },
              },
            );
          }
          const errores: Record<string, string[]> = {};
          if (!Number.isInteger(datos.dias) || datos.dias < 1 || datos.dias > 30) {
            errores['dias'] = ['Los días deben estar entre 1 y 30.'];
          }
          if (!textoEntre(datos.numeroCertificado, 1, 40)) {
            errores['numeroCertificado'] = ['El número de certificado es obligatorio (máximo 40).'];
          }
          if (datos.tipo === 'PRORROGA' && !datos.prorrogaDe) {
            errores['prorrogaDe'] = ['Una prórroga debe indicar la incapacidad que prorroga.'];
          }
          if (Object.keys(errores).length) {
            return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
              errors: errores,
            });
          }
          const delCaso = db.incapacidades.filter((x) => x.casoId === c.detalle.resumen.id);
          const acumulado = delCaso.reduce((s, x) => s + x.dias, 0) + datos.dias;
          const [anio, mes, dia] = datos.fechaInicio.split('-').map(Number) as [
            number,
            number,
            number,
          ];
          const fin = new Date(Date.UTC(anio, mes - 1, dia + datos.dias - 1))
            .toISOString()
            .slice(0, 10);
          const alertas: IncapacidadResponse['alertas'] = [];
          if (acumulado >= 540)
            alertas.push({ code: 'ACUMULADO_540_DIAS', mensaje: `Acumula ${acumulado} días.` });
          else if (acumulado >= 180)
            alertas.push({ code: 'ACUMULADO_180_DIAS', mensaje: `Acumula ${acumulado} días.` });
          else if (acumulado >= 150)
            alertas.push({ code: 'ACUMULADO_150_DIAS', mensaje: `Acumula ${acumulado} días.` });
          const nueva: IncapacidadResponse = {
            id: crypto.randomUUID(),
            casoId: c.detalle.resumen.id,
            tipo: datos.tipo,
            fechaInicio: datos.fechaInicio,
            fechaFin: fin,
            dias: datos.dias,
            diasAcumulados: acumulado,
            estado: 'REGISTRADA',
            soporteId: crypto.randomUUID(),
            alertas,
          };
          db.incapacidades.push(nueva);
          db.idempotencia.set(clave, nueva);
          return creado(nueva);
        });
      },
    },
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId/incapacidades/:incapacidadId/soporte',
      manejar: (p) =>
        conCasoClinico(p, 'clinico:read', { lectura: true }, (c) => {
          const inc = db.incapacidades.find(
            (x) => x.id === p.params['incapacidadId'] && x.casoId === c.detalle.resumen.id,
          );
          if (!inc) return noEncontrado('Clinico.SoporteNoEncontrado', 'El soporte no existe.');
          const pdf = new Blob(['%PDF-1.4\n% Soporte de prueba (mock)\n%%EOF\n'], {
            type: 'application/pdf',
          });
          return {
            status: 200,
            body: pdf,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="incapacidad-${inc.id.slice(-4)}.pdf"`,
              'Cache-Control': 'no-store',
            },
          };
        }),
    },

    /* ---------- clínico 🔒 ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId/registros-clinicos',
      manejar: (p) =>
        conCasoClinico(p, 'clinico:read', { lectura: true }, (c) =>
          ok(db.registrosClinicos.filter((r) => r.casoId === c.detalle.resumen.id)),
        ),
    },
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId/registros-clinicos/:registroId',
      manejar: (p) =>
        conCasoClinico(p, 'clinico:read', { lectura: true }, (c) => {
          const r = db.registrosClinicos.find(
            (x) => x.id === p.params['registroId'] && x.casoId === c.detalle.resumen.id,
          );
          return r ? ok(r) : noEncontrado('Clinico.RegistroNoEncontrado', 'El registro no existe.');
        }),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/registros-clinicos',
      manejar: (p) =>
        conCasoClinico(p, 'clinico:write', { lectura: false }, async (c, a) => {
          const body = await cuerpoJson<RegistroClinicoRequest>(p.req);
          if (!body) return problema(400, 'General.Validation', 'El cuerpo es obligatorio.');
          const contenido = body.contenido ?? {};
          const conTexto = [
            contenido.motivo,
            contenido.anamnesis,
            contenido.examenFisico,
            contenido.analisis,
            contenido.plan,
          ].some((t) => typeof t === 'string' && t.trim() !== '');
          if (!conTexto) {
            return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
              errors: [
                {
                  code: 'contenido',
                  description:
                    'Escribe al menos uno: motivo, anamnesis, examen físico, análisis o plan.',
                },
              ],
            });
          }
          if (Date.parse(body.atendidoEn) > ahora()) {
            return problema(
              400,
              'Clinico.AtendidoEnFuturo',
              'El momento de la atención no puede ser futuro.',
            );
          }
          // Backend `RegistroClinicoEscritura.AdmiteRegistro` and the token's professional identity.
          if (!a.claims['rethus'] || !a.claims['tipo_documento'] || !a.claims['numero_documento']) {
            return problema(
              403,
              'Clinico.ProfesionalSinRegistro',
              'El token no trae la identidad del profesional (rethus, tipo_documento y numero_documento).',
            );
          }
          const estado = c.detalle.resumen.estado;
          if (estado === 'Rechazado' || estado === 'Cerrado') {
            return problema(
              409,
              'Clinico.CasoNoAdmiteRegistros',
              'El caso está rechazado o cerrado y no admite registros clínicos nuevos.',
            );
          }
          if (Date.parse(body.atendidoEn) < Date.parse(c.detalle.resumen.fechaEvento) - DIA_MS) {
            return problema(
              400,
              'Clinico.FechaAtencionAnteriorAlEvento',
              'El momento de la atención es anterior a la fecha del evento del caso.',
            );
          }
          const registradoEn = iso();
          const id = crypto.randomUUID();
          if (body.corrigeA) {
            const corregido = db.registrosClinicos.find((r) => r.id === body.corrigeA);
            if (!corregido)
              return noEncontrado('Clinico.RegistroNoEncontrado', 'El registro no existe.');
            corregido.corregidoPor = id;
          }
          db.registrosClinicos.push({
            id,
            casoId: c.detalle.resumen.id,
            tipo: body.tipo,
            profesional: {
              sub: a.sub,
              tipoDocumento: String(a.claims['tipo_documento'] ?? 'CC'),
              numeroDocumento: String(a.claims['numero_documento'] ?? ''),
              registroRethus: (a.claims['rethus'] as string | undefined) ?? null,
            },
            atendidoEn: body.atendidoEn,
            registradoEn,
            retenerHasta: '2046-12-31',
            corrigeA: body.corrigeA ?? null,
            corregidoPor: null,
            contenido,
          });
          return creado({ registroId: id, casoId: c.detalle.resumen.id, registradoEn });
        }),
    },

    /* ---------- dictamen PCL 🔒 ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/casos/:casoId/dictamen-pcl',
      manejar: (p) =>
        conCasoClinico(
          p,
          'pcl:dictamen:read',
          { lectura: true, maxAgeSeg: MAX_AGE_DICTAMEN_SEG },
          (c) => {
            const d = vigente(db.dictamenes, c.detalle.resumen.id);
            return d
              ? ok(d)
              : noEncontrado('Dictamen.NoEncontrado', 'El caso no tiene dictamen registrado.');
          },
        ),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/dictamen-pcl',
      manejar: (p) =>
        conCasoClinico(
          p,
          'pcl:dictamen:write',
          { lectura: false, maxAgeSeg: MAX_AGE_DICTAMEN_SEG },
          async (c, a) => {
            const body = await cuerpoJson<RegistrarDictamenPclRequest>(p.req);
            if (!body) return problema(400, 'General.Validation', 'El cuerpo es obligatorio.');
            const actual = vigente(db.dictamenes, c.detalle.resumen.id);
            if (actual && !body.corrigeA) {
              return problema(
                409,
                'Dictamen.YaExiste',
                'El caso ya tiene un dictamen vigente. Para corregirlo, indique su id en corrigeA.',
              );
            }
            if (
              body.corrigeA &&
              (actual?.id !== body.corrigeA || actual.estadoNotificacion !== 'PENDIENTE')
            ) {
              return actual?.id === body.corrigeA
                ? problema(
                    409,
                    'Dictamen.YaNotificado',
                    'El dictamen ya se notificó y no admite correcciones.',
                  )
                : problema(
                    409,
                    'Dictamen.CorrigeANoVigente',
                    'Solo se corrige el dictamen vigente sin notificar.',
                  );
            }
            const errores = validarDictamen(body, diaBogota(ahora()));
            if (errores.length) {
              return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
                errors: errores,
              });
            }
            const nuevo: DictamenPclResponse = {
              id: crypto.randomUUID(),
              casoId: c.detalle.resumen.id,
              porcentajePcl: body.porcentajePcl,
              origen: body.origen,
              fechaEstructuracion: body.fechaEstructuracion,
              fechaDictamen: body.fechaDictamen,
              manual: 'Decreto 1507/2014',
              componentes: body.componentes ?? null,
              fundamentos: body.fundamentos,
              diagnosticos: body.diagnosticos.map(({ sistema, codigo }) => ({ sistema, codigo })),
              calificador: {
                identificacion: {
                  tipo: (a.claims['tipo_documento'] as 'CC' | undefined) ?? 'CC',
                  numero: String(a.claims['numero_documento'] ?? ''),
                },
                nombreCompleto: null,
                registroRethus: String(a.claims['rethus'] ?? ''),
              },
              estadoNotificacion: 'PENDIENTE',
              venceControversiaEn: null,
              corrigeA: body.corrigeA ?? null,
            };
            db.dictamenes.push(nuevo);
            // Same transaction as the backend: the case's calificación and its state.
            c.detalle.resumen.tieneCalificacion = true;
            c.detalle.resumen.porcentajePcl = nuevo.porcentajePcl;
            c.detalle.resumen.estado = 'EnCalificacionPcl';
            return creado(nuevo);
          },
        ),
    },
    {
      metodo: 'POST',
      ruta: '/v1/casos/:casoId/dictamen-pcl/notificar',
      manejar: (p) =>
        conCasoClinico(
          p,
          'pcl:dictamen:write',
          { lectura: false, maxAgeSeg: MAX_AGE_DICTAMEN_SEG },
          async (c) => {
            const d = vigente(db.dictamenes, c.detalle.resumen.id);
            if (!d)
              return noEncontrado('Dictamen.NoEncontrado', 'El caso no tiene dictamen registrado.');
            if (d.estadoNotificacion !== 'PENDIENTE') {
              return problema(409, 'Dictamen.YaNotificado', 'El dictamen ya fue notificado.');
            }
            const body = await cuerpoJson<NotificarDictamenPclRequest>(p.req);
            if (!body?.medio || !MEDIOS_NOTIFICACION.has(body.medio)) {
              return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
                errors: [
                  {
                    code: 'Dictamen.MedioInvalido',
                    description: 'Debe ser CORREO_CERTIFICADO, ELECTRONICO o PERSONAL.',
                  },
                ],
              });
            }
            const notificadoEn = Date.parse(body.notificadoEn ?? '');
            if (
              !Number.isFinite(notificadoEn) ||
              notificadoEn > ahora() ||
              diaBogota(notificadoEn) < d.fechaDictamen
            ) {
              return problema(
                400,
                'Dictamen.NotificacionFueraDeRango',
                'La notificación no puede ser futura ni anterior a la fecha del dictamen.',
              );
            }
            d.estadoNotificacion = 'NOTIFICADO';
            // The backend opens CONTROVERSIA_DICTAMEN from the outbox event: 10 days here.
            const vence = notificadoEn + 10 * DIA_MS;
            d.venceControversiaEn = diaBogota(vence);
            db.plazos.push({
              id: crypto.randomUUID(),
              casoId: c.detalle.resumen.id,
              radicado: c.detalle.resumen.radicado,
              regla: 'CONTROVERSIA_DICTAMEN',
              baseLegal: 'Decreto 1352 de 2013',
              referenciaId: d.id,
              iniciaEn: new Date(notificadoEn).toISOString(),
              venceEn: new Date(vence).toISOString(),
              alertaEn: new Date(vence - 3 * DIA_MS).toISOString(),
              estado: 'ABIERTO',
              extemporaneo: false,
              cumplidoEn: null,
            });
            return sinContenido();
          },
        ),
    },

    /* ---------- solicitudes de copia HC ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/solicitudes-copia-hc',
      manejar: (p) => {
        const a = actor(p);
        if (!a.permisos.has('solicitudes-hc:gestionar')) return prohibido();
        const estado = p.query.get('estado');
        return ok(db.solicitudesCopiaHc.filter((s) => !estado || s.estado === estado));
      },
    },
    {
      metodo: 'POST',
      ruta: '/v1/solicitudes-copia-hc/:id/tramitar',
      manejar: (p) => {
        const a = actor(p);
        if (!a.permisos.has('solicitudes-hc:gestionar')) return prohibido();
        const s = db.solicitudesCopiaHc.find((x) => x.id === p.params['id']);
        if (!s) return noEncontrado('SolicitudCopiaHc.NoEncontrada', 'La solicitud no existe.');
        if (s.estado !== 'RECIBIDA') {
          return problema(
            409,
            'SolicitudCopiaHc.TransicionInvalida',
            'La solicitud ya está en trámite o cerrada.',
          );
        }
        s.estado = 'EN_TRAMITE';
        return sinContenido();
      },
    },
    {
      metodo: 'POST',
      ruta: '/v1/solicitudes-copia-hc/:id/cerrar',
      manejar: async (p) => {
        const a = actor(p);
        if (!a.permisos.has('solicitudes-hc:gestionar')) return prohibido();
        const s = db.solicitudesCopiaHc.find((x) => x.id === p.params['id']);
        if (!s) return noEncontrado('SolicitudCopiaHc.NoEncontrada', 'La solicitud no existe.');
        const body = await cuerpoJson<CerrarSolicitudCopiaHcRequest>(p.req);
        if (body?.resultado !== 'ENTREGADA' && body?.resultado !== 'RECHAZADA') {
          return problema(
            400,
            'SolicitudCopiaHc.ResultadoInvalido',
            'El resultado debe ser ENTREGADA o RECHAZADA.',
          );
        }
        if (!textoEntre(body.nota, 10, 1000)) {
          return problema(400, 'General.Validation', 'Uno o más datos no son válidos.', {
            errors: [
              { code: 'nota', description: 'La nota debe tener entre 10 y 1000 caracteres.' },
            ],
          });
        }
        if (s.estado !== 'EN_TRAMITE') {
          return problema(
            409,
            'SolicitudCopiaHc.TransicionInvalida',
            'Solo se cierran solicitudes en trámite.',
          );
        }
        Object.assign(s, {
          estado: body.resultado,
          notaAtencion: body.nota,
          atendidaEn: iso(),
          atendidaPor: a.sub,
        });
        return sinContenido();
      },
    },

    /* ---------- auditoría ---------- */
    {
      metodo: 'GET',
      ruta: '/v1/auditoria/accesos',
      manejar: (p) => {
        const a = actor(p);
        if (!a.permisos.has('auditoria:read')) return prohibido();
        const q = p.query;
        const desde = q.get('desde');
        const hasta = q.get('hasta');
        const items = db.accesos
          .filter((x) => !desde || Date.parse(x.ocurridoEn) >= Date.parse(desde))
          .filter((x) => !hasta || Date.parse(x.ocurridoEn) <= Date.parse(hasta))
          .filter((x) => !q.get('casoId') || x.casoMedicoId === q.get('casoId'))
          .filter((x) => !q.get('actorId') || x.actorId === q.get('actorId'))
          .filter((x) => !q.get('accion') || x.accion === q.get('accion'))
          .filter((x) => !q.get('resultado') || x.resultado === q.get('resultado'));
        return ok(paginar(items, q));
      },
    },
    {
      metodo: 'GET',
      ruta: '/v1/auditoria/revisiones-emergencia',
      manejar: (p) => {
        const a = actor(p);
        if (!a.permisos.has('auditoria:revisar')) return prohibido();
        const estado = p.query.get('estado');
        return ok(
          paginar(
            db.revisionesEmergencia.filter((r) => !estado || r.estado === estado),
            p.query,
          ),
        );
      },
    },
    {
      metodo: 'POST',
      ruta: '/v1/auditoria/revisiones-emergencia/:id/cerrar',
      manejar: async (p) => {
        const a = actor(p);
        if (!a.permisos.has('auditoria:revisar')) return prohibido();
        const r = db.revisionesEmergencia.find((x) => x.id === p.params['id']);
        if (!r) return noEncontrado('Auditoria.RevisionNoEncontrada', 'La revisión no existe.');
        if (r.estado === 'CERRADA') {
          return problema(409, 'Auditoria.RevisionYaCerrada', 'La revisión ya fue cerrada.');
        }
        const body = await cuerpoJson<CerrarRevisionEmergenciaRequest>(p.req);
        if (body?.conclusion !== 'JUSTIFICADO' && body?.conclusion !== 'INJUSTIFICADO') {
          return problema(400, 'General.Validation', 'Indica la conclusión de la revisión.', {
            errors: [{ code: 'conclusion', description: 'La conclusión es obligatoria.' }],
          });
        }
        Object.assign(r, {
          estado: 'CERRADA',
          conclusion: body.conclusion,
          observaciones: body.observaciones ?? null,
          revisadoEn: iso(),
          revisadoPor: a.sub,
        });
        return sinContenido();
      },
    },
  ];
  return rutas;
}

const MEDIOS_NOTIFICACION = new Set(['CORREO_CERTIFICADO', 'ELECTRONICO', 'PERSONAL']);

/** The calendar day in Colombia (UTC−5, no DST) of an instant. */
function diaBogota(ms: number): string {
  return new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** `RegistrarDictamenPclCommandValidator`: the same codes, as `errors: [{ code, description }]`. */
function validarDictamen(
  body: RegistrarDictamenPclRequest,
  hoy: string,
): { code: string; description: string }[] {
  const errores: { code: string; description: string }[] = [];
  const p = body.porcentajePcl;
  const dosDecimales = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
  if (typeof p !== 'number' || p < 0 || p > 100 || !dosDecimales(p)) {
    errores.push({
      code: 'Dictamen.PorcentajeFueraDeRango',
      description: 'El porcentaje de PCL va de 0 a 100, con dos decimales como máximo.',
    });
  }
  if (!['LABORAL', 'COMUN', 'MIXTO'].includes(body.origen)) {
    errores.push({
      code: 'Dictamen.OrigenInvalido',
      description: 'Debe ser LABORAL, COMUN o MIXTO.',
    });
  }
  const { fechaEstructuracion: e, fechaDictamen: d } = body;
  if (e && d && (e > d || d > hoy)) {
    errores.push({
      code: 'Dictamen.FechasInvalidas',
      description:
        'La fecha de estructuración no puede ser posterior a la del dictamen, ni la del dictamen futura.',
    });
  }
  const c = body.componentes;
  if (c && typeof p === 'number' && Math.abs(c.deficiencias + c.rolLaboralYOtrasAreas - p) > 0.01) {
    errores.push({
      code: 'Dictamen.ComponentesNoSuman',
      description:
        'deficiencias + rolLaboralYOtrasAreas debe ser igual al porcentaje de PCL (±0,01).',
    });
  }
  const largo = typeof body.fundamentos === 'string' ? body.fundamentos.length : 0;
  if (!body.fundamentos?.trim() || largo < 50 || largo > 20_000) {
    errores.push({
      code: 'Dictamen.FundamentosLongitud',
      description: 'Debe tener entre 50 y 20000 caracteres.',
    });
  }
  if (!body.diagnosticos?.length) {
    errores.push({
      code: 'Dictamen.DiagnosticoRequerido',
      description: 'Se requiere al menos un diagnóstico CIE-10.',
    });
  }
  return errores;
}

/** The current dictamen of a case: the latest one that no other dictamen corrects. */
function vigente(
  dictamenes: DictamenPclResponse[],
  casoId: string,
): DictamenPclResponse | undefined {
  const delCaso = dictamenes.filter((d) => d.casoId === casoId);
  const corregidos = new Set(delCaso.map((d) => d.corrigeA).filter(Boolean));
  return delCaso.filter((d) => !corregidos.has(d.id)).at(-1);
}
