import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { EnvironmentProviders, LOCALE_ID, makeEnvironmentProviders } from '@angular/core';

/** Registers es-CO locale data and sets `LOCALE_ID` so Angular pipes match `Intl` (plan §8.5). */
export function provideLocaleEsCo(): EnvironmentProviders {
  registerLocaleData(localeEsCo);
  return makeEnvironmentProviders([{ provide: LOCALE_ID, useValue: 'es-CO' }]);
}
