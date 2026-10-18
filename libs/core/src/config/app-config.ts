import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

export interface KeycloakConfig {
  authority: string;
  clientId: string;
}

export interface AppConfig {
  apiBaseUrl: string;
  mock?: boolean;
  keycloak?: KeycloakConfig;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// Injected per build configuration through angular.json `define` (the `mock` configuration
// points it at config.mock.json). Undefined in unit tests.
declare const HALSA_CONFIG_URL: string | undefined;

export const DEFAULT_CONFIG_URL =
  typeof HALSA_CONFIG_URL === 'string' ? HALSA_CONFIG_URL : '/config.json';

/**
 * Fetches the runtime config before bootstrap, so one build serves every environment.
 * There is no fallback: a missing or malformed config must fail loudly.
 */
export async function loadAppConfig(url: string = DEFAULT_CONFIG_URL): Promise<AppConfig> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  }
  const config = (await response.json()) as Partial<AppConfig>;
  if (typeof config.apiBaseUrl !== 'string') {
    throw new Error(`Invalid ${url}: "apiBaseUrl" must be a string`);
  }
  return config as AppConfig;
}

export function provideAppConfig(config: AppConfig): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: APP_CONFIG, useValue: config }]);
}

/** Replaces the page with a static Spanish message when bootstrap fails (no console in app code). */
export function renderBootstrapError(doc: Document = document): void {
  const message = doc.createElement('p');
  message.setAttribute('role', 'alert');
  message.style.cssText = 'font-family: system-ui, sans-serif; padding: 1.5rem;';
  message.textContent =
    'No fue posible iniciar la aplicación. Recarga la página o inténtalo más tarde.';
  doc.body.replaceChildren(message);
}
