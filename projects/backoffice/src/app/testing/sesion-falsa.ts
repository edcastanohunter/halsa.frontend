// Test helpers only (imported by *.spec.ts files).
import { signal } from '@angular/core';
import { decodificarJwt, nivelDesdeClaims } from '../core/auth/claims';
import { EstadoSesion, SesionPersonal, SesionService } from '../core/sesion/sesion.service';

/** A `SesionService` stand-in driven by signals, for guards, directives and step-up tests. */
export function sesionFalsa(
  inicial: Partial<SesionPersonal> | null,
  estado: EstadoSesion = 'lista',
) {
  const sesion = signal<SesionPersonal | null>(
    inicial && {
      sub: '01999000-0000-7000-8000-000000000a01',
      nombre: 'Analista ARL-A',
      correo: null,
      actorTipo: 'arl',
      tenantId: 'ARL_A',
      ipsId: null,
      permisos: new Set(),
      acr: 1,
      authTime: null,
      ...inicial,
    },
  );
  const falsa = {
    estado: signal<EstadoSesion>(estado),
    sesion,
    iniciarSesion: vi.fn(),
    sesionExpirada: vi.fn(),
    cerrarSesion: vi.fn(),
    actualizarNivel: vi.fn((token: string) => {
      const actual = sesion();
      if (actual) sesion.set({ ...actual, ...nivelDesdeClaims(decodificarJwt(token)) });
    }),
  };
  return { falsa, provider: { provide: SesionService, useValue: falsa } };
}
