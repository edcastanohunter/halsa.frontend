# Halsa Frontend — Plan de Hitos y Seguimiento de Implementación

> **Estado general:** M11 completado (2026-10-24); los doce hitos están cerrados. Lighthouse Performance del portal sigue < 90 en páginas autenticadas (OBS-8, pendiente de remedir contra el build de producción).  
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
- [x] **M9: Privacidad (Bandeja Solicitudes Copia HC, Auditoría de Accesos, Revisiones de Emergencia)**
- [x] **M10: Portal del Paciente (BFF, Sesión por Cookie, Línea de Tiempo, Solicitudes)**
- [x] **M11: Hardening y Entrega (Dockerfiles, Nginx con CSP/Trusted Types, CI GitHub Actions)**

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

### [x] M9: Privacidad
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
- **Notas de implementación:**
  - `shared/privacidad/`: `SolicitudesCopiaHcApi`, `RevisionesEmergenciaApi` (con `pendientes()`) y `VencimientoRevision` (chip "Vence en 2 d 14 h" / "Vencida hace 8 h", rojo con < 24 h, icono distinto por nivel). Compartidos porque los widgets de `/inicio` leen lo mismo. `shared/identificador-copiable.ts`: sub/UUID en monoespacio con botón de copiar.
  - `features/solicitudes-copia-hc/`: pestañas `?estado=en-tramite|cerradas` (Recibidas por defecto) con contadores, de **una sola** `GET` sin `estado` partida en el cliente (`agruparBandeja`); abiertas en el orden del API (la más antigua primero), cerradas por cierre más reciente. Radicado como `RadicadoChip` sin enlace (sin `casos:read`), `pacienteSub` copiable, aviso del plazo legal de 10 días hábiles. "Pasar a trámite" y "Cerrar" (hoja: resultado en tarjetas + nota 10–1000 con contador). `SolicitudCopiaHc.TransicionInvalida` → aviso y recarga.
  - `features/auditoria/`: rutas `accesos` (`auditoria:read`) y `revisiones-emergencia` (`auditoria:revisar`), cada una con su guard. Filtros en la URL (`filtros.ts`): `desde`/`hasta` como días de Bogotá (por defecto los últimos 7, hoy incluido) → `desde` 00:00 −05:00 y `hasta` = medianoche siguiente (el `hasta` del API es exclusivo), ≤ 31 días, `casoId` UUID, `actorId` ≤ 64, `accion`/`resultado` desde una sola constante; se aplican con "Aplicar filtros" y en móvil se pliegan tras "Filtros (n)". Un rango inválido en la URL se explica y no se consulta. 50 por página con paginación del servidor; tabla en escritorio, tarjetas en móvil; cajón de detalle con todos los campos copiables. Sin botón de exportar (G8).
  - Revisiones: Pendientes ordenadas por `venceRevisionEn` con el motivo completo y destacado; Cerradas paginadas (50) con conclusión, revisor y observaciones. "Cerrar revisión": conclusión en tarjetas (verde/rojo) + observaciones ≤ 2000. `Auditoria.RevisionYaCerrada` → aviso y recarga.
  - `/inicio`: widgets "Revisiones de emergencia pendientes" (conteo + las 3 que vencen primero) y "Solicitudes de copia HC abiertas" (Recibidas / En trámite, dos `GET` en paralelo), primeros en el orden de widgets.
  - **Casing real del API:** el backend guarda y devuelve `accion`, `resultado` y `recursoTipo` como códigos (`AuditoriaCodigos.Codigo`: `LEER`, `NO_ENCONTRADO`, `REGISTRO_CLINICO`), no los nombres del enum que lista el plan §4.3. `ACCION_AUDITORIA_LABELS` / `RESULTADO_AUDITORIA_LABELS` pasaron a esos códigos y hay `RECURSO_AUDITORIA_LABELS`. Verificado en el código del backend (no había API en marcha); el filtro acepta ambas formas.
  - Mock alineado con el backend: accesos con `desde`/`hasta` obligatorios y ≤ 31 días (`Auditoria.*Requerido`, `RangoInvalido`, `RangoExcedido`), filtros por código o por nombre, por tenant, 50 por defecto y máximo 200; revisiones de la más reciente a la más antigua, `ConclusionInvalida` / `ObservacionesDemasiadoLargas`; solicitudes de la más antigua a la más reciente, cierre desde RECIBIDA **o** EN_TRAMITE (`SolicitudCopiaHc.Cerrar`), `NotaRequerida` / `NotaDemasiadoLarga`, `tramitar` registra `atendidaEn`/`atendidaPor`; actor no ARL → 403 `Auditoria.ActorNoAutorizado`. Fixtures: 120 accesos cada 2 h (dos páginas en la ventana de 7 días), 4 accesos de emergencia con su revisión (62 h, 12 h y −8 h de plazo, más una cerrada) y una fila de ARL_B.
  - Evidencia: unit `shared/privacidad/privacidad.spec.ts` (niveles del plazo, `pendientes()` lee 3 páginas de 200 y ordena, mock vs. backend), `solicitudes-copia-hc.spec.ts` (9), `auditoria.spec.ts` (17: filtros, URL, rango inválido, cajón, cerrar revisión, 409) y `inicio/widgets/privacidad.widgets.spec.ts`. E2E `e2e/privacidad.spec.ts` con `privacidad.arla` en Keycloak real: filtros ↔ URL con "Atrás", página 2, filtro por caso, cajón, sin exportar; cerrar la revisión vencida como Injustificado y verla en Cerradas; pasar a trámite y cerrar una solicitud como Entregada; widgets de `/inicio`. Capturas 375/1440 claro y oscuro con axe en `docs/reportes/m9/`. La línea base de `/inicio` de privacidad de M3 se regeneró (ahora con widgets).
  - Axe destapó dos defectos, corregidos: botones de fila con `aria-label` que no contenía el texto visible (WCAG 2.5.3; ahora prefijo `sr-only`) y un `<dl>` con envoltorios intermedios en el cajón. El test unitario del widget destapó "3por revisar" (Angular elimina el espacio entre dos `span`).

---

### [x] M10: Portal del Paciente
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
- **Notas de implementación:**
  - `core/`: `SesionPaciente` (`GET /paciente/bff/usuario` en el initializer: `401` → `anonima`, `vinculado` → `sin-vinculo`/`vinculada`, cualquier otro fallo → `error` con reintento en el shell; nunca se confunde un BFF caído con un visitante anónimo). `NAVEGADOR_BFF` encapsula las dos navegaciones de página completa (login con `returnUrl` relativo validado como `BffEndpoints.EsUrlLocal`, y la recarga de `/` tras el logout). `csrfInterceptor` (`X-Halsa-Csrf: 1` en todo `/paciente/`) y `sesionExpiradaInterceptor` (un `401` de `/paciente/api/*` → aviso "Tu sesión terminó" y, 2 s después, login de vuelta a la misma ruta; una sola vez aunque fallen varias peticiones). Guards `soloAnonimo` (`/`), `requiereSesion` (`/activar`, `/cuenta`) y `requiereVinculo` (el resto → `/activar` si no hay vínculo). Sin tokens, sin librería OIDC, nada en storage.
  - Shell: barra inferior de 5 pestañas (< 1024 px) y navegación superior (≥ 1024 px) con las mismas secciones; antes del vínculo no hay secciones, solo "Cerrar sesión". Bienvenida y `/privacidad` (texto de la política pendiente, `TODO(privacidad)`) son públicas y quedan fuera del shell.
  - `/activar`: formato en vivo `XXXXXX-XXXXXXXXXX` (mayúsculas, espacios y símbolos fuera, guion solo desde el 7.º carácter para que el retroceso funcione, cursor conservado) que **conserva** `O`/`I`/`L` tal como se escriben: el servidor los lee como `0`/`1`/`1` (`FormatoCodigoActivacion.TryLeer`, que exige el guion). Errores: `CodigoInvalido`, `VinculoDistinto`, `CodigoBloqueado` (423) y los dos `429` (G23): con `Retry-After`, cuenta regresiva con el botón deshabilitado (anunciada una sola vez a lectores de pantalla); sin él, el texto del servidor. Éxito: "Cuenta vinculada al documento CC ******2222"; el documento queda solo en memoria (Cuenta lo muestra en esta sesión) y el código se borra.
  - Inicio (`/resumen`): incapacidad vigente primero (rango, "Termina el …", "Faltan N días", barra con `aria-valuetext` "Día 21 de 30"), próximos hitos ordenados con explicación en lenguaje claro y enlace al caso, y casos activos. Casos: tarjetas con radicado, código ARL (G9), tipo de evento, estado en lenguaje del paciente (`EstadoBadge` variante `casoPaciente`, que hace wrap) y última actualización. Caso: línea de tiempo de la más reciente a la más antigua con la `descripcion` del servidor; `404` → "Este caso no está disponible · No existe o no está vinculado a tu cuenta"; CTA fija sobre la barra inferior en móvil.
  - Solicitar copia: medio en tarjetas (el correo electrónico sugiere el de la cuenta), destino requerido solo para su medio (dirección o correo, ≤ 500), observaciones ≤ 1000 con contador, aviso "no se muestra en línea", 10 días hábiles y Res. 1995/1999 art. 14. Los errores del validador (`General.Validation` + `errors[]`, verificado en `CrearSolicitudCopiaHcCommandValidator`) van a su campo; `SolicitudCopiaHc.YaAbierta` → aviso con enlace a `/solicitudes`. Éxito → toast y `/solicitudes`.
  - Incapacidades agrupadas por caso (el de la más reciente primero) con Vigente / Próxima / Terminada por día de Bogotá y los acumulados del último certificado. Solicitudes: stepper Recibida → En trámite → Entregada/Rechazada (`aria-current="step"`), radicado cruzado con `mis-casos` (G24) y la nota de la ARL al cerrarse.
  - Mock del BFF alineado con el backend: CSRF obligatorio (`403` vacío sin la cabecera, como `GuardasBff`), normalización de códigos como el servidor, `423`, validación como `General.Validation`, fixtures relativas a hoy (Bogotá). En modo mock el login guarda la sesión simulada en `sessionStorage` (`halsa.mock.sesion`; la cuenta, con `halsa.mock.cuenta`) y va directo al `returnUrl`; la sesión sobrevive recargas como la cookie. Todo vive en `dev.interceptors.ts`, que producción reemplaza.
  - **Toaster compartido (afecta a ambas apps, desde M2):** axe nunca se había pasado con un toast visible, y tenía dos violaciones graves: `richColors` de sonner usa su propia paleta (`#008a2e` sobre `#ecfdf3`, 4,25:1) y `brn-sonner-toast` queda como hijo directo del `<ol>` (`list`). Corregido: las variables `--success/info/warning/error-*` toman los pares tintados de los badges (`tokens.css`) y `HlmToaster` da `role="listitem"` al envoltorio. Queda un `aria-allowed-role` menor de sonner (`li role="status"`). Líneas base de los toasts de M2 regeneradas.
  - Evidencia: unit (57 en el portal): `core/core.spec.ts` (sesión por estado, BFF caído, CSRF en cada petición, 401 → aviso + relogin, logout, `returnUrl`), `activar.spec.ts` (formateador, cursor, mapeo de errores, página con 400/409/423 y 429 con cuenta regresiva que se libera), `casos.spec.ts`, `inicio.spec.ts`, `incapacidades.spec.ts`, `solicitudes.spec.ts`, `formato.spec.ts` y `mocks.spec.ts`; montan el portal completo (`testing/portal.ts`: rutas, guards e interceptores reales contra el mock). E2E `e2e/portal.spec.ts` (portal-mobile y portal-desktop, 44 tests): login → activar (inválido, luego válido) → inicio → caso → solicitar copia → solicitudes → segunda solicitud "ya abierta" → logout (sesión fuera), sin peticiones a otro origen; 429; caso no vinculado; navegación por viewport; capturas 375/1440 claro y oscuro con axe y reloj fijo en `docs/reportes/m10/`. Lighthouse: `docs/reportes/m10/lighthouse.json` (+ informes de bienvenida e inicio).
- **Desviaciones:** E2E contra el adaptador mock, no contra el BFF real (G3 sigue abierto: el realm no tiene `https://localhost:4300/paciente/bff/signin-oidc`). Lighthouse Performance < 90 en las páginas autenticadas (OBS-8).

---

### [x] M11: Hardening y Entrega
- **Alcance:**
  - Dockerfiles multi-stage optimizados para ambas aplicaciones (`node:22.23.4-alpine` → `nginxinc/nginx-unprivileged:1.30.6-alpine`).
  - Configuración Nginx con inyección de variables de entorno para `config.json` en tiempo de ejecución.
  - Cabeceras de seguridad estrictas: CSP con Trusted Types (`require-trusted-types-for 'script'`), COOP `same-origin-allow-popups`, Referrer-Policy, etc.
  - Documentación de despliegue en `deploy/README.md`.
  - Pipeline de integración continua en `.github/workflows/frontend.yml` (lint + tests unitarios + build con presupuestos estrictos).
  - Auditoría final de accesibilidad con axe-core sin violaciones serias ni críticas.
- **Criterios de Aceptación:**
  - Verificación de ejecución local de los contenedores Docker generados.
  - Cero violaciones de CSP en consola durante la ejecución completa de pruebas E2E.
  - Presupuestos de bundle respetados (Backoffice ≤ 300 kB gz, Portal ≤ 200 kB gz).
- **Notas de implementación:**
  - `deploy/backoffice/Dockerfile` y `deploy/portal/Dockerfile` (multi-stage, `node:22.23.4-alpine` → `nginxinc/nginx-unprivileged:1.30.6-alpine`, no-root, puerto 8080, `HEALTHCHECK /health`): `npm ci` con npm 11.6.2 (el npm 10 de node 22 rechaza el lockfile), `ng build` de producción y `scripts/check-bundles.mjs <app>` (falla si se pasan los presupuestos gzip o si entra código `__mock`/showcase); el `config.json` se elimina del build y se genera al arrancar.
  - Nginx: `deploy/nginx/default.conf.template` (fallback SPA, `/health`, `config.json` alias a `/tmp/halsa/config.json`, caché `immutable` para hasheados y `no-cache` para `index.html`/`theme-init.js`/rutas) y `deploy/nginx/seguridad.inc.template` (cabeceras en cada `location`, porque nginx descarta `add_header` en un `location` con directivas propias). `16-halsa.envsh` valida el entorno (solo caracteres de URL, porque los valores terminan en JSON y en una cabecera), escribe `config.json` y arma la CSP derivando `connect-src`/`frame-src`/`form-action` de los orígenes de API y Keycloak. Arranque `read_only` con `tmpfs` en `/tmp` y `/etc/nginx/conf.d`.
  - CSP con Trusted Types en ambas apps: `trusted-types angular angular#bundler halsa#iconos`. `halsa#iconos` lo crea `provideIconosTrustedTypes()` (`@halsa/ui/iconos`) para los SVG de lucide que `ng-icon` inserta con `innerHTML`; no hay política `default`, así que cualquier otro `innerHTML` queda bloqueado. COOP `same-origin-allow-popups` (el popup de step-up necesita el opener), salvo `unsafe-none` en `/auth/callback` (G25). HSTS lo pone el proxy que termina TLS, no el contenedor.
  - CI `.github/workflows/frontend.yml`: `validate` (format:check + lint + unit + build con presupuestos) y `images` (build de las dos imágenes + smoke test: arranca el contenedor, comprueba `/health`, `config.json` y que la CSP traiga `require-trusted-types-for 'script'`).
  - **Imports profundos (OBS-6/OBS-8):** se convirtieron los 62 imports del barrel `@halsa/ui` de `projects/` a entry points por componente (`@halsa/ui/estado-badge`, `/fecha-bogota`, `/ahora`, …; 25 alias nuevos en `tsconfig.json`). Resultado: inicial del backoffice **187,5 → 98,7 kB gz** (−47 %; el barrel entraba por `shell.ts`), chunk compartido del portal **17,6 → 7,9 kB gz** (−55 %) e inicial del portal 139,3 → 138,4 kB gz. El barrel se conserva para el showcase y los tests.
  - **Presupuestos:** `scripts/check-bundles.mjs` es la fuente de verdad (gzip: backoffice 300, portal 200, lazy 150; y prohibe `__mock`/`halsa-ui-showcase`). El presupuesto raw de `angular.json` del portal se alineó a 600 kB aviso / 800 kB error (antes avisaba a 400 kB con 527 kB raw, por debajo del gzip objetivo).
  - **`TemaService`:** ahora lee `document.defaultView.localStorage` en lugar del global `localStorage` (Node 22.4+/26 exponen un global experimental que lo sombrea y devuelve `undefined`); el test instala un `Storage` en memoria. La suite pasa en Node 22 (CI) y Node 26 (local).
  - **Verificación de contenedores (Podman local):** `podman build` de ambas imágenes y smoke test: `/health` → `ok`, `config.json` inyectado por variables (`HALSA_KEYCLOAK_AUTHORITY`/`HALSA_API_BASE_URL`/`HALSA_KEYCLOAK_CLIENT_ID`) y CSP correcta (`connect-src`/`frame-src`/`form-action` con los orígenes; el portal solo `'self'`).
  - **CSP y axe en E2E:** `e2e/fixtures.ts` tiene el fixture automático `sinViolacionesCsp` que falla cualquier spec cuyas páginas logueen una violación de CSP o Trusted Types (orígenes de las apps); cada spec ya corre axe con cero violaciones serias o críticas. Los dev servers (`angular.json` → `serve.headers`) envían la misma CSP de producción, así que la suite E2E valida la política real.
- **Desviaciones:** El `@defer` del toaster (sugerido en OBS-8) se descartó: sonner no garantiza renderizar toasts lanzados antes del montaje, y el boot de sesión puede notificar errores temprano. El umbral visual (`maxDiffPixelRatio: 0.01`) se mantiene (OBS-5). El Lighthouse del portal queda pendiente de remedir contra el build de producción detrás de nginx y el BFF real (OBS-8); los imports profundos ya atacan la causa del *render delay*.

---

## 3. Registro de Observaciones Técnicas, Gaps y Mitigaciones

| Código | Tema | Impacto | Estrategia de Mitigación / Decisión |
| :--- | :--- | :--- | :--- |
| **OBS-1** | Tipografía | Legibilidad e identidad clínica. | **Plus Jakarta Sans** seleccionada como fuente principal de UI; **JetBrains Mono** para radicados y códigos. |
| **OBS-2** | Podman en Windows | Keycloak local para M1.5. | `podman-machine-default` se iniciará (`podman machine start`) antes de ejecutar scripts `kc:*`. Verificado: los bind mounts relativos funcionan; `podman compose` delega en `docker-compose.exe`. En esta máquina `host.containers.internal` resuelve al router (192.168.1.1), no al host: no depender de él. |
| **OBS-3** | Generación OpenAPI (M0) | API backend fuera de línea al inicio. | Uso del script alternativo `npm run api:types:yaml` apuntando a `../Halsa.Backend/docs/api/atel-api.openapi.yaml`. |
| **OBS-5** | Umbral de las líneas base visuales | `maxDiffPixelRatio: 0.01` con el umbral por píxel por defecto deja pasar contenido nuevo en páginas claras grandes (tarjetas blancas sobre fondo casi blanco: solo cuentan los glifos). | Detectado en M4: la línea base de escritorio de `/inicio` (M3) no fallaba con los widgets nuevos. Se regeneraron desde cero las afectadas y los specs esperan los datos antes de capturar. M11 mantiene `0.01`: las diferencias de hinting de fuente entre ejecuciones ya rozan ese margen, y un umbral menor añadiría flakiness sin detectar regresiones reales (que están muy por encima). El comentario en `playwright.config.ts` documenta la decisión. |
| **OBS-6** | Presupuesto del portal | El bundle inicial del portal mide 468 kB sin comprimir (presupuesto de aviso de 400 kB en `angular.json`), ya desde antes de M4 (464,5 kB en el commit de M3). Comprimido son 109 kB, dentro del objetivo de 200 kB del plan. Al cierre de M8 mide 476,8 kB (109,4 kB comprimido); M8 no le suma nada (medido sin sus cambios). Al cierre de M9: 478,6 kB (109,5 kB comprimido; las etiquetas nuevas de `@halsa/core`). Al cierre de M10: 527,9 kB (123,3 kB comprimido): sesión, guards, rutas y las definiciones de iconos de lucide que usan las páginas lazy, que esbuild deja en el chunk común que importa `main` (medido; no cambia con `NG_BUILD_OPTIMIZE_CHUNKS`). Resuelto en M11 con imports profundos (ver notas M11): el chunk compartido del portal bajó de 17,6 a 7,9 kB gz y el inicial del backoffice de 187,5 a 98,7 kB gz. El presupuesto gzip (200 kB portal) se cumple (138,4 kB gz); el presupuesto raw de `angular.json` se alineó a 600 kB aviso / 800 kB error para que no falle en falso mientras el gzip manda. |
| **OBS-4** | Compatibilidad Spartan UI | Soporte sobre Angular 21 zoneless. | Si `@spartan-ng/*` presenta conflicto en v21, se aplicará el fallback documentado en `@angular/cdk` + `cva` + `tailwind-merge`. |
| **G1** | Falta de CORS en Backend API | Afecta llamadas directas cross-origin. | En desarrollo se usa el proxy local (`proxy.backoffice.json`). Para despliegue se documentan cabeceras requeridas en `deploy/README.md`. |
| **G3** | Falta de Redirect URI en BFF | Bloquea login local del portal en `:4300`. Sigue abierto al cierre de M10 (`halsa-pacientes-realm.json` solo lista `:5610` y `pacientes.localhost`). | Portal (M10) construido y probado sobre el adaptador mock (`playwright.config.ts` sirve el portal con `--configuration mock` salvo `HALSA_E2E_REAL=1`); validación E2E con el BFF tras actualizar el realm. |
| **G4** | Sin directorio de usuarios | Asignaciones usan UUIDs crudos (`sub`). | Botón "Asignarme", asignación por identificador, copia de `sub` en Cuenta y presentación abreviada con tooltip. Se muestran los primeros 8 **y los últimos 4** caracteres (`01999000…0a01`): con UUID v7 los primeros 8 se repiten entre cuentas creadas juntas. |
| **G6** | Sin búsqueda de texto en `/casos` | No existe búsqueda por radicado o cédula. | No se renderiza buscador de texto falso; se filtran casos únicamente por estado. |
| **G8** | Sin endpoint de exportación | Permiso `auditoria:export` sin backend. | Se oculta el botón de exportación en la pantalla de auditoría. |
| **G10** | Motivo de emergencia en ASCII | Kestrel rechaza caracteres diacríticos en cabeceras HTTP. | Transliteración automática a ASCII antes del envío (`ñ→n`, acentos removidos) y visualización en vivo del texto resultante. |
| **G13** | Discrepancia ProblemDetails | OpenAPI especifica `code`, implementación usa `errorCode`. | Lectura defensiva en interceptores y mappers: `errorCode ?? code`. |
| **G18** | `IncapacidadResponse` sin `prorrogaDe` | La lista no sabe a qué incapacidad prorroga cada prórroga. | El frontend infiere las cadenas (`agruparCadenas`): una prórroga va con la cadena cuyo último certificado termina justo antes de su inicio, lo que el backend garantiza (solo se prorroga la última de la cadena, sin solapes, ≤ 30 días de separación). Pedir al backend que exponga `prorrogaDe`. |
| **G19** | Reglas 422 de incapacidades sin prefijo | Las reglas de la SPEC 07 responden con el código tal cual (`INCAPACIDAD_SOLAPADA`, `PRORROGA_NO_ES_ULTIMA`, …), no `Incapacidades.*`, y el plan §4.2 no las lista. `Incapacidades.DiasFueraDeRango` e `InicialConProrrogaDe` son guardas que el validador ya impide (llegan como `errors` de `datos.*`). | Mapeo explícito de esas reglas a su campo en `erroresDeCarga`. |
| **G20** | Plazo de controversia asíncrono | `POST …/dictamen-pcl/notificar` responde 204, pero `CONTROVERSIA_DICTAMEN` se abre desde el evento del outbox: justo después, `GET` puede traer `NOTIFICADO` con `venceControversiaEn: null` (también es nulo para un actor IPS). | La vista dice "El plazo para controvertir aún no está disponible" en lugar de una fecha vacía. Si el backend quiere la fecha en la respuesta, podría devolver `DictamenPclResponse` en vez de 204. |
| **G21** | Revisiones de emergencia ordenadas por `ocurridoEn` | `GET /auditoria/revisiones-emergencia` ordena de la más reciente a la más antigua: las que vencen primero quedan en la **última** página, y el `pageSize=5` del widget del plan §7.2 mostraría las menos urgentes. | `RevisionesEmergenciaApi.pendientes()` lee la cola completa en páginas de 200 (tope 5 páginas) y ordena por `venceRevisionEn` en el cliente; lo usan la pestaña Pendientes y el widget. Pedir al backend `orden=venceRevisionEn` (o ese orden para `PENDIENTE`). |
| **G22** | Códigos de auditoría distintos al plan | El plan §4.3 lista `Leer`/`NoEncontrado`; las filas traen `LEER`/`NO_ENCONTRADO` (y `recursoTipo` en UPPER_SNAKE). El OpenAPI los tipa como `string`. | Etiquetas por código guardado; el filtro envía el código (el backend acepta ambos). Pedir que el OpenAPI declare los enums. |
| **G23** | Dos `429` distintos en el canje de códigos | El plan (§4.3) describe 5/min por IP con `Retry-After`, pero ni el BFF ni la API tienen ese limitador. El backend responde `429 Paciente.DemasiadosIntentos` (5 canjes fallidos por paciente en 24 h) **sin** `Retry-After`, y `423 Paciente.CodigoBloqueado`, que el plan no lista. | `/activar` maneja los tres: con `Retry-After`, cuenta regresiva; sin él, el `detail` del servidor ("Vuelve a intentarlo en 24 horas"); el 423, "Pide uno nuevo a tu ARL". Confirmar con backend si se va a agregar el limitador por IP. |
| **G24** | Datos del paciente sin contexto | `SolicitudCopiaHcPacienteResponse` no trae `radicado`, `CasoPacienteResponse.estado` está tipado como `string` (no enum) en el OpenAPI, y el documento enmascarado solo llega en la respuesta del canje. | El radicado se cruza con `mis-casos`; los estados desconocidos se muestran crudos; Cuenta muestra el documento solo en la sesión en que se canjeó. Pedir `radicado` en la respuesta y el enum en el contrato. |
| **G25** | Step-up por popup no termina (resuelto) | Los specs de step-up OTP fallaban: el popup aceptaba el OTP pero la sesión seguía en `acr 1`. **Causa:** el COOP `same-origin-allow-popups` (a4e4ea5) también se enviaba en `/auth/callback`; al volver de Keycloak (sin COOP) a una página con COOP distinto, el navegador mueve el popup a otro *browsing context group*: el opener lo ve `closed` (la librería emite "User closed popup" y quita su listener) y `window.opener` queda en `null`. Comprobado con E2E: mismo código, solo cambia la cabecera → con COOP 0/2 step-up, sin COOP 2/2. No era el OTP: con `otpPolicyCodeReusable=false` (single-use) pasan los 27 specs de escritorio. | nginx sirve `/auth/callback` con `unsafe-none` (`map $request_uri` en `deploy/nginx/default.conf.template`) y el resto con `same-origin-allow-popups`; `ng serve backoffice` no envía COOP (el dev server no varía cabeceras por ruta). Se descartó el puente por `BroadcastChannel`. `otpPolicyCodeReusable: true` en el realm mock ya no hace falta. |
| **OBS-8** | Lighthouse Performance del portal | Móvil (4G lento simulado, CPU 4×) sobre el build mock optimizado con gzip: Bienvenida 87–91, páginas autenticadas 79–88; Accesibilidad 100 y Buenas prácticas 100 en las 9. La latencia del mock no es la causa (con 0 ms da lo mismo ±4). El 88 % del LCP es *render delay*: ejecución de JS (chunk inicial de 112 kB gz en el build mock, más un chunk lazy de 40 kB gz con el barrel `@halsa/ui` que importan todas las páginas). M11 hizo los imports profundos (62 archivos; el chunk compartido del portal bajó 17,6→7,9 kB gz y el inicial del backoffice 187,5→98,7 kB gz). El `@defer` del toaster se descartó: sonner no garantiza montar toasts lanzados antes del `idle`, y el boot de sesión puede notificar errores temprano. Falta solo remedir Lighthouse contra el build de producción detrás de nginx y el BFF real. |
| **OBS-7** | Ventana de 15 min en E2E | No se puede simular un `auth_time` viejo en Playwright: adelantar el reloj del navegador rompe la validación del id_token al renovar (`iat`/`exp`) y reescribir el access token falla el `at_hash`. | El E2E prueba la supervivencia del formulario con una re-verificación real por popup ("Renovar verificación"); el cierre y la reapertura de la compuerta por tiempo se prueban en el spec unitario con la compuerta real y el popup simulado. |

---

## 4. Protocolo de Cierre por Hito (§15)

Al concluir cada hito, se actualizará el checklist de este documento y se emitirá el reporte formal con la siguiente estructura:
1. **Done:** Lista de verificación contra los AC del hito con evidencias (salida de comandos, tests, rutas de screenshots).
2. **Deviations:** Ajustes o diferencias respecto al plan y su debida justificación técnica.
3. **Gaps found:** Nuevas discrepancias o requerimientos no cubiertos por el backend.
4. **Questions:** Bloqueos críticos o decisiones que requieran confirmación del usuario.
5. **Next:** Confirmación del hito siguiente a iniciar.
