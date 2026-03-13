import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    env: {
      // Valid placeholder values so Cognito modules load without error during tests.
      // Real values are required at build/deploy time via CI environment variables.
      VITE_COGNITO_USER_POOL_ID: 'us-east-1_testPoolId0',
      VITE_COGNITO_CLIENT_ID: 'testclientid1234567890ab',
      // Ensure auth bypass is never active during tests, even if set in .env.local
      VITE_DISABLE_AUTH: 'false',
    },
  },
});
