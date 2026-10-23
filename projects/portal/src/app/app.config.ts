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
import { provideIconosTrustedTypes } from '@halsa/ui/iconos';
import { provideSpartanHlm } from '@halsa/ui/helm/utils';
import { routes } from './app.routes';
import { csrfInterceptor, sesionExpiradaInterceptor } from './core/http/interceptores';
import { SesionPaciente } from './core/sesion/sesion.service';
import { devInterceptors, devProviders } from './dev.interceptors';

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
      // The expired-session handler is outermost so it sees the parsed problem; the mock adapter,
      // when enabled, is last so the real interceptors (CSRF included) still run against it.
      provideHttpClient(
        withInterceptors([
          sesionExpiradaInterceptor,
          csrfInterceptor,
          correlacionInterceptor,
          problemaInterceptor,
          ...devInterceptors(config),
        ]),
      ),
      provideSpartanHlm(),
      provideIconosTrustedTypes(),
      provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
      // `bff/usuario` before the first navigation, so the guards know the session.
      provideAppInitializer(() => inject(SesionPaciente).iniciar()),
      ...devProviders(config),
    ],
  };
}
