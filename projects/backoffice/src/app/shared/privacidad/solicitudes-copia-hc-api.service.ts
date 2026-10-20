import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CerrarSolicitudCopiaHcRequest, SolicitudCopiaHcResponse } from '@halsa/api-types';
import { API_PREFIX, EstadoSolicitudCopiaHc } from '@halsa/core';
import { Observable } from 'rxjs';

/**
 * `/v1/solicitudes-copia-hc*` (plan §4.3, staff inbox). Not paginated: the API returns the
 * tenant's requests oldest first, the order their deadline runs. Shared by the inbox and the
 * `/inicio` widget. HTTP only.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesCopiaHcApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  listar(estado?: EstadoSolicitudCopiaHc | null): Observable<SolicitudCopiaHcResponse[]> {
    const params = estado ? new HttpParams().set('estado', estado) : undefined;
    return this.http.get<SolicitudCopiaHcResponse[]>(`${this.prefijo}solicitudes-copia-hc`, {
      params,
    });
  }

  /** RECIBIDA → EN_TRAMITE. */
  tramitar(id: string): Observable<void> {
    return this.http.post<void>(
      `${this.prefijo}solicitudes-copia-hc/${encodeURIComponent(id)}/tramitar`,
      null,
    );
  }

  /** From RECIBIDA or EN_TRAMITE to ENTREGADA or RECHAZADA. */
  cerrar(id: string, cuerpo: CerrarSolicitudCopiaHcRequest): Observable<void> {
    return this.http.post<void>(
      `${this.prefijo}solicitudes-copia-hc/${encodeURIComponent(id)}/cerrar`,
      cuerpo,
    );
  }
}
