#!/usr/bin/env node

import { spawn } from 'child_process';

const port = process.env.PORT || '5173';
const args = ['serve', `--port=${port}`];

const ng = spawn('ng', args, {
  stdio: 'inherit',
  shell: true
});

ng.on('exit', (code) => {
  process.exit(code || 0);
});

ng.on('error', (err) => {
  console.error('Failed to start ng serve:', err);
  process.exit(1);
});
