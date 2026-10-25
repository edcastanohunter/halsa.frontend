import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { APP_CONFIG, ZONA_HORARIA } from '@halsa/core';
import { injectCopiar } from '@halsa/ui/portapapeles';
import { SelectorTema } from '@halsa/ui/selector-tema';
import { HlmBadgeImports } from '@halsa/ui/helm/badge';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCopy,
  lucideExternalLink,
  lucideLogOut,
  lucideShieldCheck,
} from '@ng-icons/lucide';
import { agruparPermisos } from '../../core/permisos/etiquetas';
import { SesionService } from '../../core/sesion/sesion.service';
import { MARGEN_VENTANA_SEG, StepUpService } from '../../core/step-up/step-up.service';

/** The dictamen PCL needs `auth_time` within the last 15 minutes (plan §5.1.4). */
const VENTANA_DICTAMEN_SEG = 900;

const hora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** `/cuenta` (plan §7.1). */
@Component({
  selector: 'app-cuenta',
  imports: [SelectorTema, HlmBadgeImports, HlmButton, HlmCardImports, NgIcon],
  providers: [
    provideIcons({ lucideCheck, lucideCopy, lucideExternalLink, lucideLogOut, lucideShieldCheck }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cuenta.page.html',
})
export class CuentaPage {
  protected readonly sesion = inject(SesionService);
  private readonly stepUp = inject(StepUpService);
  protected readonly urlCuentaKeycloak = `${inject(APP_CONFIG).keycloak?.authority ?? ''}/account`;
  private readonly portapapeles = injectCopiar();
  protected readonly copiado = this.portapapeles.copiado;

  protected readonly datos = computed(() => this.sesion.sesion());
  protected readonly grupos = computed(() => agruparPermisos(this.datos()?.permisos ?? []));

  protected readonly verificacion = computed(() => {
    const s = this.datos();
    if (!s || s.acr < 2) return null;
    const dictamenVigente = this.stepUp.cumple({ acr: 2, maxAgeSeg: VENTANA_DICTAMEN_SEG });
    const cierre =
      s.authTime === null ? null : (s.authTime + VENTANA_DICTAMEN_SEG - MARGEN_VENTANA_SEG) * 1000;
    return { dictamenHasta: dictamenVigente && cierre ? hora.format(cierre) : null };
  });

  protected copiarSub(sub: string): void {
    void this.portapapeles.copiar(sub);
  }
}
