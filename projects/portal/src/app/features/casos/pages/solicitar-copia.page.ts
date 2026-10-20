import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { CasoPacienteResponse } from '@halsa/api-types';
import { MedioEntrega, MensajeError, mensajeDeError } from '@halsa/core';
import { EstadoError, EstadoVacio, Notificaciones } from '@halsa/ui';
import { HlmButton } from '@halsa/ui/helm/button';
import { HlmFieldImports } from '@halsa/ui/helm/field';
import { HlmInput } from '@halsa/ui/helm/input';
import { HlmSkeletonImports } from '@halsa/ui/helm/skeleton';
import { HlmSpinner } from '@halsa/ui/helm/spinner';
import { HlmTextarea } from '@halsa/ui/helm/textarea';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideBuilding2,
  lucideInfo,
  lucideMail,
  lucideMapPin,
  lucideSearchX,
} from '@ng-icons/lucide';
import { firstValueFrom } from 'rxjs';
import { SesionPaciente } from '../../../core/sesion/sesion.service';
import { PacienteApi } from '../../../shared/paciente-api.service';
import {
  CAMPO_DESTINO,
  CampoSolicitud,
  crearFormularioSolicitud,
  cuerpoSolicitud,
  DESTINO_MAX,
  erroresDeSolicitud,
  OBSERVACIONES_MAX,
} from '../solicitud';

type Fase = 'cargando' | 'listo' | 'no-disponible' | 'error';

const MEDIOS: readonly {
  valor: MedioEntrega;
  etiqueta: string;
  descripcion: string;
  icono: string;
}[] = [
  {
    valor: 'ELECTRONICO',
    etiqueta: 'Correo electrónico',
    descripcion: 'Te la envían a tu correo.',
    icono: 'lucideMail',
  },
  {
    valor: 'CORREO_CERTIFICADO',
    etiqueta: 'Correo certificado',
    descripcion: 'Te la envían impresa a una dirección.',
    icono: 'lucideMapPin',
  },
  {
    valor: 'PRESENCIAL',
    etiqueta: 'Presencial',
    descripcion: 'La recoges en una oficina de tu ARL.',
    icono: 'lucideBuilding2',
  },
];

/**
 * `/casos/:casoId/solicitar-copia` (plan §7.12): the formal request for a copy of the clinical
 * record. The copy is never shown online; the ARL delivers it within 10 business days.
 */
@Component({
  selector: 'app-solicitar-copia',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    EstadoError,
    EstadoVacio,
    HlmButton,
    HlmFieldImports,
    HlmInput,
    HlmSkeletonImports,
    HlmSpinner,
    HlmTextarea,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideBuilding2,
      lucideInfo,
      lucideMail,
      lucideMapPin,
      lucideSearchX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl space-y-6">
      <a hlmBtn variant="ghost" [routerLink]="['/casos', casoId()]" class="-ms-3">
        <ng-icon name="lucideArrowLeft" aria-hidden="true" /> Volver al caso
      </a>

      @switch (fase()) {
        @case ('cargando') {
          <div aria-busy="true" aria-label="Cargando" class="space-y-4">
            <hlm-skeleton class="h-8 w-3/4" />
            <hlm-skeleton class="h-24 w-full rounded-xl" />
            <hlm-skeleton class="h-40 w-full rounded-xl" />
          </div>
        }
        @case ('no-disponible') {
          <h1 class="sr-only">Caso no disponible</h1>
          <halsa-estado-vacio
            icono="lucideSearchX"
            titulo="Este caso no está disponible"
            descripcion="No existe o no está vinculado a tu cuenta."
          >
            <a hlmBtn variant="outline" routerLink="/casos">Ver mis casos</a>
          </halsa-estado-vacio>
        }
        @case ('error') {
          <h1 class="sr-only">Solicitar copia de tu historia clínica</h1>
          <halsa-estado-error
            [titulo]="errorCarga()?.titulo ?? 'No pudimos cargar el caso'"
            [mensaje]="errorCarga()?.mensaje"
            [traza]="errorCarga()?.traza ?? undefined"
            (reintentar)="cargar()"
          />
        }
        @default {
          <header class="space-y-2">
            <h1 class="text-2xl font-semibold tracking-tight text-balance lg:text-3xl">
              Solicitar copia de tu historia clínica
            </h1>
            <p class="text-muted-foreground">
              Caso <span class="text-foreground font-mono font-medium">{{ caso()?.radicado }}</span>
            </p>
          </header>

          <p class="bg-info/10 ring-info/25 flex gap-3 rounded-xl p-4 text-sm ring-1 ring-inset">
            <ng-icon
              name="lucideInfo"
              class="text-info mt-0.5 shrink-0 text-lg"
              aria-hidden="true"
            />
            <span
              >La copia la entrega tu ARL por el medio que elijas; no se muestra en línea. Tu ARL
              tiene <strong>10 días hábiles</strong> para entregártela.</span
            >
          </p>

          @if (yaAbierta()) {
            <div
              role="alert"
              class="bg-warning/12 ring-warning/30 space-y-2 rounded-xl p-4 text-sm ring-1 ring-inset"
              data-testid="solicitud-ya-abierta"
            >
              <p class="font-semibold">Ya tienes una solicitud abierta para este caso</p>
              <p>Tu ARL la está atendiendo. Puedes ver cómo va en tus solicitudes.</p>
              <a hlmBtn variant="outline" routerLink="/solicitudes">Ver mis solicitudes</a>
            </div>
          }

          <form
            id="form-solicitud"
            class="space-y-6"
            [formGroup]="form"
            (ngSubmit)="enviar()"
            novalidate
          >
            <fieldset [attr.aria-describedby]="medioInvalido() ? 'error-medio' : null">
              <legend class="mb-3 text-base font-medium">¿Cómo quieres recibir la copia?</legend>
              <div class="grid gap-3 sm:grid-cols-3">
                @for (m of medios; track m.valor) {
                  <label
                    class="bg-card ring-border has-checked:ring-primary has-checked:bg-primary/5 has-focus-visible:ring-ring flex min-h-14 cursor-pointer items-start gap-3 rounded-xl p-4 ring-1 ring-inset has-checked:ring-2 sm:flex-col sm:gap-2"
                  >
                    <input
                      type="radio"
                      class="accent-primary mt-1 size-4 shrink-0 sm:sr-only"
                      formControlName="medio"
                      [value]="m.valor"
                      (change)="alElegirMedio(m.valor)"
                    />
                    <ng-icon
                      [name]="m.icono"
                      class="text-primary hidden text-xl sm:block"
                      aria-hidden="true"
                    />
                    <span class="min-w-0">
                      <span class="block font-medium">{{ m.etiqueta }}</span>
                      <span class="text-muted-foreground block text-sm">{{ m.descripcion }}</span>
                    </span>
                  </label>
                }
              </div>
              @if (medioInvalido()) {
                <p id="error-medio" role="alert" class="text-destructive mt-2 text-sm">
                  {{ errores().medio ?? 'Elige cómo quieres recibir la copia.' }}
                </p>
              }
            </fieldset>

            @switch (campoDestino()) {
              @case ('direccion') {
                <hlm-field [forceInvalid]="!!errores().destino">
                  <label hlmFieldLabel for="solicitud-direccion">Dirección de envío</label>
                  <textarea
                    hlmTextarea
                    id="solicitud-direccion"
                    rows="3"
                    autocomplete="street-address"
                    formControlName="direccion"
                    [attr.maxlength]="destinoMax"
                    (input)="limpiar('destino')"
                  ></textarea>
                  <p hlmFieldDescription>Dirección completa, con ciudad y departamento.</p>
                  <hlm-field-error validator="required"
                    >Indica la dirección de envío.</hlm-field-error
                  >
                  @if (errores().destino; as e) {
                    <hlm-field-error forceShow>{{ e }}</hlm-field-error>
                  }
                </hlm-field>
              }
              @case ('correo') {
                <hlm-field [forceInvalid]="!!errores().destino">
                  <label hlmFieldLabel for="solicitud-correo">Correo electrónico</label>
                  <input
                    hlmInput
                    id="solicitud-correo"
                    type="email"
                    autocomplete="email"
                    inputmode="email"
                    formControlName="correo"
                    [attr.maxlength]="destinoMax"
                    (input)="limpiar('destino')"
                  />
                  <hlm-field-error validator="required"
                    >Indica tu correo electrónico.</hlm-field-error
                  >
                  <hlm-field-error validator="email"
                    >Escribe un correo electrónico válido.</hlm-field-error
                  >
                  @if (errores().destino; as e) {
                    <hlm-field-error forceShow>{{ e }}</hlm-field-error>
                  }
                </hlm-field>
              }
            }

            <hlm-field [forceInvalid]="!!errores().observaciones">
              <label hlmFieldLabel for="solicitud-observaciones">Observaciones (opcional)</label>
              <textarea
                hlmTextarea
                id="solicitud-observaciones"
                rows="3"
                formControlName="observaciones"
                [attr.maxlength]="observacionesMax"
                (input)="limpiar('observaciones')"
              ></textarea>
              <p hlmFieldDescription class="flex justify-between gap-2">
                <span>Algo que tu ARL deba saber para la entrega.</span>
                <span class="tabular-nums">{{ largoObservaciones() }}/{{ observacionesMax }}</span>
              </p>
              @if (errores().observaciones; as e) {
                <hlm-field-error forceShow>{{ e }}</hlm-field-error>
              }
            </hlm-field>

            <p class="text-muted-foreground text-sm">
              Tienes derecho a conocer y obtener copia de tu historia clínica (Resolución 1995 de
              1999, artículo 14).
            </p>

            @if (errores().general; as e) {
              <p
                role="alert"
                class="bg-destructive/10 text-destructive ring-destructive/25 rounded-xl p-4 text-sm ring-1 ring-inset"
              >
                {{ e }}
              </p>
            }

            <button hlmBtn size="lg" type="submit" class="w-full sm:w-auto" [disabled]="enviando()">
              @if (enviando()) {
                <hlm-spinner class="size-4" aria-hidden="true" />
              }
              Enviar solicitud
            </button>
          </form>
        }
      }
    </div>
  `,
})
export class SolicitarCopiaPage implements OnInit {
  readonly casoId = input.required<string>();

  private readonly api = inject(PacienteApi);
  private readonly sesion = inject(SesionPaciente);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(Notificaciones);
  private readonly injector = inject(Injector);

  protected readonly medios = MEDIOS;
  protected readonly destinoMax = DESTINO_MAX;
  protected readonly observacionesMax = OBSERVACIONES_MAX;

  protected readonly fase = signal<Fase>('cargando');
  protected readonly errorCarga = signal<MensajeError | null>(null);
  protected readonly caso = signal<CasoPacienteResponse | null>(null);

  protected readonly form = crearFormularioSolicitud();
  private readonly medio = toSignal(this.form.controls.medio.valueChanges, {
    initialValue: null,
  });
  protected readonly campoDestino = computed(() => {
    const medio = this.medio();
    return medio ? CAMPO_DESTINO[medio] : null;
  });
  private readonly observaciones = toSignal(this.form.controls.observaciones.valueChanges, {
    initialValue: '',
  });
  protected readonly largoObservaciones = computed(() => this.observaciones().length);

  protected readonly enviando = signal(false);
  protected readonly yaAbierta = signal(false);
  protected readonly errores = signal<Partial<Record<CampoSolicitud, string>>>({});
  private readonly enviado = signal(false);

  ngOnInit(): void {
    void this.cargar();
  }

  protected async cargar(): Promise<void> {
    this.fase.set('cargando');
    try {
      const casos = await firstValueFrom(this.api.misCasos());
      const caso = casos.find((c) => c.casoId === this.casoId()) ?? null;
      this.caso.set(caso);
      this.fase.set(caso ? 'listo' : 'no-disponible');
    } catch (error) {
      this.errorCarga.set(mensajeDeError(error));
      this.fase.set('error');
    }
  }

  /** Radio cards have no `hlm-field`: their error shows after a submit attempt or the server. */
  protected medioInvalido(): boolean {
    return !!this.errores().medio || (this.enviado() && this.form.controls.medio.invalid);
  }

  protected alElegirMedio(medio: MedioEntrega): void {
    const { direccion, correo } = this.form.controls;
    // The conditional "required" depends on the method: re-run both.
    direccion.updateValueAndValidity();
    correo.updateValueAndValidity();
    const sugerido = this.sesion.usuario()?.correo;
    if (medio === 'ELECTRONICO' && !correo.value && sugerido) correo.setValue(sugerido);
    this.limpiar('medio');
    this.limpiar('destino');
  }

  protected limpiar(campo: CampoSolicitud): void {
    if (!this.errores()[campo] && !this.errores().general) return;
    this.errores.update((actuales) => {
      const resto = { ...actuales };
      delete resto[campo];
      delete resto.general;
      return resto;
    });
  }

  protected async enviar(): Promise<void> {
    this.enviado.set(true);
    this.form.markAllAsTouched();
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.enfocarPrimerError();
      return;
    }
    this.errores.set({});
    this.yaAbierta.set(false);
    this.enviando.set(true);
    try {
      await firstValueFrom(this.api.solicitarCopia(this.casoId(), cuerpoSolicitud(this.form)));
      this.notificaciones.exito(
        'Solicitud enviada',
        'Tu ARL tiene 10 días hábiles para entregarte la copia.',
      );
      void this.router.navigate(['/solicitudes']);
    } catch (error) {
      const errores = erroresDeSolicitud(error);
      if ('yaAbierta' in errores) {
        this.yaAbierta.set(true);
      } else {
        this.errores.set(errores);
        this.enfocarPrimerError();
      }
    } finally {
      this.enviando.set(false);
    }
  }

  /** Plan §8.6: focus moves to the first invalid field on submit. */
  private enfocarPrimerError(): void {
    afterNextRender(
      () =>
        document
          .querySelector<HTMLElement>(
            '#form-solicitud .ng-invalid:is(input, textarea), #form-solicitud [aria-invalid="true"]',
          )
          ?.focus(),
      { injector: this.injector },
    );
  }
}
