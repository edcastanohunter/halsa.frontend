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
  correlacionInterceptor,
  problemaInterceptor,
  provideAppConfig,
  provideLocaleEsCo,
  provideManejadorErrores,
} from '@halsa/core';
import { provideSpartanHlm } from '@halsa/ui/helm/utils';
import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { devInterceptors } from './dev.interceptors';

export function appConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideZonelessChangeDetection(),
      provideBrowserGlobalErrorListeners(),
      provideManejadorErrores(),
      provideLocaleEsCo(),
      provideAppConfig(config),
      { provide: API_PREFIX, useValue: `${config.apiBaseUrl}/v1/` },
      // Order matters (plan §5.1.3); the mock adapter, when enabled, is last so the real
      // interceptors still run against it.
      provideHttpClient(
        withInterceptors([
          authInterceptor,
          correlacionInterceptor,
          problemaInterceptor,
          ...devInterceptors(config),
        ]),
      ),
      provideSpartanHlm(),
      provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    ],
  };
}
