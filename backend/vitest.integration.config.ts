import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.integration.test.ts'], // Only run integration tests
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000,
  },
});
