import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { REGLA_PLAZO_LABELS } from '@halsa/core';
import {
  BarraDiasAcumulados,
  CampoPorcentaje,
  CodigoUnaVez,
  ContadorRegresivo,
  ContenidoReforzado,
  DialogoAccesoEmergencia,
  DocumentoEnmascarado,
  EstadoBadge,
  EstadoError,
  EstadoVacio,
  FechaBogota,
  FechaRelativa,
  PageHeader,
  PanelNoAsignado,
  RadicadoChip,
  SeccionClinica,
  SelectorTema,
  SemaforoPlazo,
  SubidaPdf,
  TipoEstado,
  VerificacionReforzada,
} from '@halsa/ui';
import { HlmAccordionImports } from '@halsa/ui/helm/accordion';
import { HlmAlertImports } from '@halsa/ui/helm/alert';
import { HlmAlertDialogImports } from '@halsa/ui/helm/alert-dialog';
import { HlmAvatarImports } from '@halsa/ui/helm/avatar';
import { HlmBadgeImports } from '@halsa/ui/helm/badge';
import { HlmButtonImports } from '@halsa/ui/helm/button';
import { HlmCardImports } from '@halsa/ui/helm/card';
import { HlmCheckboxImports } from '@halsa/ui/helm/checkbox';
import { HlmDialogImports } from '@halsa/ui/helm/dialog';
import { HlmDropdownMenuImports } from '@halsa/ui/helm/dropdown-menu';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInputImports } from '@halsa/ui/helm/input';
import { HlmInputGroupImports } from '@halsa/ui/helm/input-group';
import { HlmLabelImports } from '@halsa/ui/helm/label';
import { HlmPaginationImports } from '@halsa/ui/helm/pagination';
import { HlmPopoverImports } from '@halsa/ui/helm/popover';
import { HlmProgressImports } from '@halsa/ui/helm/progress';
import { HlmRadioGroupImports } from '@halsa/ui/helm/radio-group';
import { HlmSelectImports } from '@halsa/ui/helm/select';
import { HlmSeparatorImports } from '@halsa/ui/helm/separator';
import { HlmSheetImports } from '@halsa/ui/helm/sheet';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinnerImports } from '@halsa/ui/helm/spinner';
import { HlmSwitchImports } from '@halsa/ui/helm/switch';
import { HlmTableImports } from '@halsa/ui/helm/table';
import { HlmTabsImports } from '@halsa/ui/helm/tabs';
import { HlmTextareaImports } from '@halsa/ui/helm/textarea';
import { HlmTooltipImports } from '@halsa/ui/helm/tooltip';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBell,
  lucideChevronDown,
  lucideCircleCheck,
  lucideFileSearch,
  lucideInfo,
  lucideLogOut,
  lucidePlus,
  lucideSettings,
  lucideTriangleAlert,
  lucideUser,
} from '@ng-icons/lucide';
import { toast } from '@spartan-ng/brain/sonner';
import { injectMediaQuery } from '../lib/utils/media';

const HORA = 60 * 60 * 1000;
const enHoras = (horas: number) => new Date(Date.now() + horas * HORA).toISOString();

/**
 * Dev-only `/_ui` showcase (plan §8.2): every primitive and Halsa composite, for visual review in
 * light and dark at 375 px and 1440 px. Excluded from production builds by the apps'
 * `dev.routes.ts` file replacement. All data here is fictitious.
 */
@Component({
  selector: 'halsa-ui-showcase',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    CampoPorcentaje,
    HlmInputGroupImports,
    HlmAccordionImports,
    HlmAlertImports,
    HlmAlertDialogImports,
    HlmAvatarImports,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmCheckboxImports,
    HlmDialogImports,
    HlmDropdownMenuImports,
    HlmFieldImports,
    HlmInputImports,
    HlmLabelImports,
    HlmPaginationImports,
    HlmPopoverImports,
    HlmProgressImports,
    HlmRadioGroupImports,
    HlmSelectImports,
    HlmSeparatorImports,
    HlmSheetImports,
    HlmSkeletonImports,
    HlmSpinnerImports,
    HlmSwitchImports,
    HlmTableImports,
    HlmTabsImports,
    HlmTextareaImports,
    HlmTooltipImports,
    BarraDiasAcumulados,
    CodigoUnaVez,
    ContadorRegresivo,
    ContenidoReforzado,
    DialogoAccesoEmergencia,
    DocumentoEnmascarado,
    EstadoBadge,
    EstadoError,
    EstadoVacio,
    FechaBogota,
    FechaRelativa,
    PageHeader,
    PanelNoAsignado,
    RadicadoChip,
    SeccionClinica,
    SelectorTema,
    SemaforoPlazo,
    SubidaPdf,
    VerificacionReforzada,
  ],
  providers: [
    provideIcons({
      lucideBell,
      lucideChevronDown,
      lucideCircleCheck,
      lucideFileSearch,
      lucideInfo,
      lucideLogOut,
      lucidePlus,
      lucideSettings,
      lucideTriangleAlert,
      lucideUser,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ui-showcase.page.html',
})
export class UiShowcasePage {
  protected readonly escritorio = injectMediaQuery('(min-width: 768px)');

  protected readonly secciones = [
    { id: 'fundamentos', titulo: 'Fundamentos' },
    { id: 'controles', titulo: 'Controles' },
    { id: 'navegacion', titulo: 'Navegación' },
    { id: 'superposiciones', titulo: 'Superposiciones' },
    { id: 'datos', titulo: 'Datos' },
    { id: 'halsa', titulo: 'Componentes Halsa' },
  ];

  protected readonly colores = [
    { token: 'background', fondo: 'bg-background', texto: 'text-foreground' },
    { token: 'card', fondo: 'bg-card', texto: 'text-card-foreground' },
    { token: 'muted', fondo: 'bg-muted', texto: 'text-muted-foreground' },
    { token: 'primary', fondo: 'bg-primary', texto: 'text-primary-foreground' },
    { token: 'secondary', fondo: 'bg-secondary', texto: 'text-secondary-foreground' },
    { token: 'accent', fondo: 'bg-accent', texto: 'text-accent-foreground' },
    { token: 'success', fondo: 'bg-success', texto: 'text-success-foreground' },
    { token: 'warning', fondo: 'bg-warning', texto: 'text-warning-foreground' },
    { token: 'info', fondo: 'bg-info', texto: 'text-info-foreground' },
    { token: 'destructive', fondo: 'bg-destructive', texto: 'text-destructive-foreground' },
    { token: 'clinical', fondo: 'bg-clinical', texto: 'text-clinical-foreground' },
  ];

  protected readonly estados: { tipo: TipoEstado; titulo: string; valores: string[] }[] = [
    {
      tipo: 'caso',
      titulo: 'Caso',
      valores: [
        'Radicado',
        'Validado',
        'EnAtencion',
        'EnCalificacionOrigen',
        'EnCalificacionPcl',
        'Cerrado',
        'Rechazado',
      ],
    },
    { tipo: 'plazo', titulo: 'Plazo', valores: ['ABIERTO', 'CUMPLIDO', 'VENCIDO', 'SUSPENDIDO'] },
    {
      tipo: 'dictamen',
      titulo: 'Dictamen',
      valores: ['PENDIENTE', 'NOTIFICADO', 'EN_CONTROVERSIA', 'EN_FIRME'],
    },
    {
      tipo: 'solicitudCopiaHc',
      titulo: 'Solicitud de copia HC',
      valores: ['RECIBIDA', 'EN_TRAMITE', 'ENTREGADA', 'RECHAZADA'],
    },
    {
      tipo: 'revisionEmergencia',
      titulo: 'Revisión de emergencia',
      valores: ['PENDIENTE', 'CERRADA'],
    },
    { tipo: 'conclusionRevision', titulo: 'Conclusión', valores: ['JUSTIFICADO', 'INJUSTIFICADO'] },
    {
      tipo: 'resultadoAuditoria',
      titulo: 'Resultado de auditoría',
      valores: ['Exito', 'Denegado', 'NoEncontrado', 'Error'],
    },
  ];

  protected readonly plazos = [
    { titulo: 'Normal', estado: 'ABIERTO', venceEn: enHoras(24 * 9), alertaEn: enHoras(24 * 6) },
    { titulo: 'Alerta', estado: 'ABIERTO', venceEn: enHoras(24 * 3), alertaEn: enHoras(-2) },
    { titulo: 'Menos de 24 h', estado: 'ABIERTO', venceEn: enHoras(5), alertaEn: enHoras(-48) },
    {
      titulo: 'Venció (sin cerrar)',
      estado: 'ABIERTO',
      venceEn: enHoras(-3),
      alertaEn: enHoras(-72),
    },
    { titulo: 'Vencido', estado: 'VENCIDO', venceEn: enHoras(-30), alertaEn: enHoras(-96) },
    { titulo: 'Cumplido', estado: 'CUMPLIDO', venceEn: enHoras(-10), alertaEn: enHoras(-40) },
    { titulo: 'Suspendido', estado: 'SUSPENDIDO', venceEn: enHoras(40), alertaEn: enHoras(10) },
  ] as const;

  protected readonly casos = [
    {
      radicado: '2026-ARLA-000123',
      tipo: 'Accidente de trabajo',
      estado: 'Radicado',
      fecha: '2026-10-02',
      documento: '1020304050',
    },
    {
      radicado: '2026-ARLA-000124',
      tipo: 'Enfermedad laboral',
      estado: 'EnCalificacionPcl',
      fecha: '2026-09-14',
      documento: '52887766',
    },
    {
      radicado: '2026-ARLA-000131',
      tipo: 'Accidente de trabajo',
      estado: 'Cerrado',
      fecha: '2026-01-01',
      documento: '1098765432',
    },
  ];

  protected readonly reglas = Object.entries(REGLA_PLAZO_LABELS).map(([valor, etiqueta]) => ({
    valor,
    etiqueta,
  }));

  protected readonly hace3Horas = enHoras(-3);
  protected readonly en2Dias = enHoras(48);
  protected readonly contadorLargo = enHoras(0.25);
  protected readonly contadorCorto = new Date(Date.now() + 90_000).toISOString();
  protected readonly codigoExpira = enHoras(24);
  protected readonly subDemo = '7f3c2a10-5b8e-4d21-9c4f-1e2d3c4b5a69';

  protected readonly nombre = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly porcentaje = new FormControl<number | null>(23.45);
  protected readonly reps = new FormControl('12345', {
    nonNullable: true,
    validators: [Validators.pattern(/^\d{12}$/)],
  });
  protected readonly nota = new FormControl('', { nonNullable: true });
  protected readonly acepta = new FormControl(true, { nonNullable: true });
  protected readonly notificaciones = new FormControl(true, { nonNullable: true });
  protected readonly regla = signal<string | null>(null);
  protected readonly medio = signal('ELECTRONICO');
  protected readonly pestana = signal('resumen');

  protected readonly gateSatisfecha = signal(false);
  protected readonly verificando = signal(false);
  protected readonly dialogoEmergencia = signal(false);
  protected readonly motivoRegistrado = signal<string | null>(null);
  protected readonly archivo = signal<File | null>(null);

  constructor() {
    this.reps.markAsTouched();
  }

  protected simularVerificacion(): void {
    this.verificando.set(true);
    setTimeout(() => {
      this.verificando.set(false);
      this.gateSatisfecha.set(true);
    }, 1200);
  }

  protected toastExito(): void {
    toast.success('Plazo marcado como cumplido', {
      description: 'Investigación del accidente · 2026-ARLA-000123',
    });
  }

  protected toastError(): void {
    toast.error('No pudimos guardar los cambios', {
      description: 'Revisa tu conexión e inténtalo de nuevo.',
    });
  }
}

// Second dev page, re-exported here so it shares the `@halsa/ui/showcase` entry point.
export { UiErroresPage } from './errores.page';
