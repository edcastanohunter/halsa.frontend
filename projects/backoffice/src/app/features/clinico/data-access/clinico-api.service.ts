import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  RegistroClinicoCreadoResponse,
  RegistroClinicoRequest,
  RegistroClinicoResponse,
} from '@halsa/api-types';
import { API_PREFIX } from '@halsa/core';
import { Observable } from 'rxjs';

/** Break-the-glass header (plan §5.1.5). Reads only; writes never carry it. */
export const CABECERA_MOTIVO_ACCESO = 'Halsa-Motivo-Acceso';

/**
 * `/v1/casos/{id}/registros-clinicos*` 🔒 (plan §4.3). Provided by the historia clínica page, not
 * in root: it lives and dies with the clinical view. HTTP only, nothing is cached.
 */
@Injectable()
export class ClinicoApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  listar(casoId: string, motivo: string | null): Observable<RegistroClinicoResponse[]> {
    return this.http.get<RegistroClinicoResponse[]>(this.base(casoId), {
      headers: this.cabeceras(motivo),
    });
  }

  obtener(
    casoId: string,
    registroId: string,
    motivo: string | null,
  ): Observable<RegistroClinicoResponse> {
    return this.http.get<RegistroClinicoResponse>(
      `${this.base(casoId)}/${encodeURIComponent(registroId)}`,
      { headers: this.cabeceras(motivo) },
    );
  }

  registrar(
    casoId: string,
    cuerpo: RegistroClinicoRequest,
  ): Observable<RegistroClinicoCreadoResponse> {
    return this.http.post<RegistroClinicoCreadoResponse>(this.base(casoId), cuerpo);
  }

  private base(casoId: string): string {
    return `${this.prefijo}casos/${encodeURIComponent(casoId)}/registros-clinicos`;
  }

  /** The motivo is already ASCII (transliterated by the emergency dialog, gap G10). */
  private cabeceras(motivo: string | null): HttpHeaders {
    const cabeceras = new HttpHeaders();
    return motivo ? cabeceras.set(CABECERA_MOTIVO_ACCESO, motivo) : cabeceras;
  }
}
