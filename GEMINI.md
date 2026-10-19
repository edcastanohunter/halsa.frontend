# Halsa.Frontend: agent rules

The full plan is in `prompt/02_handoff-frontend.md`. Read it before any task. It supersedes `prompt/01_Base.md`.

## What this repo is

There are two Angular 21 apps in one workspace:

- `projects/backoffice`: ARL/IPS staff. It uses OIDC + PKCE against Keycloak and sends Bearer tokens to `/v1`.
- `projects/portal`: patients. It goes through the BFF only, with a cookie session and `X-Halsa-Csrf: 1`, and holds no tokens.

Shared code lives in `libs/ui`, `libs/core` and `libs/api-types`. The backend is `../Halsa.Backend`, which is read-only for you.

## Non-negotiables

- Angular 21: standalone, zoneless, signals, OnPush, `inject()`, new control flow. **No SSR.** No NgModules. No service worker.
- Tailwind v4 + Spartan UI (helm components live in `libs/ui`). Lucide icons. No Material or PrimeNG.
- Mobile first: design at 375 px, then scale up. Touch targets ≥ 44 px. WCAG 2.2 AA.
- UI copy in Spanish (es-CO). Display time zone `America/Bogota`. Never parse a `YYYY-MM-DD` date with `new Date()`.
- Never invent endpoints, fields, enums, permissions or headers. The contract is in plan §4. Missing features are gaps (plan §13), so use the workaround or hide the feature.
- Navigation, tabs, buttons and widgets come from `permisos` (`GET /v1/identidad/yo`). The backend stays the authority.
- Clinical data (🔒 endpoints) is never stored, cached, logged or put in URLs. It's dropped on route leave. A step-up (`acr=2`) gate goes *before* any clinical form.
- Never use `localStorage` for anything but UI preferences, never use `innerHTML` with server data, never use `console.*` in app code.
- Domain names follow the API's Spanish (`caso`, `plazo`, `incapacidad`, …). Technical suffixes are in English. Code comments are in English.
- Features never import from other features.

## Keycloak

- The login pages use our own theme in `keycloak-theme/` (plan Appendix A). It's FreeMarker on `parent=base`, styled through the `kc*Class` mappings with the same Tailwind tokens as the apps. Never rename form fields from the base templates.
- A local Keycloak 26.4 runs in **Podman** at `http://localhost:8180` (plan Appendix B), with mock realms generated from the backend's realm JSON. Use Podman, not Docker.

## Commands

`npm run lint` · `npm run test` · `npm run build` · `npm run e2e` · `npm run e2e:update` (refresh visual baselines) · `npm run api:types`

`npm run kc:up` / `kc:down` / `kc:reset` / `kc:logs` / `kc:sync` · `npm run theme:watch` / `theme:build`

Backoffice against local Keycloak + mocked API: `ng serve backoffice --configuration mock`

Dev servers:

- `ng serve backoffice --port 3000`, proxying `/v1` → `:5600`;
- `ng serve portal --port 4300 --ssl`, proxying `/paciente` → `https://localhost:5610`.

## Workflow

Work milestone by milestone (plan §12). Stop after each one and report in the plan §15 format.

Every milestone that changes what users see ships visual evidence at 375 px and 1440 px, light and dark: a Playwright spec with `toHaveScreenshot` baselines (`e2e/<spec>.spec.ts-snapshots/`) plus report copies in `docs/reportes/<milestone>/`, linked from the §15 report. Look at the images before reporting.

Visual baselines follow the styles. After changing tokens, Tailwind classes, a helm primitive or a Halsa component:

1. Run `npm run e2e` and look at every diff it reports (`playwright-report/`).
2. If the change is intended, run `npm run e2e:update`. If `libs/ui/src/tokens.css` or `keycloak-theme/` changed, also run `npm run e2e:theme -- --update-snapshots` (needs `npm run kc:up`).
3. Commit the code, the baselines and the refreshed `docs/reportes/` images together.
