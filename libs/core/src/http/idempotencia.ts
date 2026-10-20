export const CABECERA_IDEMPOTENCIA = 'Idempotency-Key';

/**
 * One `Idempotency-Key` per submitted form state (plan §5.3.7). `para(datos, archivo)` returns
 * the same key while the serialized data and the file are the same, so a retry after a network
 * error replays instead of creating a duplicate; any change gets a fresh UUID v4.
 */
export class ClaveIdempotencia {
  private clave: string | null = null;
  private datos: string | null = null;
  private archivo: Blob | null = null;

  constructor(private readonly generar: () => string = () => crypto.randomUUID()) {}

  para(datos: string, archivo: Blob | null = null): string {
    if (this.clave === null || datos !== this.datos || archivo !== this.archivo) {
      this.clave = this.generar();
      this.datos = datos;
      this.archivo = archivo;
    }
    return this.clave;
  }

  /** After a definitive answer (success or a rejection): the next submission is a new one. */
  descartar(): void {
    this.clave = null;
    this.datos = null;
    this.archivo = null;
  }
}
