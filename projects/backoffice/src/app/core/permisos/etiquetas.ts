import { Permiso } from './permisos';

export const PERMISO_LABELS: Record<Permiso, string> = {
  'casos:read': 'Ver casos',
  'casos:write': 'Remitir casos a IPS',
  'casos:asignar': 'Asignar profesionales a casos',
  'incapacidades:read': 'Ver incapacidades',
  'incapacidades:write': 'Cargar incapacidades',
  'plazos:read': 'Ver plazos',
  'plazos:write': 'Marcar plazos como cumplidos',
  'clinico:read': 'Ver la historia clínica',
  'clinico:write': 'Registrar en la historia clínica',
  'clinico:emergencia': 'Acceso de emergencia a la historia clínica',
  'pcl:dictamen:read': 'Ver el dictamen PCL',
  'pcl:dictamen:write': 'Registrar y notificar el dictamen PCL',
  'auditoria:read': 'Ver la auditoría de accesos',
  'auditoria:export': 'Exportar la auditoría',
  'auditoria:revisar': 'Revisar accesos de emergencia',
  'pacientes:activar': 'Generar códigos de activación del portal',
  'solicitudes-hc:gestionar': 'Gestionar solicitudes de copia de la historia clínica',
};

/** Areas for the Cuenta page (plan §7.1), keyed by the permission's first segment. */
const AREAS: Record<string, string> = {
  casos: 'Casos',
  plazos: 'Plazos',
  incapacidades: 'Incapacidades',
  clinico: 'Clínico',
  pcl: 'Dictamen PCL',
  pacientes: 'Portal del paciente',
  auditoria: 'Auditoría',
  'solicitudes-hc': 'Solicitudes de copia HC',
};

export interface GrupoPermisos {
  area: string;
  permisos: { codigo: string; etiqueta: string }[];
}

/**
 * Groups `identidad/yo` permissions by area, in a stable order. Role names without `:` (Keycloak
 * composites such as `analista-arl`) aren't permissions and are skipped; unknown permissions keep
 * their code as the label and land in "Otros".
 */
export function agruparPermisos(permisos: Iterable<string>): GrupoPermisos[] {
  const orden = Object.keys(AREAS);
  const grupos = new Map<string, GrupoPermisos>();
  for (const codigo of [...new Set(permisos)].filter((p) => p.includes(':')).sort()) {
    const clave = codigo.split(':')[0]!;
    const area = AREAS[clave] ?? 'Otros';
    const grupo = grupos.get(area) ?? { area, permisos: [] };
    grupo.permisos.push({ codigo, etiqueta: PERMISO_LABELS[codigo as Permiso] ?? codigo });
    grupos.set(area, grupo);
  }
  const posicion = (area: string) => {
    const i = orden.findIndex((clave) => AREAS[clave] === area);
    return i === -1 ? orden.length : i;
  };
  return [...grupos.values()].sort((a, b) => posicion(a.area) - posicion(b.area));
}
