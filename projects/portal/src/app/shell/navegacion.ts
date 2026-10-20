import {
  lucideCalendarDays,
  lucideCircleUser,
  lucideFileText,
  lucideFolderOpen,
  lucideHouse,
} from '@ng-icons/lucide';

export interface ItemNavegacion {
  id: string;
  etiqueta: string;
  ruta: string;
  icono: string;
}

export const ICONOS_NAVEGACION = {
  lucideHouse,
  lucideFolderOpen,
  lucideCalendarDays,
  lucideFileText,
  lucideCircleUser,
};

/**
 * Plan §6.4: the same five sections in the bottom tab bar (mobile) and the top nav (desktop).
 * Only a linked account sees them; before that the patient can only activate or leave.
 */
export const NAVEGACION: readonly ItemNavegacion[] = [
  { id: 'inicio', etiqueta: 'Inicio', ruta: '/inicio', icono: 'lucideHouse' },
  { id: 'casos', etiqueta: 'Casos', ruta: '/casos', icono: 'lucideFolderOpen' },
  {
    id: 'incapacidades',
    etiqueta: 'Incapacidades',
    ruta: '/incapacidades',
    icono: 'lucideCalendarDays',
  },
  { id: 'solicitudes', etiqueta: 'Solicitudes', ruta: '/solicitudes', icono: 'lucideFileText' },
  { id: 'cuenta', etiqueta: 'Cuenta', ruta: '/cuenta', icono: 'lucideCircleUser' },
];
