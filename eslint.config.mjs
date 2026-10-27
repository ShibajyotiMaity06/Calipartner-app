import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import fs from 'fs';
import path from 'path';

let baselineKeySet = new Set();
try {
  const data = JSON.parse(
    fs.readFileSync(path.resolve('docs/ui/baseline_violations.json'), 'utf8'),
  );
  baselineKeySet = new Set(data.map((v) => `${v.file}:${v.type}:${v.matched}`));
} catch {
  // If baseline json does not exist yet, allow
}

const uiTokensPlugin = {
  rules: {
    'no-hardcoded-styles': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce CaliPartner token usage outside packages/ui (Rule U1)',
        },
        schema: [],
      },
      create(context) {
        const rawFilename = context.filename ?? context.getFilename?.() ?? '';
        const rel = path.relative(process.cwd(), rawFilename).replace(/\\/g, '/');

        // Allow packages/ui, packages/core, tests, configs, and non-app code
        if (
          rel.startsWith('packages/ui') ||
          rel.startsWith('packages/core') ||
          rel.includes('test') ||
          rel.includes('spec') ||
          rel.endsWith('.config.ts') ||
          rel.endsWith('.config.js') ||
          rel.endsWith('.config.mjs')
        ) {
          return {};
        }

        const hexRegex = /#([0-9a-fA-F]{3,8})\b/;

        return {
          Literal(node) {
            if (typeof node.value === 'string') {
              const m = hexRegex.exec(node.value);
              if (m) {
                const key = `${rel}:hex:${m[0]}`;
                if (!baselineKeySet.has(key)) {
                  context.report({
                    node,
                    message: `Disallowed new hard-coded hex color "${m[0]}" outside packages/ui. Use theme tokens from @calipartner/ui.`,
                  });
                }
              }
            }
          },
          Property(node) {
            const propName = node.key?.name ?? node.key?.value;
            if (propName === 'fontFamily' && node.value?.type === 'Literal') {
              const matched = `fontFamily: '${node.value.value}'`;
              const key = `${rel}:fontFamily:${matched}`;
              if (!baselineKeySet.has(key)) {
                context.report({
                  node,
                  message: `Disallowed new hard-coded fontFamily "${node.value.value}". Use type tokens or Text helper from @calipartner/ui.`,
                });
              }
            } else if (
              typeof propName === 'string' &&
              /border(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius/.test(propName) &&
              node.value?.type === 'Literal' &&
              typeof node.value.value === 'number'
            ) {
              const matched = `${propName}: ${node.value.value}`;
              const key = `${rel}:radius:${matched}`;
              if (!baselineKeySet.has(key)) {
                context.report({
                  node,
                  message: `Disallowed new raw numeric radius "${node.value.value}". Use radius tokens from @calipartner/ui.`,
                });
              }
            } else if (
              (propName === 'shadowRadius' || propName === 'elevation') &&
              node.value?.type === 'Literal' &&
              typeof node.value.value === 'number'
            ) {
              const matched = `${propName}: ${node.value.value}`;
              const key = `${rel}:shadow:${matched}`;
              if (!baselineKeySet.has(key)) {
                context.report({
                  node,
                  message: `Disallowed new raw numeric elevation/shadow "${node.value.value}". Elevation is made with surface steps (s1->s2->s3), not shadows.`,
                });
              }
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: [
      '.cache/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      '**/coverage/**',
      'app/android/**',
      'app/ios/**',
      'app/assets/**',
      'datasets/**',
      'supabase/**',
      'docs/**',
      '.agents/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, __DEV__: 'readonly' } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'ui-tokens': uiTokensPlugin },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'ui-tokens/no-hardcoded-styles': 'error',
    },
  },
  {
    // The logger and CLI scripts are allowed to use console and node globals.
    files: ['app/src/lib/logger.ts', 'scripts/**/*.{ts,js,mjs}'],
    languageOptions: { globals: { ...globals.node, console: 'readonly', process: 'readonly' } },
    rules: { 'no-console': 'off' },
  },
  {
    files: [
      '*.config.{js,ts,mjs}',
      '**/*.config.{js,ts,mjs}',
      'app/babel.config.js',
      'app/metro.config.js',
    ],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
