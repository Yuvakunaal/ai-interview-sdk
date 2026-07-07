// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: [
      'packages/react/**/*.{ts,tsx}',
      'packages/dashboard/**/*.{ts,tsx}',
      'packages/landing/**/*.{ts,tsx}',
    ],
    ...react.configs.flat.recommended,
    // Not 'detect': eslint-plugin-react@7.37.5's auto-detection still calls
    // ESLint's removed context.getFilename() method under ESLint 10 and
    // crashes. Pin the version explicitly to sidestep that code path.
    settings: { react: { version: '19.2.7' } },
  },
  {
    files: [
      'packages/react/**/*.{ts,tsx}',
      'packages/dashboard/**/*.{ts,tsx}',
      'packages/landing/**/*.{ts,tsx}',
    ],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs['recommended-latest'].rules,
  },
  {
    files: [
      'packages/react/**/*.{ts,tsx}',
      'packages/dashboard/**/*.{ts,tsx}',
      'packages/landing/**/*.{ts,tsx}',
    ],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: [
      'packages/react/**/*.{ts,tsx}',
      'packages/dashboard/**/*.{ts,tsx}',
      'packages/landing/**/*.{ts,tsx}',
    ],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  prettier,
);
