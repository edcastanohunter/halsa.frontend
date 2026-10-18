import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes the way Spartan helm components expect (clsx + tailwind-merge). */
export function hlm(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
