import {
  lucideCalendarClock,
  lucideCircleUser,
  lucideFolderOpen,
  lucideHouse,
  lucideInbox,
  lucideScrollText,
  lucideShieldAlert,
} from '@ng-icons/lucide';
import { ConPermiso, filtrarPorPermiso } from '../core/permisos/permisos';

export interface ItemNavegacion extends ConPermiso {
  id: string;
  etiqueta: string;
  /** Bottom-bar label at 375 px; the full `etiqueta` stays the accessible name. */
  etiquetaCorta?: string;
  ruta: string;
  icono: string;
}

export const ICONOS_NAVEGACION = {
  lucideHouse,
  lucideFolderOpen,
  lucideCalendarClock,
  lucideInbox,
  lucideScrollText,
  lucideShieldAlert,
  lucideCircleUser,
};

/**
 * Plan §6.3, in priority order: inbox items (deadline-bound reviews and requests) come right after
 * Inicio, so the privacy officer's queues fit in the bottom bar. Cuenta always closes the list.
 */
export const NAVEGACION: readonly ItemNavegacion[] = [
  { id: 'inicio', etiqueta: 'Inicio', ruta: '/inicio', icono: 'lucideHouse' },
  {
    id: 'revisiones-emergencia',
    etiqueta: 'Revisiones de emergencia',
    etiquetaCorta: 'Revisiones',
    ruta: '/auditoria/revisiones-emergencia',
    icono: 'lucideShieldAlert',
    permiso: 'auditoria:revisar',
  },
  {
    id: 'solicitudes-copia-hc',
    etiqueta: 'Solicitudes HC',
    etiquetaCorta: 'Solicitudes',
    ruta: '/solicitudes-copia-hc',
    icono: 'lucideInbox',
    permiso: 'solicitudes-hc:gestionar',
  },
  {
    id: 'casos',
    etiqueta: 'Casos',
    ruta: '/casos',
    icono: 'lucideFolderOpen',
    permiso: 'casos:read',
  },
  {
    id: 'plazos',
    etiqueta: 'Plazos',
    ruta: '/plazos',
    icono: 'lucideCalendarClock',
    permiso: 'plazos:read',
  },
  {
    id: 'auditoria-accesos',
    etiqueta: 'Auditoría',
    ruta: '/auditoria/accesos',
    icono: 'lucideScrollText',
    permiso: 'auditoria:read',
  },
  { id: 'cuenta', etiqueta: 'Cuenta', ruta: '/cuenta', icono: 'lucideCircleUser' },
];

/** Bottom bar slots before "Más" (plan §6.3: at most 4 items + "Más"). */
export const MAX_BARRA_INFERIOR = 4;

export interface NavegacionPersona {
  /** Sidebar (≥ 1024 px): everything the persona can open. */
  todos: ItemNavegacion[];
  /** Bottom bar (< 1024 px). Cuenta never takes a slot: it lives in "Más" and the avatar menu. */
  barra: ItemNavegacion[];
  /** The "Más" sheet: the overflow, then Cuenta. */
  mas: ItemNavegacion[];
}

export function navegacionPara(permisos: ReadonlySet<string>): NavegacionPersona {
  const todos = filtrarPorPermiso(NAVEGACION, permisos);
  const secciones = todos.filter((item) => item.id !== 'cuenta');
  const cuenta = todos.filter((item) => item.id === 'cuenta');
  return {
    todos,
    barra: secciones.slice(0, MAX_BARRA_INFERIOR),
    mas: [...secciones.slice(MAX_BARRA_INFERIOR), ...cuenta],
  };
}
