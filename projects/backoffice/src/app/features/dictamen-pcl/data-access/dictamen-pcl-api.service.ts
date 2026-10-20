import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  DictamenPclResponse,
  NotificarDictamenPclRequest,
  RegistrarDictamenPclRequest,
} from '@halsa/api-types';
import { API_PREFIX } from '@halsa/core';
import { Observable } from 'rxjs';

/** Break-the-glass header (plan §5.1.5). Reads only; writes never carry it. */
export const CABECERA_MOTIVO_ACCESO = 'Halsa-Motivo-Acceso';

/**
 * `/v1/casos/{id}/dictamen-pcl*` 🔒 (plan §4.3): `acr=2` and `auth_time` within 15 minutes.
 * Provided by the dictamen page, not in root: it lives and dies with that view. Nothing cached.
 */
@Injectable()
export class DictamenPclApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  obtener(casoId: string, motivo: string | null): Observable<DictamenPclResponse> {
    const cabeceras = new HttpHeaders();
    return this.http.get<DictamenPclResponse>(this.base(casoId), {
      // The motivo is already ASCII (transliterated by the emergency dialog, gap G10).
      headers: motivo ? cabeceras.set(CABECERA_MOTIVO_ACCESO, motivo) : cabeceras,
    });
  }

  registrar(casoId: string, cuerpo: RegistrarDictamenPclRequest): Observable<DictamenPclResponse> {
    return this.http.post<DictamenPclResponse>(this.base(casoId), cuerpo);
  }

  notificar(casoId: string, cuerpo: NotificarDictamenPclRequest): Observable<void> {
    return this.http.post<void>(`${this.base(casoId)}/notificar`, cuerpo);
  }

  private base(casoId: string): string {
    return `${this.prefijo}casos/${encodeURIComponent(casoId)}/dictamen-pcl`;
  }
}
