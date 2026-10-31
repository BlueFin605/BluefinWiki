// Loads every Lambda entry from dist/ and checks it exports a handler; for the router it
// also loads every lazily imported route handler chunk. Run after `npm run build`.
// Pass 1 (default) loads in development mode; pass 2 (re-run of this script in a child process
// with --production) loads every entry again with NODE_ENV=production and dummy Cognito config
// so load-time failures in the production-only paths (e.g. auth.ts verifier setup) are caught.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LAMBDA_ENTRIES } from './lambda-entries.mjs';

const productionPass = process.argv.includes('--production');
if (productionPass) {
  process.env.NODE_ENV = 'production';
  process.env.COGNITO_USER_POOL_ID = 'ap-southeast-2_dummy';
  process.env.COGNITO_CLIENT_ID = 'dummyclientid';
} else {
  process.env.NODE_ENV ??= 'development'; // auth.ts skips Cognito verifier setup in local mode
}
process.env.AWS_REGION ??= 'ap-southeast-2';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
for (const entry of LAMBDA_ENTRIES) {
  try {
    const mod = await import(pathToFileURL(path.join(root, 'dist', `${entry}.js`)).href);
    if (typeof mod.handler !== 'function') throw new Error('no exported handler function');
    if (entry === 'router/lambda') {
      for (const route of mod.routes) {
        if (typeof (await route.load()) !== 'function') throw new Error(`${route.method} ${route.pattern}: handler is not a function`);
      }
      console.log(`ok ${entry} (${mod.routes.length} routes)`);
    } else {
      console.log(`ok ${entry}`);
    }
  } catch (error) {
    failures++;
    console.error(`FAIL ${entry}: ${error instanceof Error ? error.message : error}`);
  }
}
if (failures > 0) {
  console.error(`${failures} Lambda entr${failures === 1 ? 'y' : 'ies'} failed to load from dist/`);
  process.exit(1);
}
console.log(`All ${LAMBDA_ENTRIES.length} Lambda entries load from dist/ (${productionPass ? 'production' : 'development'} mode)`);

if (!productionPass) {
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--production'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (child.status !== 0) process.exit(child.status ?? 1);
}
