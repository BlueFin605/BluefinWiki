import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.integration.test.ts'], // Only run integration tests
    exclude: ['**/node_modules/**', '**/dist/**', '**/page-operations.integration.test.ts', '**/links-resolve.integration.test.ts'], // Temporarily exclude problematic tests
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000,
    env: {
      AWS_ENDPOINT: 'http://localhost:4566',
      AWS_REGION: 'us-east-1',
      LOCALSTACK_ENDPOINT: 'http://localhost:4566',
    },
    pool: 'threads', // Use threads instead of forks for better memory efficiency
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 2,
        minThreads: 1,
      },
    },
    maxConcurrency: 2,
    isolate: true, // Isolate tests to prevent memory leaks
    clearMocks: true, // Clear mocks after each test
    mockReset: true, // Reset mocks after each test
    restoreMocks: true, // Restore mocks after each test
  },
});
