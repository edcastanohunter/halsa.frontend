import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { sesionFalsa } from '../../testing/sesion-falsa';
import { agruparPermisos } from './etiquetas';
import { requierePermiso, requiereSesion } from './guards';
import { PermisosService } from './permisos';
import { SiPuede } from './si-puede';

function ejecutar(guard: ReturnType<typeof requierePermiso>, url = '/casos') {
  return TestBed.runInInjectionContext(() => guard({} as never, { url } as never)) as
    boolean | UrlTree;
}

describe('permission guards (plan §5.1.2)', () => {
  it('requierePermiso sends to /acceso-denegado, not to the login', () => {
    const { falsa, provider } = sesionFalsa({ permisos: new Set(['casos:read']) });
    TestBed.configureTestingModule({ providers: [provideRouter([]), provider] });
    expect(ejecutar(requierePermiso('casos:read'))).toBe(true);
    const arbol = ejecutar(requierePermiso('casos:read', 'casos:asignar'));
    expect(TestBed.inject(Router).serializeUrl(arbol as UrlTree)).toBe('/acceso-denegado');
    expect(falsa.iniciarSesion).not.toHaveBeenCalled();
  });

  it('requiereSesion logs in with the requested URL as the return target', () => {
    const { falsa, provider } = sesionFalsa(null, 'anonima');
    TestBed.configureTestingModule({ providers: [provideRouter([]), provider] });
    expect(ejecutar(requiereSesion, '/plazos?estado=VENCIDO')).toBe(false);
    expect(falsa.iniciarSesion).toHaveBeenCalledWith('/plazos?estado=VENCIDO');
  });

  it('requiereSesion sends non-staff actors to /sin-acceso and lets errors reach the shell', () => {
    const { falsa, provider } = sesionFalsa(null, 'sin-acceso');
    TestBed.configureTestingModule({ providers: [provideRouter([]), provider] });
    const arbol = ejecutar(requiereSesion);
    expect(TestBed.inject(Router).serializeUrl(arbol as UrlTree)).toBe('/sin-acceso');
    falsa.estado.set('error');
    expect(ejecutar(requiereSesion)).toBe(true);
  });
});

@Component({
  imports: [SiPuede],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p *halsaSiPuede="'clinico:read'; else sinPermiso">clínico</p>
    <ng-template #sinPermiso><p>sin permiso</p></ng-template>
    <p *halsaSiPuede="['auditoria:read', 'auditoria:revisar']">auditoría</p>
  `,
})
class Anfitrion {}

describe('*halsaSiPuede', () => {
  it('renders the content or the else template, and follows permission changes', async () => {
    const { falsa, provider } = sesionFalsa({ permisos: new Set(['auditoria:revisar']) });
    TestBed.configureTestingModule({ providers: [provider] });
    const fixture = TestBed.createComponent(Anfitrion);
    await fixture.whenStable();
    const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ');
    expect(texto()).toContain('sin permiso');
    expect(texto()).toContain('auditoría');

    falsa.sesion.update((s) => s && { ...s, permisos: new Set(['clinico:read']) });
    await fixture.whenStable();
    expect(texto()).toContain('clínico');
    expect(texto()).not.toContain('sin permiso');
    expect(texto()).not.toContain('auditoría');
  });
});

describe('PermisosService', () => {
  it('reads permissions reactively and is empty without a session', () => {
    const { falsa, provider } = sesionFalsa(null);
    TestBed.configureTestingModule({ providers: [provider] });
    const permisos = TestBed.inject(PermisosService);
    expect(permisos.puede('casos:read')).toBe(false);
    falsa.sesion.set({ ...sesionFalsa({}).falsa.sesion()!, permisos: new Set(['casos:read']) });
    expect(permisos.puede('casos:read')).toBe(true);
    expect(permisos.puedeAlguno('plazos:read', 'casos:read')).toBe(true);
  });
});

describe('agruparPermisos (Cuenta, plan §7.1)', () => {
  it('groups by area in a stable order, skipping Keycloak composite role names', () => {
    expect(
      agruparPermisos([
        'analista-arl',
        'plazos:write',
        'casos:read',
        'plazos:read',
        'integracion:furat:write',
      ]),
    ).toEqual([
      { area: 'Casos', permisos: [{ codigo: 'casos:read', etiqueta: 'Ver casos' }] },
      {
        area: 'Plazos',
        permisos: [
          { codigo: 'plazos:read', etiqueta: 'Ver plazos' },
          { codigo: 'plazos:write', etiqueta: 'Marcar plazos como cumplidos' },
        ],
      },
      {
        area: 'Otros',
        permisos: [{ codigo: 'integracion:furat:write', etiqueta: 'integracion:furat:write' }],
      },
    ]);
  });
});
