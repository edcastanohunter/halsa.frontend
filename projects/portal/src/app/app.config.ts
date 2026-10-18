import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { AppConfig, provideAppConfig } from '@halsa/core';
import { routes } from './app.routes';

export function appConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideZonelessChangeDetection(),
      provideBrowserGlobalErrorListeners(),
      provideHttpClient(),
      provideAppConfig(config),
      provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    ],
  };
}
