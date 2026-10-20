import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CumplirPlazoRequest, PagedList, PlazoResponse } from '@halsa/api-types';
import { API_PREFIX, EstadoPlazo } from '@halsa/core';
import { Observable } from 'rxjs';

export interface FiltroPlazos {
  estado?: EstadoPlazo | null;
  regla?: string | null;
  /** ISO instant with offset (`finDelDiaBogota` for a calendar date). */
  venceAntesDe?: string | null;
  page?: number;
  pageSize?: number;
}

/**
 * `/v1/plazos` and `/v1/casos/{id}/plazos*` (plan §4.3, Plazos table). Shared by the tenant board,
 * the case tab and the `/inicio` widgets. HTTP only.
 */
@Injectable({ providedIn: 'root' })
export class PlazosApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  listar(filtro: FiltroPlazos = {}): Observable<PagedList<PlazoResponse>> {
    let params = new HttpParams();
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.regla) params = params.set('regla', filtro.regla);
    if (filtro.venceAntesDe) params = params.set('venceAntesDe', filtro.venceAntesDe);
    if (filtro.page) params = params.set('page', filtro.page);
    if (filtro.pageSize) params = params.set('pageSize', filtro.pageSize);
    return this.http.get<PagedList<PlazoResponse>>(`${this.prefijo}plazos`, { params });
  }

  delCaso(casoId: string): Observable<PlazoResponse[]> {
    return this.http.get<PlazoResponse[]>(
      `${this.prefijo}casos/${encodeURIComponent(casoId)}/plazos`,
    );
  }

  cumplir(casoId: string, plazoId: string, cuerpo: CumplirPlazoRequest): Observable<void> {
    return this.http.post<void>(
      `${this.prefijo}casos/${encodeURIComponent(casoId)}/plazos/${encodeURIComponent(plazoId)}/cumplir`,
      cuerpo,
    );
  }
}
