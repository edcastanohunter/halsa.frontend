import { computed, inject, Injectable } from '@angular/core';
import { SesionService } from '../sesion/sesion.service';

/** Staff permissions a human UI uses (backend `Permissions.cs`; integration ones excluded). */
export type Permiso =
  | 'casos:read'
  | 'casos:write'
  | 'casos:asignar'
  | 'incapacidades:read'
  | 'incapacidades:write'
  | 'plazos:read'
  | 'plazos:write'
  | 'clinico:read'
  | 'clinico:write'
  | 'clinico:emergencia'
  | 'pcl:dictamen:read'
  | 'pcl:dictamen:write'
  | 'auditoria:read'
  | 'auditoria:export'
  | 'auditoria:revisar'
  | 'pacientes:activar'
  | 'solicitudes-hc:gestionar';

/** Anything shown only with a permission: nav items, tabs, widgets, buttons (plan §5.1.2). */
export interface ConPermiso {
  /** Required permission; with a list, any one of them. Absent: every authenticated user. */
  permiso?: Permiso | readonly Permiso[];
}

export function cumplePermiso(item: ConPermiso, permisos: ReadonlySet<string>): boolean {
  const requerido = item.permiso;
  if (requerido === undefined) return true;
  return typeof requerido === 'string'
    ? permisos.has(requerido)
    : requerido.some((p) => permisos.has(p));
}

/** The one place where declared items are filtered by permission. */
export function filtrarPorPermiso<T extends ConPermiso>(
  items: readonly T[],
  permisos: ReadonlySet<string>,
): T[] {
  return items.filter((item) => cumplePermiso(item, permisos));
}

const NINGUNO: ReadonlySet<string> = new Set();

/**
 * Reactive permission checks from `identidad/yo`. The backend stays the authority: a visible
 * control can still get a 403/404, which every action handles.
 */
@Injectable({ providedIn: 'root' })
export class PermisosService {
  private readonly sesion = inject(SesionService);

  readonly permisos = computed(() => this.sesion.sesion()?.permisos ?? NINGUNO);

  puede(permiso: Permiso): boolean {
    return this.permisos().has(permiso);
  }

  puedeAlguno(...permisos: Permiso[]): boolean {
    return permisos.some((p) => this.permisos().has(p));
  }

  filtrar<T extends ConPermiso>(items: readonly T[]): T[] {
    return filtrarPorPermiso(items, this.permisos());
  }
}
