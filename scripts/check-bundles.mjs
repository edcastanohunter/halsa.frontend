// Post-build gate (plan §9, §10.1). Angular budgets measure raw size, while the plan's budgets
// are gzip, so this script enforces them on the production output and fails on overflow.
// It also fails if any production chunk contains dev-only markers (FORBIDDEN).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGETS = {
  backoffice: { initial: 300 * KB, lazy: 150 * KB },
  portal: { initial: 200 * KB, lazy: 150 * KB },
};

// Dev-only code that must never reach production: mock fixtures and the /_ui showcase.
const FORBIDDEN = ['__mock', 'halsa-ui-showcase'];

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const fmt = (bytes) => `${(bytes / KB).toFixed(1)} kB`;

let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`  ✗ ${message}`);
};

// Both apps by default; the Dockerfiles pass the one they build.
const apps = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(BUDGETS);

for (const app of apps) {
  const budget = BUDGETS[app];
  if (!budget) {
    fail(`unknown app "${app}" (expected ${Object.keys(BUDGETS).join(' or ')})`);
    continue;
  }
  const dir = join('dist', app, 'browser');
  if (!existsSync(dir)) {
    fail(`${app}: ${dir} not found, run the production build first`);
    continue;
  }

  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const initial = new Set(
    [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]),
  );
  const assets = readdirSync(dir).filter((f) => /\.(js|css)$/.test(f));

  let initialSize = 0;
  console.log(`${app}:`);
  for (const file of assets) {
    const path = join(dir, file);
    const content = readFileSync(path, 'utf8');
    for (const marker of FORBIDDEN) {
      if (content.includes(marker)) fail(`${file} contains "${marker}"`);
    }
    const size = gz(path);
    if (initial.has(file)) {
      initialSize += size;
    } else if (file.endsWith('.js') && size > budget.lazy) {
      fail(`lazy chunk ${file} is ${fmt(size)} gz (max ${fmt(budget.lazy)})`);
    }
  }

  if (initialSize > budget.initial) {
    fail(`initial bundle is ${fmt(initialSize)} gz (max ${fmt(budget.initial)})`);
  } else {
    console.log(`  ✓ initial ${fmt(initialSize)} gz (max ${fmt(budget.initial)})`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`Bundle budgets OK, no ${FORBIDDEN.join(' / ')} in production output.`);
