# Halsa — Aplicaciones Web Frontend (Backoffice y Portal del Paciente)

Este repositorio contiene las aplicaciones web de Halsa para la gestión de casos ATEL (_accidentes de trabajo y enfermedades laborales_) en Colombia, construidas en un único workspace de Angular 21 sin SSR y con change detection zoneless basada en señales.

## Estructura del Workspace

- **`projects/backoffice`**: Aplicación para el personal administrativo y asistencial de ARL e IPS. Autenticación OIDC + PKCE contra Keycloak (`halsa-backoffice`), elevación de privilegios paso a paso (step-up `acr=2`), acceso de emergencia auditado ("break-the-glass") y visualización estricta por permisos.
- **`projects/portal`**: Aplicación para pacientes (trabajadores). Comunicación delegada a través del BFF (`Halsa.Bff.Paciente`), sesión por cookie HttpOnly con protección CSRF (`X-Halsa-Csrf: 1`) sin tokens en el navegador.
- **`libs/ui`**: Sistema de diseño Halsa `@halsa/ui` construido sobre Tailwind CSS v4, componentes accesibles Spartan helm (shadcn para Angular) y tokens en OKLCH.
- **`libs/core`**: Utilidades transversales `@halsa/core`: cargador de configuración en runtime (`config.json`), formateadores de fechas Bogotá (`America/Bogota`) y valores monetarios/porcentuales es-CO, manejo de errores RFC 9457 y mapas de traducción de enums.
- **`libs/api-types`**: Definición de tipos TypeScript generados a partir de la especificación OpenAPI del backend.
- **`keycloak-theme`**: Tema personalizado de inicio de sesión de Keycloak basado en FreeMarker y Tailwind CSS.
- **`dev/keycloak`**: Entorno local de Keycloak en Podman para pruebas sin dependencias del stack completo.

## Requisitos Previos

- **Node.js**: v22 o superior (CI y contenedores usan v22)
- **npm**: v11 o superior
- **Angular CLI**: v21 o superior
- **Podman**: v5 o superior (para Keycloak local en desarrollo)

## Comandos Principales

### Construcción y Pruebas

```bash
# Compilar ambas aplicaciones (producción) y validar presupuestos gzip + ausencia de "__mock"
npm run build

# Compilar aplicaciones individualmente
npm run build:backoffice
npm run build:portal

# Ejecutar pruebas unitarias (Vitest)
npm run test

# Ejecutar linter (ESLint con reglas de fronteras y aislamiento clínico)
npm run lint

# Formato (Prettier + prettier-plugin-tailwindcss)
npm run format
npm run format:check

# Ejecutar pruebas end-to-end (Playwright; levanta los dev servers si no están corriendo)
# La primera vez: npx playwright install chromium
npm run e2e
```

### Servidores de Desarrollo

```bash
# Backoffice contra backend local (puerto 3000, proxy /v1 -> http://localhost:5600)
ng serve backoffice --port 3000

# Backoffice en modo mock con Keycloak en Podman
npm run start:mock          # = ng serve backoffice --configuration mock (usa public/config.mock.json)

# Portal en modo mock (adaptador mock, mientras no exista el redirect URI del BFF, §13 G3)
npm run start:portal:mock

# Portal del paciente (puerto 4300, HTTPS, proxy /paciente -> https://localhost:5610)
ng serve portal --port 4300 --ssl
```

### Contratos OpenAPI y Tipos

```bash
# Regenerar tipos desde el API en ejecución
npm run api:types

# Regenerar tipos desde el archivo OpenAPI YAML local
npm run api:types:yaml
```

### Configuración en runtime

Cada app carga `public/config.json` **antes** del bootstrap (`loadAppConfig()` de `@halsa/core`), de modo que una misma imagen sirve cualquier ambiente. Si el archivo falta o es inválido, la app muestra un mensaje de error en lugar de arrancar con valores por defecto. La configuración `mock` apunta el cargador a `config.mock.json` (vía `define` en `angular.json`); ese archivo se excluye de los builds de producción.

### Identidad Local (Keycloak en Podman)

> Disponible a partir del hito M1.5 (los scripts `scripts/*.mjs` y `dev/keycloak/` aún no existen).

```bash
# Sincronizar y generar mock realms desde el backend
npm run kc:sync

# Iniciar Keycloak en Podman (puerto 8180)
npm run kc:up

# Ver logs de Keycloak
npm run kc:logs

# Detener Keycloak
npm run kc:down

# Reiniciar e importar realms desde cero
npm run kc:reset
```

### Tema de Keycloak

> Disponible a partir del hito M1.5.

```bash
# Compilar CSS del tema
npm run theme:css

# Compilar CSS en modo escucha
npm run theme:watch

# Generar el paquete JAR del tema (dist/keycloak-theme/halsa-keycloak-theme.jar)
npm run theme:build
```

## Sistema de Diseño (`@halsa/ui`)

- **Showcase:** `npm start` y abre `http://localhost:3000/_ui` (también existe en el portal). Muestra todas las primitivas y componentes Halsa en claro y oscuro. Es solo de desarrollo: los builds de producción reemplazan `dev.routes.ts` por `dev.routes.prod.ts` y `scripts/check-bundles.mjs` falla si el showcase llega al bundle.
- **Tokens:** `libs/ui/src/theme.css` (OKLCH, claro y oscuro). Tras cambiar un color ejecuta `npm run check:contrast` (también corre dentro de `npm run test`): verifica WCAG 2.2 AA para cada par texto/fondo y 3:1 para controles y foco.
- **Tema claro/oscuro:** por defecto sigue al sistema; el usuario lo cambia con `<halsa-selector-tema />` (`TemaService`) y la preferencia se guarda en `localStorage` (`halsa.tema`, solo preferencia de UI). `theme-init.js` aplica la clase `.dark` antes del primer pintado, como archivo externo porque la CSP prohíbe scripts inline.
- **Importaciones:** componentes Halsa desde `@halsa/ui`; primitivas Spartan desde `@halsa/ui/helm/<nombre>` (p. ej. `HlmButtonImports` de `@halsa/ui/helm/button`).
- **Agregar una primitiva Spartan:** `npx ng g @spartan-ng/cli:ui <nombre> --defaults` (usa `components.json`). Después revisa el código generado: textos en inglés → español, alturas táctiles (`pointer-coarse:h-11`), y que no use `new Date(string)` con fechas `YYYY-MM-DD`.
- **Pruebas visuales:** `npx playwright test e2e/ui-showcase.spec.ts` corre axe (cero violaciones serias o críticas), revisa que no haya scroll horizontal y guarda capturas en `docs/reportes/m1/`.

## Reglas de Arquitectura y Seguridad

1. **Aislamiento clínico:** Ningún dato clínico se persiste en `localStorage`, `sessionStorage`, `IndexedDB` ni URLs. Los estados clínicos se eliminan de la memoria al abandonar la ruta.
2. **Fechas calendario:** Nunca se parsean fechas `YYYY-MM-DD` mediante `new Date()`. Se utilizan los formateadores de `@halsa/core/format` para evitar desfases de día en la zona horaria `America/Bogota`.
3. **Fronteras entre features:** Los módulos de feature son independientes y nunca importan código de otros features.
4. **Permisos y navegación:** El backend es la autoridad; los controles y secciones de navegación se derivan dinámicamente de los permisos del usuario (`GET /v1/identidad/yo`).
