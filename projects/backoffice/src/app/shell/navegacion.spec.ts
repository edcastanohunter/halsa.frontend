import { filtrarPorPermiso } from '../core/permisos/permisos';
import { navegacionPara } from './navegacion';

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
const PERSONAS: Record<string, string[]> = {
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

// Plan §6.3, top table, as navigation ids in display order.
const ESPERADO: Record<string, { barra: string[]; mas: string[] }> = {
  analista: { barra: ['inicio', 'casos', 'plazos'], mas: ['cuenta'] },
  'medico-laboral': { barra: ['inicio', 'casos', 'plazos'], mas: ['cuenta'] },
  calificador: { barra: ['inicio', 'casos', 'plazos'], mas: ['cuenta'] },
  privacidad: {
    barra: ['inicio', 'revisiones-emergencia', 'solicitudes-copia-hc', 'auditoria-accesos'],
    mas: ['cuenta'],
  },
  'medico-ips': { barra: ['inicio', 'casos'], mas: ['cuenta'] },
  'coordinador-ips': { barra: ['inicio', 'casos'], mas: ['cuenta'] },
};

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('navigation per persona (plan §6.3)', () => {
  it.each(Object.keys(PERSONAS))('%s sees exactly its column', (persona) => {
    const nav = navegacionPara(new Set(PERSONAS[persona]));
    expect({ barra: ids(nav.barra), mas: ids(nav.mas) }).toEqual(ESPERADO[persona]);
    // The sidebar shows the same sections, Cuenta last.
    expect(ids(nav.todos)).toEqual([...ESPERADO[persona]!.barra, ...ESPERADO[persona]!.mas]);
  });

  it('never puts more than 4 sections in the bottom bar; the rest go to "Más"', () => {
    const todo = new Set(Object.values(PERSONAS).flat());
    const nav = navegacionPara(todo);
    expect(nav.barra).toHaveLength(4);
    expect(ids(nav.mas)).toEqual(['plazos', 'auditoria-accesos', 'cuenta']);
  });

  it('a session without permissions still gets Inicio and Cuenta', () => {
    const nav = navegacionPara(new Set());
    expect(ids(nav.barra)).toEqual(['inicio']);
    expect(ids(nav.mas)).toEqual(['cuenta']);
  });
});

describe('filtrarPorPermiso', () => {
  const items = [
    { id: 'libre' },
    { id: 'uno', permiso: 'casos:read' as const },
    { id: 'alguno', permiso: ['auditoria:read', 'auditoria:revisar'] as const },
  ];

  it('keeps items without a permission and treats a list as "any of"', () => {
    expect(ids(filtrarPorPermiso(items, new Set(['auditoria:revisar'])))).toEqual([
      'libre',
      'alguno',
    ]);
    expect(ids(filtrarPorPermiso(items, new Set(['casos:read'])))).toEqual(['libre', 'uno']);
  });
});
