# Despliegue del frontend Halsa

Dos imágenes, una por aplicación, servidas por nginx sin privilegios (plan §10). La misma imagen sirve cualquier ambiente: las URLs llegan por variables de entorno y se escriben en `config.json` al arrancar el contenedor.

| Imagen             | Dockerfile                     | Destino (plan §10.4)                                          |
| ------------------ | ------------------------------ | ------------------------------------------------------------- |
| `halsa-backoffice` | `deploy/backoffice/Dockerfile` | `https://halsa-backoffice.alcast.dev`                         |
| `halsa-portal`     | `deploy/portal/Dockerfile`     | `https://halsa-pacientes.alcast.dev/` (mismo host que el BFF) |

## Contenido

```
deploy/
  backoffice/Dockerfile        node:22.23.4-alpine (build) → nginxinc/nginx-unprivileged:1.30.6-alpine
  portal/Dockerfile            idem
  nginx/16-halsa.envsh         al arrancar: valida el entorno, escribe config.json y arma la CSP
  nginx/default.conf.template  servidor SPA (puerto 8080, /health, caché)
  nginx/seguridad.inc.template cabeceras de seguridad, incluidas en cada location
```

- **Build:** `npm ci` con npm 11.6.2 (el de `packageManager`; el npm 10 de node 22 rechaza el lockfile), `ng build <app>` en producción y `scripts/check-bundles.mjs <app>`: el build falla si se pasan los presupuestos gzip o si entra código de mocks.
- **Ejecución:** usuario `nginx` (uid 101), puerto **8080**, `HEALTHCHECK` contra `/health`. Escribe solo en `/etc/nginx/conf.d` (plantillas) y `/tmp` (`config.json` y temporales de nginx). Con `read_only: true` monta ambos como `tmpfs`.
- **Caché:** los archivos con hash (`main-ABCD1234.js`, fuentes en `media/`) llevan `max-age=31536000, immutable`; `index.html`, `config.json`, `theme-init.js` y toda ruta del cliente (fallback SPA a `index.html`) llevan `no-cache`.
- **gzip** en nginx para JS, CSS, JSON y SVG.

## Construir

Contexto: la raíz del repositorio.

```bash
docker build -f deploy/backoffice/Dockerfile -t halsa-backoffice .
docker build -f deploy/portal/Dockerfile -t halsa-portal .
# En la máquina de desarrollo (Podman): podman build ... (mismos argumentos)
```

## Variables de entorno

### Backoffice

| Variable                   | Requerida                 | Ejemplo                                | Uso                                                                                                       |
| -------------------------- | ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `HALSA_KEYCLOAK_AUTHORITY` | sí                        | `https://auth.alcast.dev/realms/halsa` | `config.json` → `keycloak.authority`; su origen va a `connect-src`, `frame-src` y `form-action` de la CSP |
| `HALSA_API_BASE_URL`       | no (vacío = mismo origen) | `https://halsa-api.alcast.dev`         | `config.json` → `apiBaseUrl` (la app agrega `/v1/`); su origen va a `connect-src`                         |
| `HALSA_KEYCLOAK_CLIENT_ID` | no                        | `halsa-backoffice` (por defecto)       | `config.json` → `keycloak.clientId`                                                                       |

El contenedor **no arranca** si falta la autoridad, si una URL no es `http(s)://…` o si trae caracteres fuera de una URL (comillas, espacios), porque esos valores terminan dentro de JSON y de una cabecera HTTP.

### Portal

No usa variables. Solo habla con su BFF en el mismo host (`/paciente/*`), así que `config.json` es fijo (`{"apiBaseUrl":"","mock":false}`) y la CSP solo permite `'self'`.

## Cabeceras de seguridad (plan §10.3)

Las dos apps envían en **todas** las respuestas:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src <ver abajo>; [frame-src <keycloak>;]
  frame-ancestors 'none'; base-uri 'self'; form-action <ver abajo>; object-src 'none';
  require-trusted-types-for 'script'; trusted-types angular angular#bundler halsa#iconos
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin-allow-popups   (unsafe-none en /auth/callback)
```

| Directiva     | Backoffice                                     | Portal        |
| ------------- | ---------------------------------------------- | ------------- |
| `connect-src` | `'self'` + origen del API + origen de Keycloak | `'self'`      |
| `frame-src`   | origen de Keycloak                             | (no se envía) |
| `form-action` | `'self'` + origen de Keycloak                  | `'self'`      |

- **Trusted Types:** `angular` es la política del framework; `halsa#iconos` la crea `provideIconosTrustedTypes()` (`@halsa/ui/iconos`) para los SVG de lucide que `ng-icon` inserta con `innerHTML`. No hay política `default`: cualquier otro `innerHTML` con texto plano queda bloqueado.
- `'unsafe-inline'` solo en estilos (Angular inyecta los estilos de componentes en runtime). No hay scripts inline: el tema se aplica antes del primer pintado desde `theme-init.js`.
- `same-origin-allow-popups`: el step-up del backoffice abre Keycloak en un popup que necesita `window.opener`. **Excepción: `/auth/callback` se sirve con `unsafe-none`** (un `map` sobre `$request_uri` en `default.conf`): con cualquier otro COOP, la vuelta del popup desde Keycloak lo pasa a otro _browsing context group_, el opener lo ve cerrado y `window.opener` queda en `null` (G25). El dev server de Angular no puede variar cabeceras por ruta, así que `ng serve backoffice` no envía COOP.
- **HSTS** lo pone el proxy que termina TLS (NPM: "HSTS Enabled" en la pestaña SSL), no el contenedor, que habla HTTP.
- Los dev servers (`ng serve`) envían la misma CSP con los orígenes locales (`angular.json` → `serve.options.headers`), y la suite E2E falla ante cualquier violación de CSP o Trusted Types (`e2e/fixtures.ts`).

## Probar en local

```bash
# Backoffice contra el Keycloak de Podman (npm run kc:up). El realm de desarrollo solo registra
# http://localhost:3000 como redirect URI, de ahí el puerto (detén ng serve antes).
podman run --rm -p 3000:8080 \
  -e HALSA_KEYCLOAK_AUTHORITY=http://localhost:8180/realms/halsa \
  -e HALSA_API_BASE_URL=http://localhost:5600 \
  halsa-backoffice

# Portal: arranca y muestra "No pudimos conectar" (no hay BFF detrás en este puerto).
podman run --rm -p 4380:8080 halsa-portal

curl -i http://localhost:3000/health
curl -i http://localhost:3000/config.json
curl -sI http://localhost:3000/casos | grep -i content-security-policy
```

El API local no tiene CORS (G1): el backoffice en contenedor puede iniciar sesión en el Keycloak de Podman, pero sus llamadas a `http://localhost:5600` fallan por CORS. Para la prueba de punta a punta con el API se usa `ng serve` con el proxy.

## Despliegue en VPS (push a `main`)

Sin registry, igual que `Halsa.Backend`: el job `deploy` de `.github/workflows/frontend.yml` (con aprobación del environment `produccion`) construye las imágenes para **linux/arm64**, las envía por SSH como `paquete.tar` y `halsa-recibir-despliegue-front` las carga y reinicia los Quadlets en el VPS. La llave del CI solo puede ejecutar ese script.

| Archivo                                                                | Función                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `vps/recibir-despliegue-front.sh`                                      | script del VPS: valida, `podman load`, cambia `HALSA_FRONT_TAG`, reinicia, rollback |
| `quadlet/halsa-backoffice.container`, `quadlet/halsa-portal.container` | unidades systemd rootless en la red `halsa_borde`, `Notify=healthy`                 |
| `quadlet/frontend.env.ejemplo`                                         | `~/.config/halsa-frontend/frontend.env`: tag actual y URLs del backoffice           |

Instalación, secretos, verificación y rollback: [`docs/RUNBOOK.md`](../docs/RUNBOOK.md) §4.4, §5.4 y §5.6.

## Compose (fragmento para el stack del backend)

```yaml
services:
  halsa-backoffice:
    image: halsa-backoffice:latest
    restart: unless-stopped
    read_only: true
    tmpfs: [/tmp, /etc/nginx/conf.d]
    environment:
      HALSA_KEYCLOAK_AUTHORITY: https://auth.alcast.dev/realms/halsa
      HALSA_API_BASE_URL: https://halsa-api.alcast.dev
    networks: [proxy]

  halsa-portal:
    image: halsa-portal:latest
    restart: unless-stopped
    read_only: true
    tmpfs: [/tmp, /etc/nginx/conf.d]
    networks: [proxy]
```

El entrypoint llena `/etc/nginx/conf.d` desde `/etc/nginx/templates` y necesita poder escribir ahí como uid 101. Docker monta los `tmpfs` con modo 1777; **Podman los monta `root:root` 0775**, así que en Podman/Quadlet hay que pedir `Tmpfs=/etc/nginx/conf.d:mode=1777` (sin eso el entrypoint falla con `conf.d is not writable` y nginx sirve su configuración por defecto, sin `/health`).

## Nginx Proxy Manager

### Backoffice (G2)

Nuevo _Proxy Host_ `halsa-backoffice.alcast.dev` → `http://halsa-backoffice:8080`, SSL con Let's Encrypt, "Force SSL" y HSTS. Sin configuración avanzada.

### Portal (G2): `/` al portal, `/paciente/*` al BFF

El host `halsa-pacientes.alcast.dev` ya existe para el BFF y hoy responde `404` en `/`. Debe quedar así (pestaña _Advanced_, o _Custom locations_):

```nginx
# El BFF conserva /paciente/* (login, callbacks OIDC, API). Host y esquema originales: el BFF arma
# redirect_uri con ellos y la cookie __Host- queda en este origen.
location /paciente/ {
    proxy_pass http://halsa-bff-paciente:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# Todo lo demás es el portal.
location / {
    proxy_pass http://halsa-portal:8080;
    proxy_set_header Host $host;
}
```

Ajusta el nombre y puerto del contenedor del BFF a los del compose del backend. El portal nunca usa rutas que empiecen por `/paciente` (plan §5.2).

## Lo que falta del lado del backend

| Gap                             | Qué hacer                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1 · CORS en el API**         | Permitir el origen `https://halsa-backoffice.alcast.dev`; métodos `GET, POST, PATCH, DELETE`; cabeceras `Authorization, Content-Type, Idempotency-Key, Halsa-Motivo-Acceso, X-Correlation-Id`; **cabeceras expuestas** `WWW-Authenticate, Location, Content-Disposition, Retry-After`. Sin `WWW-Authenticate` expuesta el step-up no se detecta. |
| **G2 · Hosting**                | Los dos proxy hosts de arriba.                                                                                                                                                                                                                                                                                                                   |
| **G3 · Redirect URI del BFF**   | Para desarrollo: agregar `https://localhost:4300/paciente/bff/signin-oidc` y el post-logout `https://localhost:4300/paciente/bff/signout-callback-oidc` a `halsa-bff-paciente`.                                                                                                                                                                  |
| **Keycloak `halsa-backoffice`** | Producción: redirect URI `https://halsa-backoffice.alcast.dev/*` y web origin `https://halsa-backoffice.alcast.dev`.                                                                                                                                                                                                                             |
| **G14 · Tema de login**         | `keycloak-theme/README.md`.                                                                                                                                                                                                                                                                                                                      |
