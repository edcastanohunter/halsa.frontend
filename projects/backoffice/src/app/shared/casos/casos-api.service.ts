import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CasoDetalleResponse,
  CasoResumenResponse,
  CodigoActivacionResponse,
  PagedList,
  RemisionCreadaResponse,
} from '@halsa/api-types';
import { API_PREFIX, EstadoCaso } from '@halsa/core';
import { Observable } from 'rxjs';

export interface FiltroCasos {
  estado?: EstadoCaso | null;
  page?: number;
  pageSize?: number;
}

/**
 * `/v1/casos*` (plan §4.3, Casos table). Shared because `/inicio` widgets read the same list as
 * `features/casos`, and features never import each other. HTTP only: no caching.
 */
@Injectable({ providedIn: 'root' })
export class CasosApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_PREFIX)}casos`;

  listar(filtro: FiltroCasos = {}): Observable<PagedList<CasoResumenResponse>> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.page) params = params.set('page', filtro.page);
    if (filtro.pageSize) params = params.set('pageSize', filtro.pageSize);
    return this.http.get<PagedList<CasoResumenResponse>>(this.base, { params });
  }

  detalle(casoId: string): Observable<CasoDetalleResponse> {
    return this.http.get<CasoDetalleResponse>(`${this.base}/${encodeURIComponent(casoId)}`);
  }

  asignar(casoId: string, sub: string): Observable<void> {
    return this.http.post<void>(`${this.caso(casoId)}/asignaciones`, { sub });
  }

  desasignar(casoId: string, sub: string): Observable<void> {
    return this.http.delete<void>(`${this.caso(casoId)}/asignaciones/${encodeURIComponent(sub)}`);
  }

  remitir(casoId: string, ipsId: string): Observable<RemisionCreadaResponse> {
    return this.http.post<RemisionCreadaResponse>(`${this.caso(casoId)}/remisiones`, { ipsId });
  }

  revocarRemision(casoId: string, remisionId: string): Observable<void> {
    return this.http.post<void>(
      `${this.caso(casoId)}/remisiones/${encodeURIComponent(remisionId)}/revocar`,
      null,
    );
  }

  generarCodigoActivacion(casoId: string): Observable<CodigoActivacionResponse> {
    return this.http.post<CodigoActivacionResponse>(
      `${this.caso(casoId)}/codigos-activacion`,
      null,
    );
  }

  private caso(casoId: string): string {
    return `${this.base}/${encodeURIComponent(casoId)}`;
  }
}
