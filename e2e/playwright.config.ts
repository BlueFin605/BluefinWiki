import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  // Capped rather than left at Playwright's default (CPU-based, often 6-8+
  // here): each spec file's worker-scoped pageTree fixture fires 5 POST
  // /pages calls at setup, and running every file's workers at once against
  // the local Express+LocalStack dev backend produced socket hang up errors
  // during fixture setup (Task 6, growing worse as more spec files are
  // added). 3 keeps real parallelism without the backend falling over.
  workers: 3,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium' }],
});
