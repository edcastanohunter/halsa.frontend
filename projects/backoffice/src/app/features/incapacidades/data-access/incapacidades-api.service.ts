import { HttpClient, HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { IncapacidadRequest, IncapacidadResponse } from '@halsa/api-types';
import { API_PREFIX, CABECERA_IDEMPOTENCIA, nombreDeContentDisposition } from '@halsa/core';
import { map, Observable } from 'rxjs';

export interface SoporteDescargado {
  blob: Blob;
  nombre: string;
}

/**
 * `/v1/casos/{id}/incapacidades*` (plan §4.3). Provided by the incapacidades page, like its
 * store. The soporte is clinical 🔒: its bytes go straight to a one-shot download.
 */
@Injectable()
export class IncapacidadesApi {
  private readonly http = inject(HttpClient);
  private readonly prefijo = inject(API_PREFIX);

  listar(casoId: string): Observable<IncapacidadResponse[]> {
    return this.http.get<IncapacidadResponse[]>(this.base(casoId));
  }

  /**
   * Multipart upload with progress events: `datos` as a JSON blob and `soporte` as the PDF. The
   * caller owns the `Idempotency-Key`, so a retry can resend the same one (plan §5.3.7).
   */
  cargar(
    casoId: string,
    datos: IncapacidadRequest,
    soporte: File,
    clave: string,
  ): Observable<HttpEvent<IncapacidadResponse>> {
    const cuerpo = new FormData();
    cuerpo.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    cuerpo.append('soporte', soporte, soporte.name);
    return this.http.post<IncapacidadResponse>(this.base(casoId), cuerpo, {
      headers: { [CABECERA_IDEMPOTENCIA]: clave },
      observe: 'events',
      reportProgress: true,
    });
  }

  /** 🔒 `clinico:read` + `acr=2`. Never cached: the response is `no-store` and stays a blob. */
  soporte(casoId: string, incapacidadId: string): Observable<SoporteDescargado> {
    return this.http
      .get(`${this.base(casoId)}/${encodeURIComponent(incapacidadId)}/soporte`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((r) => ({
          blob: r.body ?? new Blob([], { type: 'application/pdf' }),
          nombre: nombreDeContentDisposition(
            r.headers.get('Content-Disposition'),
            `incapacidad-${incapacidadId}.pdf`,
          ),
        })),
      );
  }

  private base(casoId: string): string {
    return `${this.prefijo}casos/${encodeURIComponent(casoId)}/incapacidades`;
  }
}
