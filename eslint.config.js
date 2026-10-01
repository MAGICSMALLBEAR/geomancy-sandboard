import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'playwright-report', 'test-results', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Private text must not reach the console; see AGENTS.md.
      'no-console': 'error',
      // Full-width spaces are ordinary punctuation in Chinese UI text.
      'no-irregular-whitespace': ['error', { skipJSXText: true, skipStrings: true, skipTemplates: true }],
    },
  },
  {
    files: ['tests/**/*.{ts,mjs}', 'scripts/**/*.mjs', '*.config.{ts,js}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
