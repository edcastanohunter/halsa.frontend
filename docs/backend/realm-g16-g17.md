# Cambios de realm pendientes en el backend (G16 y G17)

Aplican igual a `docker/keycloak/halsa-realm.json` (desarrollo) y a
`deploy/keycloak/halsa.prod.json` (producción). El frontend ya los aplica a sus realms mock
desde `scripts/sync-realms.mjs` (`withBasicScope` y `withCookieStep`), con la misma forma que
se muestra aquí. Cuando el backend los incorpore, esas funciones no hacen nada y se pueden quitar.

## G16: client scope `basic`

Keycloak 25+ saca `sub` y `auth_time` de los tokens si el realm no tiene el scope `basic`. El API
lee los dos (CurrentUser, ProfesionalActual, StepUp). Sin `auth_time`, la ventana de 15 min del
dictamen no puede validarse.

1. Agregar a `clientScopes`:

```json
{
  "name": "basic",
  "description": "OpenID Connect scope for add all basic claims to the token",
  "protocol": "openid-connect",
  "attributes": { "include.in.token.scope": "false", "display.on.consent.screen": "false" },
  "protocolMappers": [
    {
      "name": "auth_time",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-usersessionmodel-note-mapper",
      "consentRequired": false,
      "config": {
        "user.session.note": "AUTH_TIME",
        "introspection.token.claim": "true",
        "userinfo.token.claim": "true",
        "id.token.claim": "true",
        "lightweight.claim": "true",
        "access.token.claim": "true",
        "claim.name": "auth_time",
        "jsonType.label": "long"
      }
    },
    {
      "name": "sub",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-sub-mapper",
      "consentRequired": false,
      "config": { "introspection.token.claim": "true", "access.token.claim": "true" }
    }
  ]
}
```

2. Agregar `"basic"` a `defaultDefaultClientScopes`. Si algún cliente declara su propio
   `defaultClientScopes`, agregarlo también ahí.

En un realm ya importado (prod), el mismo cambio se hace en la consola: Client scopes → Create
(o importar el JSON de arriba) → Type `Default`. Después, en cada cliente, Client scopes → Add
client scope → `basic` → Default.

## G17: paso Cookie en `browser-loa`

Hoy el flujo arranca directo en los subflujos de nivel. En un step-up, Keycloak no reconoce la
sesión existente y vuelve a pedir la contraseña antes del OTP. El flujo de step-up que documenta
Keycloak pone Cookie primero, como alternativa a los subflujos:

- si la sesión ya cumple el nivel pedido, Cookie entra sin pedir nada;
- si no, `loa-nivel-1` (10 h) da por cumplido el nivel 1 y solo se pide el OTP.

Reemplazar `authenticationExecutions` del flujo `browser-loa` (top level) por:

```json
[
  {
    "authenticator": "auth-cookie",
    "requirement": "ALTERNATIVE",
    "priority": 10,
    "authenticatorFlow": false,
    "autheticatorFlow": false,
    "userSetupAllowed": false
  },
  {
    "flowAlias": "browser-loa niveles",
    "requirement": "ALTERNATIVE",
    "priority": 20,
    "authenticatorFlow": true,
    "autheticatorFlow": true,
    "userSetupAllowed": false
  }
]
```

Los subflujos `browser-loa niveles`, `nivel 1` y `nivel 2` y los configs `loa-nivel-1` y
`loa-nivel-2` no cambian.

En la consola: Authentication → `browser-loa` → Add step → Cookie. Subirlo al primer lugar y
poner Cookie y `browser-loa niveles` como Alternative.

## Verificación

Con `npm run kc:reset` y `npm run e2e` en el frontend:

- los tokens traen `sub` y `auth_time`; la Cuenta muestra el `sub`;
- el step-up de `calificador.arla` y `medico.ips` abre un popup que pide solo el código
  (`e2e/identidad.spec.ts` verifica que no aparezca el campo de contraseña).
