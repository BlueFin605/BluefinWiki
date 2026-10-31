// Bundles the Lambda entry points into dist/ keeping the <dir>/<file>.handler layout
// that UnifiedStack.cs and the deploy workflow's update-function-code loop expect.
import { build } from 'esbuild';
import { readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAMBDA_ENTRIES } from './lambda-entries.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });

const result = await build({
  absWorkingDir: root,
  entryPoints: LAMBDA_ENTRIES.map((entry) => `src/${entry}.ts`),
  outdir: 'dist',
  outbase: 'src',
  entryNames: '[dir]/[name]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true, // each route's await import() becomes a chunk loaded on first use
  format: 'esm',
  platform: 'node',
  target: 'node24',
  sourcemap: true,
  metafile: true,
  logLevel: 'warning',
  // Bundled CommonJS dependencies call require(); ESM output has none, so give every file one.
  banner: {
    js: "import { createRequire as __bfCreateRequire } from 'node:module'; const require = __bfCreateRequire(import.meta.url);",
  },
});

// local-server.ts and its Express/ws stack are local-dev only and must never reach a Lambda.
const forbidden = /(^|\/)src\/local-server\.ts$|(^|\/)src\/local-adapter\.ts$|(^|\/)src\/realtime\/local-ws\.ts$|node_modules\/(express|cors|ws)\//;
const leaked = Object.keys(result.metafile.inputs).filter((input) => forbidden.test(input));
if (leaked.length > 0) {
  console.error('Local-only modules leaked into the Lambda bundle:', leaked);
  process.exit(1);
}

// Lambda's Node runtime reads "type" from the nearest package.json to load .js as ESM.
await writeFile(path.join(dist, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n');

async function dirSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await stat(p)).size;
  }
  return total;
}
console.log(`Bundled ${LAMBDA_ENTRIES.length} Lambda entries into dist/ (${((await dirSize(dist)) / 1024 / 1024).toFixed(1)} MB)`);
