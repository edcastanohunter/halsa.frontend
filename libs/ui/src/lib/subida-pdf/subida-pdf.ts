import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { ERROR_PDF_MENSAJES, formatTamanoArchivo, validarPdf } from '@halsa/core';
import { HlmButton } from '@halsa/ui/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText, lucideUpload, lucideX } from '@ng-icons/lucide';

let siguienteId = 0;

/**
 * PDF picker with drag & drop (plan §7.6 step 4, §5.3.8). Validates type, size (≤ 10 MB) and the
 * `%PDF-` signature before exposing the file through the `archivo` model.
 */
@Component({
  selector: 'halsa-subida-pdf',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({ lucideUpload, lucideFileText, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (archivo(); as actual) {
      <div
        class="bg-card ring-foreground/10 flex items-center gap-3 rounded-xl p-3 shadow-xs ring-1"
      >
        <span
          class="bg-primary/12 text-primary inline-flex size-10 shrink-0 items-center justify-center rounded-lg"
          aria-hidden="true"
        >
          <ng-icon name="lucideFileText" class="text-xl" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ actual.name }}</p>
          <p class="text-muted-foreground text-xs tabular-nums">{{ tamano(actual.size) }} · PDF</p>
        </div>
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          type="button"
          [disabled]="deshabilitado()"
          [attr.aria-label]="'Quitar ' + actual.name"
          (click)="quitar()"
        >
          <ng-icon name="lucideX" aria-hidden="true" />
        </button>
      </div>
    } @else {
      <label
        [for]="inputId"
        class="border-input bg-card hover:border-primary hover:bg-primary/5 has-[:focus-visible]:outline-ring data-[arrastrando]:border-primary data-[arrastrando]:bg-primary/5 data-[error]:border-destructive flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-150 ease-out has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
        [attr.data-arrastrando]="arrastrando() || null"
        [attr.data-error]="error() ? true : null"
        (dragover)="alArrastrar($event)"
        (dragleave)="arrastrando.set(false)"
        (drop)="alSoltar($event)"
      >
        <span
          class="bg-muted text-muted-foreground inline-flex size-11 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <ng-icon name="lucideUpload" class="text-xl" />
        </span>
        <span class="text-sm font-medium">
          <span class="pointer-coarse:hidden">Arrastra el PDF aquí o haz clic para elegirlo</span>
          <span class="hidden pointer-coarse:inline">Toca para elegir el PDF</span>
        </span>
        <span class="text-muted-foreground text-xs">PDF, máximo 10 MB</span>
        <input
          type="file"
          accept="application/pdf"
          class="sr-only"
          [id]="inputId"
          [disabled]="deshabilitado()"
          [attr.aria-describedby]="error() ? errorId : null"
          [attr.aria-invalid]="error() ? true : null"
          (change)="alElegir($event)"
        />
      </label>
    }
    @if (error()) {
      <p [id]="errorId" role="alert" class="text-destructive mt-2 text-sm font-medium">
        {{ error() }}
      </p>
    }
  `,
})
export class SubidaPdf {
  readonly archivo = model<File | null>(null);
  readonly deshabilitado = input(false);

  protected readonly arrastrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly inputId = `halsa-subida-pdf-${siguienteId++}`;
  protected readonly errorId = `${this.inputId}-error`;
  protected readonly tamano = formatTamanoArchivo;

  protected alArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    if (!this.deshabilitado()) this.arrastrando.set(true);
  }

  protected alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    if (this.deshabilitado()) return;
    void this.procesar(evento.dataTransfer?.files.item(0) ?? null);
  }

  protected alElegir(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    void this.procesar(input.files?.item(0) ?? null);
    input.value = '';
  }

  protected quitar(): void {
    this.archivo.set(null);
    this.error.set(null);
  }

  private async procesar(archivo: File | null): Promise<void> {
    if (!archivo) return;
    const error = await validarPdf(archivo);
    this.error.set(error ? ERROR_PDF_MENSAJES[error] : null);
    this.archivo.set(error ? null : archivo);
  }
}
