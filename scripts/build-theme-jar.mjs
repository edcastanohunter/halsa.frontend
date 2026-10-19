// Packages the Keycloak login themes into dist/keycloak-theme/halsa-keycloak-theme.jar
// (plan Appendix A.4). Run through `npm run theme:build`, which builds the CSS and fonts first.
//
// Layout inside the JAR, as Keycloak expects it:
//   META-INF/keycloak-themes.json
//   theme/<name>/login/...
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const THEME_ROOT = 'keycloak-theme';
const THEMES = ['halsa', 'halsa-pacientes'];
const OUTPUT = 'dist/keycloak-theme/halsa-keycloak-theme.jar';
// Generated files the JAR can't do without; theme:css must have run.
const REQUIRED = [
  'themes/halsa/login/resources/css/halsa.css',
  'themes/halsa/login/resources/fonts/plus-jakarta-sans-latin-400-normal.woff2',
];

for (const file of REQUIRED) {
  if (!existsSync(join(THEME_ROOT, file))) {
    console.error(`Missing ${join(THEME_ROOT, file)}. Run npm run theme:css first.`);
    process.exit(1);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// A fixed timestamp keeps the JAR byte-identical between builds of the same sources.
const mtime = new Date('2026-01-01T00:00:00Z');
const entries = {
  'META-INF/keycloak-themes.json': [
    readFileSync(join(THEME_ROOT, 'META-INF/keycloak-themes.json')),
    { mtime },
  ],
};
for (const theme of THEMES) {
  const base = join(THEME_ROOT, 'themes', theme);
  for (const file of walk(base)) {
    const path = `theme/${theme}/${relative(base, file).split(sep).join('/')}`;
    entries[path] = [readFileSync(file), { mtime }];
  }
}

mkdirSync('dist/keycloak-theme', { recursive: true });
const jar = zipSync(entries, { level: 9 });
writeFileSync(OUTPUT, jar);
console.log(
  `Wrote ${OUTPUT} (${Object.keys(entries).length} files, ${(jar.length / 1024).toFixed(1)} kB)`,
);
