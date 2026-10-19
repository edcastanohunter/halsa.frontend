// Copies the self-hosted fonts the Keycloak theme CSS references (../fonts/*.woff2) out of
// @fontsource, next to the generated halsa.css (plan Appendix A.4). The output is gitignored.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TARGET = 'keycloak-theme/themes/halsa/login/resources/fonts';
const FONTS = [
  ['@fontsource/plus-jakarta-sans', 'plus-jakarta-sans', [400, 500, 600, 700]],
  ['@fontsource/jetbrains-mono', 'jetbrains-mono', [400, 500]],
];

mkdirSync(TARGET, { recursive: true });
let copied = 0;
for (const [pkg, family, weights] of FONTS) {
  for (const weight of weights) {
    const file = `${family}-latin-${weight}-normal.woff2`;
    copyFileSync(join('node_modules', pkg, 'files', file), join(TARGET, file));
    copied++;
  }
}
console.log(`Copied ${copied} fonts to ${TARGET}`);
