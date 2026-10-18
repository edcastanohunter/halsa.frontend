// @ts-check
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import path from 'node:path';

const NO_MOCKS = {
  group: ['**/mocks/**', '**/mocks'],
  message: 'Mock fixtures must never be imported in production code.',
};
// Plan §3: only clinico and dictamen-pcl may reach clinical endpoints.
const CLINICAL_FEATURES = new Set(['clinico', 'dictamen-pcl']);
const FEATURE_RE = /\/projects\/[^/]+\/src\/app\/features\/([^/]+)(?:\/|$)/;

// Resolves relative imports against the importing file, so `../clinico/...` is caught too.
const featureBoundaries = {
  meta: {
    type: 'problem',
    messages: {
      crossFeature:
        'Features never import from other features ("{{from}}" → "{{to}}"). Move shared code to shared/ or a lib.',
      clinical:
        'Clinical data-access is isolated: only features/clinico and features/dictamen-pcl may import it.',
    },
    schema: [],
  },
  create(context) {
    const file = context.filename.replaceAll('\\', '/');
    const from = FEATURE_RE.exec(file)?.[1];
    const check = (node) => {
      const source = node.source;
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
      if (!source.value.startsWith('.')) return;
      const target = path.posix.join(path.posix.dirname(file), source.value);
      const to = FEATURE_RE.exec(target)?.[1];
      if (!to || to === from) return;
      if (from) {
        context.report({ node: source, messageId: 'crossFeature', data: { from, to } });
      } else if (CLINICAL_FEATURES.has(to) && /\/data-access(?:\/|$)/.test(target)) {
        context.report({ node: source, messageId: 'clinical' });
      }
    };
    return {
      ImportDeclaration: check,
      ImportExpression: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
    };
  },
};

export default tseslint.config(
  {
    ignores: ['dist/**', '.angular/**', 'out-tsc/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    plugins: { halsa: { rules: { 'feature-boundaries': featureBoundaries } } },
    rules: {
      'halsa/feature-boundaries': 'error',
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['app', 'halsa'], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['app', 'halsa'], style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      'no-console': 'error',
      'no-restricted-imports': ['error', { patterns: [NO_MOCKS] }],
    },
  },
  {
    files: ['**/*.spec.ts', 'projects/*/src/mocks/**', 'e2e/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
