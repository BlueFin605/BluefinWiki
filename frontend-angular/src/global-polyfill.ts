// Polyfill Node-style `global` for CommonJS deps that run module-load
// side effects in the browser. amazon-cognito-identity-js pulls in
// `buffer`, whose top-level code references `global` unconditionally.
// Vite/esbuild in Angular's dev server doesn't shim this automatically,
// so bootstrap dies at module load without this line.
//
// This file is side-effect-only and must be the FIRST import in main.ts.
// In ES modules, imports are evaluated in source order, so importing
// this module first guarantees the assignment runs before any other
// import resolves into amazon-cognito-identity-js.
(globalThis as { global?: typeof globalThis }).global ??= globalThis;
