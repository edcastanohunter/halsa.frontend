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

**Despliegue automático:** un push a `main` construye las imágenes (arm64), las envía por SSH al VPS y reinicia los contenedores, previa aprobación del environment `produccion` (ver §4.4 y §5.6). El despliegue manual con `docker build` solo hace falta fuera del pipeline.

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

### 4.4 Despliegue en el VPS (SSH + Quadlets)

Mismo modelo que `Halsa.Backend` (runbooks 01 y 03 de ese repo): **sin registry**. El job `deploy` de `.github/workflows/frontend.yml` corre en cada push a `main` tras `validate` e `images` y espera la aprobación del environment `produccion`:

1. Construye `halsa-backoffice` y `halsa-portal` para **linux/arm64** (el VPS es arm64; el build de Angular corre nativo en el runner y solo la etapa nginx va por QEMU) con tag `localhost/…:v1.0.<run_number>`.
2. Empaqueta `paquete.tar` (`imagenes.tar.gz` + `manifiesto.sha256`) y lo manda por SSH: `ssh halsa-deploy@VPS "desplegar v1.0.<n>" < paquete.tar`.
3. En el VPS, `halsa-recibir-despliegue-front` (el único comando que esa llave puede ejecutar) valida el tag, verifica las sumas, hace `podman load`, escribe `HALSA_FRONT_TAG` en `~/.config/halsa-frontend/frontend.env` y reinicia las dos unidades. Los Quadlets usan `Notify=healthy`: el reinicio solo termina bien si `/health` responde. Si falla, vuelve al tag anterior y el job queda en rojo.

Todo corre como **`edhunter`**, el dueño de NPM y de los Quadlets del backend (`sudo -u`): las redes de Podman son por usuario y los contenedores deben estar en `halsa_borde` para que NPM los alcance por nombre (`http://halsa-backoffice:8080`, `http://halsa-portal:8080`) sin publicar puertos.

**Piezas del repo**

| Archivo                                                               | Va a                                                    | Quién lo copia            |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------- |
| `deploy/vps/recibir-despliegue-front.sh`                              | `/usr/local/sbin/halsa-recibir-despliegue-front` (root) | una persona, **no** el CI |
| `deploy/quadlet/halsa-backoffice.container`, `halsa-portal.container` | `~/.config/containers/systemd/` de `edhunter`           | una persona               |
| `deploy/quadlet/frontend.env.ejemplo`                                 | `~/.config/halsa-frontend/frontend.env` (0600)          | una persona               |

#### Preparación única

Una sola vez por VPS y por repo. Cada paso dice **dónde** se ejecuta. Los comandos con `sudo` los corre una persona con sudo en el VPS (`edhunter` u otra); `<vps>` es el mismo host que irá en `VPS_HOST`.

| Fase | Dónde      | Pasos                                                                                     |
| ---- | ---------- | ----------------------------------------------------------------------------------------- |
| A    | VPS        | 1 prerrequisitos · 2 Quadlets y entorno · 3 script · 4 usuario `halsa-deploy` · 5 sudoers |
| B    | tu máquina | 6 generar la llave · 7 copiar la pública al VPS                                           |
| C    | VPS        | 8 registrar la pública con la restricción                                                 |
| D    | GitHub     | 9 environment `produccion` y secretos                                                     |
| E    | tu máquina | 10 verificar y borrar la privada · 11 primer despliegue                                   |

**Qué impide que la llave del CI haga otra cosa que desplegar el front** (cuatro capas, todas necesarias):

| Capa                           | Dónde vive                                                   | Qué impone                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command="…",restrict`         | la línea de la llave en `~halsa-deploy/.ssh/authorized_keys` | sshd ejecuta **siempre** ese comando, sea cual sea el que pida el cliente (que llega en `SSH_ORIGINAL_COMMAND`); `restrict` quita pty, forwardings y agente |
| sudoers                        | `/etc/sudoers.d/halsa-deploy-front`                          | `halsa-deploy` solo puede correr **ese** script, y solo como `edhunter`                                                                                     |
| El script en `/usr/local/sbin` | root:root 0755                                               | `halsa-deploy` no puede modificarlo; acepta solo `desplegar vX.Y.Z` y rechaza todo lo demás con exit `2`                                                    |
| Una llave por propósito        | una línea por llave                                          | la llave del backend ejecuta el script del backend; la del front, el del front. Nunca compartas una llave                                                   |

##### Fase A — En el VPS

**Paso 1 · Prerrequisitos.** El backend ya está instalado (su runbook 01). Compruébalo:

```bash
id edhunter                                # el dueño de NPM y de los Quadlets del backend
loginctl show-user edhunter -p Linger      # Linger=yes
sudo -u edhunter env XDG_RUNTIME_DIR=/run/user/$(id -u edhunter) podman network ls | grep halsa_borde
id halsa-deploy                            # existe si el backend ya despliega por CI; si no, paso 4
```

**Paso 2 · Quadlets y entorno.** Son dos tandas y las dos son necesarias: `scp` solo deja los archivos en `/tmp` del VPS; hay que **instalarlos** en el home de `edhunter` para que systemd y el script los vean.

2a. **Desde tu máquina** (raíz de este repo), sube los archivos a `/tmp`:

```bash
scp deploy/quadlet/*.container deploy/quadlet/frontend.env.ejemplo edhunter@<vps>:/tmp/
```

2b. **En el VPS, como `edhunter`** (`ssh edhunter@<vps>`; no como otro usuario, porque `~` sería otro home), muévelos a su sitio:

```bash
install -d -m 0755 ~/.config/containers/systemd
install -m 0644 /tmp/halsa-backoffice.container /tmp/halsa-portal.container ~/.config/containers/systemd/
install -d -m 0700 ~/.config/halsa-frontend
install -m 0600 /tmp/frontend.env.ejemplo ~/.config/halsa-frontend/frontend.env
nano ~/.config/halsa-frontend/frontend.env          # HALSA_KEYCLOAK_AUTHORITY y HALSA_API_BASE_URL reales
systemctl --user daemon-reload
rm /tmp/halsa-backoffice.container /tmp/halsa-portal.container /tmp/frontend.env.ejemplo
```

2c. **Comprueba** que quedaron donde el script los busca (los dos `.container` y el `.env`):

```bash
ls -l ~/.config/containers/systemd/halsa-backoffice.container ~/.config/containers/systemd/halsa-portal.container ~/.config/halsa-frontend/frontend.env
```

No se arrancan todavía: no hay imagen hasta el primer despliegue. `Network=halsa-borde.network` y el `NetworkAlias=` ya vienen en los `.container`.

**Paso 3 · Instalar el script**, propiedad de root y fuera de cualquier carpeta que el despliegue escriba, para que el CI no pueda cambiar lo que ejecuta. Desde tu máquina:

```bash
scp deploy/vps/recibir-despliegue-front.sh edhunter@<vps>:/tmp/
```

En el VPS:

```bash
sudo install -o root -g root -m 0755 /tmp/recibir-despliegue-front.sh /usr/local/sbin/halsa-recibir-despliegue-front
ls -l /usr/local/sbin/halsa-recibir-despliegue-front      # -rwxr-xr-x root root
```

**Paso 4 · El usuario `halsa-deploy`** (el mismo que usa el backend; si ya existe, el `adduser` no se ejecuta). Sin contraseña y con un shell real: `sshd` ejecuta el `command=` forzado **con el shell del usuario**, y con `/usr/sbin/nologin` toda conexión falla. La restricción no la da el shell sino `command=` y sudo.

```bash
id halsa-deploy || sudo adduser --system --group --shell /bin/sh --home /home/halsa-deploy halsa-deploy

# Carpeta y archivo de llaves, con los dueños y permisos que sshd exige (StrictModes)
sudo install -d -o halsa-deploy -g halsa-deploy -m 0700 /home/halsa-deploy/.ssh
sudo touch /home/halsa-deploy/.ssh/authorized_keys
sudo chown halsa-deploy:halsa-deploy /home/halsa-deploy/.ssh/authorized_keys
sudo chmod 600 /home/halsa-deploy/.ssh/authorized_keys
ls -ld /home/halsa-deploy /home/halsa-deploy/.ssh /home/halsa-deploy/.ssh/authorized_keys
```

Comprueba que `sshd` acepta llaves y que no lista a `halsa-deploy` fuera de una lista permitida:

```bash
sudo sshd -T | grep -Ei '^(pubkeyauthentication|authorizedkeysfile|allowusers|allowgroups) '
```

`pubkeyauthentication yes` y `authorizedkeysfile .ssh/authorized_keys …` son lo esperado. Si aparece `allowusers` o `allowgroups`, agrega `halsa-deploy` en `/etc/ssh/sshd_config` y recarga: `sudo sshd -t && sudo systemctl reload ssh`.

**Paso 5 · El sudoers.** Archivo aparte; el del backend no se toca. `env_keep` es imprescindible: sin él `sudo` borra `SSH_ORIGINAL_COMMAND` y el script rechaza todo con exit `2`.

```bash
cat > /tmp/halsa-deploy-front <<'EOF'
Defaults!/usr/local/sbin/halsa-recibir-despliegue-front env_keep += "SSH_ORIGINAL_COMMAND"
halsa-deploy ALL=(edhunter) NOPASSWD: /usr/local/sbin/halsa-recibir-despliegue-front
EOF
sudo visudo -cf /tmp/halsa-deploy-front && sudo install -o root -g root -m 0440 /tmp/halsa-deploy-front /etc/sudoers.d/halsa-deploy-front
sudo -l -U halsa-deploy        # lista los scripts del backend y del front, cada uno como (edhunter) NOPASSWD
```

##### Fase B — En tu máquina

**Paso 6 · Generar la llave.** Una llave nueva, solo para el front, **fuera del repo**. En Git Bash, WSL, macOS o Linux:

```bash
ssh-keygen -t ed25519 -N '' -C ci-halsa-front -f ~/.ssh/ci-halsa-front
ssh-keygen -lf ~/.ssh/ci-halsa-front.pub      # huella SHA256: anótala para comparar en el paso 8
```

En PowerShell el passphrase vacío se escribe distinto (PowerShell 5.1 descarta `''`): `ssh-keygen -t ed25519 -N '""' -C ci-halsa-front -f "$HOME\.ssh\ci-halsa-front"`.

- `-t ed25519`: tipo de llave. `-C ci-halsa-front`: el comentario identifica la línea de `authorized_keys`; es lo que usarás para revocarla.
- `-N ''`: **sin passphrase**, porque el CI no puede teclearla. La protección es el `command=` y el environment con aprobación, no la passphrase.
- `-f`: ruta. Si el archivo ya existe, `ssh-keygen` pregunta si lo sobrescribe: contesta que no y elige otro nombre.
- Quedan dos archivos: `ci-halsa-front` (**privada**, va a GitHub) y `ci-halsa-front.pub` (pública, va al VPS). Nunca pegues la privada en chats, tickets ni commits.

**Paso 7 · Copiar solo la pública al VPS:**

```bash
scp ~/.ssh/ci-halsa-front.pub edhunter@<vps>:/tmp/ci-halsa-front.pub
```

##### Fase C — En el VPS

**Paso 8 · Registrar la pública con la restricción.** La línea final de `authorized_keys` es `command="…",restrict ssh-ed25519 AAAA… ci-halsa-front`; se arma a partir del archivo para no retipear la llave:

```bash
# La .pub debe ser UNA línea que empiece por ssh-ed25519
wc -l < /tmp/ci-halsa-front.pub ; cut -c1-40 /tmp/ci-halsa-front.pub

AK=/home/halsa-deploy/.ssh/authorized_keys
# Si la última línea no termina en salto de línea, tee -a la pegaría a la llave del backend
sudo sh -c '[ -s "'$AK'" ] && [ "$(tail -c1 "'$AK'" | wc -l)" -eq 0 ] && echo >> "'$AK'"; true'

# Registrar la llave (no duplica si ya estaba)
if sudo grep -q ' ci-halsa-front$' "$AK"; then
  echo "ya estaba registrada"
else
  echo "command=\"sudo -u edhunter /usr/local/sbin/halsa-recibir-despliegue-front\",restrict $(cat /tmp/ci-halsa-front.pub)" \
    | sudo tee -a "$AK" >/dev/null
fi
rm /tmp/ci-halsa-front.pub

# Comprobar: 2 líneas (backend y front), cada una con su command=; la huella del front debe ser la del paso 6
sudo cut -c1-130 "$AK"
sudo ssh-keygen -lf "$AK"
```

- `command="sudo -u edhunter /usr/local/sbin/halsa-recibir-despliegue-front"`: lo único que sshd ejecuta con esta llave. Lo que pida el cliente (`ssh host "desplegar v1.0.7"`) no se ejecuta: se guarda en `SSH_ORIGINAL_COMMAND` y lo valida el script.
- `restrict` (OpenSSH ≥ 7.2, `ssh -V`) desactiva de golpe pty, port forwarding, agent forwarding, X11 y `~/.ssh/rc`. En un OpenSSH más viejo usa `no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc`.
- **No pongas `from="…"`:** los runners de GitHub no tienen IP fija.
- **Agrega, no reemplaces:** `tee -a`, nunca `>`. La línea del backend debe seguir ahí.
- No hace falta recargar `sshd`: lee `authorized_keys` en cada conexión.

##### Fase D — En GitHub

**Paso 9 · Environment `produccion` y secretos** en el repo del front (`edcastanohunter/halsa.frontend`).

1. _Settings → Environments → New environment_ → `produccion`. Ahí mismo:
   - _Required reviewers_: al menos una persona (aprueba cada despliegue);
   - _Deployment branches and tags_ → _Selected branches_ → solo `main`.
2. Los cuatro secretos van en _Environment secrets_ de `produccion`, no como secretos del repo. Con la CLI `gh` (desde tu máquina):

   ```bash
   REPO=edcastanohunter/halsa.frontend
   gh secret set VPS_HOST    --env produccion --repo $REPO --body '<ip-o-dns-del-vps>'
   gh secret set VPS_USER    --env produccion --repo $REPO --body halsa-deploy
   gh secret set VPS_SSH_KEY --env produccion --repo $REPO < ~/.ssh/ci-halsa-front
   ```

   En PowerShell no existe `<`: usa `Get-Content -Raw $HOME\.ssh\ci-halsa-front | gh secret set VPS_SSH_KEY --env produccion --repo $REPO`. Por la web: pega **todo** el archivo, de `-----BEGIN OPENSSH PRIVATE KEY-----` a `-----END OPENSSH PRIVATE KEY-----`.

3. `VPS_SSH_KNOWN_HOSTS` es la huella del host (evita que el CI hable con un servidor suplantado). Obtenla desde fuera y compárala con la del propio VPS antes de guardarla:

   ```bash
   ssh-keyscan -t ed25519 <vps> > ~/.ssh/kh-halsa-vps      # en tu máquina; <vps> idéntico a VPS_HOST
   ssh-keygen -lf ~/.ssh/kh-halsa-vps                       # huella SHA256
   ```

   ```bash
   ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub         # en el VPS: debe ser la MISMA huella
   ```

   ```bash
   gh secret set VPS_SSH_KNOWN_HOSTS --env produccion --repo $REPO < ~/.ssh/kh-halsa-vps
   ```

   Si `VPS_HOST` es una IP, el `ssh-keyscan` se hace a la IP (es el nombre que ssh buscará en `known_hosts`). Es el mismo valor que ya usa el backend si el host es el mismo.

##### Fase E — Verificar y primer despliegue

**Paso 10 · Verificar la restricción**, desde tu máquina y **con la llave privada recién creada** (antes de borrarla):

```bash
KEY=~/.ssh/ci-halsa-front ; VPS=<vps>

# a) Sin comando: no hay shell, el script rechaza
ssh -i $KEY -o IdentitiesOnly=yes halsa-deploy@$VPS ; echo "exit=$?"
#    comando no permitido; el único válido es: desplegar <tag vX.Y.Z>     exit=2

# b) Pedir un comando cualquiera: se ignora, el command= manda
ssh -i $KEY -o IdentitiesOnly=yes halsa-deploy@$VPS 'cat /etc/passwd' ; echo "exit=$?"     # igual, exit=2

# c) La cadena completa ssh → command= → sudo → script, con un paquete vacío (no cambia nada)
ssh -i $KEY -o IdentitiesOnly=yes halsa-deploy@$VPS 'desplegar v0.0.0' < /dev/null ; echo "exit=$?"
#    tar: This does not look like a tar archive
#    FALLO: el paquete no es un tar válido; nada cambió     exit=1
#    (en PowerShell: sin '< /dev/null' y con "exit=$LASTEXITCODE")
```

Lectura del resultado:

| Resultado                                                               | Significa                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a) y b) con `exit=2`, c) con `FALLO: … nada cambió`                     | **Todo bien.**                                                                                                                                                                                                                        |
| c) también da `exit=2` "comando no permitido"                           | Falta `env_keep` en el sudoers (paso 5): sudo borró `SSH_ORIGINAL_COMMAND`                                                                                                                                                            |
| `sudo: a password is required`                                          | La línea `NOPASSWD` del sudoers no coincide con la ruta del script (paso 5)                                                                                                                                                           |
| `FALLO: falta …frontend.env` / `falta el Quadlet`                       | Falta el paso 2                                                                                                                                                                                                                       |
| `Permission denied (publickey)`                                         | `sudo journalctl -u ssh --since "10 min ago"` en el VPS. Habituales: `bad ownership or modes` (paso 4), usuario fuera de `AllowUsers`, línea de `authorized_keys` partida, o `account is locked` (`sudo usermod -p '*' halsa-deploy`) |
| a) o b) responden `desplegar: command not found` (127) o abren un shell | La llave entró **sin** el `command=` y tiene shell completo: la `.pub` está también en otro `authorized_keys` (por ejemplo vía `ssh-copy-id`) o la línea del paso 8 no lleva `command=`. Quítala de todo lado salvo esa línea         |

Cuando todo dé bien, borra la llave de tu máquina. GitHub no permite leer un secreto de vuelta; si algún día la pierdes, se rota (sección siguiente):

```bash
shred -u ~/.ssh/ci-halsa-front 2>/dev/null || rm -f ~/.ssh/ci-halsa-front
rm -f ~/.ssh/ci-halsa-front.pub ~/.ssh/kh-halsa-vps
```

**Paso 11 · Primer despliegue:** haz un push a `main` (o relanza el workflow desde _Actions_) y aprueba `produccion`. Comprueba en el VPS, como `edhunter`:

```bash
podman ps --filter name=halsa-          # halsa-backoffice y halsa-portal en "healthy"
podman image ls localhost/halsa-backoffice
```

Luego crea los _Proxy Hosts_ de NPM (§4.5).

##### Rotar o revocar la llave

Revocar es borrar su línea de `authorized_keys` (el comentario `ci-halsa-front` va al final de la línea); sin ella la llave deja de entrar al instante:

```bash
sudo sed -i '/ ci-halsa-front$/d' /home/halsa-deploy/.ssh/authorized_keys
sudo wc -l /home/halsa-deploy/.ssh/authorized_keys      # solo queda la del backend
```

Para **rotar**: revoca, repite los pasos 6, 7, 8 y vuelve a ejecutar `gh secret set VPS_SSH_KEY …` del paso 9. Para **retirar el despliegue del front**: revoca, borra `/etc/sudoers.d/halsa-deploy-front` y `/usr/local/sbin/halsa-recibir-despliegue-front`, y elimina el environment `produccion`.

**Cambiar la configuración** (`HALSA_KEYCLOAK_AUTHORITY`, `HALSA_API_BASE_URL`): edita `~/.config/halsa-frontend/frontend.env` como `edhunter` y `systemctl --user restart halsa-backoffice`. No hace falta reconstruir la imagen.

**Cuando cambie un `.container`** el despliegue no lo copia (igual que el backend con sus Quadlets): cópialo a `~/.config/containers/systemd/`, `systemctl --user daemon-reload` y reinicia la unidad.

**Cuando cambie `deploy/vps/recibir-despliegue-front.sh`** (su cabecera lleva `# version:`), el que corre es el instalado. Copia el nuevo a `/tmp`, revisa el diff y reinstálalo a mano:

```bash
diff /usr/local/sbin/halsa-recibir-despliegue-front /tmp/recibir-despliegue-front.sh
sudo install -o root -g root -m 0755 /tmp/recibir-despliegue-front.sh /usr/local/sbin/halsa-recibir-despliegue-front
```

Variables opcionales del script (agrégalas al `env_keep` del sudoers y al `command=`): `HALSA_FRONT_PAQUETE_MAX_MB` (1024) y `HALSA_FRONT_VERSIONES_RETENIDAS` (5).

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
# en el VPS, como edhunter
podman logs -f halsa-backoffice            # salida del entrypoint (config.json escrito) + nginx
journalctl --user -u halsa-backoffice -u halsa-portal -f   # arranque/reinicios de las unidades
podman ps --filter name=halsa-             # estado y health
# en local: docker logs -f <contenedor>
```

Al arrancar, `16-halsa.envsh` imprime `halsa: backoffice config.json written; CSP connect-src …`. Si el contenedor no arranca, casi siempre es una variable de entorno inválida o faltante en `~/.config/halsa-frontend/frontend.env` (ver §4.2).

### 5.4 Rollback

El script **vuelve solo** al tag anterior si las unidades no quedan sanas tras un despliegue. Para volver a mano a una versión que siga cargada en el VPS (se conservan las últimas 5):

```bash
# en el VPS
sudo -u edhunter podman image ls localhost/halsa-backoffice            # tags disponibles
sudo -u edhunter grep HALSA_FRONT_TAG /home/edhunter/.config/halsa-frontend/frontend.env   # el actual
sudo -u edhunter /usr/local/sbin/halsa-recibir-despliegue-front revertir v1.0.41
```

`revertir` solo se acepta desde una sesión local: por SSH la llave del CI únicamente puede `desplegar`. Si el tag ya no está cargado, relanza el workflow de ese commit (_Re-run_) o haz `git revert` en `main`. Un próximo push sigue avanzando con normalidad. No hay migraciones de datos en el frontend, así que el rollback no deja inconsistencias.

### 5.5 Problemas comunes

| Síntoma                                          | Causa probable                                              | Acción                                                               |
| ------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Contenedor backoffice no arranca                 | `HALSA_KEYCLOAK_AUTHORITY` falta o inválida                 | Revisar variables (§4.2); ver log del entrypoint                     |
| Login de backoffice cae al callback y vuelve     | Redirect URI no registrada en el realm                      | Agregar el origin en Keycloak (§4.6)                                 |
| Llamadas al API fallan solo en prod              | Falta CORS (G1)                                             | Agregar origen/cabeceras en el API                                   |
| Step-up no se detecta                            | `WWW-Authenticate` no expuesta por CORS                     | G1: cabeceras expuestas                                              |
| Portal en blanco en el host del BFF              | NPM responde 404 en `/` (G2)                                | Configurar `location /` → portal (§4.5)                              |
| `config.json` muestra URLs viejas                | La imagen cachea `config.json`                              | Es `no-cache`; forzar recarga / reiniciar contenedor                 |
| Job `deploy` falla en SSH                        | Secretos del environment mal o `known_hosts` desactualizado | Revisar `VPS_*` del environment `produccion`                         |
| `desplegar: command not found` (127)             | La llave entró sin `command=`                               | Revisar `authorized_keys` (§4.4 paso 8)                              |
| Exit `2` "comando no permitido"                  | Falta `env_keep` o el comando no es `desplegar <tag>`       | Revisar el sudoers (§4.4 paso 5)                                     |
| Deploy rojo con "las unidades no quedaron sanas" | Env inválido, imagen rota o `/health` no responde           | `journalctl --user -u halsa-backoffice`; volvió solo al tag anterior |
| `exec format error` al arrancar                  | Imagen amd64 en un VPS arm64                                | El workflow fija `platforms: linux/arm64`; no lo cambies             |
| NPM responde 502                                 | Contenedor caído o fuera de `halsa_borde`                   | `podman ps`, `Network=` del Quadlet                                  |
| E2E local falla en el OTP                        | Contención de la ventana TOTP en workers paralelos          | Reintentar con `--workers=1`                                         |

### 5.6 CI/CD

`.github/workflows/frontend.yml` (permisos: `contents: read`):

- `validate`: `format:check` + `lint` + `test` + `build` (presupuestos gzip). Corre en push y PR a `main`.
- `images`: construye las dos imágenes (sin push) y hace un smoke test (arranca, comprueba `/health`, `config.json` y la CSP con `require-trusted-types-for 'script'`). Corre en push y PR.
- `deploy`: **solo en push a `main`**, después de `validate` e `images`, con aprobación del environment `produccion`. Construye para arm64, envía el paquete por SSH y reinicia los contenedores (§4.4). Usa `concurrency: despliegue-produccion` sin cancelar, así dos pushes seguidos despliegan en orden. Los PR nunca despliegan.

E2E queda fuera del CI (necesita Keycloak + backend). Verificar un deploy: el job termina con la lista de contenedores `halsa-*` y su estado; después §5.2 contra el host publicado.

---

## 6. Guardas de seguridad (no negociables, resumen)

- Sin tokens/clínica/códigos en `localStorage`/`sessionStorage`/IndexedDB/URLs/`console` (solo la preferencia de tema va a `localStorage`). ESLint prohíbe `console` en `projects/**` (salvo el `console.error` del manejador global, que anonimiza).
- Datos clínicos 🔒 solo en la memoria de la ruta abierta; se descartan al salir. Step-up (`acr=2`) **antes** de cualquier formulario clínico; dictamen además exige `auth_time` ≤ 15 min.
- Nunca `innerHTML` con datos del servidor; los SVG de lucide pasan por la política Trusted Types `halsa#iconos`.
- El backend es la autoridad de permisos y navegación (`GET /v1/identidad/yo`). Un control visible puede fallar con 403/404 y debe manejarlo.
