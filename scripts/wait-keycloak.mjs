// Waits until the local Keycloak (plan Appendix B.3) serves the halsa realm's discovery document.
const URL_TO_POLL = 'http://localhost:8180/realms/halsa/.well-known/openid-configuration';
const TIMEOUT_MS = 120_000;
const INTERVAL_MS = 2_000;

const deadline = Date.now() + TIMEOUT_MS;
process.stdout.write('Waiting for Keycloak at http://localhost:8180 ');

while (Date.now() < deadline) {
  try {
    const response = await fetch(URL_TO_POLL);
    if (response.ok) {
      console.log('\nKeycloak is ready:');
      console.log('  staff login:   http://localhost:8180/realms/halsa/account');
      console.log('  patient login: http://localhost:8180/realms/halsa-pacientes/account');
      console.log('  admin console: http://localhost:8180/admin (admin / admin)');
      process.exit(0);
    }
  } catch {
    // Not listening yet.
  }
  process.stdout.write('.');
  await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
}

console.error(`\nKeycloak did not answer within ${TIMEOUT_MS / 1000} s. Check npm run kc:logs.`);
process.exit(1);
