// Generates the local Keycloak mock realms (plan Appendix B.2) from the backend's realm JSON.
//
//   node scripts/sync-realms.mjs           writes dev/keycloak/realms/*.json
//   node scripts/sync-realms.mjs --check   fails when the committed files drift from the source
//
// The output is committed so the repo works without the ../Halsa.Backend sibling. Never hand-edit it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SOURCE_DIR = '../Halsa.Backend/docker/keycloak';
const OUTPUT_DIR = 'dev/keycloak/realms';
const BACKOFFICE_ORIGIN = 'http://localhost:3000';
const I18N = {
  internationalizationEnabled: true,
  supportedLocales: ['es'],
  defaultLocale: 'es',
};

const check = process.argv.includes('--check');

// Realm fixes the backend still has to apply to docker/keycloak/halsa-realm.json and
// deploy/keycloak/halsa.prod.json (gaps G16 and G17, docs/backend/realm-g16-g17.md). They are applied
// here exactly as they would be in prod, and are no-ops once the source has them; remove them then.
//
// G16: Keycloak 25+'s `basic` client scope is missing, so tokens carry neither `sub` nor
// `auth_time`, both of which the API reads (CurrentUser, StepUp).
const BASIC_SCOPE = {
  name: 'basic',
  description: 'OpenID Connect scope for add all basic claims to the token',
  protocol: 'openid-connect',
  attributes: { 'include.in.token.scope': 'false', 'display.on.consent.screen': 'false' },
  protocolMappers: [
    {
      name: 'auth_time',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-usersessionmodel-note-mapper',
      consentRequired: false,
      config: {
        'user.session.note': 'AUTH_TIME',
        'introspection.token.claim': 'true',
        'userinfo.token.claim': 'true',
        'id.token.claim': 'true',
        'lightweight.claim': 'true',
        'access.token.claim': 'true',
        'claim.name': 'auth_time',
        'jsonType.label': 'long',
      },
    },
    {
      name: 'sub',
      protocol: 'openid-connect',
      protocolMapper: 'oidc-sub-mapper',
      consentRequired: false,
      config: { 'introspection.token.claim': 'true', 'access.token.claim': 'true' },
    },
  ],
};

function withBasicScope(realm) {
  if ((realm.clientScopes ?? []).some((s) => s.name === 'basic')) return realm;
  return {
    ...realm,
    clientScopes: [...(realm.clientScopes ?? []), BASIC_SCOPE],
    defaultDefaultClientScopes: [...(realm.defaultDefaultClientScopes ?? []), 'basic'],
    clients: realm.clients.map((c) =>
      c.defaultClientScopes
        ? { ...c, defaultClientScopes: [...c.defaultClientScopes, 'basic'] }
        : c,
    ),
  };
}

// G17: `browser-loa` starts at the level subflows, so a step-up can't see the existing session and
// asks for the password again before the OTP. Keycloak's step-up flow puts Cookie first, as an
// alternative to the level subflows: Cookie skips the login while the session meets the requested
// level, and otherwise `loa-nivel-1` (10 h) lets the subflows ask only for the OTP.
const COOKIE_STEP = {
  authenticator: 'auth-cookie',
  requirement: 'ALTERNATIVE',
  priority: 10,
  authenticatorFlow: false,
  autheticatorFlow: false,
  userSetupAllowed: false,
};

function withCookieStep(realm) {
  const flujo = (realm.authenticationFlows ?? []).find((f) => f.alias === realm.browserFlow);
  if (!flujo || flujo.authenticationExecutions.some((e) => e.authenticator === 'auth-cookie')) {
    return realm;
  }
  const niveles = flujo.authenticationExecutions.map((e) => ({
    ...e,
    requirement: 'ALTERNATIVE',
    priority: e.priority + COOKIE_STEP.priority,
  }));
  return {
    ...realm,
    authenticationFlows: realm.authenticationFlows.map((f) =>
      f === flujo ? { ...f, authenticationExecutions: [COOKIE_STEP, ...niveles] } : f,
    ),
  };
}

const isIntegrationClient = (clientId) => clientId.startsWith('int-');

function transformHalsa(realm) {
  const removedClients = realm.clients.filter((c) => isIntegrationClient(c.clientId));
  const removedUsers = realm.users.filter((u) => u.username.startsWith('service-account-'));
  const clients = realm.clients
    .filter((c) => !isIntegrationClient(c.clientId))
    .map((c) =>
      c.clientId === 'halsa-backoffice'
        ? {
            ...c,
            redirectUris: [`${BACKOFFICE_ORIGIN}/*`],
            webOrigins: [BACKOFFICE_ORIGIN],
            attributes: { ...c.attributes, 'post.logout.redirect.uris': `${BACKOFFICE_ORIGIN}/*` },
          }
        : c,
    );

  const out = {
    ...realm,
    ...I18N,
    loginTheme: 'halsa',
    // G25: `otpPolicyCodeReusable` defaults to false, so a validated OTP goes through the
    // `singleUseStore` replay check; in this dev Keycloak that rejects even the first valid code,
    // breaking the acr=2 step-up. Make codes reusable in the mock realm only (prod keeps the
    // single-use default).
    otpPolicyCodeReusable: true,
    clients,
    users: realm.users.filter((u) => !removedUsers.includes(u)),
  };

  // Role, scope and mapping entries owned by the removed clients would fail the import.
  if (out.roles?.client) {
    out.roles = {
      ...out.roles,
      client: Object.fromEntries(
        Object.entries(out.roles.client).filter(([id]) => !isIntegrationClient(id)),
      ),
    };
  }
  if (out.clientScopeMappings) {
    out.clientScopeMappings = Object.fromEntries(
      Object.entries(out.clientScopeMappings)
        .filter(([id]) => !isIntegrationClient(id))
        .map(([id, mappings]) => [
          id,
          mappings.filter((m) => !m.client || !isIntegrationClient(m.client)),
        ]),
    );
  }
  if (out.scopeMappings) {
    out.scopeMappings = out.scopeMappings.filter(
      (m) => !m.client || !isIntegrationClient(m.client),
    );
  }

  return {
    realm: out,
    summary: {
      kept: clients.map((c) => c.clientId),
      removed: removedClients.map((c) => c.clientId),
      users: out.users.map((u) => u.username),
      removedUsers: removedUsers.map((u) => u.username),
    },
  };
}

function transformPacientes(realm) {
  const out = { ...realm, ...I18N, loginTheme: 'halsa-pacientes' };
  return {
    realm: out,
    summary: {
      kept: out.clients.map((c) => c.clientId),
      removed: [],
      users: (out.users ?? []).map((u) => u.username),
      removedUsers: [],
    },
  };
}

const REALMS = [
  { file: 'halsa-realm.json', transform: transformHalsa },
  { file: 'halsa-pacientes-realm.json', transform: transformPacientes },
];

let drift = false;
for (const { file, transform } of REALMS) {
  const sourcePath = join(SOURCE_DIR, file);
  const outputPath = join(OUTPUT_DIR, file);
  if (!existsSync(sourcePath)) {
    console.error(
      `Source not found: ${sourcePath}. Is ../Halsa.Backend checked out next to this repo?`,
    );
    process.exit(1);
  }

  const { realm, summary } = transform(
    withCookieStep(withBasicScope(JSON.parse(readFileSync(sourcePath, 'utf8')))),
  );
  const json = `${JSON.stringify(realm, null, 2)}\n`;

  // Keycloak's own expressions (e.g. `${client_id}`) are fine; our environment placeholders are not.
  const placeholders = [...json.matchAll(/\$\{(HALSA_[A-Z0-9_]*)/g)].map((m) => m[1]);
  if (placeholders.length > 0) {
    console.error(
      `${file}: environment placeholders remain: ${[...new Set(placeholders)].join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`${realm.realm} (theme: ${realm.loginTheme})`);
  console.log(`  clients kept:    ${summary.kept.join(', ')}`);
  console.log(`  clients removed: ${summary.removed.join(', ') || '-'}`);
  console.log(`  users:           ${summary.users.join(', ')}`);
  if (summary.removedUsers.length > 0) {
    console.log(`  users removed:   ${summary.removedUsers.join(', ')}`);
  }

  if (check) {
    const committed = existsSync(outputPath)
      ? readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n')
      : '';
    if (committed !== json) {
      console.error(`  DRIFT: ${outputPath} differs from the source. Run npm run kc:sync.`);
      drift = true;
    }
  } else {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, json);
  }
}

if (drift) process.exit(1);
