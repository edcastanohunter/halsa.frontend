/** Semantic tones shared by badges, chips and semaphores (plan §8.3). */
export type Tono =
  'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'destructive' | 'clinical' | 'muted';

/** Soft style: tinted background, colored text and a subtle ring. Contrast-checked in tokens.css. */
export const TONO_SUAVE: Record<Tono, string> = {
  neutral: 'bg-muted text-foreground ring-border',
  primary: 'bg-primary/12 text-primary ring-primary/25',
  info: 'bg-info/12 text-info ring-info/25',
  success: 'bg-success/12 text-success ring-success/25',
  warning: 'bg-warning/12 text-warning ring-warning/30',
  destructive: 'bg-destructive/12 text-destructive ring-destructive/25',
  clinical: 'bg-clinical/12 text-clinical ring-clinical/25',
  muted: 'bg-muted text-muted-foreground ring-border',
};

/** Outline style (no fill), e.g. an audit `Error` or a deadline with less than 24 h left. */
export const TONO_CONTORNO: Record<Tono, string> = {
  neutral: 'bg-transparent text-foreground ring-input',
  primary: 'bg-transparent text-primary ring-primary',
  info: 'bg-transparent text-info ring-info',
  success: 'bg-transparent text-success ring-success',
  warning: 'bg-transparent text-warning ring-warning',
  destructive: 'bg-transparent text-destructive ring-destructive',
  clinical: 'bg-transparent text-clinical ring-clinical',
  muted: 'bg-transparent text-muted-foreground ring-border',
};
