import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CONCLUSION_REVISION_EMERGENCIA_LABELS,
  ConclusionRevisionEmergencia,
  ESTADO_CASO_STAFF_LABELS,
  ESTADO_DICTAMEN_LABELS,
  ESTADO_PLAZO_LABELS,
  ESTADO_REVISION_EMERGENCIA_LABELS,
  ESTADO_SOLICITUD_COPIA_HC_LABELS,
  EstadoCaso,
  EstadoDictamen,
  EstadoPlazo,
  EstadoRevisionEmergencia,
  EstadoSolicitudCopiaHc,
  RESULTADO_AUDITORIA_LABELS,
  ResultadoAuditoria,
} from '@halsa/core';
import { hlm } from '@halsa/ui/helm/utils';
import { TONO_CONTORNO, TONO_SUAVE, Tono } from '../utils/tono';

export type TipoEstado =
  | 'caso'
  | 'plazo'
  | 'dictamen'
  | 'solicitudCopiaHc'
  | 'revisionEmergencia'
  | 'conclusionRevision'
  | 'resultadoAuditoria';

interface Estilo {
  tono: Tono;
  contorno?: boolean;
}

// Plan §8.3. Each map is keyed by its enum, so a missing value fails the build.
const CASO: Record<EstadoCaso, Estilo> = {
  Radicado: { tono: 'info' },
  Validado: { tono: 'primary' },
  EnAtencion: { tono: 'primary' },
  EnCalificacionOrigen: { tono: 'clinical' },
  EnCalificacionPcl: { tono: 'clinical' },
  Cerrado: { tono: 'muted' },
  Rechazado: { tono: 'destructive' },
};
const PLAZO: Record<EstadoPlazo, Estilo> = {
  ABIERTO: { tono: 'neutral' },
  CUMPLIDO: { tono: 'success' },
  VENCIDO: { tono: 'destructive' },
  SUSPENDIDO: { tono: 'muted' },
};
const DICTAMEN: Record<EstadoDictamen, Estilo> = {
  PENDIENTE: { tono: 'warning' },
  NOTIFICADO: { tono: 'info' },
  EN_CONTROVERSIA: { tono: 'clinical' },
  EN_FIRME: { tono: 'success' },
};
const SOLICITUD: Record<EstadoSolicitudCopiaHc, Estilo> = {
  RECIBIDA: { tono: 'info' },
  EN_TRAMITE: { tono: 'warning' },
  ENTREGADA: { tono: 'success' },
  RECHAZADA: { tono: 'destructive' },
};
const REVISION: Record<EstadoRevisionEmergencia, Estilo> = {
  PENDIENTE: { tono: 'warning' },
  CERRADA: { tono: 'muted' },
};
const CONCLUSION: Record<ConclusionRevisionEmergencia, Estilo> = {
  JUSTIFICADO: { tono: 'success' },
  INJUSTIFICADO: { tono: 'destructive' },
};
const AUDITORIA: Record<ResultadoAuditoria, Estilo> = {
  EXITO: { tono: 'success' },
  DENEGADO: { tono: 'destructive' },
  NO_ENCONTRADO: { tono: 'warning' },
  ERROR: { tono: 'destructive', contorno: true },
};

interface EntradaCatalogo {
  estilos: Record<string, Estilo>;
  etiquetas: Record<string, string>;
}

const CATALOGO: Record<TipoEstado, EntradaCatalogo> = {
  caso: { estilos: CASO, etiquetas: ESTADO_CASO_STAFF_LABELS },
  plazo: { estilos: PLAZO, etiquetas: ESTADO_PLAZO_LABELS },
  dictamen: { estilos: DICTAMEN, etiquetas: ESTADO_DICTAMEN_LABELS },
  solicitudCopiaHc: { estilos: SOLICITUD, etiquetas: ESTADO_SOLICITUD_COPIA_HC_LABELS },
  revisionEmergencia: { estilos: REVISION, etiquetas: ESTADO_REVISION_EMERGENCIA_LABELS },
  conclusionRevision: { estilos: CONCLUSION, etiquetas: CONCLUSION_REVISION_EMERGENCIA_LABELS },
  resultadoAuditoria: { estilos: AUDITORIA, etiquetas: RESULTADO_AUDITORIA_LABELS },
};

/**
 * Status badge for any backend enum (plan §8.3). Always text, never color alone.
 * Unknown values render raw in a neutral tone.
 */
@Component({
  selector: 'halsa-estado-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span [class]="clases()">
      <span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
      {{ etiqueta() }}
    </span>
  `,
})
export class EstadoBadge {
  readonly tipo = input.required<TipoEstado>();
  readonly valor = input.required<string>();
  /** An emergency review past its 72 h deadline turns destructive (plan §8.3). */
  readonly vencida = input(false);

  private readonly entrada = computed(() => CATALOGO[this.tipo()]);

  private readonly esRevisionVencida = computed(
    () => this.vencida() && this.tipo() === 'revisionEmergencia' && this.valor() === 'PENDIENTE',
  );

  protected readonly etiqueta = computed(() => {
    const base = this.entrada().etiquetas[this.valor()] ?? this.valor();
    return this.esRevisionVencida() ? `${base} · vencida` : base;
  });

  protected readonly clases = computed(() => {
    const estilo: Estilo = this.esRevisionVencida()
      ? { tono: 'destructive' }
      : (this.entrada().estilos[this.valor()] ?? { tono: 'neutral' });
    return hlm(
      'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
      estilo.contorno ? TONO_CONTORNO[estilo.tono] : TONO_SUAVE[estilo.tono],
    );
  });
}
