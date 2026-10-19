import { HttpInterceptorFn } from '@angular/common/http';
import { AppConfig } from '@halsa/core';
import { crearMockBackoffice } from '../mocks';

// Dev-only interceptors. Production builds replace this file with dev.interceptors.prod.ts
// (angular.json), so the mock adapter never reaches a production bundle.
export function devInterceptors(config: AppConfig): HttpInterceptorFn[] {
  return config.mock ? [crearMockBackoffice(config.apiBaseUrl)] : [];
}
