# Halsa Frontend: Handoff Plan

> **Status:** Approved for implementation
> **Date:** 2026-10-17
> **Audience:** the coding agent (Gemini) that builds the frontend, and the human who reviews its work.
> **Supersedes:** the "wait for the api.spec" instruction in `prompt/01_Base.md`. The contract is now known. It's summarized here, and its sources are listed in §4.
> **Objective:** Build the two Halsa web apps in one Angular 21 workspace: the staff **Backoffice** (ARL and IPS personnel) and the **Patient Portal**. They are mobile first, have no SSR, are styled with Tailwind + Spartan UI (shadcn for Angular), and cover the navigation of every human role the backend supports.

---

## 0. How to use this document

1. Read this whole document once before writing any code, including **Appendix A** (the Keycloak login theme) and **Appendix B** (the local Keycloak in Podman). Then read `GEMINI.md` at the repo root (the standing rules).
2. Work **milestone by milestone** (§12). Don't start a milestone until the previous one meets its acceptance criteria. At the end of each milestone, stop and report in the format of §15.
3. **Never invent an endpoint, field, enum value, permission or header.** Everything the backend offers is in §4–§5. If a screen needs something that isn't there, it's a known gap (§13). Implement the documented workaround, or hide the feature. Don't fake it with mock data in production code.
4. When this document and the live OpenAPI (`/openapi/v1.json`) disagree, **the live OpenAPI wins** for shapes. Report the discrepancy.
5. The backend repository is the sibling folder `../Halsa.Backend`. It's read-only for you, so don't modify it. Useful files in it:
   - `docs/api/atel-api.openapi.yaml`: the hand-written contract (most schemas, enums, error semantics).
   - `docs/arquitectura/01-arquitectura-backend-atel.md`: why the system is shaped this way.
   - `docs/diagrams/workflows/`: Mermaid diagrams of **what each user does**, with screens, flows, state machines and the work the system does on its own. Read them before building a persona's screens.
   - `specs/08-lectura-clinica-y-dictamen-pcl.md`, `specs/12-bff-paciente.md`: the two specs with the most frontend impact.
   - `docker/keycloak/halsa-realm.json`, `docker/keycloak/halsa-pacientes-realm.json`: dev users, clients and roles.
   - `README.md`: how to run the backend locally.

---

## 1. Product context (read this, it drives the UX)

Halsa manages **ATEL claims** (*accidentes de trabajo y enfermedades laborales*) for Colombian ARLs (occupational risk insurers). The data is **sensitive health data** under Colombian law (Ley 1581/2012, Res. 1995/1999). The two risks the whole system is designed against are:

1. **Clinical leakage inside the system:** an administrative ARL analyst sees a diagnosis.
2. **Cross-tenant leakage:** ARL A sees a case of ARL B.

The backend enforces both in five independent layers. The frontend's job:

- **Never show a control or a section the actor can't use.** Navigation is derived from permissions.
- **Make the sensitive zones feel different.** Clinical sections are visibly marked as reserved, require step-up authentication, and say that every access is audited.
- **Never keep clinical data longer than the screen that shows it.** No caches, no service-worker storage, no logging.
- **Be honest with errors.** A `404` may mean "not visible to you". A `403` may mean "not assigned to this case". Explain both in plain Spanish.

**Actors:**

| Actor | Realm | Who | How they authenticate |
| --- | --- | --- | --- |
| ARL staff | `halsa` | Analysts, occupational physicians, PCL raters, privacy officers of one ARL (the **tenant**) | OIDC code + PKCE in the browser (public client `halsa-backoffice`), Bearer token to the API. MFA (OTP) for step-up. |
| IPS staff | `halsa` | Physicians and coordinators of a clinic (IPS) that receives cases from any ARL by **remission** | Same as ARL staff. |
| Patient (worker) | `halsa-pacientes` | The injured or ill worker | The **BFF** `Halsa.Bff.Paciente`. The browser never holds a token, only an HttpOnly session cookie. |
| Integrations | `halsa` | ARL cores, IPS systems (machine to machine) | **No UI. Out of scope.** |

**UI language:** Spanish (Colombia). **Locale:** `es-CO`. **Time zone for display:** `America/Bogota`, always. Don't use the browser's zone, because legal deadlines are Colombian.

---

## 2. Closed decisions (do not reopen)

| Topic | Decision |
| --- | --- |
| Framework | **Angular 21**, latest patch. Standalone components only, no NgModules. **Zoneless** change detection (the v21 default). Signals for state. New control flow (`@if`, `@for`, `@switch`, `@defer`). `ChangeDetectionStrategy.OnPush` everywhere. `inject()` instead of constructor DI. |
| Rendering | **No SSR, no prerender, no hydration.** Create the apps with `--ssr=false`. |
| Workspace | One Angular CLI workspace, **two applications** (`backoffice`, `portal`) plus shared code in `libs/` through TypeScript path aliases. No Nx. |
| Styling | **Tailwind CSS v4** (CSS-first config with `@theme`, through `@tailwindcss/postcss`). |
| Components | **Spartan UI**, the shadcn/ui port for Angular: `@spartan-ng/brain` (accessible headless primitives) plus the **helm** styled components generated into `libs/ui` with `@spartan-ng/cli`, so we own the source like shadcn. Icons: `@ng-icons/core` + `@ng-icons/lucide`. **Fallback:** if, at install time, Spartan doesn't support Angular 21, build the same helm-style components on `@angular/cdk` with `class-variance-authority` + `tailwind-merge`, keeping the identical API and look. Report it. No Angular Material, no PrimeNG. |
| Backoffice auth | **`angular-auth-oidc-client`** (code flow + PKCE, refresh tokens, popup support for step-up). |
| Portal auth | **None in the browser.** Cookie session through the BFF (§5.2). No OIDC library in the portal. |
| Forms | Typed **Reactive Forms**. Don't use experimental Signal Forms for production forms. |
| Data fetching | `HttpClient` services per bounded context. Reads may use `httpResource` / `rxResource` if they are stable in the installed version, otherwise Observables + `toSignal`. Feature state lives in small signal-based stores (`signal`, `computed`, plain services), not NgRx. |
| API types | Generated with **`openapi-typescript`** from the live `/openapi/v1.json`, and committed. Hand-written services on top. |
| Unit tests | **Vitest** (the Angular 21 default builder). Angular Testing Library is welcome. |
| E2E | **Playwright**, against the real local backend + Keycloak, with `@axe-core/playwright` for accessibility. |
| Lint/format | `angular-eslint` + Prettier (+ `prettier-plugin-tailwindcss`). Strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` if the generated types allow it). |
| Fonts | Self-hosted through `@fontsource` packages, never the Google Fonts CDN (CSP + privacy). |
| PWA | **No service worker in either app.** No offline mode: it would put clinical data at rest in the browser. |
| Keycloak login theme | **Our own FreeMarker login theme** (`halsa` for staff, `halsa-pacientes` extending it for patients), styled with the **same Tailwind tokens** as the apps, packaged as a JAR. Not Keycloakify (it would bring React into the repo). Details in Appendix A. |
| Local identity | A **Keycloak 26.4 in Podman** inside this repo (`dev/keycloak/`, port **8180**) with trimmed copies of the backend realms and the theme mounted live. The frontend can then be built and tested without the backend stack. Details in Appendix B. |
| Naming | Domain names in **Spanish** exactly as the API uses them (`caso`, `plazo`, `incapacidad`, `registroClinico`, `dictamenPcl`, `solicitudCopiaHc`, …). Technical suffixes in English (`*.service.ts`, `*.page.ts`, `*.store.ts`). Files in kebab-case. UI copy in Spanish. Code comments in English. |

---

## 3. Workspace architecture

```
Halsa.Frontend/
  GEMINI.md
  angular.json
  package.json
  tsconfig.json                      # path aliases @halsa/*
  .postcssrc.json                    # tailwind v4
  proxy.backoffice.json              # dev proxy: /v1 -> API
  proxy.portal.json                  # dev proxy: /paciente -> BFF
  keycloak-theme/                    # Appendix A — login theme (FreeMarker + Tailwind), built into a JAR
  dev/keycloak/                      # Appendix B — Podman compose + generated mock realms
  scripts/                           # sync-realms.mjs, build-theme-jar.mjs, copy-fonts.mjs
  libs/
    ui/                              # @halsa/ui — design tokens (theme.css), Spartan helm components, layout primitives
      src/theme.css
      src/lib/<component>/...
    core/                            # @halsa/core — framework-level, app-agnostic
      src/config/                    # runtime config loader (config.json)
      src/http/                      # problem-details parsing, error mapping, idempotency keys
      src/format/                    # Bogotá dates, DateOnly helpers, es-CO numbers, percent
      src/i18n/                      # Spanish labels for every enum (§8.4), error-code messages
    api-types/                       # @halsa/api-types — generated schema.d.ts + thin aliases
  projects/
    backoffice/
      public/config.json             # runtime config (overwritten at deploy)
      src/app/
        app.config.ts / app.routes.ts
        core/                        # auth (oidc), sesion (identidad/yo), permisos, guards, interceptors, step-up, emergencia
        shell/                       # layout: bottom nav (mobile), sidebar (desktop), top bar, "más" sheet
        features/
          inicio/
          casos/                     # list, detail shell, resumen, equipo-remisiones, portal-paciente (código)
          plazos/
          clinico/                   # historia clínica (list/detail/new/correct), step-up gates, emergency access
          incapacidades/             # list, upload, soporte download
          dictamen-pcl/
          solicitudes-copia-hc/
          auditoria/                 # accesos, revisiones-emergencia
          cuenta/
        shared/                      # backoffice-only presentational bits
    portal/
      public/
      src/app/
        core/                        # bff session (usuario), csrf interceptor, guards
        shell/
        features/
          bienvenida/  activar/  inicio/  casos/  incapacidades/  solicitudes/  cuenta/
```

**Rules inside every feature folder** (lightweight DDD layering):

- `data-access/`: `*-api.service.ts` (HTTP only, typed with `@halsa/api-types`), `*.store.ts` (signals, loading/error state).
- `ui/`: presentational components (inputs/outputs only, no injection of services).
- `pages/` (or `*.page.ts`): routed containers that wire stores to UI.
- `*.routes.ts`: lazy route definitions with guards.
- A feature may import from `@halsa/ui`, `@halsa/core`, `@halsa/api-types` and its app's `core/`. **Features never import from other features.** Shared things move to `shared/` or a lib.
- **Clinical isolation in the frontend.** Only `features/clinico`, `features/dictamen-pcl` and the soporte download in `features/incapacidades` may call clinical endpoints (§4.3). Add an ESLint `no-restricted-imports` / boundaries rule so that nothing else imports their data-access.

**Routing:** every feature is lazy loaded (`loadChildren` / `loadComponent`). Use `withComponentInputBinding()` so route params arrive as `input()`s. Use `withViewTransitions()` for subtle page transitions (respect `prefers-reduced-motion`).

---

## 4. Backend contract

### 4.1 Base URLs and conventions

| | Backoffice | Portal |
| --- | --- | --- |
| API base | `{apiBaseUrl}/v1/...` (runtime config; `''` in dev through the proxy) | **Only** `/paciente/api/...`, same origin, which the BFF maps to `/v1/paciente/...` |
| Auth | `Authorization: Bearer <access token>`, attached **only** to requests whose URL starts with `apiBaseUrl + '/v1/'` | Session cookie (sent automatically, same origin) + **`X-Halsa-Csrf: 1` on every `/paciente/api/*` request and on `POST /paciente/bff/logout`** |
| Local dev | API `http://localhost:5600`, Keycloak `http://localhost:8080` | BFF `https://localhost:5610` |

- JSON is **camelCase**.
- `date` values (`fechaInicio`, `fechaFin`, `fechaEstructuracion`, `fechaDictamen`, `retenerHasta`, `venceControversiaEn`, hito `fecha` in `ProximoHitoResponse`) are **`YYYY-MM-DD` strings**. **Never** pass them to `new Date(str)`: it parses as UTC midnight and shows the previous day in Bogotá. Use the helpers in `@halsa/core/format` that treat them as calendar dates.
- `date-time` values carry an offset. Display them in `America/Bogota`.
- Paginated lists return `PagedList<T>`: `{ items, page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage }`. Query params are `page` and `pageSize`.
- Case state values (`estado` of a case, also the `estado` query param of `GET /casos`) are **PascalCase**: `Radicado`, `Validado`, `EnAtencion`, `EnCalificacionOrigen`, `EnCalificacionPcl`, `Cerrado`, `Rechazado`. `tipoEvento` values are `AccidenteTrabajo` and `EnfermedadLaboral`. Most other enums are `UPPER_SNAKE` (see the schemas).

### 4.2 Errors (RFC 9457 problem+json)

The implementation returns:

```json
{ "type": "...", "title": "Not found", "status": 404, "detail": "Texto en español legible", "errorCode": "Caso.NoEncontrado", "traceId": "..." }
```

- The stable machine code is in **`errorCode`**. The YAML contract says `code`, which is a known discrepancy (§13 G13). Read `errorCode ?? code`.
- Validation errors (`400`) come in two shapes. Support both:
  - `errors: [{ code, description }]` for staff endpoints;
  - `errors: { "json.path": ["msg", ...] }` for the integration-style validators (incapacidad upload).
- `detail` is already Spanish and user-presentable. Map only the codes that need **special UX** (§7, "Errors" rows). Everything else shows `detail` in a toast or inline alert, with the `traceId` copyable under a "Detalles técnicos" disclosure.
- `401` **with** header `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="2"[, max_age="900"]` means step-up (§5.1.4). `401` without it means the session expired: re-login.
- `403` → forbidden. `Clinico.NoAsignado` is special (offer emergency access if permitted, §5.1.5).
- `404` → "no existe o no está disponible para tu usuario". Never claim it doesn't exist.
- `409` → conflict, show `detail`. `413` → file too large. `415` → not a PDF. `422` → unprocessable, show `detail`. `429` → rate limited, honour `Retry-After`. `503` → antivirus or dependency unavailable: "intenta de nuevo en unos minutos".

Known error codes (from the domain) that the UI may branch on:
`Caso.NoEncontrado, Caso.IpsIdInvalido, Caso.RemisionDuplicada, Caso.RemisionNoEncontrada, Caso.RemisionYaRevocada, Caso.AsignacionNoEncontrada, Caso.ConflictoConcurrencia, Caso.TransicionInvalida, Clinico.AccesoNoPermitido, Clinico.CasoNoEncontrado, Clinico.NoAsignado, Clinico.MotivoEmergenciaInvalido, Clinico.CasoNoAdmiteRegistros, Clinico.AtendidoEnFuturo, Clinico.FechaAtencionAnteriorAlEvento, Clinico.ProfesionalNoIdentificado, Clinico.ProfesionalSinRegistro, Clinico.RethusRequerido, Clinico.RegistroNoEncontrado, Clinico.SoporteNoEncontrado, Dictamen.YaExiste, Dictamen.YaNotificado, Dictamen.CorrigeANoVigente, Dictamen.FechasInvalidas, Dictamen.NotificacionFueraDeRango, Dictamen.PorcentajeFueraDeRango, Dictamen.NoEncontrado, Incapacidades.CertificadoDuplicado, Incapacidades.DiasFueraDeRango, Incapacidades.InicialConProrrogaDe, Incapacidades.PartesInvalidas, Integracion.IdempotencyKeyInvalida, Integracion.IdempotenciaConflicto, Paciente.CodigoInvalido, Paciente.CasoNoValidado, Paciente.VinculoDistinto, Plazo.NoCumplible, Plazo.CumplidoEnFuturo, Plazo.NoEncontrado, SolicitudCopiaHc.YaAbierta, SolicitudCopiaHc.TransicionInvalida, SolicitudCopiaHc.ResultadoInvalido, Auditoria.RevisionYaCerrada, Auditoria.RevisionNoEncontrada`.

### 4.3 Endpoint catalogue (everything a human UI can use)

All staff paths are relative to `/v1`. **Perm** is the permission the endpoint requires (from `GET /v1/identidad/yo` → `permisos`). 🔒 marks a clinical endpoint: it needs the permission, plus `acr ≥ 2` (step-up), plus being assigned to the case (ABAC), and every call is audited.

**Identity**

| Method | Path | Perm | Returns / body | Used by |
| --- | --- | --- | --- | --- |
| GET | `/identidad/yo` | authenticated | `{ sub, actorTipo: 'arl'\|'ips'\|..., tenantId, ipsId, permisos: string[] }` | Session bootstrap, navigation |

**Casos**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET | `/casos?page&pageSize&estado` | `casos:read` | `PagedList<CasoResumenResponse>`: `{ id, radicado, tipoEvento, estado, fechaEvento, trabajadorDocumento, tieneCalificacion, porcentajePcl }`. An IPS actor sees only the cases remitted to its IPS. |
| GET | `/casos/{casoId}` | `casos:read` | `CasoDetalleResponse`: `{ resumen: CasoResumen, empleadorDocumento, municipioDivipola, esGraveOMortal, remisionesVigentes: [{ id, ipsId, remitidoEn }], equipoAsignado: string[] /* subs */ }` |
| POST | `/casos/{casoId}/asignaciones` | `casos:asignar` | `{ sub }` → 204 (idempotent) |
| DELETE | `/casos/{casoId}/asignaciones/{sub}` | `casos:asignar` | 204 |
| POST | `/casos/{casoId}/remisiones` | `casos:write` | `{ ipsId }` (REPS, **12 digits**) → 201 `{ remisionId }`. Errors: `Caso.IpsIdInvalido`, `Caso.RemisionDuplicada`. |
| POST | `/casos/{casoId}/remisiones/{remisionId}/revocar` | `casos:write` | 204 |
| POST | `/casos/{casoId}/codigos-activacion` | `pacientes:activar` | → 201 `{ codigo: 'ABC123-K7Q2M9XD4P', expiraEn }`. **Shown only once.** `Paciente.CasoNoValidado` if the case isn't `Validado`. |

**Plazos (legal deadlines)**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET | `/plazos?estado&venceAntesDe&regla&page&pageSize` | `plazos:read` | `PagedList<PlazoResponse>`: `{ id, casoId, radicado, regla, baseLegal, referenciaId, iniciaEn, venceEn, alertaEn, estado: ABIERTO\|CUMPLIDO\|VENCIDO\|SUSPENDIDO, extemporaneo, cumplidoEn }` |
| GET | `/casos/{casoId}/plazos` | `plazos:read` | `PlazoResponse[]` |
| POST | `/casos/{casoId}/plazos/{plazoId}/cumplir` | `plazos:write` | `{ nota (10–1000), cumplidoEn? (≤ now) }` → 204. `Plazo.NoCumplible`. |

Known `regla` codes (labels in §8.4): `REPORTE_FURAT`, `REPORTE_FUREP`, `INVESTIGACION_AT`, `REMISION_INVESTIGACION_GRAVE`, `CONTROVERSIA_DICTAMEN`, `TOPE_IT_180`, `SOLICITUD_COPIA_HC`. Unknown codes must render as the raw code, never crash.

**Incapacidades (sick leave certificates)**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET | `/casos/{casoId}/incapacidades` | `incapacidades:read` | `IncapacidadResponse[]`: `{ id, casoId, tipo: INICIAL\|PRORROGA, fechaInicio, fechaFin, dias, diasAcumulados, estado: REGISTRADA, soporteId, alertas: [{ code: ACUMULADO_150_DIAS\|ACUMULADO_180_DIAS\|ACUMULADO_540_DIAS\|CARGA_EXTEMPORANEA, mensaje }] }` |
| POST | `/casos/{casoId}/incapacidades` | `incapacidades:write` + **`acr=2`** (no max age) | **multipart/form-data**: part `datos` (JSON `IncapacidadRequest`, ≤64 KB, send it as a `Blob` of type `application/json`) + part `soporte` (PDF, ≤10 MB, must start with `%PDF-`). **Header `Idempotency-Key: <uuid v4>` is required.** → 201 `IncapacidadResponse` (with `alertas`). |
| GET 🔒 | `/casos/{casoId}/incapacidades/{incapacidadId}/soporte` | `clinico:read` (clinical policy) | `application/pdf` bytes, `Content-Disposition: attachment; filename="incapacidad-<n>.pdf"`, `Cache-Control: no-store` |

`IncapacidadRequest` (backoffice): `{ numeroCertificado (≤40), tipo: INICIAL|PRORROGA, prorrogaDe? (uuid, required iff PRORROGA, an incapacidad of the same case), fechaInicio (date), dias (1–30; server computes fechaFin), diagnosticoPrincipal: { sistema: 'CIE-10', codigo, descripcion? }, diagnosticosRelacionados? (≤3), ipsEmisora: { codigoReps (10–12 digits), nombre? }, modalidad: PRESENCIAL|TELEMEDICINA, observaciones? (≤1000) }`. **Don't send `profesional`.** The backoffice ignores it, because the professional comes from the token claims.

**Clínico 🔒 (historia clínica)**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET 🔒 | `/casos/{casoId}/registros-clinicos` | `clinico:read` | `RegistroClinicoResponse[]` (never includes PCL rulings) |
| GET 🔒 | `/casos/{casoId}/registros-clinicos/{registroId}` | `clinico:read` | `RegistroClinicoResponse`: `{ id, casoId, tipo: REPORTE_INICIAL\|CONCEPTO_MEDICO\|EVOLUCION\|CONCEPTO_REHABILITACION\|CERTIFICADO_INCAPACIDAD, profesional: { sub, tipoDocumento, numeroDocumento, registroRethus }, atendidoEn, registradoEn, retenerHasta, corrigeA, corregidoPor, contenido: { motivo, anamnesis, examenFisico, analisis, plan, diagnosticos: [{ sistema, codigo }], observaciones } }` |
| POST 🔒 | `/casos/{casoId}/registros-clinicos` | `clinico:write` (+ assignment) | `{ tipo: CONCEPTO_MEDICO\|EVOLUCION\|CONCEPTO_REHABILITACION, atendidoEn (date-time, not future, not >1 day before the event), corrigeA?, contenido }` → 201 `{ registroId, casoId, registradoEn }`. At least one of motivo/anamnesis/examenFisico/analisis/plan must have text (each ≤8000). Diagnoses: CIE-10, pattern `^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$`, the first one is the principal. |

Clinical **reads** accept the **break-the-glass** header `Halsa-Motivo-Acceso: <20–500 chars>` when the user holds `clinico:emergencia` (§5.1.5). Writes never accept it.

**Dictamen PCL 🔒 (loss-of-work-capacity ruling: the most sensitive data in the system)**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET 🔒 | `/casos/{casoId}/dictamen-pcl` | `pcl:dictamen:read` + `acr=2` + **`auth_time` ≤ 15 min** | `DictamenPclResponse`: `{ id, casoId, porcentajePcl, origen: LABORAL\|COMUN\|MIXTO, fechaEstructuracion, fechaDictamen, manual, componentes?: { deficiencias, rolLaboralYOtrasAreas }, fundamentos, diagnosticos, calificador: { identificacion: { tipo, numero }, nombreCompleto, registroRethus }, estadoNotificacion: PENDIENTE\|NOTIFICADO\|EN_CONTROVERSIA\|EN_FIRME, venceControversiaEn, corrigeA }`. `404 Dictamen.NoEncontrado` means none has been registered yet. |
| POST 🔒 | `/casos/{casoId}/dictamen-pcl` | `pcl:dictamen:write` + same step-up | `{ porcentajePcl (0–100, 2 decimals), origen, fechaEstructuracion (≤ fechaDictamen), fechaDictamen (not future, Colombia), componentes? (deficiencias + rolLaboralYOtrasAreas = porcentajePcl ±0.01), fundamentos (50–20000), diagnosticos (≥1, CIE-10), corrigeA? (id of the current one, only while PENDIENTE) }` → 201 `DictamenPclResponse` |
| POST 🔒 | `/casos/{casoId}/dictamen-pcl/notificar` | `pcl:dictamen:write` + same step-up | `{ notificadoEn (date-time), medio: CORREO_CERTIFICADO\|ELECTRONICO\|PERSONAL }` → 204 |

**Solicitudes de copia de HC (staff inbox)**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET | `/solicitudes-copia-hc?estado` | `solicitudes-hc:gestionar` | `SolicitudCopiaHcResponse[]`: `{ id, casoId, radicado, pacienteSub, medioEntrega, direccionOCorreo, observaciones, estado: RECIBIDA\|EN_TRAMITE\|ENTREGADA\|RECHAZADA, solicitadaEn, atendidaEn, atendidaPor, notaAtencion }` |
| POST | `/solicitudes-copia-hc/{id}/tramitar` | same | 204 (RECIBIDA → EN_TRAMITE) |
| POST | `/solicitudes-copia-hc/{id}/cerrar` | same | `{ resultado: ENTREGADA\|RECHAZADA, nota (10–1000) }` → 204 |

**Auditoría**

| Method | Path | Perm | Body → Response |
| --- | --- | --- | --- |
| GET | `/auditoria/accesos?desde&hasta&casoId&actorId&accion&resultado&page&pageSize` | `auditoria:read` | `PagedList<AccesoAuditadoResponse>`: `{ id, ocurridoEn, tenantId, actorId, actorTipo, actorTenantId, actorIpsId, actorRoles[], clientId, ip, userAgent, correlationId, accion, resultado, recursoTipo, recursoId, casoMedicoId, motivo, acr }`. `accion` ∈ Leer/Crear/Actualizar/Eliminar/Corregir/Exportar and `resultado` ∈ Exito/Denegado/NoEncontrado/Error. **Verify the exact wire casing against a live response** and keep the filter options in one constant. |
| GET | `/auditoria/revisiones-emergencia?estado&page&pageSize` | `auditoria:revisar` | `PagedList<RevisionEmergenciaResponse>`: `{ id, casoMedicoId, accesoId, actorId, motivo, ocurridoEn, venceRevisionEn (72 h), estado: PENDIENTE\|CERRADA, revisadoEn, revisadoPor, conclusion: JUSTIFICADO\|INJUSTIFICADO\|null, observaciones }` |
| POST | `/auditoria/revisiones-emergencia/{id}/cerrar` | `auditoria:revisar` | `{ conclusion: JUSTIFICADO\|INJUSTIFICADO, observaciones? (≤2000) }` → 204. `Auditoria.RevisionYaCerrada` → 409. |

**Patient portal: through the BFF only**

| Method | Browser path | Returns |
| --- | --- | --- |
| GET | `/paciente/bff/login?returnUrl=/ruta` | Full-page navigation (not XHR). Redirects to Keycloak, then back to `returnUrl` (must be a relative path). |
| POST | `/paciente/bff/logout` (+ `X-Halsa-Csrf: 1`) | 204. Ends the Keycloak session too. Idempotent. |
| GET | `/paciente/bff/usuario` | `{ nombre, correo, vinculado }`, or **401** when there is no session |
| POST | `/paciente/api/vinculos` | `{ codigo }` → 201 `{ trabajador: { tipo, numeroEnmascarado } }`. Errors: `Paciente.CodigoInvalido`, `Paciente.VinculoDistinto` (the account is already linked to another document). **Rate limited: 5/min per IP → 429.** |
| GET | `/paciente/api/resumen` | `{ casosActivos: CasoPaciente[], incapacidadesVigentes: [{ casoId, fechaInicio, fechaFin, dias }], proximosHitos: [{ casoId, tipo: FIN_INCAPACIDAD\|VENCE_CONTROVERSIA, fecha }] }` |
| GET | `/paciente/api/mis-casos` | `CasoPacienteResponse[]`: `{ casoId, radicado, tipoEvento, estado, fechaEvento, arl, ultimoHitoEn }` (may span several ARLs) |
| GET | `/paciente/api/casos/{casoId}/linea-tiempo` | `HitoResponse[]`: `{ tipo: RADICADO\|VALIDADO\|RECHAZADO\|REMITIDO_A_IPS\|INCAPACIDAD_REGISTRADA\|DICTAMEN_NOTIFICADO\|DICTAMEN_EN_FIRME, fecha, descripcion }`. `404` if not linked. |
| GET | `/paciente/api/incapacidades` | `IncapacidadPacienteResponse[]`: `{ id, casoId, tipo, fechaInicio, fechaFin, dias, diasAcumulados, estado }` |
| POST | `/paciente/api/casos/{casoId}/solicitudes-copia-hc` | `{ medioEntrega: CORREO_CERTIFICADO\|PRESENCIAL\|ELECTRONICO, direccionOCorreo? (≤500; required unless PRESENCIAL; must be an email when ELECTRONICO), observaciones? (≤1000) }` → 201. `SolicitudCopiaHc.YaAbierta` → 409. |
| GET | `/paciente/api/solicitudes-copia-hc` | `SolicitudCopiaHcPacienteResponse[]` |

**Not for the UI:** `/v1/integraciones/*` (FURAT/FUREP/conceptos, machine-only, mTLS) and `/v1/integraciones/suscripciones-webhook*` (only integration service accounts hold `webhooks:manage`).

### 4.4 Generating the types

- Script `npm run api:types` runs `openapi-typescript http://localhost:5600/openapi/v1.json -o libs/api-types/src/schema.d.ts` (the endpoint exists in the Development environment). Commit the output.
- Also add `npm run api:types:yaml` against `../Halsa.Backend/docs/api/atel-api.openapi.yaml`, as a fallback when the API isn't running.
- `libs/api-types/src/index.ts` re-exports friendly aliases (`export type CasoResumen = components['schemas']['CasoResumenResponse']`, …). Hand-write a type in `index.ts` only when the generated one is missing or wrong (e.g. the multipart body), with a `// TODO(api-types):` comment that names the gap.

---

## 5. Identity and security

### 5.1 Backoffice

#### 5.1.1 OIDC configuration (`angular-auth-oidc-client`)

| Setting | Value |
| --- | --- |
| `authority` | runtime config `keycloak.authority` (dev: `http://localhost:8080/realms/halsa`) |
| `clientId` | `halsa-backoffice` (public client) |
| `responseType` | `code` (PKCE S256) |
| `scope` | `openid`. The realm's default client scopes (`profile`, `roles`, `web-origins`, `acr`, `halsa-claims`) are added automatically. **Don't request `email`.** The realm doesn't define that client scope, and Keycloak would answer `invalid_scope`. So `correo` is usually `null`. |
| `redirectUrl` | `window.location.origin` + `/auth/callback` |
| `postLogoutRedirectUri` | `window.location.origin` + `/` |
| `useRefreshToken` / `silentRenew` | `true` / `true` (Keycloak access tokens last **5 minutes**) |
| `renewTimeBeforeTokenExpiresInSeconds` | `30` |
| `secureRoutes` | `[config.apiBaseUrl + '/v1/']` (in dev, `apiBaseUrl` is `''` and the interceptor must still match `/v1/`) |
| Storage | the library default (sessionStorage). **Never localStorage.** |
| `triggerAuthorizationResultEvent` | `true`, to route back to the stored return URL |

App start (`provideAppInitializer`): load `config.json`, then `checkAuth()`. If authenticated, call `GET /v1/identidad/yo` and build the **session** signal store:

```ts
interface SesionPersonal {
  sub: string;
  nombre: string | null;          // id_token `name` / `preferred_username`
  correo: string | null;
  actorTipo: 'arl' | 'ips';
  tenantId: string | null;        // ARL code, e.g. ARL_A
  ipsId: string | null;           // REPS
  permisos: ReadonlySet<string>;
  acr: number;                    // from the access token payload
  authTime: number | null;        // epoch seconds, from the token
}
```

If `actorTipo` isn't `arl` or `ips`, show a full-screen "Este usuario no tiene acceso al backoffice" with a logout button.

#### 5.1.2 Permission primitives

- `PermisosService.puede(perm: string): boolean` and `puedeAlguno(...perms)`, built on `computed` signals.
- Route guard factory `requierePermiso(...perms)` → redirects to `/acceso-denegado` (not to login).
- Structural directive `*halsaSiPuede="'clinico:read'"` (plus an `else` template), for templates where `@if (permisos.puede(...))` reads worse.
- **Navigation items, tabs, buttons and dashboard widgets are all declared as data with a `permiso` field**, filtered in one place. No scattered checks.
- The backend is the authority. A visible control can still fail with 403 or 404, so every action handles that gracefully.

#### 5.1.3 HTTP interceptors (order matters)

1. `authInterceptor`: adds the Bearer token to `/v1/` requests only.
2. `correlationInterceptor`: adds `X-Correlation-Id: <uuid>` per request, if the API accepts it (check the CORS allow-list, §13 G1). Show it in error details.
3. `problemInterceptor`: parses problem+json into a typed `ProblemaApi { status, errorCode, detail, title, traceId, errors, stepUp?: { acr: number; maxAge?: number } }`, reading `WWW-Authenticate` for step-up. It rethrows typed errors. It **never** retries non-idempotent requests.
4. `sessionExpiredHandler`: a `401` without step-up → `authorize()` with the current URL as the return target.

#### 5.1.4 Step-up (RFC 9470), the core UX of clinical access

The levels: `acr=1` means password, `acr=2` means password + OTP. Requirements:

- Clinical reads and writes, and loading an incapacidad: `acr ≥ 2`.
- Dictamen PCL (read and write): `acr ≥ 2` **and** `auth_time` within the last **15 minutes**.

Implement **both**:

- **Proactive gate.** A component `<halsa-verificacion-reforzada [acr]="2" [maxAgeSeg]="900">` wraps every clinical section and every clinical form. If the current token doesn't satisfy it, it renders a calm, branded panel instead of the content: lock icon, "Información clínica reservada", one sentence on why ("Confirma tu identidad con tu código de verificación. Cada acceso queda registrado."), and the primary button **"Verificar identidad"**. For the dictamen, also check `auth_time` and re-gate when less than 2 minutes of the window remain.
- **Reactive handling.** A step-up `401` from any request opens the same flow in a dialog and, after success, retries the original request **once**.
- **Mechanism.** Use `authorizeWithPopUp({ customParams: { acr_values: '2', max_age: <maxAge if required> } })` so that **unsaved forms survive** (a dictamen's `fundamentos` can run to 20 000 characters). If the popup is blocked, fall back to the redirect `authorize(...)` with the same params after a confirm dialog: "Se abrirá la verificación en esta pestaña; los cambios sin guardar se perderán". Store the return URL in sessionStorage. **Never store form contents** in it.
- **Gate first, then form.** Open the gate *before* showing any clinical form, so users don't type into a form that's bound to fail.
- **Missing OTP.** The user has no OTP configured (Keycloak will ask them to set it up), or can't reach level 2. Link to the Keycloak account console (`{authority}/account`) from the gate ("Configurar mi código de verificación").

#### 5.1.5 Emergency access ("break-the-glass")

Some actors hold `clinico:emergencia`. When a clinical **read** fails with `403 Clinico.NoAsignado` for such an actor:

- Show a panel: "No estás asignado a este caso". Explain the normal path (ask an analyst to assign you, and show your `sub` with a copy button) and offer a secondary, destructive-styled button **"Acceso de emergencia"**.
- The dialog: a red/amber banner saying "Este acceso queda auditado con tu motivo, se notifica al oficial de privacidad y genera una revisión obligatoria en 72 horas". A `textarea` (20–500 characters, live counter). A required checkbox "Confirmo que es una urgencia clínica". The confirm button **"Acceder y registrar motivo"**.
- Send the motivo as header `Halsa-Motivo-Acceso` **only on the clinical read requests of that case, only while the user stays on that case view**. Keep it in a component-scoped signal and clear it on navigation away. Never persist it.
- **Header encoding:** HTTP header values must be ASCII for the API (§13 G10). Transliterate before sending (NFD normalize, strip combining marks, `ñ→n`, `Ñ→N`, drop anything outside printable ASCII), and **show the user the exact text that will be recorded** under the textarea ("Se registrará como: …").
- While emergency access is active, show a persistent amber strip on top of the clinical content: "Acceso de emergencia activo — motivo registrado".
- Writes never use emergency access. Hide write buttons while it's active.

#### 5.1.6 Logout

Call `logoff()` (Keycloak end-session) and clear every store. A hard reload to `/` guarantees that no clinical data remains in memory.

### 5.2 Patient portal (BFF)

- **There are no tokens and no OIDC library in the portal.** Session state comes from `GET /paciente/bff/usuario`:
  - `401` → anonymous. Show the public welcome page.
  - `200 { vinculado: false }` → force `/activar`.
  - `200 { vinculado: true }` → normal app.
- **Login** is a full navigation: `window.location.assign('/paciente/bff/login?returnUrl=' + encodeURIComponent(path))`. The path must be relative and start with `/`. Registration goes through the same login. The Keycloak login page offers "Registrarse" (the `halsa-pacientes` realm allows self-registration).
- **Logout:** `POST /paciente/bff/logout` with `X-Halsa-Csrf: 1`, then `window.location.assign('/')`.
- **`csrfInterceptor`:** adds `X-Halsa-Csrf: 1` to every request whose URL starts with `/paciente/`. `withCredentials` isn't needed (same origin), but never point the portal at another origin.
- A `401` from `/paciente/api/*` means the session expired. Show the toast "Tu sesión terminó" and navigate to login with the current path.
- **Angular routes must never start with `/paciente`.** That prefix belongs to the BFF on the same host.
- The patient **never** sees diagnoses, percentages or rationales. The API doesn't send them. Don't add placeholders that suggest otherwise. Copy of the clinical record is requested formally, and the portal says so: "La copia la entrega tu ARL por el medio que elijas; no se muestra en línea".

### 5.3 Security non-negotiables (both apps)

1. No tokens, clinical text, documents or activation codes in `localStorage`, IndexedDB, cookies set by JS, URLs, `console.*`, analytics or error reporters. Add an ESLint rule banning `console` in `projects/**` (except `console.error` in the global error handler, which must scrub payloads).
2. No PII in URLs: no worker document numbers in routes or query params. Case ids (UUIDs) are fine.
3. No `innerHTML` / `bypassSecurityTrust*` with server data. Clinical text renders as text, with `white-space: pre-wrap`.
4. Clinical responses live only in the component or route-scoped store of the open case and are **dropped on route leave**. Don't use a global cache for anything under 🔒. Downloaded PDFs: create an object URL, trigger the download, and `revokeObjectURL` immediately. Never preview PDFs in an `<iframe>` from a cached blob.
5. Activation codes: displayed once, copied to the clipboard on request, wiped from memory when the dialog closes.
6. Trusted Types and a strict CSP in production (§10.3). Angular supports Trusted Types, so enable them.
7. Idempotency: the incapacidad upload generates **one** `Idempotency-Key` (`crypto.randomUUID()`) per submission attempt of a given form state, and **reuses the same key on retry** after a network error. Generate a new key only when the user changes the data.
8. File uploads are validated client-side (type `application/pdf`, ≤10 MB, first bytes `%PDF-` read through `Blob.slice(0,5)`) before sending. The server re-validates and also runs the antivirus.

---

## 6. Personas and navigation

### 6.1 Backoffice personas (from the `halsa-api` client roles)

| Role (dev user, password `dev`) | Actor | Permissions | What they do |
| --- | --- | --- | --- |
| `analista-arl` (`analista.arla` for ARL_A, `analista.arlb` for ARL_B) | arl | `casos:read`, `casos:write`, `casos:asignar`, `incapacidades:read`, `plazos:read`, `plazos:write`, `pacientes:activar` | Runs the administrative case: assigns professionals, remits to IPS, watches deadlines, issues activation codes. **No clinical access at all.** |
| `medico-laboral` (*no dev user, §13 G12*) | arl | `casos:read`, `casos:write`, `incapacidades:read`, `incapacidades:write`, `plazos:read`, `clinico:read`, `clinico:write` | Occupational physician of the ARL: clinical history, sick leaves. |
| `medico-calificador` (`calificador.arla`, has OTP and also `clinico:emergencia`) | arl | medico-laboral + `pcl:dictamen:read`, `pcl:dictamen:write` | Rates PCL, registers and notifies the dictamen. |
| `oficial-privacidad` (`privacidad.arla`) | arl | `auditoria:read`, `auditoria:export`, `auditoria:revisar`, `solicitudes-hc:gestionar` | Data-protection officer: audit log, emergency-access reviews, clinical-record copy requests. **No `casos:read`.** |
| `medico-ips` (`medico.ips`, has OTP) | ips | `casos:read`, `incapacidades:read`, `incapacidades:write`, `clinico:read`, `clinico:write` | IPS physician on remitted, assigned cases. **No plazos.** |
| `coordinador-ips` (`coordinador.ips`) | ips | `casos:read`, `casos:asignar` | Assigns the IPS physicians to remitted cases. |

The dev users have **fixed subs**, so tests and fixtures can use them directly:

| User | `sub` |
| --- | --- |
| analista.arla | `01999000-0000-7000-8000-000000000a01` |
| calificador.arla | `01999000-0000-7000-8000-000000000a02` |
| privacidad.arla | `01999000-0000-7000-8000-000000000a03` |
| analista.arlb | `01999000-0000-7000-8000-000000000b01` |
| medico.ips | `01999000-0000-7000-8000-000000000c01` |
| coordinador.ips | `01999000-0000-7000-8000-000000000c02` |
| paciente.dev (realm `halsa-pacientes`) | `01999000-0000-7000-8000-000000000d01` |

Dev OTP secrets (TOTP SHA-1, 6 digits, 30 s): `calificador.arla` → `NBQWY43BMRSXMY3BNRUWM2LDMFSG64RR`, `medico.ips` → `NBQWY43BMRSXM3LFMRUWG33JOBZTAMBR`. Playwright can generate codes with `otplib`.

### 6.2 Backoffice route map

| Route | Guard (permission) | Screen |
| --- | --- | --- |
| `/auth/callback` | — | OIDC callback (spinner) |
| `/` | auth | → `/inicio` |
| `/inicio` | auth | Role-adaptive dashboard (§7.2) |
| `/casos` | `casos:read` | Case list |
| `/casos/:casoId` | `casos:read` | Case shell (header + tabs), default child `resumen` |
| `/casos/:casoId/resumen` | `casos:read` | Summary |
| `/casos/:casoId/equipo` | `casos:read` | Team and remissions (actions need `casos:asignar` / `casos:write`) |
| `/casos/:casoId/plazos` | `plazos:read` | Case deadlines |
| `/casos/:casoId/incapacidades` | `incapacidades:read` | Sick leaves (upload needs `incapacidades:write`) |
| `/casos/:casoId/incapacidades/nueva` | `incapacidades:write` | Upload (full-screen sheet on mobile) |
| `/casos/:casoId/historia-clinica` | `clinico:read` | 🔒 Clinical history |
| `/casos/:casoId/historia-clinica/nuevo` | `clinico:write` | 🔒 New record (`?corrige=<registroId>` to correct) |
| `/casos/:casoId/historia-clinica/:registroId` | `clinico:read` | 🔒 Record detail |
| `/casos/:casoId/dictamen-pcl` | `pcl:dictamen:read` | 🔒 PCL ruling (register, correct and notify need `pcl:dictamen:write`) |
| `/casos/:casoId/portal-paciente` | `pacientes:activar` | Issue an activation code |
| `/plazos` | `plazos:read` | Tenant deadlines board |
| `/solicitudes-copia-hc` | `solicitudes-hc:gestionar` | Copy-request inbox |
| `/auditoria/accesos` | `auditoria:read` | Audit log |
| `/auditoria/revisiones-emergencia` | `auditoria:revisar` | Emergency-access reviews |
| `/cuenta` | auth | My account |
| `/acceso-denegado`, `/sin-acceso`, `**` | — | 403 page, "user without backoffice access", 404 page |

Case tabs appear only when the permission allows them. If a tab URL is opened directly without permission, redirect to the case `resumen` with a toast.

### 6.3 Backoffice navigation per persona (the result to verify)

| Section | analista | med. laboral | calificador | privacidad | médico IPS | coord. IPS |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Inicio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Casos | ✓ | ✓ | ✓ | — | ✓ (remitted) | ✓ (remitted) |
| Plazos | ✓ | ✓ | ✓ | — | — | — |
| Solicitudes HC | — | — | — | ✓ | — | — |
| Auditoría (accesos) | — | — | — | ✓ | — | — |
| Revisiones de emergencia | — | — | — | ✓ | — | — |
| Cuenta | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| *Case tabs:* Resumen / Equipo | ✓ / ✓+actions | ✓ / ✓ remit | ✓ / ✓ remit | — | ✓ / ✓ read | ✓ / ✓ assign |
| *Case tab:* Plazos | ✓ (+cumplir) | ✓ | ✓ | — | — | — |
| *Case tab:* Incapacidades | ✓ read | ✓ +upload | ✓ +upload | — | ✓ +upload | — |
| *Case tab:* Historia clínica 🔒 | — | ✓ | ✓ | — | ✓ | — |
| *Case tab:* Dictamen PCL 🔒 | — | — | ✓ | — | — | — |
| *Case tab:* Portal paciente | ✓ | — | — | — | — | — |

**Shell, mobile first:**

- **< 1024 px:** a top app bar (logo, tenant/IPS chip, avatar menu) and a **bottom navigation bar** with at most **4 items + "Más"**, ordered by the persona's priority (inbox items first). Overflow items go into a bottom **sheet** ("Más"). Touch targets ≥ 44×44 px. Respect `env(safe-area-inset-*)`.
- **≥ 1024 px:** a collapsible left **sidebar** (icons + labels, collapsible to icons), with the content max-width ~1280 px.
- The **tenant/IPS context** is always visible: a chip "ARL_A" or "IPS 110011234501". Use the code as the label, because there's no name endpoint yet.
- Global "Actualizar" affordances: pull-to-refresh on mobile lists, a refresh icon button on desktop. Refetch when the tab becomes visible again if the data is older than 60 s.

### 6.4 Portal route map (patient)

| Route | Condition | Screen |
| --- | --- | --- |
| `/` | anonymous | **Bienvenida**: what Halsa is, privacy promise, "Ingresar" / "Crear cuenta" (both → BFF login), "¿Tienes un código de activación?" explainer |
| `/` | signed in | → `/inicio` (or `/activar` if not linked) |
| `/activar` | signed in | Redeem the activation code (also reachable from Cuenta to link once more) |
| `/inicio` | linked | Summary (`/resumen`) |
| `/casos` | linked | My cases |
| `/casos/:casoId` | linked | Case timeline + "Solicitar copia de mi historia clínica" |
| `/casos/:casoId/solicitar-copia` | linked | Copy request form |
| `/incapacidades` | linked | My sick leaves |
| `/solicitudes` | linked | My copy requests |
| `/cuenta` | signed in | Name, email, linked document (masked, from the redeem response if available in this session), "Vincular otro código", "Cerrar sesión" |

The portal shell has a **bottom tab bar** on mobile (Inicio · Casos · Incapacidades · Solicitudes · Cuenta) and a top nav on desktop. It's designed primarily for phones: larger type and calmer density than the backoffice.

---

## 7. Screen specifications

Every screen implements **all four states**: loading (skeletons with the real layout, no spinners for content), empty (illustration or icon + one sentence + the next action), error (inline alert with retry + technical details disclosure), and forbidden/not-found. Lists show cards on mobile and tables at `md+` with the same data.

### 7.1 Backoffice: Cuenta (`/cuenta`)

- Name, email, actor type, tenant or IPS, roles **as permissions grouped by area** (Casos, Clínico, Auditoría…), current assurance level ("Verificación reforzada activa hasta HH:mm" when `acr=2`).
- "Tu identificador de usuario" (`sub`) with a copy button and the hint "Compártelo con el analista para que te asigne a un caso" (workaround for §13 G4).
- Links: "Gestionar mi cuenta y código de verificación" → `{authority}/account`. "Cerrar sesión".
- A theme switch (system / light / dark), persisted in localStorage. That's acceptable, because it isn't sensitive.

### 7.2 Backoffice: Inicio (`/inicio`)

A greeting with the name and the tenant/IPS. Then **widgets, each declared with a `permiso`** and rendered in a responsive grid (1 col mobile, 2 md, 3 xl). Each widget fetches independently (`@defer (on viewport)`), so one failure doesn't break the page.

| Widget | Permission | Source |
| --- | --- | --- |
| "Plazos por vencer (7 días)": top 5, countdowns, link to `/plazos?estado=ABIERTO` | `plazos:read` | `GET /plazos?estado=ABIERTO&venceAntesDe=<now+7d>&pageSize=5` |
| "Plazos vencidos": big number + link | `plazos:read` | `GET /plazos?estado=VENCIDO&pageSize=1` → `totalCount` |
| "Casos por estado": counts for Radicado, Validado, EnAtencion, EnCalificacionPcl | `casos:read` | 4 × `GET /casos?estado=X&pageSize=1` → `totalCount` (parallel) |
| "Casos recientes": last 5 | `casos:read` | `GET /casos?pageSize=5` |
| "Revisiones de emergencia pendientes": count + the ones expiring first, highlighted red when `venceRevisionEn` < 24 h | `auditoria:revisar` | `GET /auditoria/revisiones-emergencia?estado=PENDIENTE&pageSize=5` |
| "Solicitudes de copia HC abiertas" | `solicitudes-hc:gestionar` | `GET /solicitudes-copia-hc?estado=RECIBIDA` (+ `EN_TRAMITE`) |
| Quick actions ("Ver casos", "Auditoría", …) | per item | — |

### 7.3 Backoffice: Casos list (`/casos`)

- Filters: **estado** (segmented chips on mobile, select on desktop). They sync to the URL query (`?estado=Validado&page=2`).
- **No text search exists** (§13 G6). Don't render a search box that doesn't work.
- Card/row: radicado (monospace, copyable), tipo de evento badge, estado badge, fecha del evento (Bogotá), worker document (shown masked by default, e.g. `CC ••••4050`, with a tap-to-reveal per row. The API returns it in clear, so mask it in the UI), "Calificado 23,45 %" if `tieneCalificacion`.
- Pagination: "Cargar más" on mobile (append), numbered pagination on desktop. `pageSize` 20.

### 7.4 Backoffice: Case shell (`/casos/:casoId`)

- Sticky header: radicado, estado badge, tipo de evento, "Grave o mortal" red badge if `esGraveOMortal`, fecha del evento.
- Tabs filtered by permission (§6.3). On mobile, a horizontally scrollable tab strip with an active indicator. Clinical tabs carry a small lock icon.
- The case detail (`GET /casos/{id}`) is loaded once per shell and shared with the child routes through a route-scoped store. Errors: `404` → "Caso no encontrado o no disponible para tu usuario".

**Resumen:** two cards. "Evento" (tipo, fecha, municipio DIVIPOLA code, grave/mortal). "Partes" (worker document masked with reveal, employer document). Plus a calificación card when `tieneCalificacion` (percentage only. The rationale is clinical and lives in the Dictamen tab).

**Equipo y remisiones:**

- *Equipo asignado:* a list of `sub`s (§13 G4), with "Tú" when it equals the session `sub`. The actions need `casos:asignar`:
  - "Asignarme" (posts own `sub`);
  - "Asignar por identificador" (input `sub`, UUID format, with helper text);
  - remove (confirm dialog).
- *Remisiones vigentes:* IPS REPS code + date. The actions need `casos:write`:
  - "Remitir a IPS" (input REPS, exactly 12 digits, numeric keypad on mobile);
  - "Revocar" (confirm).
  - Errors: `Caso.RemisionDuplicada`, `Caso.IpsIdInvalido` inline under the field.

**Plazos (tab):** a vertical timeline of deadlines sorted by `venceEn`. Each row shows the regla label + `baseLegal` (small), start/due date-times, the urgency semaphore (§8.3), and "Extemporáneo" when applicable. "Marcar como cumplido" (`plazos:write`, only `ABIERTO`) opens a dialog/sheet with `nota` (10–1000, counter) and optional `cumplidoEn` (datetime-local in Bogotá, ≤ now).

**Portal del paciente (tab):**

- Explanation copy: "Genera un código de un solo uso para que el trabajador vincule su cuenta en el portal".
- The button "Generar código" is only enabled if the case `estado` isn't `Radicado`/`Rechazado`. The server enforces `Validado` (`Paciente.CasoNoValidado`), so show its `detail` in any case.
- On success, a dialog that **can't be dismissed by an outside click**: the code in large monospace grouped `ABC123-K7Q2M9XD4P`, "Copiar", expiry ("Vence el 18 oct 2026, 10:30 a. m."), and a warning: "No se volverá a mostrar. Si se pierde, genera uno nuevo". On close, wipe it.

### 7.5 Backoffice: Historia clínica 🔒 (`/casos/:casoId/historia-clinica`)

- Wrapped by `<halsa-verificacion-reforzada [acr]="2">`.
- Banner (subtle, violet): "Información clínica reservada · Res. 1995/1999 · Cada consulta queda auditada".
- The list is sorted by `atendidoEn` descending. Each card shows: tipo badge, `atendidoEn`, professional (`tipoDocumento numeroDocumento`, `RETHUS …`), first diagnosis code, and a status. "Corregido" (muted, with a link to `corregidoPor`) vs "Corrección de …" (link to `corrigeA`). By default, hide superseded records behind a "Mostrar versiones corregidas" toggle.
- Detail (`/:registroId`): sections Motivo · Anamnesis · Examen físico · Análisis · Plan · Diagnósticos (chips `CIE-10 S62.6`) · Observaciones. Empty sections are hidden. Show "Conservar hasta {retenerHasta}" in the footer.
- **New / correct** (`clinico:write`, gate first): `tipo` (segmented: Concepto médico · Evolución · Concepto de rehabilitación), `atendidoEn` (datetime, default now, ≤ now), the five text areas (auto-grow, 8000-char counters, at least one required), and a diagnoses editor (add or remove rows, code input uppercase with pattern validation, optional description; the first one is marked "Principal"). Correction mode prefills from the original and shows "Los registros no se modifican: la corrección crea un registro nuevo vinculado al original". Errors: `Clinico.CasoNoAdmiteRegistros` (case closed or rejected), `Clinico.AtendidoEnFuturo`, `Clinico.FechaAtencionAnteriorAlEvento`, `Clinico.ProfesionalSinRegistro` / `Clinico.RethusRequerido` ("Tu usuario no tiene registro RETHUS configurado. Contacta al administrador").
- `403 Clinico.NoAsignado` → the not-assigned panel (§5.1.5), with emergency access when permitted.

### 7.6 Backoffice: Incapacidades (`/casos/:casoId/incapacidades`)

- A header card with **days accumulated**: the max `diasAcumulados` as a progress bar with markers at 150 (warning), 180 (legal limit, needs a rehabilitation concept) and 540, plus a legend.
- List: tipo (Inicial/Prórroga, prórrogas indented under their chain), date range, días, alert badges (labels in §8.4), "Descargar soporte" 🔒 (`clinico:read`). It goes through the step-up gate and a `403` handler. Download it as a blob with a filename from `Content-Disposition` (fallback `incapacidad-<id>.pdf`).
- **Upload** (`incapacidades:write`, step-up `acr=2` gate first). A multi-step form on mobile (stepper) and one page on desktop:
  1. *Certificado:* `numeroCertificado`, `tipo` (Inicial/Prórroga), `prorrogaDe` (select from this case's incapacidades, shown only for Prórroga), `fechaInicio` (date), `dias` (1–30 stepper) → a live "Termina el {fechaInicio + dias − 1}" preview, `modalidad`.
  2. *Diagnóstico:* principal (CIE-10 code + optional description), up to 3 related.
  3. *IPS emisora:* `codigoReps` (10–12 digits), `nombre`. Prefill `codigoReps` with the session `ipsId` for IPS actors.
  4. *Soporte:* drag & drop or camera/file picker (`accept="application/pdf"`), client checks (§5.3.8), file name + size + remove.
  5. *Revisión:* a summary and "Cargar incapacidad". An upload progress bar (`reportProgress`).
- On 201, show a success sheet with any **alertas** (e.g. "Se superaron 180 días acumulados: se requiere concepto de rehabilitación"), then go back to the list.
- Errors: `Incapacidades.CertificadoDuplicado` (on the field), `Incapacidades.DiasFueraDeRango`, `Incapacidades.InicialConProrrogaDe`, 413 / 415 / 422 / 503 per §4.2, and field errors from `errors` mapped to the form controls by JSON path.

### 7.7 Backoffice: Dictamen PCL 🔒 (`/casos/:casoId/dictamen-pcl`)

- The gate has `acr=2` + `maxAgeSeg=900`. A small countdown chip shows "Verificación vigente por 12 min". When less than 2 minutes remain, offer to re-verify *before* the user submits (popup flow).
- **None yet** (`404 Dictamen.NoEncontrado`): an empty state, "Aún no hay dictamen registrado", and the CTA "Registrar dictamen" (`pcl:dictamen:write`).
- **View:** a big percentage figure (es-CO, `23,45 %`), origen badge, dates (estructuración, dictamen), manual ("Decreto 1507/2014"), componentes (deficiencias + rol laboral, with a stacked bar that sums to the total), diagnoses chips, calificador (name, document, RETHUS), and `fundamentos` in a readable long-text block. A **notification status stepper**: Pendiente → Notificado → (En controversia) → En firme, with `venceControversiaEn` as a countdown when NOTIFICADO.
- **Actions** (`pcl:dictamen:write`):
  - "Corregir dictamen": only while `estadoNotificacion = PENDIENTE`, sends `corrigeA = id`.
  - "Registrar notificación": only `PENDIENTE`. Fields: `notificadoEn` datetime ≤ now and `medio` (radio cards).
- **Form:**
  - `porcentajePcl`: decimal input with es-CO comma display, sent as a number with 2 decimals.
  - `origen`: radio cards.
  - Dates: validate estructuración ≤ dictamen ≤ today in Bogotá.
  - `componentes` (optional toggle): validate the sum ±0.01 live, with a message.
  - `fundamentos`: textarea 50–20 000 with a counter.
  - `diagnosticos` editor (≥1).
- Errors: `Dictamen.YaExiste`, `Dictamen.YaNotificado`, `Dictamen.CorrigeANoVigente` → refresh the view and explain. `Dictamen.FechasInvalidas` and `Dictamen.PorcentajeFueraDeRango` go on their fields.

### 7.8 Backoffice: Plazos board (`/plazos`)

- Filters: estado (default `ABIERTO`), regla (select with labels), "Vence antes de" (date, interpreted as the end of that day in Bogotá). Synced to the URL.
- Grouping on mobile: "Vencidos", "Hoy", "Esta semana", "Más adelante" for ABIERTO. On desktop, a table with sortable `venceEn`.
- Row: radicado (link to `/casos/:casoId/plazos`, only if the user has `casos:read`), regla label, `baseLegal` tooltip, `venceEn` with relative time ("vence en 2 días", "venció hace 3 h"), semaphore, extemporáneo tag. Inline "Cumplir" (`plazos:write`).

### 7.9 Backoffice: Solicitudes de copia HC (`/solicitudes-copia-hc`)

- Tabs by estado: Recibidas · En trámite · Cerradas (ENTREGADA + RECHAZADA). Badge counts.
- Card: radicado, medio de entrega + destination, observaciones, solicitada (relative + absolute), the `SOLICITUD_COPIA_HC` deadline hint ("10 días hábiles"), and the requester `pacienteSub` (copyable).
- Actions: "Pasar a trámite" (RECIBIDA). "Cerrar" (RECIBIDA or EN_TRAMITE) opens a sheet with the resultado radio (Entregada / Rechazada) and `nota` (10–1000). Errors: `SolicitudCopiaHc.TransicionInvalida` → refresh.
- Note: the officer has no `casos:read`, so radicado and casoId are text, not links.

### 7.10 Backoffice: Auditoría, accesos (`/auditoria/accesos`)

- Filters: date range (`desde`/`hasta`, default the last 7 days, in Bogotá), casoId (UUID), actorId (sub), acción, resultado. Collapsible on mobile ("Filtros (3)"). Synced to the URL.
- Table (desktop) or cards (mobile): when, actor (sub short + actorTipo + tenant/IPS), acción badge, resultado badge (Denegado in red), recurso (tipo + id), caso, acr ("Nivel 2"), motivo (if present: an emergency access gets an amber badge).
- Row click → a detail drawer with every field (ip, userAgent, clientId, correlationId, roles), each copyable.
- Page size 50, server pagination.
- **Export:** `auditoria:export` exists, but there is no endpoint (§13 G8). Don't render an export button.

### 7.11 Backoffice: Revisiones de emergencia (`/auditoria/revisiones-emergencia`)

- Tabs: Pendientes (default) · Cerradas.
- Pending cards are sorted by `venceRevisionEn` ascending with a countdown (red when < 24 h or overdue): actor, case, when, **motivo** (full text, prominent).
- "Cerrar revisión" opens a sheet with conclusión radio cards (Justificado (green) / Injustificado (red)) and observaciones (≤2000). `Auditoria.RevisionYaCerrada` → refresh.

### 7.12 Portal screens

- **Bienvenida (`/`):** a hero ("Consulta el estado de tu caso de accidente o enfermedad laboral"), three benefit bullets (estado del caso, incapacidades, solicitud de copia de historia clínica), a privacy note ("Nunca mostramos diagnósticos en línea"), the primary CTA "Ingresar" and the secondary "Crear cuenta". A footer with a link to the data-treatment policy placeholder (route `/privacidad`, static text the human will provide; keep a TODO).
- **Activar (`/activar`):** a big single input for the code, auto-uppercase and auto-format as `XXXXXX-XXXXXXXXXX` while typing. Accept spaces, lowercase and the Crockford confusables (`O→0`, `I/L→1`). The server normalizes too, so keep the raw user intent. Helper: "Tu ARL te entregó este código. Es de un solo uso". On success, a screen with "Cuenta vinculada al documento CC ******4050" and the CTA "Ver mis casos". Errors:
  - `Paciente.CodigoInvalido`: "El código no es válido o ya fue usado".
  - `Paciente.VinculoDistinto`: "Tu cuenta ya está vinculada a otro documento".
  - `429`: "Demasiados intentos. Intenta de nuevo en N segundos", with the button disabled and a countdown from `Retry-After`.
- **Inicio:** "Hola, {nombre}". Cards:
  - "Casos activos" (count + list);
  - "Incapacidad vigente" (a big date range, "Termina el …", days remaining);
  - "Próximos hitos" (FIN_INCAPACIDAD / VENCE_CONTROVERSIA with dates and plain-language explanations).
  - Empty: "No tienes casos activos".
- **Casos:** cards with radicado, ARL code, tipo de evento, estado in **plain language** (§8.4 patient labels), "Última actualización {ultimoHitoEn relative}".
- **Caso:** a vertical timeline of hitos with icons per tipo, `descripcion` from the server, dates. A sticky bottom CTA "Solicitar copia de mi historia clínica".
- **Solicitar copia:** medio de entrega radio cards (Correo certificado → dirección; Electrónico → correo, validated as an email; Presencial → no field), observaciones. A legal note (Res. 1995/1999 art. 14) and the 10 business days notice. `SolicitudCopiaHc.YaAbierta` → "Ya tienes una solicitud abierta para este caso", with a link to `/solicitudes`.
- **Incapacidades:** grouped by case, each with a date range, días, acumulados, tipo.
- **Solicitudes:** a status stepper per request (Recibida → En trámite → Entregada/Rechazada) + `notaAtencion` when closed.
- **Cuenta:** nombre, correo, "Vincular otro código" → `/activar`, "Cerrar sesión".

---

## 8. Design system and UX

Load your design judgement here. The brief: **trustworthy, calm and modern clinical software**, shadcn-level polish, not a generic admin template. The backoffice is dense but breathable. The portal is warm, large and reassuring.

### 8.1 Tokens (`libs/ui/src/theme.css`, Tailwind v4 `@theme` + shadcn-style CSS variables)

- Color space **OKLCH**. Semantic variables (`--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--primary`, `--primary-foreground`, `--secondary`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`, `--clinical`), defined for light and dark (`.dark` class + `prefers-color-scheme` default).
- **Brand:** a deep **teal** primary (health + calm, e.g. around `oklch(0.50 0.09 195)`), slate neutrals, and a soft **violet `--clinical`** used *only* to mark clinical or reserved zones (lock badges, the clinical banner). Status colors: success emerald, warning amber, destructive red, info sky. All text/background pairs pass **WCAG 2.2 AA** (4.5:1 for body text) in both themes. Verify with a script.
- **Type:** UI font "Plus Jakarta Sans" or "Inter" (pick one and justify it in the report), with **tabular numbers** for figures and a monospace ("JetBrains Mono" / "Geist Mono") for radicados, codes and ids. The base is 16 px on mobile (never smaller for inputs, to avoid iOS zoom). The portal base is 17–18 px.
- Radius `0.75rem` for cards, `0.5rem` for controls. Soft shadows, a 1 px border on cards. 4/8 spacing.
- Motion: 150–200 ms ease-out for state changes, and nothing at all under `prefers-reduced-motion`.

### 8.2 Component inventory (`@halsa/ui`)

These are the Spartan helm components: button, badge, card, input, textarea, label, form-field (with error and hint), select, radio-group, checkbox, switch, tabs, dialog, alert-dialog, **sheet** (bottom sheet on mobile), dropdown-menu, popover, tooltip, table, pagination, skeleton, progress, separator, avatar, toast (sonner), alert, accordion, scroll-area, and calendar/date-picker.

Halsa composites:

- `EstadoBadge` (per enum, §8.3), `RadicadoChip` (mono + copy), `DocumentoEnmascarado` (tap to reveal), `FechaBogota` / `FechaRelativa`;
- `SemaforoPlazo`, `ContadorRegresivo`, `BarraDiasAcumulados`, `EditorDiagnosticosCie10`, `CampoMoneda`/`CampoPorcentaje` (es-CO);
- `EstadoVacio`, `EstadoError` (with retry + trace), `SeccionClinica` (violet banner + lock), `VerificacionReforzada` (gate), `PanelNoAsignado` + `DialogoAccesoEmergencia`;
- `BottomNav`, `SidebarNav`, `MasSheet`, `PageHeader` (title, back, actions; collapses on scroll on mobile), `ListaResponsiva` (cards ↔ table), `FiltrosColapsables`, `SubidaPdf` (drag & drop + picker + validations), `CodigoUnaVez` (one-time code display).

A dev-only route `/_ui` (excluded from production builds through `fileReplacements` or an environment check) shows every component in light and dark, for visual review.

### 8.3 Status → visual mapping

| Enum | Value → label · tone |
| --- | --- |
| Estado del caso | Radicado → "Radicado" · info · Validado → "Validado" · primary · EnAtencion → "En atención" · primary · EnCalificacionOrigen → "Calificación de origen" · clinical · EnCalificacionPcl → "Calificación PCL" · clinical · Cerrado → "Cerrado" · muted · Rechazado → "Rechazado" · destructive |
| Plazo | ABIERTO → neutral, **amber when now ≥ alertaEn**, **red outline when < 24 h left** · CUMPLIDO → success (+ amber "Extemporáneo" tag if `extemporaneo`) · VENCIDO → destructive · SUSPENDIDO → muted |
| Dictamen | PENDIENTE → warning · NOTIFICADO → info · EN_CONTROVERSIA → clinical · EN_FIRME → success |
| Solicitud HC | RECIBIDA → info · EN_TRAMITE → warning · ENTREGADA → success · RECHAZADA → destructive |
| Revisión emergencia | PENDIENTE → warning (destructive when overdue) · CERRADA → muted; conclusión JUSTIFICADO → success · INJUSTIFICADO → destructive |
| Auditoría resultado | Exito → success · Denegado → destructive · NoEncontrado → warning · Error → destructive outline |

Never rely on color alone: every badge has text, and the semaphores have an icon (clock, alert-triangle, check, x).

### 8.4 Spanish labels (`@halsa/core/i18n`, one typed map per enum, with an exhaustive check)

- **Tipo de evento:** AccidenteTrabajo "Accidente de trabajo", EnfermedadLaboral "Enfermedad laboral".
- **Reglas:**
  - REPORTE_FURAT "Reporte del accidente (FURAT)";
  - REPORTE_FUREP "Reporte de la enfermedad (FUREP)";
  - INVESTIGACION_AT "Investigación del accidente";
  - REMISION_INVESTIGACION_GRAVE "Remisión de investigación (AT grave o mortal)";
  - CONTROVERSIA_DICTAMEN "Controversia del dictamen";
  - TOPE_IT_180 "Tope de incapacidad temporal (180 días)";
  - SOLICITUD_COPIA_HC "Entrega de copia de historia clínica".
- **Alertas de incapacidad:**
  - ACUMULADO_150_DIAS "150 días acumulados: alerta temprana";
  - ACUMULADO_180_DIAS "180 días: requiere concepto de rehabilitación";
  - ACUMULADO_540_DIAS "540 días acumulados";
  - CARGA_EXTEMPORANEA "Cargada de forma extemporánea".
- **Registro clínico:** REPORTE_INICIAL "Reporte inicial", CONCEPTO_MEDICO "Concepto médico", EVOLUCION "Evolución", CONCEPTO_REHABILITACION "Concepto de rehabilitación", CERTIFICADO_INCAPACIDAD "Certificado de incapacidad".
- **Origen:** LABORAL "Laboral", COMUN "Común", MIXTO "Mixto". **Medio de notificación:** CORREO_CERTIFICADO "Correo certificado", ELECTRONICO "Electrónico", PERSONAL "Personal". **Medio de entrega:** CORREO_CERTIFICADO, PRESENCIAL "Presencial (recoger en oficina)", ELECTRONICO "Correo electrónico".
- **Patient-facing case states (plain language):**
  - Radicado "Recibimos el reporte de tu caso";
  - Validado "Tu ARL validó el caso";
  - EnAtencion "Estás en atención médica";
  - EnCalificacionOrigen "Se está definiendo si el origen es laboral";
  - EnCalificacionPcl "Se está calificando tu pérdida de capacidad laboral";
  - Cerrado "Caso cerrado";
  - Rechazado "El caso no fue aceptado. Comunícate con tu ARL".
- **Hitos:** RADICADO "Caso radicado", VALIDADO "Caso validado", RECHAZADO "Caso rechazado", REMITIDO_A_IPS "Remitido a una IPS para tu atención", INCAPACIDAD_REGISTRADA "Incapacidad registrada", DICTAMEN_NOTIFICADO "Te notificaron el dictamen", DICTAMEN_EN_FIRME "El dictamen quedó en firme".
- **Próximos hitos:** FIN_INCAPACIDAD "Termina tu incapacidad", VENCE_CONTROVERSIA "Último día para controvertir el dictamen".

Unknown enum values render as the raw value, with a `console.warn` in dev builds only.

### 8.5 Formatting

- Dates: `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', ... })`, e.g. "17 oct 2026" and "17 oct 2026, 3:45 p. m.". Relative time with `Intl.RelativeTimeFormat('es-CO')`.
- `DateOnly` strings: format by splitting `YYYY-MM-DD`. Never through a `Date` in local or UTC time.
- Numbers: `Intl.NumberFormat('es-CO')`. Percent: `23,45 %`.
- Register Angular's `es-CO` locale data and set `LOCALE_ID` for pipes.

### 8.6 Accessibility (WCAG 2.2 AA)

Keyboard reachable everything, visible focus rings (`--ring`), `aria-live="polite"` for toasts and async results, labelled form controls with `aria-describedby` for hints and errors, focus moved to the first invalid field on submit, the page title updated per route ("Casos · Halsa"), and a skip-to-content link. Dialogs trap focus (Spartan brain does it). Run axe in every e2e test: zero serious or critical violations.

---

## 9. Development environment

**Backend running locally** (the human runs this, see `../Halsa.Backend/README.md`): Docker compose (PostgreSQL, Keycloak, Redis, ClamAV, Seq), the API at `http://localhost:5600`, and for the portal the BFF at `https://localhost:5610`.

| App | Command | Proxy | Notes |
| --- | --- | --- | --- |
| Backoffice | `ng serve backoffice --port 3000` | `proxy.backoffice.json`: `/v1` → `http://localhost:5600` (no CORS needed in dev) | Port **3000** because it's already a registered redirect URI and web origin of `halsa-backoffice` in the dev realm. `public/config.json`: `{ "apiBaseUrl": "", "keycloak": { "authority": "http://localhost:8080/realms/halsa", "clientId": "halsa-backoffice" } }` |
| Portal | `ng serve portal --port 4300 --ssl` | `proxy.portal.json`: `/paciente` → `https://localhost:5610`, `secure: false`, **`changeOrigin: false`** (keep `Host: localhost:4300` so the BFF builds `redirect_uri=https://localhost:4300/paciente/bff/signin-oidc` and the cookie lands on this origin) | Needs HTTPS (`__Host-` cookie) and **backend prerequisite §13 G3** (redirect URIs for port 4300). Until then, build the portal UI against the mock adapter (below) and test the real flow afterwards. |

**Two ways to run the backoffice:**

| Mode | Identity | API | When |
| --- | --- | --- | --- |
| `ng serve backoffice --configuration mock` | **The local Podman Keycloak** (`http://localhost:8180/realms/halsa`, Appendix B): real login, real OTP step-up, real tokens with the same claims | The mock adapter (below) | Building UI, theme work, step-up and permission-matrix tests without the backend |
| `ng serve backoffice` | The backend's Keycloak (`http://localhost:8080/realms/halsa`) | The real API through the proxy | Integration and acceptance (the e2e suite) |

The `mock` configuration only swaps `public/config.json` for `public/config.mock.json` (`"mock": true`, authority on 8180). Run `npm run kc:up` first. The two Keycloaks can run at the same time, because their ports differ.

**Mock adapter (dev only):** an `HttpInterceptor` enabled by `config.json` → `"mock": true` that serves fixtures for every endpoint in §4.3 (including errors: 401 step-up, 403 `Clinico.NoAsignado`, 404, 409, 429). Fixtures live under `projects/*/src/mocks/` and **must never be imported by production code paths** (lint rule + a build check that the production bundle doesn't contain the word `__mock`). Use it to build the UI states fast. The real backend remains the acceptance target.

**Seed data:** the dev seed has 3 cases for ARL_A and 2 for ARL_B, all `Radicado`. To get a `Validado` case (needed for activation codes and the portal), follow the README "patient portal" section (radicate a FURAT, and the worker validates it). For clinical tests, assign `calificador.arla` to a case first (analista.arla → Equipo → assign by sub; `calificador.arla`'s sub is shown on their Cuenta page).

---

## 10. Build and deployment

### 10.1 Builds

- `ng build backoffice` and `ng build portal` (production). Budgets: initial bundle ≤ **300 kB** gz (backoffice) and ≤ **200 kB** gz (portal), any lazy chunk ≤ 150 kB gz. Fail the build on overflow.
- Source maps: hidden in production (uploaded nowhere for now).
- **Runtime config, not build-time environments,** for URLs: `config.json` is fetched before bootstrap, so one image serves every environment.

### 10.2 Containers

One Dockerfile per app (multi-stage: `node:22-alpine` build → `nginxinc/nginx-unprivileged:stable-alpine` serve, non-root, port 8080):

- SPA fallback (`try_files $uri $uri/ /index.html`). Long cache for hashed assets. `no-cache` for `index.html` and `config.json`.
- `config.json` generated at container start from env vars (`envsubst` in an entrypoint), e.g. `HALSA_API_BASE_URL`, `HALSA_KEYCLOAK_AUTHORITY`, `HALSA_KEYCLOAK_CLIENT_ID`.
- `/health` returns 200 (static).

### 10.3 Security headers (in the container's nginx)

- **Backoffice:**
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' <api-origin> <keycloak-origin>; frame-src <keycloak-origin>; frame-ancestors 'none'; base-uri 'self'; form-action 'self' <keycloak-origin>; object-src 'none'; require-trusted-types-for 'script'; trusted-types angular angular#bundler`. Keep `'unsafe-inline'` for styles only (Angular injects component styles at runtime) and disable critical-CSS inlining if it conflicts.
  - Also send `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Cross-Origin-Opener-Policy: same-origin-allow-popups` (the step-up popup needs the opener).
- **Portal:** the same, but `connect-src 'self'`, no Keycloak frame (login is a full navigation), `form-action 'self' <keycloak-origin>`, and `Permissions-Policy: camera=(self)` only if the PDF picker needs it (it doesn't, since patients don't upload).

### 10.4 Where they will live (backend/deploy work, §13 G1–G2)

- **Backoffice:** `https://halsa-backoffice.edcastdev.com` (already referenced by `HALSA_BACKOFFICE_URL` in the backend `.env`) → new NPM proxy host → backoffice container. It calls the API cross-origin at `https://halsa-api.edcastdev.com`, which **requires CORS on the API** (G1).
- **Portal:** `https://halsa-pacientes.edcastdev.com/` → the same host as the BFF. The NPM site currently answers `404` for `location /`. It must route `/` to the portal container while keeping `/paciente/*` → BFF (G2).
- You deliver the Dockerfiles, the nginx configs and a `deploy/README.md` with the required NPM/compose snippets. You **don't** edit the backend repo.

---

## 11. Testing strategy and quality gates

- **Unit (Vitest):**
  - formatters (the DateOnly off-by-one bug as a named test);
  - problem-details parsing (both `errors` shapes, `errorCode`/`code`, `WWW-Authenticate` parsing);
  - the permission service and nav filtering (the §6.3 matrix as a table-driven test);
  - the emergency-motivo transliteration;
  - the CIE-10 validator;
  - the activation code formatter;
  - the idempotency key reuse.
- **Component tests:** every form's validation and error mapping, and the gate states.
- **E2E (Playwright), against the real local stack:**
  - **one login spec per persona** asserting the exact visible navigation of §6.3 (no extra, no missing items);
  - analista: list → case → assign calificador → remit to IPS → issue the activation code (`Validado` case);
  - calificador: step-up via OTP (`otplib`) → historia clínica → new concepto → correction → register dictamen → notify;
  - calificador on an unassigned case → emergency access → the audit row appears for privacidad;
  - privacidad: audit log filters → close the emergency review → close a copy request;
  - medico.ips: remitted case → upload an incapacidad with a PDF fixture (and a non-PDF rejection);
  - coordinador.ips: assign medico.ips;
  - analista.arlb can't open an ARL_A case id (404 page);
  - analista sees **no** clinical tab, and a direct URL to `/historia-clinica` redirects;
  - portal: login → activar (invalid, then valid) → inicio → caso timeline → solicitar copia → solicitudes → logout (the session is gone).
  - Run every page through `@axe-core/playwright` at **375×812** and **1440×900**.
- **Keycloak theme (against the Podman Keycloak):**
  - a Playwright spec visits every themed page of Appendix A.3 for both realms, at 375 px and 1440 px, in light and dark;
  - screenshot baselines (`toHaveScreenshot`);
  - axe with zero serious or critical violations;
  - a check that no page shows an English string, an unstyled default PatternFly element or a broken image.
- **Gates:** `npm run lint`, `npm run test`, `npm run build` (both apps, budgets), and `npm run e2e` (when the backend is up). There's no CI for the frontend yet. Provide a `.github/workflows/frontend.yml` with lint + unit + build (e2e excluded) as a deliverable.
- **Lighthouse (mobile):** Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 on the portal pages and the backoffice `/inicio` and `/casos`.

---

## 12. Milestones

Each milestone ends with: lint + unit tests green, both apps build, a short report (§15). Don't merge milestones.

**M0: Workspace and tooling.** `ng new halsa --create-application=false`, the two apps (`--ssr=false --style=css --routing`), `libs/` + path aliases, Tailwind v4, Spartan (or the documented fallback), ESLint (boundaries, no-console, restricted imports), Prettier, Vitest, Playwright skeleton, `api:types` scripts, generated types committed, proxies, runtime config loader, `README.md` (how to run).
*AC:* `npm run build` builds both apps. `npm run test` runs. An empty shell renders in both. Types generated from the live OpenAPI (or the YAML fallback, stated in the report).

**M1: Design system.** Tokens (light/dark, AA verified), fonts, all of §8.2 that are needed for M2–M4, and the `/_ui` showcase.
*AC:* Showcase screenshots at 375 px and 1440 px, light and dark, attached to the report. A contrast check passes.

**M1.5: Local Keycloak + login theme.**

- Appendix B: `dev/keycloak/compose.yaml`, `scripts/sync-realms.mjs`, the `kc:*` scripts, the backoffice `mock` configuration.
- Appendix A: the `halsa` and `halsa-pacientes` login themes, Spanish messages, the `theme:*` scripts, the JAR build.

*AC:*

- `npm run kc:up` starts Keycloak in Podman, and it imports both mock realms with the themes applied.
- Logging in to `http://localhost:8180/realms/halsa/account` as `calificador.arla` shows the themed login, then the themed OTP page.
- Logging in to `http://localhost:8180/realms/halsa-pacientes/account` shows the patient variant, and its "Crear cuenta" leads to the themed registration.
- Editing a `.ftl` or the CSS shows up on reload without restarting the container.
- `npm run theme:build` produces `dist/keycloak-theme/halsa-keycloak-theme.jar`.
- The theme Playwright spec (§11) passes. Screenshots of every page are attached to the report.

**M2: Core plumbing.** HTTP layer, problem-details, error→UI mapping, toasts, formatters, i18n maps, the mock adapter with fixtures, global error handler (scrubbed).
*AC:* Unit tests from §11 for these pieces.

**M3: Backoffice identity and shell.** OIDC, `identidad/yo` session, permissions, guards, `*halsaSiPuede`, mobile bottom nav + "Más" sheet, desktop sidebar, tenant chip, Cuenta page, logout, 403/404/"sin acceso" pages, the step-up gate component + popup/redirect flow (tested with a dummy route).
*AC:* With the real Keycloak, each of the five dev users sees exactly their column of §6.3 (Playwright). Step-up to `acr=2` works for calificador.arla and medico.ips. analista.arla's Cuenta page shows `sub` and the permissions.

**M4: Casos.** List, case shell + tabs (permission-filtered), Resumen, Equipo y remisiones (assign/unassign/remit/revoke), Portal paciente (activation code), Inicio widgets for `casos:read`.
*AC:* The analista flows in §11 pass. A cross-tenant id → 404 page. Mobile layout reviewed at 375 px.

**M5: Plazos.** The tenant board, the case tab, cumplir, Inicio plazo widgets.
*AC:* Filters sync to the URL. The semaphore is right for alerta/vencido fixtures. The cumplir validation errors map.

**M6: Clínico.** Historia clínica list/detail/new/correct, the not-assigned panel, emergency access with transliteration preview and the active strip.
*AC:* The calificador flows in §11. No clinical data in any storage after leaving the case (an automated check of `sessionStorage`/`localStorage`/IndexedDB). Every clinical request carries a Bearer token with `acr=2`.

**M7: Incapacidades.** List + accumulated-days bar, upload (stepper, PDF validation, idempotency, progress, alerts), soporte download.
*AC:* medico.ips upload e2e. A retry after a simulated network failure reuses the same `Idempotency-Key` (unit test). A non-PDF is rejected client-side.

**M8: Dictamen PCL.** View, register, correct, notify, 15-minute window handling.
*AC:* calificador e2e. With an `auth_time` older than 15 min (simulated), the gate asks for re-verification before submit. A form with 5 000 characters of fundamentos survives a popup step-up.

**M9: Privacidad.** Auditoría accesos, revisiones de emergencia, solicitudes de copia HC, the officer's Inicio widgets.
*AC:* The privacidad e2e. Pagination and filters work with the real API.

**M10: Patient portal.** Every §6.4 / §7.12 screen, BFF session handling, CSRF interceptor, the 429 handling. Built first against mocks. Then, once §13 G3 is done, against the real BFF.
*AC:* The portal e2e against the real BFF. Lighthouse mobile targets. No request leaves to an origin other than self (assert in Playwright).

**M11: Hardening and delivery.** Dockerfiles, nginx with CSP/Trusted Types, `deploy/README.md`, the GitHub workflow, a full axe sweep, Lighthouse, a bundle budget review, and a final README.
*AC:* Both containers run locally with env-provided `config.json`. CSP produces zero violations in the console during the e2e suite. A final report listing every open gap.

---

## 13. Known backend gaps and prerequisites (not yours to fix; implement the workaround)

| # | Gap | Impact | Workaround in the frontend | Owner |
| --- | --- | --- | --- | --- |
| **G1** | The API has **no CORS** configuration. | Blocks the backoffice in production (different origin). Dev is fine via the proxy. | None. The backend must allow `https://halsa-backoffice.edcastdev.com`, methods GET/POST/PATCH/DELETE, headers `Authorization, Content-Type, Idempotency-Key, Halsa-Motivo-Acceso, X-Correlation-Id`, **exposed headers `WWW-Authenticate, Location, Content-Disposition, Retry-After`** (without `WWW-Authenticate` exposed, step-up detection fails cross-origin). | Backend |
| **G2** | No hosting for the SPAs: no NPM host for the backoffice, and `halsa-pacientes` returns 404 on `/`. | Blocks production. | Deliver containers + snippets (§10.4). | Backend/deploy |
| **G3** | The `halsa-bff-paciente` redirect URIs don't include `https://localhost:4300/paciente/bff/signin-oidc` (+ the `signout-callback-oidc` post-logout URI). | Blocks the real portal login in dev. | Build against the mock adapter until it's added. | Backend (realm JSON + reimport) |
| **G4** | No user directory: assignments take a raw `sub`, and `equipoAsignado` returns only subs. | Assigning is awkward, and the team shows UUIDs. | "Asignarme", "assign by identifier", and the `sub` copy on Cuenta. Show `sub` shortened (first 8 chars) with a tooltip. | Backend (future endpoint) |
| **G5** | No IPS catalog. | Remission by a typed 12-digit REPS. Only codes are shown. | Validated input. | Backend |
| **G6** | `GET /casos` has no text search (radicado or document) and no "assigned to me" filter. | No search box, no "Mis casos". | Estado filter only. Don't render a fake search. | Backend |
| **G7** | No staff-facing case timeline or dictamen history list. | — | Case tabs only. | Backend |
| **G8** | `auditoria:export` has no endpoint. | No export. | Hide the export button. | Backend |
| **G9** | No names for tenants or IPS. | Codes as labels (ARL_A, REPS). | Chips with codes. | Backend |
| **G10** | `Halsa-Motivo-Acceso` is an HTTP header. Kestrel rejects non-ASCII header bytes by default (verify). | Spanish accents in the motivo could fail with 400. | Transliterate + show the recorded text (§5.1.5). | Backend (accept a UTF-8/percent-encoded motivo) |
| **G11** | Only integration service accounts hold `webhooks:manage`. | No webhook admin UI. | Out of scope. | Product decision |
| **G12** | No `medico-laboral` dev user. | The role is untestable in e2e. | Test its matrix column with a unit test on the permission set. Add an e2e test when a user exists. | Backend (realm) |
| **G13** | The YAML says the problem field is `code`, the implementation returns `errorCode`. | — | Read `errorCode ?? code`. | Backend docs |
| **G14** | The theme you build (Appendix A) still has to be **installed and selected** in the real Keycloaks. | Until then, the backend's dev Keycloak and production show the default Keycloak pages. | You deliver the JAR + `keycloak-theme/README.md` with the steps below. Your own Podman Keycloak already uses the theme. | Backend/identity: <br>(1) **dev:** mount `keycloak-theme/themes` into the backend compose's Keycloak, or copy the JAR to `/opt/keycloak/providers`; <br>(2) set `loginTheme` (`halsa` / `halsa-pacientes`), `internationalizationEnabled: true`, `supportedLocales: ["es"]` and `defaultLocale: "es"` in both realm JSONs and in `deploy/keycloak/importar-realms.sh`; <br>(3) **production:** the owner of the shared `auth.edcastdev.com` puts the JAR in `providers/` and restarts. |
| **G15** | No push or real-time notifications. | — | Refetch on focus and manual refresh. | Future |

If you find another gap, add it to this table in your report (don't edit this file).

---

## 14. Out of scope

Webhook subscription admin, FURAT/FUREP/concepto integrations UI, the employer portal, payments/liquidation, the Juntas de Calificación, digital signatures, analytics, native mobile apps, PWA/offline, the Keycloak **account console** and **admin console** themes (only the login theme and, optionally, the email theme are in scope), i18n beyond Spanish, and any backend change, including installing the theme in the backend's Keycloak (§13 G14).

---

## 15. Milestone report format

At the end of every milestone, reply with:

1. **Done:** bullet list mapped to the milestone's AC (each with ✅/❌ and evidence: test name, screenshot path, command output).
2. **Deviations:** anything you did differently from this plan, and why.
3. **Gaps found:** new rows for §13.
4. **Questions:** only real blockers. Otherwise pick the conservative option, state it, and continue.
5. **Next:** the next milestone you'll start.

---

## Appendix A: Keycloak login theme

The backoffice users and the patients spend their first seconds in Halsa on **Keycloak's** pages: login, OTP, OTP enrollment, registration. Those pages must feel like the same product as the apps.

### A.1 Approach

- **The technology:** a classic **FreeMarker login theme**, `parent=base`, `import=common/keycloak`. This choice keeps one toolchain (Tailwind) and adds no framework.
- **The trick that covers every page:** the `base` templates take their CSS classes from the `kc*Class` properties in `theme.properties`. Remap **all** of those properties to our own component classes (`hl-card`, `hl-input`, `hl-btn-primary`, …), defined with Tailwind in `@layer components`. Then even the pages we don't override render in the Halsa style. Override the `.ftl` files only where the markup itself needs to change (§A.3).
- **The tokens:** the theme CSS imports **`libs/ui/src/theme.css`**, so colors, radii, fonts and dark mode are the same as the apps. A token change shows up everywhere.
- **The reference files** (don't commit them): extract Keycloak 26.4's themes once into `keycloak-theme/.reference/` (gitignored). Create a container from `quay.io/keycloak/keycloak:26.4` with `podman create --name kc-ref`, copy `/opt/keycloak/lib/lib/main` out with `podman cp`, remove the container, and unzip `org.keycloak.keycloak-themes-26.4.*.jar` into `keycloak-theme/.reference/themes`.
  - Take the **complete** list of `kc*Class` keys from `theme/keycloak/login/theme.properties` and give every key a value. An empty value is allowed. A missing key falls back to nothing.
  - Override a page by **copying the base `.ftl` and changing markup only.** Never rename inputs, form ids or button names (`username`, `password`, `otp`, `selectedCredentialId`, `rememberMe`, `login`, `totpSecret`, `userLabel`, …), and never drop hidden fields. Keycloak posts them.
  - Keep FreeMarker's escaping. Use `kcSanitize(...)?no_esc` only where the base template already does.

### A.2 Structure

```
keycloak-theme/
  src/halsa.css                       # imports ../../libs/ui/src/theme.css; @source ../themes/**/*.ftl; @layer components { .hl-* }
  META-INF/keycloak-themes.json       # {"themes":[{"name":"halsa","types":["login"]},{"name":"halsa-pacientes","types":["login"]}]}
  themes/
    halsa/login/
      theme.properties                # parent=base, import=common/keycloak, styles=css/halsa.css, scripts=js/halsa.js,
                                      # locales=es, meta=viewport==width=device-width,initial-scale=1, every kc*Class mapped,
                                      # custom: halsaVariant=personal, halsaPrivacyUrl=<url>
      template.ftl                    # the shell (A.3)
      login.ftl  login-otp.ftl  login-config-totp.ftl  login-reset-password.ftl  login-update-password.ftl
      login-update-profile.ftl  login-page-expired.ftl  logout-confirm.ftl  info.ftl  error.ftl  terms.ftl
      messages/messages_es.properties # only the keys whose wording changes; the base Spanish covers the rest
      resources/css/halsa.css         # GENERATED by theme:css (gitignored)
      resources/js/halsa.js           # vanilla: password show/hide, OTP input niceties. No inline scripts.
      resources/fonts/*.woff2         # copied from @fontsource by scripts/copy-fonts.mjs (gitignored)
      resources/img/logo.svg, logo-dark.svg, favicon.svg, pattern.svg
    halsa-pacientes/login/
      theme.properties                # parent=halsa, halsaVariant=pacientes
      register.ftl  login-verify-email.ftl
      messages/messages_es.properties # the warmer patient copy
      resources/img/hero.svg
    (stretch) halsa/email/            # html/template.ftl branding + messages_es for verify-email / reset-password
```

### A.3 Design

**The shell (`template.ftl`), mobile first:**

- **< 1024 px:** a single column. A top brand bar (logo + context label), then the form card edge-to-edge with a 16 px gutter, then a small footer. No sticky buttons: the mobile keyboard would cover them.
- **≥ 1024 px:** a split screen.
  - *Left (5/12):* a brand panel with a deep-teal gradient from `--primary`, a subtle `pattern.svg`, the headline and three short bullets with Lucide-style inline SVG icons.
  - *Right (7/12):* the card centered, `max-w-[420px]`.
- **Context label and copy per variant:**
  - *Staff (`halsa`):* label "Acceso para personal de ARL e IPS". Headline "Gestión de casos ATEL". Bullets: "Información clínica protegida", "Cada acceso queda auditado", "Verificación en dos pasos para datos sensibles".
  - *Patients (`halsa-pacientes`):* label "Portal del paciente". Headline "Tu caso, en un solo lugar". Bullets: "Consulta el estado de tu caso", "Revisa tus incapacidades", "Solicita la copia de tu historia clínica". Larger type (17–18 px base). `hero.svg` (abstract and friendly, no stock photos) replaces the pattern.
- **Dark mode** follows `prefers-color-scheme`. There's no toggle on these pages.
- **Messages:** one error/info alert at the top of the card (`message.type` → destructive / warning / success / info tone, with an icon), plus field errors inline under each input.
- **Footer:** "Halsa · Tratamiento de datos según la Ley 1581 de 2012" and a link to `properties.halsaPrivacyUrl`.
- **Language:** a single locale (`es`), so hide the language switcher.
- **Accessibility:** the same WCAG 2.2 AA rules as §8.6, plus `autocomplete` attributes (`username`, `current-password`, `new-password`, `one-time-code`) and visible labels (no placeholder-only fields).

**Pages:**

| Template | Realms | Content |
| --- | --- | --- |
| `login.ftl` | both | Title "Ingresa a Halsa". Fields "Usuario o correo" and "Contraseña" (show/hide toggle). "¿Olvidaste tu contraseña?" only if `realm.resetPasswordAllowed`. Primary "Ingresar". **Patients:** a divider + "¿Primera vez? **Crear cuenta**" if `realm.registrationAllowed`, and a hint: "Después de crear tu cuenta necesitarás el código de activación que te entregó tu ARL". |
| `login-otp.ftl` | both | Title "Verificación en dos pasos". Text "Ingresa el código de 6 dígitos de tu aplicación de autenticación. Lo pedimos para proteger la información clínica". **One** input (not six boxes; paste and screen readers work better), `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength=6`, large with letter spacing, autofocus. With several OTP devices, a radio-card selector (`selectedCredentialId`). Primary "Verificar". |
| `login-config-totp.ftl` | both | A 3-step enrollment:<br>(1) install an app: Google Authenticator, Microsoft Authenticator or FreeOTP;<br>(2) scan the QR (`totp.totpSecretQrCode`), with a "¿No puedes escanear?" disclosure showing the key in monospace groups of 4 + a copy button;<br>(3) enter the code + "Nombre del dispositivo".<br>Primary "Activar verificación". |
| `login-reset-password.ftl`, `login-update-password.ftl` | both | Clear titles. The update form shows the password policy as a checklist hint. |
| `login-update-profile.ftl`, `login-page-expired.ftl`, `logout-confirm.ftl`, `info.ftl`, `error.ftl`, `terms.ftl` | both | Styled consistently. `error.ftl` gets a friendly title, the message, and a "Volver al inicio" link when `client.baseUrl` exists. |
| `register.ftl` | pacientes | Nombre, Apellidos, Correo, Contraseña, Confirmar contraseña. Policy hint. A data-treatment notice linking `halsaPrivacyUrl`. Primary "Crear cuenta", secondary "Ya tengo cuenta". |
| `login-verify-email.ftl` | pacientes | "Revisa tu correo" with the address and a resend link (production has SMTP; dev has verification off). |

- **Copy:** Colombian Spanish, informal "tú" (consistent with the apps).
- **Error wording:** keep Keycloak's error semantics. Never reveal whether a user exists.
- **Not in scope:** WebAuthn and identity-provider (social login) pages. They're unused, and the base styling through `kc*Class` is enough if they ever appear.

### A.4 Build scripts

| Script | Does |
| --- | --- |
| `theme:css` | Runs the Tailwind CLI: input `keycloak-theme/src/halsa.css`, output `keycloak-theme/themes/halsa/login/resources/css/halsa.css`, minified. Then runs `node scripts/copy-fonts.mjs`. |
| `theme:watch` | The same in watch mode. Use it together with `kc:up`: Keycloak picks up the changes on reload. |
| `theme:build` | `theme:css`, then `node scripts/build-theme-jar.mjs`. That writes `dist/keycloak-theme/halsa-keycloak-theme.jar`, a zip with `META-INF/keycloak-themes.json` and the themes under **`theme/<name>/login/...`**, which is the layout Keycloak expects inside a JAR. Use a Node zip library (`fflate` or `archiver`), so it runs the same in PowerShell and in bash. |

`keycloak-theme/README.md` documents the installation for the backend owners (§13 G14). Give the JAR to the backend team. Don't install it yourself.

---

## Appendix B: Local Keycloak in Podman

The dev machine has **Podman 6** (no Docker). This Keycloak gives the frontend real logins, real OTP step-up and real tokens with the same users, subs, roles and claims as the backend's realm, without running the backend stack. It's also where the theme is developed.

### B.1 `dev/keycloak/compose.yaml`

```yaml
name: halsa-frontend-dev
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.4      # same version as the backend
    command: ["start-dev", "--import-realm"]   # start-dev disables theme caching: .ftl/.css edits show on reload
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      KC_HOSTNAME: http://localhost:8180        # issuer = http://localhost:8180/realms/<realm>
      KC_HTTP_ENABLED: "true"
    ports:
      - "8180:8080"                             # 8080 is the backend's Keycloak; both can run at once
    volumes:
      - ./realms:/opt/keycloak/data/import:ro
      - ../../keycloak-theme/themes/halsa:/opt/keycloak/themes/halsa:ro
      - ../../keycloak-theme/themes/halsa-pacientes:/opt/keycloak/themes/halsa-pacientes:ro
```

- There's **no data volume**: the dev database is ephemeral, so `kc:reset` always reimports the realms from scratch.
- **Windows:** the repo lives under `C:\_ws\...`. The default Podman machine mounts `C:` (`/mnt/c`), so the relative bind mounts work. If the theme folders show up empty inside the container, check `podman machine inspect` and report it.
- **Linux with SELinux:** add `:Z` to the mounts.
- `podman compose` delegates to a compose provider. If none is installed, document `pip install podman-compose` in the README. Don't switch to Docker.

### B.2 Mock realms: `scripts/sync-realms.mjs` → `dev/keycloak/realms/*.json`

- **Source of truth:** `../Halsa.Backend/docker/keycloak/halsa-realm.json` and `halsa-pacientes-realm.json`. The script transforms them, and you **commit the output** so the repo works without the backend sibling. `npm run kc:sync -- --check` fails if the committed files drift from the source. Never hand-edit the generated files.
- **`halsa` transformations:**
  - **Remove** every client whose `clientId` starts with `int-`, and every user whose username starts with `service-account-`. They need mTLS certificates and environment placeholders.
  - **Keep everything else:** roles and composites, users (ids/subs, credentials, **OTP secrets**, attributes `actor_tipo`/`tenant_id`/`ips_id`/`tipo_documento`/`numero_documento`/`rethus`), client scopes (`halsa-claims`, `acr`), the **`browser-loa`** flows and the ACR→LoA map (without them there's no step-up), and `halsa-dev-cli`.
  - **Set** `loginTheme: "halsa"`, `internationalizationEnabled: true`, `supportedLocales: ["es"]`, `defaultLocale: "es"`.
  - **Set on `halsa-backoffice`:** `redirectUris: ["http://localhost:3000/*"]`, `webOrigins: ["http://localhost:3000"]`, and `attributes["post.logout.redirect.uris"] = "http://localhost:3000/*"`.
  - **Fail** if any `HALSA_` environment placeholder remains. Leave Keycloak's own `client_id`-style expressions untouched.
- **`halsa-pacientes` transformations:** set `loginTheme: "halsa-pacientes"` and the same i18n fields. Keep `registrationAllowed`, `paciente.dev` and the clients as they are.
- **Output:** the script prints a summary (clients kept/removed, users, theme), so drift is visible.

### B.3 npm scripts

The logic lives in Node scripts, so these run the same from PowerShell and Git Bash.

| Script | Command |
| --- | --- |
| `kc:sync` | `node scripts/sync-realms.mjs` |
| `kc:up` | `npm run theme:css`, then `podman compose -f dev/keycloak/compose.yaml up -d`, then `node scripts/wait-keycloak.mjs`. The wait script polls `http://localhost:8180/realms/halsa/.well-known/openid-configuration` (timeout 120 s). |
| `kc:down` | `podman compose -f dev/keycloak/compose.yaml down` |
| `kc:reset` | `kc:down`, then `kc:up` (fresh import) |
| `kc:logs` | `podman compose -f dev/keycloak/compose.yaml logs -f keycloak` |

### B.4 What it's for

- **Theme work:** run `npm run kc:up` + `npm run theme:watch`, then open:
  - `http://localhost:8180/realms/halsa/account`, the staff login;
  - `http://localhost:8180/realms/halsa-pacientes/account`, the patient login → "Crear cuenta".
  - **OTP page:** log in as `calificador.arla` or `medico.ips` (secrets in §6.1).
  - **OTP enrollment page:** in the admin console (`http://localhost:8180/admin`, `admin`/`admin`), add the required action *Configure OTP* to `analista.arla`, then log in.
  - **Expired page:** use the browser back button after a login.
- **Backoffice mock mode** (§9): a real OIDC login + step-up against this Keycloak, with the API mocked. The Playwright permission-matrix and step-up specs can run here, without the backend.
- **Limits:**
  - Its issuer is `http://localhost:8180`, so the real API rejects its tokens. That's by design: mock mode uses the mock adapter.
  - The BFF is configured against the backend's Keycloak (8080), so the **portal** doesn't use this Keycloak. Portal mock mode needs no identity, and the patient theme is previewed through the account console URL above.

### B.5 `.gitignore` additions

`keycloak-theme/.reference/`, `keycloak-theme/themes/**/resources/css/halsa.css`, `keycloak-theme/themes/**/resources/fonts/`, `dist/`.
