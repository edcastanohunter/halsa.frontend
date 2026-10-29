# Runbook — Halsa Frontend

> Cómo correr y operar las dos aplicaciones (`backoffice` y `portal`) en local y en producción.
> Es el resumen operativo; los detalles de diseño/contrato viven en
> [`prompt/02_handoff-frontend.md`](../prompt/02_handoff-frontend.md), las reglas en
> [`GEMINI.md`](../GEMINI.md) y el despliegue en [`deploy/README.md`](../deploy/README.md).

---

## 1. Qué es

Un workspace Angular 21 (sin SSR, zoneless) con dos aplicaciones:

| App                   | Público          | Identidad                                            | Habla con                                |
| --------------------- | ---------------- | ---------------------------------------------------- | ---------------------------------------- |
| `projects/backoffice` | Personal ARL/IPS | OIDC + PKCE (Keycloak), Bearer a `/v1`               | API `halsa-api`                          |
| `projects/portal`     | Pacientes        | BFF (cookie HttpOnly, `X-Halsa-Csrf: 1`), sin tokens | BFF `halsa-bff-paciente` (`/paciente/*`) |

Código compartido en `libs/ui`, `libs/core`, `libs/api-types`. El backend está en `../Halsa.Backend` (solo lectura para este repo).

---

## 2. Referencia rápida de comandos

```bash
npm ci                                # instalar (npm 11.6.2, ver §3.1)
npm run lint                          # eslint (fronteras, no-console, imports)
npm run test                          # contraste + unit (backoffice + portal)
npm run build                         # build prod + presupuestos gzip + sin __mock
npm run e2e                           # Playwright (levanta los dev servers; kc:up antes)
npm run e2e:update                    # refrescar líneas base visuales
npm run e2e:theme                     # Playwright del tema de Keycloak (kc:up antes)
npm run api:types                     # regenerar tipos OpenAPI (API corriendo en :5600)
npm run api:types:yaml                # idem desde ../Halsa.Backend/docs/api/atel-api.openapi.yaml

npm run kc:up / kc:down / kc:reset / kc:logs / kc:sync   # Keycloak local (Podman)
npm run theme:css / theme:watch / theme:build            # tema de login (JAR)
npm run check:contrast                 # WCAG 2.2 AA de los tokens
```

---

## 3. Local (desarrollo)

### 3.1 Requisitos

- **Node 22** (CI y contenedores usan v22) y **npm 11.6.2** (el `packageManager`; el npm 10 de node 22 rechaza el lockfile).
- **Podman 6** para el Keycloak local, con la máquina iniciada (`podman machine start`) y un proveedor de compose (`podman compose version`; si no hay, `pip install podman-compose`). No se usa Docker.
- Para E2E/visual: `npx playwright install chromium` la primera vez.

### 3.2 Puesta en marcha

```bash
npm ci
npm run kc:up          # Keycloak :8180 + Mailpit :8025 (SMTP para "revisa tu correo")
npm run start:mock     # backoffice :3000 — Keycloak de Podman + API mock
npm run start:portal:mock   # portal :4300 — BFF mock (mientras G3 sigue abierto)
```

### 3.3 Modos de ejecución

| Modo                                | Identidad                    | API/BFF                                       | Cuándo                          |
| ----------------------------------- | ---------------------------- | --------------------------------------------- | ------------------------------- |
| `ng serve backoffice --port 3000`   | Keycloak del backend (:8080) | API real a través del proxy (`/v1` → `:5600`) | Integración / E2E real          |
| `npm run start:mock`                | Keycloak de Podman (:8180)   | Adaptador mock (interceptor dev)              | UI, step-up, matriz de permisos |
| `ng serve portal --port 4300 --ssl` | BFF real (cookie)            | BFF `:5610` a través del proxy                | Requiere G3 (redirect URIs)     |
| `npm run start:portal:mock`         | sesión BFF simulada          | BFF mock                                      | UI del portal                   |

- El backoffice usa el puerto **3000** porque el realm de desarrollo solo lo registra como redirect URI.
- El portal requiere **HTTPS** (`--ssl`, puerto 4300): la cookie `__Host-` solo se fija en un origen seguro.
- La configuración de runtime (`config.json`) se carga antes del bootstrap (`loadAppConfig()` de `@halsa/core`). El modo mock apunta a `config.mock.json` (via `define` en `angular.json`).

### 3.4 Usuarios de desarrollo (contraseña `dev`)

| Usuario                           | Realm             | OTP                                       | Notas                            |
| --------------------------------- | ----------------- | ----------------------------------------- | -------------------------------- |
| `analista.arla` / `analista.arlb` | `halsa`           | no                                        | administrativo, sin clínico      |
| `calificador.arla`                | `halsa`           | **sí** `NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR` | dictamen PCL, emergencia         |
| `privacidad.arla`                 | `halsa`           | no                                        | auditoría, revisiones, copias HC |
| `medico.ips`                      | `halsa`           | **sí** `NBQWY43BMRSXM3LFMRUWG33JOBZTAMBR` | clínico IPS, incapacidades       |
| `coordinador.ips`                 | `halsa`           | no                                        | asignación IPS                   |
| `paciente.dev@halsa.dev`          | `halsa-pacientes` | no                                        | portal                           |

Consola de administración: `http://localhost:8180/admin` (`admin`/`admin`). Los TOTP son SHA-1, 6 dígitos, 30 s; Playwright los genera con `otplib`.

### 3.5 Tema de login de Keycloak

- `npm run theme:watch` + `npm run kc:up` → los cambios en `.ftl`/CSS/mensajes se ven al recargar (Keycloak corre con `start-dev`, sin caché de temas).
- Páginas de referencia: `http://localhost:8180/realms/halsa/account` (staff) y `http://localhost:8180/realms/halsa-pacientes/account` (pacientes → "Crear cuenta").
- Empaquetar para el backend: `npm run theme:build` → `dist/keycloak-theme/halsa-keycloak-theme.jar`. Instalación en los Keycloak del backend: [`keycloak-theme/README.md`](../keycloak-theme/README.md) (G14).
- `kc:sync` regenera `dev/keycloak/realms/*.json` desde `../Halsa.Backend/docker/keycloak` (se versionan); aplica G16/G17 solo en local (detalle en [`docs/backend/realm-g16-g17.md`](backend/realm-g16-g17.md)).

### 3.6 Pruebas y líneas base visuales

- `npm run test` corre el chequeo de contraste y las pruebas unitarias (Vitest) de ambas apps.
- `npm run e2e` corre la suite Playwright (dev servers se levantan solos si no están corriendo). La CSP de producción se sirve desde `angular.json` → `serve.headers`, y el fixture `e2e/fixtures.ts` falla cualquier spec con una violación de CSP/Trusted Types.
- Tras un cambio de estilos/tokens/helm/Halsa component: corre `npm run e2e`, revisa los diffs en `playwright-report/`, y si el cambio es intencional `npm run e2e:update` (y `npm run e2e:theme -- --update-snapshots` si tocaste `tokens.css` o el tema). Commitea código + líneas base + `docs/reportes/` juntos.
- La suite E2E completa incluye flujos con step-up OTP real (`calificador.arla`, `medico.ips`). Con workers en paralelo, el OTP a veces se cae por contención de la ventana TOTP de 30 s (conocido, M6/M7); se reintenta serializado: `npx playwright test <spec> --workers=1`.

---

## 4. Producción (despliegue)

### 4.1 Imágenes

Una imagen por app, multi-stage (`node:22.23.4-alpine` → `nginxinc/nginx-unprivileged:1.30.6-alpine`), no-root (uid 101), puerto **8080**, `HEALTHCHECK /health`. La misma imagen sirve cualquier ambiente: las URLs llegan por variables de entorno y se escriben en `config.json` al arrancar.

```bash
# Contexto: la raíz del repo. En la máquina dev: podman build ... (mismos argumentos).
docker build -f deploy/backoffice/Dockerfile -t halsa-backoffice .
docker build -f deploy/portal/Dockerfile    -t halsa-portal .
```

El build falla si se pasan los presupuestos gzip (`scripts/check-bundles.mjs`) o si entra código de mocks/showcase.

**Despliegue automático:** un push a `main` publica las imágenes en GHCR y reinicia los contenedores en el VPS (ver §4.4 y §5.6). El despliegue manual con `docker build` solo hace falta fuera del pipeline.

### 4.2 Variables de entorno

**Backoffice**

| Variable                   | Requerida                 | Ejemplo                                | Uso                                                                                          |
| -------------------------- | ------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `HALSA_KEYCLOAK_AUTHORITY` | sí                        | `https://auth.alcast.dev/realms/halsa` | `config.json` → `keycloak.authority`; su origen va a `connect-src`/`frame-src`/`form-action` |
| `HALSA_API_BASE_URL`       | no (vacío = mismo origen) | `https://halsa-api.alcast.dev`         | `config.json` → `apiBaseUrl` (la app agrega `/v1/`)                                          |
| `HALSA_KEYCLOAK_CLIENT_ID` | no                        | `halsa-backoffice` (por defecto)       | `config.json` → `keycloak.clientId`                                                          |

El contenedor **no arranca** si falta la autoridad, si una URL no es `http(s)://…` o si trae caracteres fuera de una URL (los valores terminan dentro de JSON y de una cabecera HTTP).

**Portal:** no usa variables — solo habla con su BFF en el mismo host (`/paciente/*`); `config.json` es fijo (`{"apiBaseUrl":"","mock":false}`) y la CSP solo permite `'self'`.

### 4.3 Ejecutar el contenedor en local

```bash
# Backoffice (detén ng serve antes: el realm dev solo registra http://localhost:3000)
podman run --rm -p 3000:8080 \
  -e HALSA_KEYCLOAK_AUTHORITY=http://localhost:8180/realms/halsa \
  -e HALSA_API_BASE_URL=http://localhost:5600 \
  halsa-backoffice

# Portal
podman run --rm -p 4380:8080 halsa-portal
```

Verificación:

```bash
curl -i http://localhost:3000/health        # 200 "ok"
curl -i http://localhost:3000/config.json   # generado desde las variables
curl -sI http://localhost:3000/casos | grep -i content-security-policy   # CSP + Trusted Types
```

El API local no tiene CORS (G1): en contenedor el backoffice puede iniciar sesión en el Keycloak de Podman, pero sus llamadas a `:5600` fallan por CORS. La prueba punta a punta contra el API usa `ng serve` con el proxy.

### 4.4 Despliegue en el VPS (quadlet + GitHub Actions)

Cada push a `main` ejecuta el job `deploy` de `.github/workflows/frontend.yml` (después de `validate` e `images`):

1. Construye y publica `ghcr.io/edcastanohunter/halsa-backoffice` y `halsa-portal`, con tags `:latest` y `:<sha del commit>`.
2. Abre SSH al VPS (secretos `VPS_*`), hace `podman login ghcr.io` con el `GITHUB_TOKEN` del job (por stdin; no hay PAT guardado en el VPS) y `podman pull` de ambas imágenes.
3. Reinicia `halsa-backoffice.service` y `halsa-portal.service` con `systemctl --user restart` y lista el estado de los contenedores.

Los contenedores los define systemd mediante Quadlet: `deploy/quadlet/halsa-backoffice.container` y `halsa-portal.container`. Usan la red de Podman `proxy` (la de Nginx Proxy Manager), así que NPM los resuelve por nombre (`http://halsa-backoffice:8080`) y no se publica ningún puerto. Corren `read_only`, con `tmpfs` en `/tmp` y `/etc/nginx/conf.d`, sin capabilities y con `HealthCmd` contra `/health`.

**Preparación única del VPS** (usuario `deploy`, Podman rootless):

```bash
sudo loginctl enable-linger deploy
mkdir -p ~/.config/containers/systemd
# copiar deploy/quadlet/*.container ahí; ajustar Network= si la red de NPM no se llama "proxy"
systemctl --user daemon-reload
```

**Secretos del repositorio** (Settings → Secrets and variables → Actions):

| Secreto           | Valor                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `VPS_HOST`        | IP o DNS del VPS                                                                          |
| `VPS_USER`        | `deploy`                                                                                  |
| `VPS_PORT`        | opcional (22 por defecto)                                                                 |
| `VPS_SSH_KEY`     | clave privada dedicada; la pública va en `~deploy/.ssh/authorized_keys`                   |
| `VPS_KNOWN_HOSTS` | salida de `ssh-keyscan -p <puerto> <host>`, verificada contra la huella real del servidor |

**Cambiar la configuración** (`HALSA_KEYCLOAK_AUTHORITY`, `HALSA_API_BASE_URL`): editar las líneas `Environment=` del `.container` en el VPS (y en el repo), luego `systemctl --user daemon-reload && systemctl --user restart halsa-backoffice`. No hace falta reconstruir la imagen. Un push no pisa los `.container` del VPS: el pipeline solo actualiza las imágenes, así que un cambio en `deploy/quadlet/` hay que copiarlo a mano.

### 4.5 Nginx Proxy Manager (hosting, G2)

**Backoffice:** nuevo _Proxy Host_ `halsa-backoffice.alcast.dev` → `http://halsa-backoffice:8080`, SSL Let's Encrypt, "Force SSL" y HSTS. Sin configuración avanzada.

**Portal:** el host `halsa-pacientes.alcast.dev` ya existe para el BFF (hoy responde 404 en `/`). Debe quedar así (_Advanced_ / _Custom locations_):

```nginx
# El BFF conserva /paciente/* (login, callbacks OIDC, API). Host y esquema originales.
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

El portal nunca usa rutas que empiecen por `/paciente` (plan §5.2).

### 4.6 Prerrequisitos del backend (no son de este repo)

| Gap                             | Qué hacer                                                                                                                                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1 · CORS en el API**         | Permitir `https://halsa-backoffice.alcast.dev`; métodos `GET, POST, PATCH, DELETE`; cabeceras `Authorization, Content-Type, Idempotency-Key, Halsa-Motivo-Acceso, X-Correlation-Id`; **cabeceras expuestas** `WWW-Authenticate, Location, Content-Disposition, Retry-After` (sin `WWW-Authenticate` expuesta el step-up no se detecta). |
| **G3 · Redirect URI del BFF**   | Agregar `https://localhost:4300/paciente/bff/signin-oidc` y `.../signout-callback-oidc` a `halsa-bff-paciente` (desarrollo).                                                                                                                                                                                                            |
| **Keycloak `halsa-backoffice`** | Producción: redirect URI `https://halsa-backoffice.alcast.dev/*` y web origin `https://halsa-backoffice.alcast.dev`.                                                                                                                                                                                                                    |
| **G14 · Tema de login**         | Entregar `halsa-keycloak-theme.jar` y seleccionar `loginTheme` en ambos realms (ver `keycloak-theme/README.md`).                                                                                                                                                                                                                        |
| **G16/G17 · Realm**             | `basic` scope + paso Cookie en `browser-loa` (ver `docs/backend/realm-g16-g17.md`).                                                                                                                                                                                                                                                     |

---

## 5. Operación

### 5.1 Cabeceras de seguridad (en el contenedor)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src <api+keycloak>; [frame-src <keycloak>;]
  frame-ancestors 'none'; base-uri 'self'; form-action <self+keycloak>; object-src 'none';
  require-trusted-types-for 'script'; trusted-types angular angular#bundler halsa#iconos
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin-allow-popups   (unsafe-none en /auth/callback)
```

- `'unsafe-inline'` solo en estilos (Angular inyecta los estilos de componentes en runtime). No hay scripts inline: el tema se aplica desde `theme-init.js` (archivo externo) antes del primer pintado.
- `same-origin-allow-popups`: el popup de step-up necesita el `window.opener`. En `/auth/callback` va `unsafe-none`; si no, el popup pierde el opener al volver de Keycloak y el step-up nunca termina (G25, ver `deploy/README.md`).
- **HSTS** lo pone el proxy que termina TLS (NPM: "HSTS Enabled"), no el contenedor (habla HTTP).

### 5.2 Salud y verificación tras desplegar

```bash
# dentro del contenedor / contra el host publicado
curl -fsS <host>/health                       # 200 ok
curl -fsS <host>/config.json                  # URLs correctas según el ambiente
curl -fsSI <host>/casos | grep -i content-security-policy   # CSP presente
curl -fsS <host>/casos | grep -q '<app-root>'               # fallback SPA sirve el shell
```

- `/health` es estático (no toca la app); sirve para el `HEALTHCHECK` del contenedor y para el balanceador.
- Archivos con hash (`main-*.js`, fuentes en `media/`) → `max-age=31536000, immutable`. `index.html`, `config.json`, `theme-init.js` y las rutas del cliente → `no-cache`.

### 5.3 Logs y diagnóstico

```bash
# en el VPS (usuario deploy)
podman logs -f halsa-backoffice        # salida del entrypoint (config.json escrito) + nginx
journalctl --user -u halsa-backoffice -f   # arranque/reinicios de la unidad systemd
podman ps --filter name=halsa-         # estado y health
# en local: docker logs -f <contenedor>
```

Al arrancar, `16-halsa.envsh` imprime `halsa: backoffice config.json written; CSP connect-src …`. Si el contenedor no arranca, casi siempre es una variable de entorno inválida o faltante (ver §4.2).

### 5.4 Rollback

Las imágenes son inmutables (cada deploy deja un tag `:<sha>` en GHCR) y la configuración viene del entorno: volver atrás es re-apuntar `:latest` a la imagen anterior. Así el próximo push vuelve a avanzar con normalidad.

```bash
# en el VPS (usuario deploy); el sha es el de un deploy anterior sano
podman pull ghcr.io/edcastanohunter/halsa-backoffice:<sha-anterior>
podman tag  ghcr.io/edcastanohunter/halsa-backoffice:<sha-anterior> ghcr.io/edcastanohunter/halsa-backoffice:latest
systemctl --user restart halsa-backoffice
```

Alternativa: revertir el commit en `main` (`git revert`) y dejar que el pipeline despliegue de nuevo. Si el pull falla porque GHCR exige login, usa un PAT con `read:packages` o relanza el workflow desde Actions.

No hay migraciones de datos en el frontend (el estado vive en el backend), así que el rollback no deja inconsistencias.

### 5.5 Problemas comunes

| Síntoma                                      | Causa probable                                       | Acción                                               |
| -------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Contenedor backoffice no arranca             | `HALSA_KEYCLOAK_AUTHORITY` falta o inválida          | Revisar variables (§4.2); ver log del entrypoint     |
| Login de backoffice cae al callback y vuelve | Redirect URI no registrada en el realm               | Agregar el origin en Keycloak (§4.6)                 |
| Llamadas al API fallan solo en prod          | Falta CORS (G1)                                      | Agregar origen/cabeceras en el API                   |
| Step-up no se detecta                        | `WWW-Authenticate` no expuesta por CORS              | G1: cabeceras expuestas                              |
| Portal en blanco en el host del BFF          | NPM responde 404 en `/` (G2)                         | Configurar `location /` → portal (§4.5)              |
| `config.json` muestra URLs viejas            | La imagen cachea `config.json`                       | Es `no-cache`; forzar recarga / reiniciar contenedor |
| Job `deploy` falla en SSH                    | Secretos `VPS_*` mal o `known_hosts` desactualizado  | Revisar secretos; regenerar con `ssh-keyscan`        |
| Deploy verde pero la versión no cambió       | El quadlet no se reinició o `pull` falló en silencio | `podman ps`, `journalctl --user -u halsa-backoffice` |
| `systemctl --user` falla por SSH             | Sin linger / sin `XDG_RUNTIME_DIR` para `deploy`     | `sudo loginctl enable-linger deploy`                 |
| NPM responde 502                             | El contenedor no está en la red `proxy` o no arrancó | Comprobar `Network=` del quadlet y `podman ps`       |
| E2E local falla en el OTP                    | Contención de la ventana TOTP en workers paralelos   | Reintentar con `--workers=1`                         |

### 5.6 CI/CD

`.github/workflows/frontend.yml` (permisos: `contents: read`, `packages: write`):

- `validate`: `format:check` + `lint` + `test` + `build` (presupuestos gzip). Corre en push y PR a `main`.
- `images`: construye las dos imágenes (sin push) y hace un smoke test (arranca, comprueba `/health`, `config.json` y la CSP con `require-trusted-types-for 'script'`). Corre en push y PR.
- `deploy`: **solo en push a `main`**, después de `validate` e `images`. Publica en GHCR y reinicia los contenedores en el VPS (§4.4). Usa `concurrency: deploy-production` sin cancelar, así dos pushes seguidos despliegan en orden. Los PR nunca despliegan.

E2E queda fuera del CI (necesita Keycloak + backend). Verificar un deploy: pestaña Actions → el job `Publish & deploy` termina con la lista de contenedores `halsa-*` y su estado; después §5.2 contra el host publicado.

---

## 6. Guardas de seguridad (no negociables, resumen)

- Sin tokens/clínica/códigos en `localStorage`/`sessionStorage`/IndexedDB/URLs/`console` (solo la preferencia de tema va a `localStorage`). ESLint prohíbe `console` en `projects/**` (salvo el `console.error` del manejador global, que anonimiza).
- Datos clínicos 🔒 solo en la memoria de la ruta abierta; se descartan al salir. Step-up (`acr=2`) **antes** de cualquier formulario clínico; dictamen además exige `auth_time` ≤ 15 min.
- Nunca `innerHTML` con datos del servidor; los SVG de lucide pasan por la política Trusted Types `halsa#iconos`.
- El backend es la autoridad de permisos y navegación (`GET /v1/identidad/yo`). Un control visible puede fallar con 403/404 y debe manejarlo.
