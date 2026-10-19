import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import {
  API_PREFIX,
  AppConfig,
  problemaInterceptor,
  provideAppConfig,
  provideLocaleEsCo,
  provideManejadorErrores,
} from '@halsa/core';
import { provideSpartanHlm } from '@halsa/ui/helm/utils';
import { routes } from './app.routes';
import { devInterceptors } from './dev.interceptors';

export function appConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideZonelessChangeDetection(),
      provideBrowserGlobalErrorListeners(),
      provideManejadorErrores(),
      provideLocaleEsCo(),
      provideAppConfig(config),
      // The portal only talks to its BFF, same origin (plan §4.1).
      { provide: API_PREFIX, useValue: '/paciente/' },
      provideHttpClient(withInterceptors([problemaInterceptor, ...devInterceptors(config)])),
      provideSpartanHlm(),
      provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    ],
  };
}
