import { HttpInterceptorFn } from '@angular/common/http';
import { Provider } from '@angular/core';
import { AppConfig } from '@halsa/core';

export function devInterceptors(config: AppConfig): HttpInterceptorFn[] {
  void config;
  return [];
}

export function devProviders(config: AppConfig): Provider[] {
  void config;
  return [];
}
