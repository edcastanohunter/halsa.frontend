# Halsa Frontend — Plan de Hitos y Seguimiento de Implementación

> **Estado general:** M2 completado (2026-10-19); siguiente: M3  
> **Fecha de inicio:** 2026-10-17  
> **Tipografía UI:** Plus Jakarta Sans (`@fontsource/plus-jakarta-sans`)  
> **Monospace:** JetBrains Mono (`@fontsource/jetbrains-mono`)  
> **Referencia base:** [`GEMINI.md`](GEMINI.md) y [`prompt/02_handoff-frontend.md`](prompt/02_handoff-frontend.md)

---

## 1. Lista de Verificación de Hitos (Checklist)

- [x] **M0: Workspace y Tooling**
- [x] **M1: Design System y Primitivas UI**
- [x] **M1.5: Keycloak Local (Podman) y Login Theme**
- [x] **M2: Core Plumbing (HTTP, Errores, Fechas, i18n, Mock Adapter)**
- [ ] **M3: Backoffice Shell e Identidad (OIDC, Permisos, Layout Responsivo)**
- [ ] **M4: Casos (Flujo Administrativo, Resumen, Equipo, Activación Paciente)**
- [ ] **M5: Plazos (Tablero de Vencimientos y Workflow de Cumplimiento)**
- [ ] **M6: Clínico 🔒 (Historia Clínica y Acceso de Emergencia "Break-the-Glass")**
- [ ] **M7: Incapacidades (Listado, Barra Acumulada, Carga Multipart con Soporte PDF)**
- [ ] **M8: Dictamen PCL 🔒 (Dictamen, Notificación y Ventana de 15 Minutos)**
- [ ] **M9: Privacidad (Bandeja Solicitudes Copia HC, Auditoría de Accesos, Revisiones de Emergencia)**
- [ ] **M10: Portal del Paciente (BFF, Sesión por Cookie, Línea de Tiempo, Solicitudes)**
- [ ] **M11: Hardening y Entrega (Dockerfiles, Nginx con CSP/Trusted Types, CI GitHub Actions)**

---

## 2. Detalle de Hitos y Criterios de Aceptación (AC)

### [x] M0: Workspace y Tooling
- **Alcance:**
  - Creación del workspace Angular CLI (`halsa`) con dos aplicaciones standalone y zoneless (`backoffice`, `portal`) sin SSR (`--ssr=false`).
  - Creación de librerías locales en `libs/`:
    - `libs/ui` (`@halsa/ui`)
    - `libs/core` (`@halsa/core`)
    - `libs/api-types` (`@halsa/api-types`)
  - Configuración de TypeScript path aliases (`@halsa/*`) en `tsconfig.json`.
  - Configuración de Tailwind CSS v4 vía PostCSS (`@tailwindcss/postcss`).
  - Configuración de Spartan UI (`@spartan-ng/brain`) o fallback verificado sobre `@angular/cdk` + `cva` + `tailwind-merge`.
  - Configuración de linters (`angular-eslint` con reglas de boundaries, no-console, imports restringidos) y Prettier (`prettier-plugin-tailwindcss`).
  - Configuración de Vitest para pruebas unitarias y Playwright para E2E.
  - Proxies de desarrollo: `proxy.backoffice.json` (`/v1` → `:5600`) y `proxy.portal.json` (`/paciente` → `:5610`).
  - Scripts de generación de tipos OpenAPI: `api:types` (live) y `api:types:yaml` (fallback desde `atel-api.openapi.yaml`).
- **Criterios de Aceptación:**
  - `npm run build` compila ambas aplicaciones exitosamente.
  - `npm run test` ejecuta la suite de pruebas unitarias.
  - Tipos generados en `libs/api-types/src/schema.d.ts` y versionados en el repositorio.
  - Shell vacío funcional en ambas aplicaciones.

---

### [x] M1: Design System y Primitivas UI
- **Alcance:**
  - Definición de tokens en `libs/ui/src/theme.css` usando `@theme` y variables OKLCH (modo claro y oscuro).
  - Integración de fuentes self-hosted: Plus Jakarta Sans y JetBrains Mono vía `@fontsource`.
  - Catálogo de componentes base Spartan helm: botones, tarjetas, inputs, textareas, selects, tabs, modales, sheets (bottom sheet en móvil), toasts (Sonner), alertas, tablas, etc.
  - Componentes de dominio Halsa: `EstadoBadge`, `RadicadoChip`, `DocumentoEnmascarado`, `FechaBogota`, `FechaRelativa`, `SemaforoPlazo`, `ContadorRegresivo`, `BarraDiasAcumulados`, `SeccionClinica`, `VerificacionReforzada`, `PanelNoAsignado`, `DialogoAccesoEmergencia`, `SubidaPdf`, `CodigoUnaVez`.
  - Ruta de demostración y validación `/_ui` (excluida de producción).
  - Selector de tema claro/oscuro/sistema (`SelectorTema` + `TemaService`), solicitado por el usuario.
  - Diferidos a su hito (se construyen con datos reales): calendar/date-picker (M5, con adaptador DateOnly), `BottomNav`/`SidebarNav`/`MasSheet` (M3), `ListaResponsiva`/`FiltrosColapsables` (M4), `EditorDiagnosticosCie10` (M6), `CampoMoneda`/`CampoPorcentaje` (M8).
- **Criterios de Aceptación:**
  - Verificación de contraste WCAG 2.2 AA (ratio ≥ 4.5:1 para texto normal) en temas claro y oscuro.
  - Showcase visual navegable en 375 px y 1440 px.

---

### [x] M1.5: Keycloak Local (Podman) y Login Theme
- **Alcance:**
  - `dev/keycloak/compose.yaml` configurado en puerto 8180 usando Podman.
  - Script `scripts/sync-realms.mjs` para transformar los realms del backend (`halsa-realm.json`, `halsa-pacientes-realm.json`) eliminando cuentas de servicio con certificados mTLS y fijando el tema Halsa y locales en español.
  - Scripts de gestión: `npm run kc:sync`, `kc:up`, `kc:down`, `kc:reset`, `kc:logs`.
  - Tema FreeMarker en `keycloak-theme/`:
    - Variante `halsa` (personal ARL/IPS).
    - Variante `halsa-pacientes` (portal de pacientes).
    - Mapeo completo de clases `kc*Class` a componentes Tailwind (`.hl-*`).
    - Plantillas personalizadas: `template.ftl`, `login.ftl`, `login-otp.ftl`, `login-config-totp.ftl`, `register.ftl`, etc.
  - Script de empaquetado `npm run theme:build` que produce `dist/keycloak-theme/halsa-keycloak-theme.jar`.
- **Criterios de Aceptación:**
  - `npm run kc:up` inicializa Keycloak 26.4 con realms importados y temas activos.
  - Login y OTP funcionales para `calificador.arla` y `medico.ips`.
  - Registro de cuenta funcional en `halsa-pacientes`.
  - JAR generado en `dist/keycloak-theme/halsa-keycloak-theme.jar`.
  - Playwright visual test sin cadenas en inglés ni elementos PatternFly sin estilo.
- **Notas de implementación:**
  - Los tokens viven en `libs/ui/src/tokens.css` (sin Tailwind ni fuentes); `theme.css` de las apps y `keycloak-theme/src/halsa.css` lo importan.
  - `dev/keycloak/compose.yaml` añade Mailpit (`:8025`) como buzón SMTP: sin él, Keycloak muestra error en lugar de la página "Revisa tu correo".
  - Spec del tema: `npm run e2e:theme` (`playwright.keycloak.config.ts`, serial); capturas en `docs/reportes/m1.5/`.

---

### [x] M2: Core Plumbing (HTTP, Errores, Fechas, i18n, Mock Adapter)
- **Alcance:**
  - Interceptores HTTP: inyección de Bearer token, `X-Correlation-Id`, mapeo RFC 9457 `ProblemDetails` (`errorCode ?? code`).
  - Manejo de cabecera `WWW-Authenticate` con desafío `acr_values="2"` y `max_age`.
  - Helpers de formato: parseo seguro de fechas calendario `YYYY-MM-DD` sin desfase de zona horaria (`America/Bogota`), números y moneda es-CO.
  - Mapas de traducción exhaustivos en `@halsa/core/i18n` para enums de negocio con validación exhaustiva de TypeScript.
  - Transliteración ASCII estricta para la cabecera `Halsa-Motivo-Acceso`.
  - Manejador global de errores con anonimización (scrubbing) de payloads sensibles.
  - Adaptador mock de desarrollo (`projects/*/src/mocks/`) para simular respuestas y errores (401 step-up, 403, 404, 409, 429).
- **Criterios de Aceptación:**
  - Suite de pruebas unitarias en Vitest cubriendo formatters, parsing de problemas, transliteración y mapeo de enums.
- **Notas de implementación:**
  - `@halsa/core`: `http/problema.ts` (`ProblemaApi`, `ErrorApi`, `WWW-Authenticate` y `Retry-After`), `http/interceptores.ts` (`API_PREFIX`, `correlacionInterceptor`, `problemaInterceptor`, sin reintentos), `http/mensaje-error.ts` (error → UI en español; 404 siempre neutro, 5xx sin `detail`), `errors/manejador-errores.ts` (`ErrorHandler` global con anonimización), `format/fecha-calendario.ts` (DateOnly sin `new Date(str)`, `hoyBogota`), `format/locale.ts` (`LOCALE_ID` es-CO), `formatMoneda`, `i18n/codigos-error.ts` y mapas `Record<Union, string>` exhaustivos.
  - Bearer: `projects/backoffice/src/app/core/http/auth.interceptor.ts` con el token `TOKEN_ACCESO` (M3 lo enlaza al cliente OIDC). Toasts: `Notificaciones` en `@halsa/ui` y `<hlm-toaster>` en el shell de ambas apps.
  - Mock adapter: `libs/mocks` (`@halsa/mocks`, enrutador + RFC 9457) y fixtures en `projects/*/src/mocks/`. Se conecta con `dev.interceptors.ts`, que producción reemplaza por `dev.interceptors.prod.ts`. Escenarios: 401 step-up (por `acr`/`auth_time` del token), 403 `Clinico.NoAsignado` + acceso de emergencia, 404 entre tenants, 409, 429 (`/paciente/api/vinculos`), 503 (`numeroCertificado: ANTIVIRUS-503`). Sin token, el mock responde como `analista.arla`. Sesión BFF inicial del portal: `sessionStorage['halsa.mock.sesion']`.
  - Evidencia visual: `/_ui/errores` (ambas apps) y `e2e/errores.spec.ts` (375 px y 1440 px, claro y oscuro, axe). Líneas base en `e2e/errores.spec.ts-snapshots/`; capturas del reporte en `docs/reportes/m2/`. Tras un cambio de estilos: `npm run e2e:update`.
  - Las capturas destaparon dos defectos visuales, ya corregidos: los toasts ignoraban el modo oscuro (el shell ahora pasa `[theme]` desde `TemaService`) y el código de seguimiento de `<halsa-estado-error>` se partía en "00-" / resto.

---

### [ ] M3: Backoffice Shell e Identidad
- **Alcance:**
  - Configuración de `angular-auth-oidc-client` (PKCE, silent renew, popup step-up).
  - Almacenamiento seguro de tokens exclusivamente en memoria / sessionStorage (nunca localStorage).
  - Bootstrap de sesión mediante `GET /v1/identidad/yo`.
  - `PermisosService` reactivo basado en señales y guard `requierePermiso(...)`.
  - Shell responsivo: barra inferior de 4 ítems + sheet "Más" (< 1024 px); sidebar colapsable (≥ 1024 px).
  - Chip con identificador de tenant o código REPS de IPS.
  - Pantalla `/cuenta` con display de `sub`, permisos asignados y nivel de verificación actual.
  - Componente de compuerta `<halsa-verificacion-reforzada>` con fallback de redirección si el popup es bloqueado.
- **Criterios de Aceptación:**
  - Matriz de navegación de §6.3 verificada en Playwright para los cinco roles principales.
  - Flujo de elevación a `acr=2` validado con dev users de Keycloak.

---

### [ ] M4: Casos (Flujo Administrativo)
- **Alcance:**
  - Listado de casos `/casos` con filtros por `estado` sincronizados a la URL (sin caja de búsqueda de texto inexistente).
  - Shell del caso `/casos/:casoId` con tabs filtrados por permisos.
  - Tab Resumen: visualización de datos del evento, partes (documento de trabajador enmascarado con botón de revelar) y porcentaje PCL calificado.
  - Tab Equipo y Remisiones: asignación por propio `sub` o identificador externo, remisión a IPS con código REPS de 12 dígitos, revocación de remisión.
  - Tab Portal Paciente: generación de código de activación de un solo uso para casos en estado `Validado`, visualizado en diálogo no descartable con copia segura.
  - Widgets de casos en `/inicio`.
- **Criterios de Aceptación:**
  - Flujos E2E de analista completados (asignar calificador, remitir a IPS, generar código de activación).
  - Respuestas 404 neutras para casos fuera del tenant.

---

### [ ] M5: Plazos (Tablero y Workflow)
- **Alcance:**
  - Tablero central de plazos `/plazos` con filtros de estado y reglas legales.
  - Agrupación visual en móvil (Vencidos, Hoy, Esta semana, Próximos) y tabla ordenable en escritorio.
  - Tab de plazos dentro del shell de caso.
  - Diálogo de cumplimiento de plazo (`POST /casos/{id}/plazos/{id}/cumplir`) con nota obligatoria (10–1000 caracteres) y fecha de cumplimiento opcional (≤ ahora).
  - Semáforos de urgencia visual basados en `alertaEn` y `venceEn`.
- **Criterios de Aceptación:**
  - Sincronización bidireccional de filtros con la URL.
  - Mapeo adecuado de estados y alertas de extemporaneidad.

---

### [ ] M6: Clínico 🔒 (Historia Clínica y Acceso de Emergencia)
- **Alcance:**
  - Aislamiento estricto de datos clínicos: sin persistencia en storage, eliminación al abandonar la ruta, banners de reserva legal (Res. 1995/1999).
  - Listado cronológico de registros clínicos con filtro para ocultar versiones superadas por corrección.
  - Detalle de registro clínico y formulario de nuevo registro (`CONCEPTO_MEDICO`, `EVOLUCION`, `CONCEPTO_REHABILITACION`) con editor de diagnósticos CIE-10.
  - Modo corrección de registro pre-llenado (`?corrige=<id>`).
  - Manejo de `403 Clinico.NoAsignado`: despliegue del panel de usuario no asignado con opción de Acceso de Emergencia ("break-the-glass").
  - Diálogo de acceso de emergencia con motivo obligatorio (20–500 caracteres), vista previa en ASCII estándar, inyección de cabecera `Halsa-Motivo-Acceso` y cintillo ámbar persistente.
- **Criterios de Aceptación:**
  - Flujo E2E de calificador (`calificador.arla`) con elevación OTP.
  - Validación automatizada de vaciado de memoria y storages al salir de la historia clínica.

---

### [ ] M7: Incapacidades
- **Alcance:**
  - Visualizador de días acumulados con barra de progreso y marcadores normativos (150, 180, 540 días).
  - Listado de certificados e indentación visual de prórrogas respecto a la incapacidad inicial.
  - Formulario de carga de incapacidad (`incapacidades:write`, `acr=2`):
    - Stepper en móvil, formulario unificado en escritorio.
    - Carga multipart/form-data: parte `datos` (JSON Blob) y parte `soporte` (PDF Blob).
    - Validación en cliente del PDF: extensión, tamaño ≤ 10 MB, verificación de bytes mágicos `%PDF-`.
    - Generación y reuso de clave de idempotencia (`Idempotency-Key` UUID v4) ante reintentos de red.
  - Descarga segura de soporte clínico 🔒 (`clinico:read`, `acr=2`) mediante Blob URL de un solo uso revocada inmediatamente.
- **Criterios de Aceptación:**
  - E2E de carga de incapacidad con `medico.ips`.
  - Test unitario de persistencia de la misma clave de idempotencia en reintentos.

---

### [ ] M8: Dictamen PCL 🔒
- **Alcance:**
  - Consulta de dictamen con compuerta de seguridad estricta: `acr=2` y `auth_time` ≤ 15 minutos.
  - Contador regresivo de vigencia de la sesión y re-elevación preventiva mediante popup cuando resten < 2 minutos.
  - Formulario de registro de dictamen PCL:
    - Validación de porcentaje (0–100 % con dos decimales).
    - Validación de suma de componentes (deficiencias + rol = total ±0.01).
    - Fundamentos extensos (50–20 000 caracteres) preservados en memoria reactiva ante elevación popup.
  - Flujo de corrección de dictamen en estado `PENDIENTE`.
  - Registro de notificación del dictamen (`notificadoEn`, medio) y visualización del plazo para controversia.
- **Criterios de Aceptación:**
  - E2E de calificador registrando y notificando dictamen.
  - Supervivencia verificada de formularios extensos sin guardado en storage tras re-autenticación por popup.

---

### [ ] M9: Privacidad
- **Alcance:**
  - Bandeja de Solicitudes de Copia de Historia Clínica `/solicitudes-copia-hc`:
    - Pestañas por estado (Recibidas, En trámite, Cerradas).
    - Transición de estados y cierre con registro de nota y resultado.
    - Radicado y caso presentados sin enlaces de navegación (el oficial carece de `casos:read`).
  - Registro de Auditoría de Accesos `/auditoria/accesos`:
    - Filtros por rango de fechas, actor, caso, acción y resultado.
    - Drawer de detalle con copia de identificadores técnicos y correlación.
    - Botón de exportación oculto (ausencia de endpoint backend G8).
  - Revisiones de Acceso de Emergencia `/auditoria/revisiones-emergencia`:
    - Listado de revisiones pendientes con contador crítico hacia las 72 horas legales.
    - Diálogo de cierre de revisión con dictamen de Justificado / Injustificado y observaciones.
- **Criterios de Aceptación:**
  - Pruebas E2E completas con el usuario `privacidad.arla`.
  - Paginación y filtrado operativo contra el API.

---

### [ ] M10: Portal del Paciente
- **Alcance:**
  - Arquitectura sin tokens en el navegador: navegación a través del BFF (`/paciente/api/*`) y sesión por cookie HttpOnly.
  - Interceptor CSRF para adjuntar `X-Halsa-Csrf: 1` a toda petición hacia `/paciente/`.
  - Flujo de bienvenida y autenticación OIDC delegada en el BFF.
  - Pantalla de activación `/activar`: entrada de código de activación, tolerancia a caracteres confusos (Crockford) y manejo del código 429 (rate limiting con countdown).
  - Pantallas de Inicio, Mis Casos, Línea de Tiempo de Caso e Incapacidades en lenguaje claro para el paciente.
  - Formulario de Solicitud de Copia de Historia Clínica con validación de solicitud única abierta (`SolicitudCopiaHc.YaAbierta`).
- **Criterios de Aceptación:**
  - Suite E2E de paciente ejecutada contra el BFF (o adaptador mock según disponibilidad de G3).
  - Métricas Lighthouse móvil: Performance ≥ 90, Accesibilidad ≥ 95.

---

### [ ] M11: Hardening y Entrega
- **Alcance:**
  - Dockerfiles multi-stage optimizados para ambas aplicaciones (`node:22-alpine` → `nginxinc/nginx-unprivileged:stable-alpine`).
  - Configuración Nginx con inyección de variables de entorno para `config.json` en tiempo de ejecución.
  - Cabeceras de seguridad estrictas: CSP con Trusted Types (`require-trusted-types-for 'script'`), COOP `same-origin-allow-popups`, Referrer-Policy, etc.
  - Documentación de despliegue en `deploy/README.md`.
  - Pipeline de integración continua en `.github/workflows/frontend.yml` (lint + tests unitarios + build con presupuestos estrictos).
  - Auditoría final de accesibilidad con axe-core sin violaciones serias ni críticas.
- **Criterios de Aceptación:**
  - Verificación de ejecución local de los contenedores Docker generados.
  - Cero violaciones de CSP en consola durante la ejecución completa de pruebas E2E.
  - Presupuestos de bundle respetados (Backoffice ≤ 300 kB gz, Portal ≤ 200 kB gz).

---

## 3. Registro de Observaciones Técnicas, Gaps y Mitigaciones

| Código | Tema | Impacto | Estrategia de Mitigación / Decisión |
| :--- | :--- | :--- | :--- |
| **OBS-1** | Tipografía | Legibilidad e identidad clínica. | **Plus Jakarta Sans** seleccionada como fuente principal de UI; **JetBrains Mono** para radicados y códigos. |
| **OBS-2** | Podman en Windows | Keycloak local para M1.5. | `podman-machine-default` se iniciará (`podman machine start`) antes de ejecutar scripts `kc:*`. Verificado: los bind mounts relativos funcionan; `podman compose` delega en `docker-compose.exe`. En esta máquina `host.containers.internal` resuelve al router (192.168.1.1), no al host: no depender de él. |
| **OBS-3** | Generación OpenAPI (M0) | API backend fuera de línea al inicio. | Uso del script alternativo `npm run api:types:yaml` apuntando a `../Halsa.Backend/docs/api/atel-api.openapi.yaml`. |
| **OBS-4** | Compatibilidad Spartan UI | Soporte sobre Angular 21 zoneless. | Si `@spartan-ng/*` presenta conflicto en v21, se aplicará el fallback documentado en `@angular/cdk` + `cva` + `tailwind-merge`. |
| **G1** | Falta de CORS en Backend API | Afecta llamadas directas cross-origin. | En desarrollo se usa el proxy local (`proxy.backoffice.json`). Para despliegue se documentan cabeceras requeridas en `deploy/README.md`. |
| **G3** | Falta de Redirect URI en BFF | Bloquea login local del portal en `:4300`. | Desarrollo inicial del portal (M10) sobre el adaptador mock; posterior validación E2E con BFF tras actualización del realm. |
| **G4** | Sin directorio de usuarios | Asignaciones usan UUIDs crudos (`sub`). | Se implementa botón "Asignarme", copia de `sub` en Cuenta y presentación abreviada (8 caracteres con tooltip). |
| **G6** | Sin búsqueda de texto en `/casos` | No existe búsqueda por radicado o cédula. | No se renderiza buscador de texto falso; se filtran casos únicamente por estado. |
| **G8** | Sin endpoint de exportación | Permiso `auditoria:export` sin backend. | Se oculta el botón de exportación en la pantalla de auditoría. |
| **G10** | Motivo de emergencia en ASCII | Kestrel rechaza caracteres diacríticos en cabeceras HTTP. | Transliteración automática a ASCII antes del envío (`ñ→n`, acentos removidos) y visualización en vivo del texto resultante. |
| **G13** | Discrepancia ProblemDetails | OpenAPI especifica `code`, implementación usa `errorCode`. | Lectura defensiva en interceptores y mappers: `errorCode ?? code`. |

---

## 4. Protocolo de Cierre por Hito (§15)

Al concluir cada hito, se actualizará el checklist de este documento y se emitirá el reporte formal con la siguiente estructura:
1. **Done:** Lista de verificación contra los AC del hito con evidencias (salida de comandos, tests, rutas de screenshots).
2. **Deviations:** Ajustes o diferencias respecto al plan y su debida justificación técnica.
3. **Gaps found:** Nuevas discrepancias o requerimientos no cubiertos por el backend.
4. **Questions:** Bloqueos críticos o decisiones que requieran confirmación del usuario.
5. **Next:** Confirmación del hito siguiente a iniciar.
