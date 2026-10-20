import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CasoPacienteResponse,
  CrearSolicitudCopiaHcRequest,
  HitoResponse,
  IncapacidadPacienteResponse,
  ResumenPacienteResponse,
  SolicitudCopiaHcPacienteResponse,
  VinculoCreadoResponse,
} from '@halsa/api-types';
import { Observable } from 'rxjs';

const API = '/paciente/api/';

/**
 * `/paciente/api/*` through the BFF (plan §4.3, portal table): same origin, cookie session, CSRF
 * header from `csrfInterceptor`. HTTP only. None of these responses carries diagnoses,
 * percentages or rationales; the portal never asks for them.
 */
@Injectable({ providedIn: 'root' })
export class PacienteApi {
  private readonly http = inject(HttpClient);

  /** Redeems an activation code. Rate limited (`429`), see the activation page. */
  vincular(codigo: string): Observable<VinculoCreadoResponse> {
    return this.http.post<VinculoCreadoResponse>(`${API}vinculos`, { codigo });
  }

  resumen(): Observable<ResumenPacienteResponse> {
    return this.http.get<ResumenPacienteResponse>(`${API}resumen`);
  }

  /** Every linked case, of any ARL. */
  misCasos(): Observable<CasoPacienteResponse[]> {
    return this.http.get<CasoPacienteResponse[]>(`${API}mis-casos`);
  }

  /** `404` when the case isn't linked to this account. */
  lineaTiempo(casoId: string): Observable<HitoResponse[]> {
    return this.http.get<HitoResponse[]>(`${API}casos/${encodeURIComponent(casoId)}/linea-tiempo`);
  }

  incapacidades(): Observable<IncapacidadPacienteResponse[]> {
    return this.http.get<IncapacidadPacienteResponse[]>(`${API}incapacidades`);
  }

  solicitudes(): Observable<SolicitudCopiaHcPacienteResponse[]> {
    return this.http.get<SolicitudCopiaHcPacienteResponse[]>(`${API}solicitudes-copia-hc`);
  }

  /** `409 SolicitudCopiaHc.YaAbierta` while another request of the case is open. */
  solicitarCopia(
    casoId: string,
    cuerpo: CrearSolicitudCopiaHcRequest,
  ): Observable<SolicitudCopiaHcPacienteResponse> {
    return this.http.post<SolicitudCopiaHcPacienteResponse>(
      `${API}casos/${encodeURIComponent(casoId)}/solicitudes-copia-hc`,
      cuerpo,
    );
  }
}
