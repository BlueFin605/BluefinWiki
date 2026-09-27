import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  // Capped rather than left at Playwright's default (CPU-based, often 6-8+
  // here): each worker's pageTree fixture fires 5 POST /pages calls at
  // setup, once per worker (it's worker-scoped, so every spec file that
  // worker runs afterwards reuses the same fixture instance) — so concurrent
  // fixture-setup load against the local Express+LocalStack dev backend is
  // bounded by the worker COUNT, not by how many spec files exist. Running
  // the default (uncapped) worker count produced socket hang up errors
  // during fixture setup (Task 6). 3 keeps real parallelism without the
  // backend falling over; override with PW_WORKERS if your machine can (or
  // can't) take more.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 3,
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
