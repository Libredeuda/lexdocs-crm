import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Config enfocada en CORRECCIÓN, no en estilo. El objetivo es frenar bugs como
// claves duplicadas en objetos, hooks mal usados, listas sin key y variables
// muertas — no pelear con los estilos inline del proyecto.
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'server/**',          // pendiente de decisión (código muerto)
      'supabase/**',        // Edge Functions corren en Deno (otro entorno/globals)
      'public/**',
      'libertadhipotecaria/**',
      '*.config.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Correctness (errores reales)
      'no-dupe-keys': 'error',
      'react/jsx-uses-vars': 'error',   // no marcar como muerto lo usado en JSX
      'react/jsx-uses-react': 'off',    // new JSX transform: no hace falta importar React
      'react-hooks/rules-of-hooks': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'no-cond-assign': 'error',
      'no-unsafe-optional-chaining': 'error',
      // Avisos (deuda, no bloquean)
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Desactivados (no aplican a este stack)
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars-experimental': 'off',
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-undef': 'off', // vitest inyecta describe/it/expect (globals: true)
    },
  },
];
