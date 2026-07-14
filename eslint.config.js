// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly' },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  prettier,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
    rules: {
      // Build tooling shells out to git deliberately — not attacker-influenced input.
      'sonarjs/no-os-command-from-path': 'off',
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 5],
      'sonarjs/cognitive-complexity': ['error', 10],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
