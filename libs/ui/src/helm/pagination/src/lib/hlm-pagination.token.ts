import { inject, InjectionToken, type ValueProvider } from '@angular/core';

export interface HlmPaginationConfig {
  totalItemsLabel: string;
  pagesLabel: string;
  previousLabel: string;
  previousAriaLabel: string;
  nextLabel: string;
  nextAriaLabel: string;
}

const defaultConfig: HlmPaginationConfig = {
  totalItemsLabel: 'total items',
  pagesLabel: 'pages',
  nextLabel: 'Siguiente',
  nextAriaLabel: 'Ir a la página siguiente',
  previousLabel: 'Anterior',
  previousAriaLabel: 'Ir a la página anterior',
};

const HlmPaginationConfigToken = new InjectionToken<HlmPaginationConfig>('HlmPaginationConfig');

export function provideHlmPaginationConfig(config: Partial<HlmPaginationConfig>): ValueProvider {
  return { provide: HlmPaginationConfigToken, useValue: { ...defaultConfig, ...config } };
}

export function injectHlmPaginationConfig(): HlmPaginationConfig {
  return inject(HlmPaginationConfigToken, { optional: true }) ?? defaultConfig;
}
