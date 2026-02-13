import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.integration.test.ts'], // Only run integration tests
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000,
    pool: 'forks', // Use forks instead of threads to avoid memory sharing issues
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in a single fork to reduce memory usage
        execArgv: ['--max-old-space-size=8192'], // Pass memory limit to worker
      },
    },
    maxConcurrency: 5, // Limit concurrent tests
  },
});
