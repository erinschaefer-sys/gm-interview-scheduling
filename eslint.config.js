import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'dist-server', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // The only outbound path is the app's own /api via src/api/axios-instance.ts.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/axios-instance.ts', 'src/**/*.test.tsx'],
    rules: {
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Call the app API through src/api/axios-instance.ts.' }],
      'no-restricted-imports': ['error', { paths: [{ name: 'axios', message: 'Import api from src/api/axios-instance.ts.' }] }],
    },
  },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
);
