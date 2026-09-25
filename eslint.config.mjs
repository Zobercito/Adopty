// Adopty Fase 0 — ESLint flat config (v10).
// Sin typescript-eslint ni eslint-plugin-astro instalados, el lint cubre solo
// JS plano; TS/Astro lo cubre el compilador estricto (tsconfig extends astro/strict + astro build).
// Al instalar plugins, ampliar `files` y `languageOptions.parser`.
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', '.astro/**', '.vercel/**', 'node_modules/**', 'public/**'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-unused-vars': 'off', // TS/Astro lo cubre el compilador estricto
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
];
