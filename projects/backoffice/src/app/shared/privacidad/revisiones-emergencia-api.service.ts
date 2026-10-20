import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CerrarRevisionEmergenciaRequest,
  PagedList,
  RevisionEmergenciaResponse,
} from '@halsa/api-types';
import { API_PREFIX, EstadoRevisionEmergencia } from '@halsa/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';

/** Backend `ListRevisionesEmergenciaQuery.PageSizeMaximo`. */
export const TAMANO_MAXIMO_REVISIONES = 200;
/** Safety cap of `pendientes()`: pending reviews last 72 h, so 1 000 is far beyond a real queue. */
const PAGINAS_MAXIMAS_PENDIENTES = 5;

export interface FiltroRevisiones {
  estado?: EstadoRevisionEmergencia | null;
  page?: number;
  pageSize?: number;
}

/** Soonest deadline first; overdue ones lead. */
export function porVencimiento(a: RevisionEmergenciaResponse, b: RevisionEmergenciaResponse) {
  return Date.parse(a.venceRevisionEn) - Date.parse(b.venceRevisionEn);
}

/**
 * `/v1/auditoria/revisiones-emergencia*` (plan §4.3, Auditoría). Shared by the reviews page and
 * the `/inicio` widget. HTTP only.
 */
@Injectable({ providedIn: 'root' })
export class RevisionesEmergenciaApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  listar(filtro: FiltroRevisiones = {}): Observable<PagedList<RevisionEmergenciaResponse>> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.page) params = params.set('page', filtro.page);
    if (filtro.pageSize) params = params.set('pageSize', filtro.pageSize);
    return this.http.get<PagedList<RevisionEmergenciaResponse>>(
      `${this.prefijo}auditoria/revisiones-emergencia`,
      { params },
    );
  }

  /**
   * Every pending review, soonest deadline first, with the server's total. The API sorts by
   * `ocurridoEn` newest first, so the most urgent ones sit on the *last* page (gap G21): the queue
   * is read whole, in pages of 200, and sorted here.
   */
  pendientes(): Observable<{ items: RevisionEmergenciaResponse[]; total: number }> {
    const pagina = (page: number) =>
      this.listar({ estado: 'PENDIENTE', page, pageSize: TAMANO_MAXIMO_REVISIONES });
    return pagina(1).pipe(
      expand((p) =>
        p.hasNextPage && p.page < PAGINAS_MAXIMAS_PENDIENTES ? pagina(p.page + 1) : EMPTY,
      ),
      reduce((acc, p) => ({ items: [...acc.items, ...p.items], total: p.totalCount }), {
        items: [] as RevisionEmergenciaResponse[],
        total: 0,
      }),
      map(({ items, total }) => ({ items: [...items].sort(porVencimiento), total })),
    );
  }

  cerrar(id: string, cuerpo: CerrarRevisionEmergenciaRequest): Observable<void> {
    return this.http.post<void>(
      `${this.prefijo}auditoria/revisiones-emergencia/${encodeURIComponent(id)}/cerrar`,
      cuerpo,
    );
  }
}
