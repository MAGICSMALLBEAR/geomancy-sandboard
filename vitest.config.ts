import { defineConfig } from 'vitest/config';

// Only tests/unit: the Node runner owns tests/*.test.mjs, Playwright owns tests/e2e.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
