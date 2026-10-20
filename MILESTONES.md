# Halsa Frontend — Plan de Hitos y Seguimiento de Implementación

> **Estado general:** M8 completado (2026-10-20); siguiente: M9  
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
- [x] **M3: Backoffice Shell e Identidad (OIDC, Permisos, Layout Responsivo)**
- [x] **M4: Casos (Flujo Administrativo, Resumen, Equipo, Activación Paciente)**
- [x] **M5: Plazos (Tablero de Vencimientos y Workflow de Cumplimiento)**
- [x] **M6: Clínico 🔒 (Historia Clínica y Acceso de Emergencia "Break-the-Glass")**
- [x] **M7: Incapacidades (Listado, Barra Acumulada, Carga Multipart con Soporte PDF)**
- [x] **M8: Dictamen PCL 🔒 (Dictamen, Notificación y Ventana de 15 Minutos)**
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

### [x] M3: Backoffice Shell e Identidad
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
- **Notas de implementación:**
  - `projects/backoffice/src/app/`: `core/auth` (OIDC, claims, retorno, callback), `core/sesion` (`SesionService`), `core/permisos` (servicio, guards, `*halsaSiPuede`, etiquetas), `core/step-up` (servicio, compuerta, diálogo), `core/http/step-up.interceptor.ts`, `shell/` (layout, navegación, páginas 403/404/sin acceso), `features/inicio`, `features/cuenta`.
  - Validado con el Keycloak de Podman + API mock (el Keycloak del backend no estaba disponible). `playwright.config.ts` sirve el backoffice en modo mock salvo con `HALSA_E2E_REAL=1`.
  - Gaps nuevos: G16 (el realm no define el scope `basic`: tokens sin `sub` ni `auth_time`; `kc:sync` lo agrega solo en local) y G17 (`browser-loa` sin paso Cookie: el step-up pedía contraseña y código). Los dos se aplican a los realms mock como en prod desde `kc:sync`; el cambio para el backend está en `docs/backend/realm-g16-g17.md`.
  - Secciones de M4+ (casos, plazos, solicitudes, auditoría) responden con su guard y una página "disponible pronto".

---

### [x] M4: Casos (Flujo Administrativo)
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
- **Notas de implementación:**
  - `features/casos/`: `casos.routes.ts`, `pestanas.ts` (pestañas por permiso + guard `requierePestana`, que vuelve al resumen con un aviso), `validacion.ts` (REPS de 12 dígitos, `sub` UUID), `data-access/caso.store.ts` (detalle del caso con alcance de ruta: lo provee el shell del caso), `pages/` (lista, shell, resumen, equipo, portal-paciente). Las pestañas de M5–M8 ya existen con su guard y una página "disponible pronto".
  - `shared/casos/casos-api.service.ts` (`CasosApi`): compartido porque los widgets de `/inicio` leen el mismo listado y las features no se importan entre sí. `shared/paginacion.ts` y `shared/refresco.ts` (recarga al volver a la pestaña si los datos tienen más de 60 s).
  - `/inicio`: los widgets se declaran con su `permiso` y cargan con `@defer (on viewport)`; M4 trae "Casos por estado" y "Casos recientes".
  - `sub` abreviado como `01999000…0a01` (primeros 8 + últimos 4): son UUID v7 ordenados por tiempo y las cuentas creadas a la vez comparten el prefijo (ver G4).
  - `formatFechaHoraBogota` ahora sigue §8.5 ("17 oct 2026, 3:45 p. m.", sin cortes dentro de "p. m."); nuevo `formatFechaDiaBogota` y `<halsa-fecha-bogota [conHora]="false">` para el día de un datetime.
  - Mock: 20 casos históricos de ARL_A para paginar, orden "más reciente primero" como la API, y cuerpos JSON clonados en cada respuesta (antes compartía referencias con los fixtures y dejaba `computed` desactualizados).
  - Evidencia: `e2e/casos.spec.ts` (flujos de analista y coordinador IPS, 404 entre tenants, redirección de pestaña clínica, paginación, widgets; capturas 375/1440 claro/oscuro con axe). Líneas base en `e2e/casos.spec.ts-snapshots/` (fechas enmascaradas: los fixtures son relativos a hoy), capturas del reporte en `docs/reportes/m4/`. Helpers comunes de los specs del backoffice en `e2e/backoffice.ts`.

---

### [x] M5: Plazos (Tablero y Workflow)
- **Alcance:**
  - Tablero central de plazos `/plazos` con filtros de estado y reglas legales.
  - Agrupación visual en móvil (Vencidos, Hoy, Esta semana, Próximos) y tabla ordenable en escritorio.
  - Tab de plazos dentro del shell de caso.
  - Diálogo de cumplimiento de plazo (`POST /casos/{id}/plazos/{id}/cumplir`) con nota obligatoria (10–1000 caracteres) y fecha de cumplimiento opcional (≤ ahora).
  - Semáforos de urgencia visual basados en `alertaEn` y `venceEn`.
- **Criterios de Aceptación:**
  - Sincronización bidireccional de filtros con la URL.
  - Mapeo adecuado de estados y alertas de extemporaneidad.
- **Notas de implementación:**
  - `features/plazos/`: tablero `/plazos` con filtros `estado` (por defecto `ABIERTO`; `?estado=todos` para todos), `regla` y `venceAntesDe` (fecha calendario = hasta el fin de ese día en Bogotá) en la URL. Móvil: tarjetas agrupadas en Vencidos / Hoy / Esta semana / Más adelante (día calendario de Bogotá); escritorio: tabla ordenable por `venceEn` (`aria-sort`).
  - Pestaña Plazos del caso (`features/casos/pages/plazos.page.ts`): línea de tiempo por `venceEn` con el semáforo como punto.
  - `shared/plazos/`: `PlazosApi`, `DialogoCumplirPlazo` (hoja inferior en móvil, lateral en escritorio; nota 10–1000 con contador, `cumplidoEn` opcional como `datetime-local` en hora de Bogotá), `TarjetaPlazo` y `agruparPlazos`. Los usan el tablero, la pestaña del caso y `/inicio`.
  - `/inicio`: widgets "Plazos por vencer (7 días)" y "Plazos vencidos".
  - `@halsa/core`: `bogotaLocalAIso`, `aBogotaLocal` y `finDelDiaBogota` (Colombia es UTC−5 fijo, sin horario de verano).
  - "Cumplir" se ofrece para `ABIERTO` **y `VENCIDO`**: el backend (`Plazo.Cumplir`) admite ambos; el plan decía solo `ABIERTO`. Errores mapeados: `Plazo.NotaRequerida`/`Plazo.NotaDemasiadoLarga` bajo la nota, `Plazo.CumplidoEnFuturo` bajo la fecha, `Plazo.NoCumplible` y el resto dentro de la hoja.
  - Fecha "Vence antes de": `<input type="date">` nativo (el calendario de Spartan no se generó): accesible y con el selector del sistema en móvil.
  - Evidencia: `e2e/plazos.spec.ts` (URL ↔ filtros incluido "Atrás", orden, cumplir desde el tablero y desde el caso, widgets, calificador sin `plazos:write`), capturas en `docs/reportes/m5/`. `cargarDiferidos()` en `e2e/backoffice.ts` hace scroll para que carguen los widgets `@defer (on viewport)`.

---

### [x] M6: Clínico 🔒 (Historia Clínica y Acceso de Emergencia)
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
- **Notas de implementación:**
  - `features/clinico/`: `clinico.routes.ts` (lista, `nuevo` con `clinico:write`, `:registroId`), `data-access/clinico-api.service.ts` y `historia-clinica.store.ts` **provistos por la página** (no en `root`): los registros y el motivo de emergencia se descartan al salir de la historia clínica. `formulario.ts` concentra el modelo del formulario, el mapeo a `RegistroClinicoRequest` y el de errores.
  - La pestaña la monta `app.routes.ts` con `crearRutasCasos({ historiaClinica })`: la composición vive en la raíz y `features/casos` no importa `features/clinico`.
  - Compuerta antes de todo: el contenido clínico solo se instancia con `acr=2`, así que ninguna petición clínica sale antes del step-up (test unitario).
  - Acceso de emergencia: el motivo (ASCII, G10) viaja en `Halsa-Motivo-Acceso` solo en las **lecturas** de ese caso y mientras se está en la historia clínica; las escrituras se ocultan con la franja ámbar activa.
  - "Corregir": cualquier registro vigente salvo `CERTIFICADO_INCAPACIDAD` (nace de la carga del PDF, M7). El backend no exige conservar el tipo, así que un reporte inicial se corrige con un concepto médico.
  - `@halsa/core`: validador CIE-10 (`PATRON_CIE10`, mismo patrón que el backend). `@halsa/ui`: `EditorDiagnosticosCie10` (reutilizable en M8).
  - Mock: añade `Clinico.CasoNoAdmiteRegistros`, `Clinico.FechaAtencionAnteriorAlEvento` (1 día de tolerancia) y `Clinico.ProfesionalSinRegistro`, como el backend.
  - E2E: `e2e/clinico.spec.ts` (step-up OTP real, lista con versiones corregidas, corrección, concepto nuevo con CIE-10, acceso de emergencia con motivo transliterado que se borra al salir, y revisión de `localStorage`/`sessionStorage`/IndexedDB sin datos clínicos). Capturas en `docs/reportes/m6/` (calificador en escritorio, medico.ips en móvil).
  - El mock es un interceptor dentro de la app, así que Playwright no ve las cabeceras: que toda petición clínica lleve `acr=2` se comprueba porque el mock responde 401 con desafío si no (y en el test unitario de la compuerta), y la cabecera del motivo en un test unitario.
  - `e2e/backoffice.ts`: el control de ventanas TOTP ahora es entre procesos (archivo de bloqueo), porque los workers en paralelo reutilizaban el mismo código y Keycloak lo rechazaba.

---

### [x] M7: Incapacidades
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
- **Notas de implementación:**
  - `features/incapacidades/`: `incapacidades.routes.ts` (lista y `nueva` con `incapacidades:write`), montado desde `app.routes.ts` con `crearRutasCasos({ incapacidades })` como la historia clínica. `IncapacidadesApi` e `IncapacidadesStore` los provee la página de la pestaña: el listado se comparte con el formulario (selector de `prorrogaDe`) y se descarta al salir.
  - Lista: `BarraDiasAcumulados` con el mayor `diasAcumulados`, cadenas (inicial + prórrogas sangradas) con `agruparCadenas` (`cadenas.ts`) y alertas con sus etiquetas de §8.4. "Descargar soporte" 🔒 (`clinico:read`): step-up `acr=2` antes de pedirlo, blob + `guardarBlob` (URL de un solo uso revocada en el acto) con el nombre de `Content-Disposition` (`nombreDeContentDisposition`, respaldo `incapacidad-<id>.pdf`); un 403/404 va a un toast.
  - Carga: compuerta `acr=2` primero. Escritorio, una página; móvil (< 768 px), stepper de 5 pasos que valida cada paso antes de avanzar, con las acciones fijas sobre la barra inferior. `formulario.ts` concentra el modelo, `aRequest` (sin `profesional`; `prorrogaDe` solo en prórrogas) y `erroresDeCarga` (códigos de dominio, reglas 422 de la SPEC 07, rutas `datos.*` de `errors`, 413/415 sobre el soporte). Vista previa "Termina el …", REPS prellenado con el `ipsId` de los actores IPS, barra de progreso (`reportProgress`) y hoja de resultado con las `alertas`.
  - Multipart: `datos` como `Blob` `application/json` y `soporte` como el PDF. `ClaveIdempotencia` (`@halsa/core`) da una `Idempotency-Key` UUID v4 por estado del formulario: la misma si se reintenta con los mismos datos y el mismo archivo (tras un fallo de red el botón pasa a "Reintentar la carga"), una nueva si algo cambia, y se descarta tras el 201.
  - Diagnósticos: un solo `EditorDiagnosticosCie10` (el primero es el principal, hasta 3 relacionados); el editor ganó la entrada `maximo`.
  - `features/clinico/caso-id.ts` pasó a `shared/casos/caso-id.ts` (lo usan las dos pestañas montadas desde fuera). La regla `halsa/feature-boundaries` trata `features/incapacidades/data-access` como clínica (plan §3: la descarga del soporte).
  - Evidencia: `incapacidades.spec.ts` (unit: cadenas, modelo, mapeo de errores, compuerta, multipart, misma clave tras un fallo de red simulado, clave nueva si cambian los datos, 503, permisos) y `e2e/incapacidades.spec.ts` (medico.ips: prórroga con PDF, rechazo de un no-PDF en el cliente, descarga del soporte; analista sin carga ni descarga; capturas 375/1440 claro y oscuro con axe). Capturas en `docs/reportes/m7/`.
  - Las capturas de M7 hacen claro y oscuro en la misma prueba (`emulateMedia`): solo `calificador.arla` y `medico.ips` tienen OTP y cada step-up necesita su ventana TOTP de 30 s; una prueba por esquema hacía que la suite completa superara el timeout de 120 s.

---

### [x] M8: Dictamen PCL 🔒
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
- **Notas de implementación:**
  - `features/dictamen-pcl/`: `dictamen-pcl.routes.ts` (vista y `registrar[?corrige=<id>]` con `pcl:dictamen:write`), montado desde `app.routes.ts` con `crearRutasCasos({ dictamenPcl })`. `DictamenPclApi` y `DictamenPclStore` los provee la página **por encima** de la compuerta `acr=2` + `maxAgeSeg=900`: el dictamen y el borrador del formulario viven ahí, en memoria.
  - Ventana de 15 minutos: cuando faltan menos de 2 min la compuerta se cierra y destruye la vista, pero el `FormGroup` es del store (`store.formulario(clave)`), así que al verificar de nuevo vuelve el mismo formulario con todo lo escrito. Nada va a storage. "Cancelar" y el 201 descartan el borrador; salir de la pestaña también.
  - `core/step-up/vigencia-verificacion.ts`: chip "Verificación vigente por mm:ss" (cuenta hasta el cierre de la compuerta, `auth_time + 900 − 120`) y "Renovar verificación" (popup `acr_values=2&max_age=780`). Al llegar a cero llama a `StepUpService.actualizarReloj()` para que la compuerta cierre en ese segundo y no en el siguiente tick de 15 s. `StepUpService.cierraEn()` es nuevo.
  - Comprobado contra Keycloak real (script de sondeo con PKCE): una re-verificación dentro de la ventana pide **solo el OTP** y **renueva `auth_time`** (el nivel 2 tiene `loa-max-age: 0`); con la ventana vencida, `max_age` obliga a contraseña + OTP.
  - Formulario: `CampoPorcentaje` (nuevo en `@halsa/ui`: directiva CVA + validador sobre el `<input hlmInput>`, muestra "23,45", entrega `23.45`; `parsearDecimal`, `tieneMaxDecimales` y `formatDecimalEditable` en `@halsa/core`), origen en tarjetas de radio, fechas estructuración ≤ dictamen ≤ hoy en Bogotá, componentes opcionales con la suma ±0,01 en vivo, fundamentos 50–20 000 con contador, `EditorDiagnosticosCie10` con `minimo=1`. Errores por código del backend (`Dictamen.*` en `errors[]` o en `errorCode`) a su campo; sin RETHUS, aviso general.
  - Vista: cifra grande es-CO, origen, estado, fechas, manual, barra apilada de componentes, diagnósticos, calificador (documento enmascarado) y fundamentos. Stepper Pendiente → Notificado → (En controversia) → En firme; con NOTIFICADO, días para controvertir, o "aún no está disponible" mientras el backend abre el plazo (ver G20).
  - "Registrar notificación": hoja inferior/lateral, `notificadoEn` ≤ ahora y ≥ fecha del dictamen (Bogotá), medio en tarjetas de radio.
  - Desviaciones del plan §7.7: "Renovar verificación" se ofrece siempre y pasa a primario en los últimos 2 minutos (el plan lo ofrecía solo entonces), para reiniciar la ventana antes de escribir un dictamen largo. Ante un 409 (`YaExiste`, `YaNotificado`, `CorrigeANoVigente`) el formulario **no** se cierra: se explica arriba, se deshabilita el envío y se recarga el dictamen, para no perder hasta 20 000 caracteres escritos. `CampoMoneda` no se construyó: ningún endpoint maneja dinero todavía.
  - Acceso de emergencia también en la lectura del dictamen (la API lo acepta): panel "No estás asignado", motivo ASCII solo en el GET y escrituras ocultas mientras esté activo, como en M6.
  - Mock alineado con el backend: validación con `General.Validation` + `errors[{ code, description }]` (`PorcentajeFueraDeRango` también por decimales, `FechasInvalidas` también por dictamen futuro, `ComponentesNoSuman`, `FundamentosLongitud`, `DiagnosticoRequerido`), el caso pasa a `EnCalificacionPcl`, `NotificacionFueraDeRango` (400) antes de la fecha del dictamen, `MedioInvalido`, y al notificar se abre el plazo `CONTROVERSIA_DICTAMEN`.
  - Evidencia: `dictamen-pcl.spec.ts` (25 tests: modelo, mapeo de errores, compuerta sin peticiones con `acr=1`, con `auth_time` de 16 min y con menos de 2 min de ventana; el borrador de >5 000 caracteres sobrevive al cierre de la compuerta y a la verificación por popup sin tocar storage; registrar, corregir, notificar, el error del medio que se limpia al elegirlo, 409, emergencia, sin escritura). `CampoPorcentaje` y los decimales en sus specs. `e2e/dictamen.spec.ts` con Keycloak real: calificador registra con >5 000 caracteres de fundamentos, renueva la verificación por popup OTP con el formulario lleno (sigue intacto y nada en storage), registra y notifica; corrección con la suma en vivo; analista sin pestaña. Capturas 375/1440 claro y oscuro con axe en `docs/reportes/m8/`.

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
| **OBS-5** | Umbral de las líneas base visuales | `maxDiffPixelRatio: 0.01` con el umbral por píxel por defecto deja pasar contenido nuevo en páginas claras grandes (tarjetas blancas sobre fondo casi blanco: solo cuentan los glifos). | Detectado en M4: la línea base de escritorio de `/inicio` (M3) no fallaba con los widgets nuevos. Se regeneraron desde cero las afectadas y los specs esperan los datos antes de capturar. Pendiente para M11: evaluar un umbral más estricto. |
| **OBS-6** | Presupuesto del portal | El bundle inicial del portal mide 468 kB sin comprimir (presupuesto de aviso de 400 kB en `angular.json`), ya desde antes de M4 (464,5 kB en el commit de M3). Comprimido son 109 kB, dentro del objetivo de 200 kB del plan. Al cierre de M8 mide 476,8 kB (109,4 kB comprimido); M8 no le suma nada (medido sin sus cambios). | Revisar en M10/M11. |
| **OBS-4** | Compatibilidad Spartan UI | Soporte sobre Angular 21 zoneless. | Si `@spartan-ng/*` presenta conflicto en v21, se aplicará el fallback documentado en `@angular/cdk` + `cva` + `tailwind-merge`. |
| **G1** | Falta de CORS en Backend API | Afecta llamadas directas cross-origin. | En desarrollo se usa el proxy local (`proxy.backoffice.json`). Para despliegue se documentan cabeceras requeridas en `deploy/README.md`. |
| **G3** | Falta de Redirect URI en BFF | Bloquea login local del portal en `:4300`. | Desarrollo inicial del portal (M10) sobre el adaptador mock; posterior validación E2E con BFF tras actualización del realm. |
| **G4** | Sin directorio de usuarios | Asignaciones usan UUIDs crudos (`sub`). | Botón "Asignarme", asignación por identificador, copia de `sub` en Cuenta y presentación abreviada con tooltip. Se muestran los primeros 8 **y los últimos 4** caracteres (`01999000…0a01`): con UUID v7 los primeros 8 se repiten entre cuentas creadas juntas. |
| **G6** | Sin búsqueda de texto en `/casos` | No existe búsqueda por radicado o cédula. | No se renderiza buscador de texto falso; se filtran casos únicamente por estado. |
| **G8** | Sin endpoint de exportación | Permiso `auditoria:export` sin backend. | Se oculta el botón de exportación en la pantalla de auditoría. |
| **G10** | Motivo de emergencia en ASCII | Kestrel rechaza caracteres diacríticos en cabeceras HTTP. | Transliteración automática a ASCII antes del envío (`ñ→n`, acentos removidos) y visualización en vivo del texto resultante. |
| **G13** | Discrepancia ProblemDetails | OpenAPI especifica `code`, implementación usa `errorCode`. | Lectura defensiva en interceptores y mappers: `errorCode ?? code`. |
| **G18** | `IncapacidadResponse` sin `prorrogaDe` | La lista no sabe a qué incapacidad prorroga cada prórroga. | El frontend infiere las cadenas (`agruparCadenas`): una prórroga va con la cadena cuyo último certificado termina justo antes de su inicio, lo que el backend garantiza (solo se prorroga la última de la cadena, sin solapes, ≤ 30 días de separación). Pedir al backend que exponga `prorrogaDe`. |
| **G19** | Reglas 422 de incapacidades sin prefijo | Las reglas de la SPEC 07 responden con el código tal cual (`INCAPACIDAD_SOLAPADA`, `PRORROGA_NO_ES_ULTIMA`, …), no `Incapacidades.*`, y el plan §4.2 no las lista. `Incapacidades.DiasFueraDeRango` e `InicialConProrrogaDe` son guardas que el validador ya impide (llegan como `errors` de `datos.*`). | Mapeo explícito de esas reglas a su campo en `erroresDeCarga`. |
| **G20** | Plazo de controversia asíncrono | `POST …/dictamen-pcl/notificar` responde 204, pero `CONTROVERSIA_DICTAMEN` se abre desde el evento del outbox: justo después, `GET` puede traer `NOTIFICADO` con `venceControversiaEn: null` (también es nulo para un actor IPS). | La vista dice "El plazo para controvertir aún no está disponible" en lugar de una fecha vacía. Si el backend quiere la fecha en la respuesta, podría devolver `DictamenPclResponse` en vez de 204. |
| **OBS-7** | Ventana de 15 min en E2E | No se puede simular un `auth_time` viejo en Playwright: adelantar el reloj del navegador rompe la validación del id_token al renovar (`iat`/`exp`) y reescribir el access token falla el `at_hash`. | El E2E prueba la supervivencia del formulario con una re-verificación real por popup ("Renovar verificación"); el cierre y la reapertura de la compuerta por tiempo se prueban en el spec unitario con la compuerta real y el popup simulado. |

---

## 4. Protocolo de Cierre por Hito (§15)

Al concluir cada hito, se actualizará el checklist de este documento y se emitirá el reporte formal con la siguiente estructura:
1. **Done:** Lista de verificación contra los AC del hito con evidencias (salida de comandos, tests, rutas de screenshots).
2. **Deviations:** Ajustes o diferencias respecto al plan y su debida justificación técnica.
3. **Gaps found:** Nuevas discrepancias o requerimientos no cubiertos por el backend.
4. **Questions:** Bloqueos críticos o decisiones que requieran confirmación del usuario.
5. **Next:** Confirmación del hito siguiente a iniciar.
