import { HttpInterceptorFn } from '@angular/common/http';
import { AppConfig } from '@halsa/core';

export function devInterceptors(config: AppConfig): HttpInterceptorFn[] {
  void config;
  return [];
}
