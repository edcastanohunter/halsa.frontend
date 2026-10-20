import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { AccesoAuditadoResponse, PagedList } from '@halsa/api-types';
import { API_PREFIX } from '@halsa/core';
import { Observable } from 'rxjs';
import { ConsultaAccesos } from '../filtros';

/** `GET /v1/auditoria/accesos` (plan §4.3, Auditoría). HTTP only. */
@Injectable({ providedIn: 'root' })
export class AccesosAuditadosApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  listar(consulta: ConsultaAccesos): Observable<PagedList<AccesoAuditadoResponse>> {
    let params = new HttpParams()
      .set('desde', consulta.desde)
      .set('hasta', consulta.hasta)
      .set('page', consulta.page)
      .set('pageSize', consulta.pageSize);
    if (consulta.casoId) params = params.set('casoId', consulta.casoId);
    if (consulta.actorId) params = params.set('actorId', consulta.actorId);
    if (consulta.accion) params = params.set('accion', consulta.accion);
    if (consulta.resultado) params = params.set('resultado', consulta.resultado);
    return this.http.get<PagedList<AccesoAuditadoResponse>>(`${this.prefijo}auditoria/accesos`, {
      params,
    });
  }
}
