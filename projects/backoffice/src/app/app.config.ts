import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
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
import { provideOidc } from './core/auth/oidc';
import { authInterceptor } from './core/http/auth.interceptor';
import { stepUpInterceptor } from './core/http/step-up.interceptor';
import { SesionService } from './core/sesion/sesion.service';
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
      provideOidc(config),
      // Order matters (plan §5.1.3). The step-up/expired-session handler is outermost so its one
      // retry goes through authInterceptor again; the mock adapter, when enabled, is last so the
      // real interceptors still run against it.
      provideHttpClient(
        withInterceptors([
          stepUpInterceptor,
          authInterceptor,
          correlacionInterceptor,
          problemaInterceptor,
          ...devInterceptors(config),
        ]),
      ),
      provideSpartanHlm(),
      provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
      // OIDC callback + `identidad/yo` before the first navigation, so guards see the session.
      provideAppInitializer(() => inject(SesionService).iniciar()),
    ],
  };
}
