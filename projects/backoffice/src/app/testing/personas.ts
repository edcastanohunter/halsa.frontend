// Test helpers only (imported by *.spec.ts files).
// Plan §6.1: effective permissions of each halsa-api role. medico-laboral has no dev user (gap
// G12), so this table is its only check.
const MEDICO_LABORAL = [
  'casos:read',
  'casos:write',
  'incapacidades:read',
  'incapacidades:write',
  'plazos:read',
  'clinico:read',
  'clinico:write',
];
export const PERSONAS: Record<string, string[]> = {
  analista: [
    'casos:read',
    'casos:write',
    'casos:asignar',
    'incapacidades:read',
    'plazos:read',
    'plazos:write',
    'pacientes:activar',
  ],
  'medico-laboral': MEDICO_LABORAL,
  calificador: [...MEDICO_LABORAL, 'pcl:dictamen:read', 'pcl:dictamen:write', 'clinico:emergencia'],
  privacidad: [
    'auditoria:read',
    'auditoria:export',
    'auditoria:revisar',
    'solicitudes-hc:gestionar',
  ],
  'medico-ips': [
    'casos:read',
    'incapacidades:read',
    'incapacidades:write',
    'clinico:read',
    'clinico:write',
  ],
  'coordinador-ips': ['casos:read', 'casos:asignar'],
};
