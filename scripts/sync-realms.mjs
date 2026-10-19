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

  const { realm, summary } = transform(JSON.parse(readFileSync(sourcePath, 'utf8')));
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
