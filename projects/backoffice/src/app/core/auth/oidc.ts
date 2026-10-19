import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { AppConfig } from '@halsa/core';
import {
  LogLevel,
  OidcSecurityService,
  OpenIdConfiguration,
  provideAuth,
} from 'angular-auth-oidc-client';
import { map } from 'rxjs';
import { TOKEN_ACCESO } from '../http/auth.interceptor';
import { RUTA_CALLBACK } from './retorno';

/** Plan §5.1.1. Exported for the unit test of the settings. */
export function configuracionOidc(config: AppConfig, origen: string): OpenIdConfiguration {
  if (!config.keycloak) throw new Error('config.json: "keycloak" is required for the backoffice');
  return {
    authority: config.keycloak.authority,
    clientId: config.keycloak.clientId,
    responseType: 'code',
    // The realm adds its default client scopes (acr, roles, halsa-claims). `email` doesn't exist.
    scope: 'openid',
    redirectUrl: origen + RUTA_CALLBACK,
    postLogoutRedirectUri: origen + '/',
    useRefreshToken: true,
    silentRenew: true,
    renewTimeBeforeTokenExpiresInSeconds: 30,
    ignoreNonceAfterRefresh: true,
    triggerAuthorizationResultEvent: true,
    // The id token has the name; no extra userinfo round trip.
    autoUserInfo: false,
    secureRoutes: [`${config.apiBaseUrl}/v1/`],
    // The library logs through console.*; tokens and URLs with codes must never reach it.
    logLevel: LogLevel.None,
  };
}

/** OIDC + PKCE against Keycloak; tokens stay in the library's sessionStorage, never localStorage. */
export function provideOidc(config: AppConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAuth({ config: configuracionOidc(config, globalThis.location.origin) }),
    {
      provide: TOKEN_ACCESO,
      useFactory: () => {
        const oidc = inject(OidcSecurityService);
        return () => oidc.getAccessToken().pipe(map((token) => token || null));
      },
    },
  ]);
}
