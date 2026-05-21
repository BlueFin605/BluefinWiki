import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'], // Only include .test.ts files
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts', // Exclude integration tests from default run
      '**/*.integration.test.ts.skip', // Also exclude renamed integration tests
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    singleFork: true,
    isolate: false,
    execArgv: ['--max-old-space-size=8192'],
  },
});
