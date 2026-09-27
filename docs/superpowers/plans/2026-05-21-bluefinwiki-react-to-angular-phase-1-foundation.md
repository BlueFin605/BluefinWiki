# React → Angular Conversion — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` in the BluefinWiki submodule.
**Working directory for this phase:** `BluefinWiki/frontend-angular/` (created in Task 1).

**Goal:** Scaffold the new Angular app such that `npm run build`, `npm run lint`, and `npm test` are green; the app boots in dev under `ng serve --port 5173`; auth wiring against Cognito Hosted UI (or `DISABLE_AUTH=true` bypass) works; all routes from the spec exist as placeholder pages; CI in the home repo builds and tests the new app alongside the React app.

**Architecture:** Angular 21 standalone components with signals-first style. Material 21 for UI. Jest + jest-preset-angular + @testing-library/angular for tests. ESLint with angular-eslint for lint. Build-time environment-file generation via a small Node script. Auth wraps the existing `amazon-cognito-identity-js` + Cognito Hosted UI authorization-code flow exactly as the React code does today (no PKCE — that's deferred).

**Tech Stack:** `@angular/cli@21`, `@angular/material@21`, `@angular/cdk@21`, `jest@30` + `jest-preset-angular@16`, `@testing-library/angular@19`, `eslint@9` + `angular-eslint@21`, `amazon-cognito-identity-js@6`.

**Spec → behaviour adjustments locked in here:**
- The spec mentions PKCE; the current React code does **not** use PKCE (only OAuth state for CSRF). The port matches current behaviour exactly. Adding PKCE is a separate follow-up, not this work.
- The spec says roles come from `cognito:groups`; the current code uses `payload['custom:role']`. The port matches current behaviour exactly.
- Local dev bypass (`VITE_DISABLE_AUTH=true` → `NG_APP_DISABLE_AUTH=true`) is preserved with the same semantics: dev-mode-only, signs in a mock Admin user.
- Auth error API and DI shape (decided after the Task 10 code review): `cognito-oauth.ts` throws a typed `OAuthError` (codes: `state_mismatch`, `config_missing`, `token_exchange_failed`, `missing_tokens`) instead of `new Error(...)`, and `userPool` moves behind a tree-shakeable `USER_POOL` `InjectionToken` instead of a module-load singleton. Both land in Task 11 — the first place that needs them — to avoid refactoring after Tasks 12-13 consume the API.
- Auth role runtime validation (deferred from the Task 11 code review): `extractUser` in `auth.ts` casts `payload['custom:role'] as Role` without checking that the JWT value is actually `'Admin'` or `'Standard'`. A Cognito-misconfigured role string (`'admin'` lowercase, `'Manager'`, etc.) would be typed as `Role` but break any exhaustive `switch (user.role)`. The fix is deferred until the first consumer of `user.role` exists — picking a fallback policy (silently coerce to `'Standard'` vs. surface an error vs. log + coerce) is premature without a real consumer driving the choice. A `TODO` is in place at the `extractUser` call site pointing at this bullet.

---

## Task 1: Scaffold the Angular workspace

**Files:**
- Create: `BluefinWiki/frontend-angular/` (entire directory tree from `ng new`)

- [ ] **Step 1: Verify Node and Angular CLI versions**

Run from `BluefinWiki/`:

```bash
node --version
npx -y @angular/cli@21 version
```

Expected: Node ≥ 22.11; Angular CLI prints version starting with `21.`.

- [ ] **Step 2: Generate the workspace**

Run from `BluefinWiki/`:

```bash
npx -y @angular/cli@21 new frontend-angular \
  --routing=true \
  --style=scss \
  --standalone=true \
  --strict=true \
  --inline-style=false \
  --inline-template=false \
  --skip-git=true \
  --skip-tests=false \
  --package-manager=npm \
  --ssr=false
```

`ng new` may prompt for analytics — answer `N`.

- [ ] **Step 3: Pin Angular CLI in package.json**

Confirm `BluefinWiki/frontend-angular/package.json` has `@angular/cli` in `devDependencies` with a `^21.x` range. If `ng new` wrote a different range, edit it to `^21.2.0`.

- [ ] **Step 4: Verify the scaffold builds**

Run from `BluefinWiki/frontend-angular/`:

```bash
npm run build
```

Expected: build succeeds; output appears in `dist/frontend-angular/browser/`.

- [ ] **Step 5: Verify the dev server starts**

Run from `BluefinWiki/frontend-angular/`:

```bash
npx ng serve --port 5173
```

Visit `http://localhost:5173` — should see the default Angular welcome page. Stop the server with Ctrl+C.

- [ ] **Step 6: Commit**

Run from `BluefinWiki/`:

```bash
git add frontend-angular/
git commit -m "feat(angular): scaffold frontend-angular workspace via ng new"
```

---

## Task 2: Install Angular Material

**Files:**
- Modify: `BluefinWiki/frontend-angular/package.json`
- Modify: `BluefinWiki/frontend-angular/angular.json`
- Modify: `BluefinWiki/frontend-angular/src/styles.scss`
- Modify: `BluefinWiki/frontend-angular/src/index.html`

- [ ] **Step 1: Install Material via `ng add`**

Run from `BluefinWiki/frontend-angular/`:

```bash
npx ng add @angular/material@21 --defaults
```

`--defaults` accepts: include typography styles = yes, include browser animations = yes, theme = first preset (Azure & Blue). Material 3 with `mat.theme()` is the default in Material 21.

- [ ] **Step 2: Verify the build still passes**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Sanity-check Material renders**

Edit `src/app/app.html` (clear the welcome scaffold) so it contains exactly:

```html
<mat-toolbar color="primary">BlueFinWiki</mat-toolbar>
<button mat-flat-button color="primary" style="margin: 1rem;">Material works</button>
```

Edit `src/app/app.ts` to import the Material modules used above:

```ts
import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
```

- [ ] **Step 4: Verify visually**

Start dev server:

```bash
npx ng serve --port 5173
```

Visit `http://localhost:5173`. Expected: indigo toolbar with "BlueFinWiki" and a filled button labelled "Material works". Stop the server.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): add Angular Material with default theme"
```

---

## Task 3: Replace Karma + Jasmine with Jest

**Files:**
- Modify: `BluefinWiki/frontend-angular/package.json`
- Modify: `BluefinWiki/frontend-angular/angular.json`
- Modify: `BluefinWiki/frontend-angular/tsconfig.spec.json`
- Delete: `BluefinWiki/frontend-angular/karma.conf.js` (if present)
- Create: `BluefinWiki/frontend-angular/jest.config.ts`
- Create: `BluefinWiki/frontend-angular/setup-jest.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.spec.ts`

- [ ] **Step 1: Remove Jasmine / Karma deps**

Edit `package.json`, remove from `devDependencies`:
- `karma`
- `karma-chrome-launcher`
- `karma-coverage`
- `karma-jasmine`
- `karma-jasmine-html-reporter`
- `jasmine-core`
- `@types/jasmine`

Delete `karma.conf.js` if it exists.

- [ ] **Step 2: Install Jest deps**

Run from `BluefinWiki/frontend-angular/`:

```bash
npm install --save-dev \
  jest@30 \
  jest-preset-angular@16 \
  @types/jest@30 \
  jest-environment-jsdom@30 \
  jest-junit@16 \
  ts-jest@29
```

Verify zero warnings/errors per the home repo's `feedback_npm_install_zero_warnings` rule. If npm reports deprecated transitives, capture the names in the commit message body so we can chase them post-phase.

- [ ] **Step 3: Create `jest.config.ts`**

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEach: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '<rootDir>/test-results', outputName: 'jest-junit.xml' }],
  ],
};

export default config;
```

- [ ] **Step 4: Create `setup-jest.ts`**

```ts
import 'jest-preset-angular/setup-jest';

// jsdom doesn't implement matchMedia; Material's responsive APIs use it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
```

- [ ] **Step 5: Update `tsconfig.spec.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jest", "node"],
    "esModuleInterop": true,
    "module": "esnext",
    "target": "es2022"
  },
  "files": ["setup-jest.ts"],
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

- [ ] **Step 6: Remove the Karma test target from `angular.json`**

Inside `projects.frontend-angular.architect`, delete the `test` block (Angular CLI 21 keeps lint/build/serve; the project will use `npm test` → Jest directly, not `ng test`).

- [ ] **Step 7: Add npm scripts**

In `package.json` `scripts`:

```json
"test": "jest",
"test:ci": "jest --ci --reporters=default --reporters=jest-junit",
"test:watch": "jest --watch"
```

Remove the old `"test": "ng test"` script.

- [ ] **Step 8: Rewrite the scaffolded `app.spec.ts` for Jest**

Replace `src/app/app.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('renders the toolbar title', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const toolbar: HTMLElement = fixture.nativeElement.querySelector('mat-toolbar');
    expect(toolbar.textContent).toContain('BlueFinWiki');
  });
});
```

- [ ] **Step 9: Run the test**

```bash
npm test
```

Expected: 1 test passes; `test-results/jest-junit.xml` exists.

- [ ] **Step 10: Commit**

```bash
git -C BluefinWiki add frontend-angular/ -- ':!frontend-angular/karma.conf.js'
git -C BluefinWiki rm --ignore-unmatch frontend-angular/karma.conf.js 2>/dev/null || true
git -C BluefinWiki commit -m "chore(angular): replace Karma+Jasmine with Jest+jest-preset-angular"
```

---

## Task 4: Add `@testing-library/angular`

**Files:**
- Modify: `BluefinWiki/frontend-angular/package.json`
- Modify: `BluefinWiki/frontend-angular/setup-jest.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.spec.ts`

- [ ] **Step 1: Install**

```bash
npm install --save-dev @testing-library/angular@19 @testing-library/jest-dom@6 @testing-library/dom@10 @testing-library/user-event@14
```

- [ ] **Step 2: Add jest-dom matchers to setup**

Add to the top of `setup-jest.ts`:

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Convert the smoke test to TLA**

Replace `src/app/app.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { App } from './app';

describe('App', () => {
  it('renders the toolbar title', async () => {
    await render(App);
    expect(screen.getByText('BlueFinWiki')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run**

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "test(angular): add @testing-library/angular with jest-dom matchers"
```

---

## Task 5: Lint with `angular-eslint`

**Files:**
- Modify: `BluefinWiki/frontend-angular/package.json`
- Create: `BluefinWiki/frontend-angular/eslint.config.mjs`

- [ ] **Step 1: Add lint**

Run:

```bash
npx ng add @angular-eslint/schematics@21 --defaults
```

This installs `eslint`, `angular-eslint`, `typescript-eslint`, configures the project, and adds a `lint` script. Material 21 / Angular CLI 21 expect ESLint flat config (`eslint.config.mjs`).

- [ ] **Step 2: Tighten lint rules**

Overwrite `eslint.config.mjs` with:

```js
// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['app', 'wiki'], style: 'kebab-case' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
);
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "chore(angular): add ESLint with angular-eslint flat config"
```

---

## Task 6: Dev-server proxy and port

**Files:**
- Create: `BluefinWiki/frontend-angular/proxy.conf.json`
- Modify: `BluefinWiki/frontend-angular/angular.json`
- Modify: `BluefinWiki/frontend-angular/package.json`

- [ ] **Step 1: Create proxy config**

`proxy.conf.json`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

- [ ] **Step 2: Wire serve target**

In `angular.json`, under `projects.frontend-angular.architect.serve.options` add:

```json
"proxyConfig": "proxy.conf.json",
"port": 5173,
"host": "localhost"
```

- [ ] **Step 3: Update npm scripts**

In `package.json` `scripts`:

```json
"start": "ng serve",
"build": "ng build",
"build:prod": "ng build --configuration production"
```

(`start` no longer needs explicit flags — they're in `angular.json`.)

- [ ] **Step 4: Verify**

```bash
npm start
```

Expected: dev server reports `Local: http://localhost:5173/`. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): configure dev server on port 5173 with /api proxy"
```

---

## Task 7: Environment files + build-env script

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/environments/environment.ts`
- Modify: `BluefinWiki/frontend-angular/src/environments/environment.production.ts`
- Create: `BluefinWiki/frontend-angular/src/environments/environment.types.ts`
- Create: `BluefinWiki/frontend-angular/scripts/build-env.mjs`
- Modify: `BluefinWiki/frontend-angular/package.json`
- Modify: `BluefinWiki/frontend-angular/angular.json`

- [ ] **Step 1: Define the environment type**

Create `src/environments/environment.types.ts`:

```ts
export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  cognito: {
    region: string;
    userPoolId: string;
    clientId: string;
    domain: string;
    redirectUri: string;
    endpoint?: string; // optional cognito-local endpoint
  };
  disableAuth: boolean;
  aiAllowDestructive: boolean;
}
```

- [ ] **Step 2: Dev environment**

Replace `src/environments/environment.ts`:

```ts
import type { Environment } from './environment.types';

export const environment: Environment = {
  production: false,
  apiBaseUrl: '/api',
  cognito: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_testPoolId0',
    clientId: 'testclientid1234567890ab',
    domain: 'auth.dev.bluefinwiki.bluefin605.com',
    redirectUri: 'http://localhost:5173/callback',
    endpoint: undefined,
  },
  disableAuth: true, // local dev default; flip to false to exercise real Cognito
  aiAllowDestructive: true,
};
```

- [ ] **Step 3: Production environment**

Replace `src/environments/environment.production.ts` with the same shape but placeholders that will be rewritten by `build-env.mjs`:

```ts
import type { Environment } from './environment.types';

// NOTE: This file is regenerated by `scripts/build-env.mjs` at production build time
// from NG_APP_* environment variables. Do not commit real values here.
export const environment: Environment = {
  production: true,
  apiBaseUrl: '',
  cognito: {
    region: '',
    userPoolId: '',
    clientId: '',
    domain: '',
    redirectUri: '',
  },
  disableAuth: false,
  aiAllowDestructive: true,
};
```

- [ ] **Step 4: Write the build-env script**

Create `scripts/build-env.mjs`:

```js
#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = [
  'NG_APP_API_BASE_URL',
  'NG_APP_COGNITO_REGION',
  'NG_APP_COGNITO_USER_POOL_ID',
  'NG_APP_COGNITO_CLIENT_ID',
  'NG_APP_COGNITO_DOMAIN',
  'NG_APP_COGNITO_REDIRECT_URI',
];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`build-env: missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../src/environments/environment.production.ts');

const env = {
  production: true,
  apiBaseUrl: process.env.NG_APP_API_BASE_URL,
  cognito: {
    region: process.env.NG_APP_COGNITO_REGION,
    userPoolId: process.env.NG_APP_COGNITO_USER_POOL_ID,
    clientId: process.env.NG_APP_COGNITO_CLIENT_ID,
    domain: process.env.NG_APP_COGNITO_DOMAIN,
    redirectUri: process.env.NG_APP_COGNITO_REDIRECT_URI,
  },
  disableAuth: false,
  aiAllowDestructive: process.env.NG_APP_AI_ALLOW_DESTRUCTIVE !== 'false',
};

const banner = '// Generated by scripts/build-env.mjs — do not edit by hand.';
const body = `import type { Environment } from './environment.types';\n\nexport const environment: Environment = ${JSON.stringify(env, null, 2)};\n`;

writeFileSync(outPath, `${banner}\n\n${body}`, 'utf8');
console.log(`build-env: wrote ${outPath}`);
```

- [ ] **Step 5: Wire `fileReplacements` for production**

In `angular.json` under `projects.frontend-angular.architect.build.configurations.production`, ensure:

```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.production.ts"
  }
]
```

(Angular CLI 17+ defaults this; verify the block exists and edit if not.)

- [ ] **Step 6: Add prebuild npm script**

Update `package.json` `scripts`:

```json
"prebuild:prod": "node scripts/build-env.mjs",
"build:prod": "ng build --configuration production"
```

So `npm run build:prod` runs `build-env.mjs` first (npm runs `prebuild:prod` automatically before `build:prod`).

- [ ] **Step 7: Smoke test**

Dev build (uses `environment.ts` directly):

```bash
npm run build
```

Expected: succeeds.

Production build with stub env vars:

```bash
NG_APP_API_BASE_URL=/api \
NG_APP_COGNITO_REGION=us-east-1 \
NG_APP_COGNITO_USER_POOL_ID=stub \
NG_APP_COGNITO_CLIENT_ID=stub \
NG_APP_COGNITO_DOMAIN=auth.example.com \
NG_APP_COGNITO_REDIRECT_URI=https://example.com/callback \
npm run build:prod
```

Expected: `build-env: wrote …/environment.production.ts` then build succeeds.

On PowerShell the equivalent is:

```powershell
$env:NG_APP_API_BASE_URL='/api'
$env:NG_APP_COGNITO_REGION='us-east-1'
$env:NG_APP_COGNITO_USER_POOL_ID='stub'
$env:NG_APP_COGNITO_CLIENT_ID='stub'
$env:NG_APP_COGNITO_DOMAIN='auth.example.com'
$env:NG_APP_COGNITO_REDIRECT_URI='https://example.com/callback'
npm run build:prod
```

After the smoke test, run `git checkout -- src/environments/environment.production.ts` to restore the placeholder (since the build rewrote it).

- [ ] **Step 8: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): environment files with build-time generation from NG_APP_* vars"
```

---

## Task 8: Bootstrap and `app.config.ts`

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/main.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.config.ts`

- [ ] **Step 1: Confirm `main.ts`**

`ng new --standalone` already wrote `bootstrapApplication`. Verify `src/main.ts` reads:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

- [ ] **Step 2: Overwrite `app.config.ts`**

```ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([])),
    provideAnimationsAsync(),
  ],
};
```

(Interceptors are added in later tasks; the array stays empty until then.)

- [ ] **Step 3: Verify**

```bash
npm run build && npm test
```

Expected: both green.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): bootstrap with zoneless CD + provideRouter + provideHttpClient"
```

---

## Task 9: Routing skeleton with placeholder pages

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/placeholder/placeholder.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.routes.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.html`
- Modify: `BluefinWiki/frontend-angular/src/app/app.ts`

- [ ] **Step 1: Create the placeholder components**

For each route, create a tiny standalone component. Pattern (`src/app/features/placeholder/pages-placeholder.ts`):

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'wiki-pages-placeholder',
  standalone: true,
  template: `<main style="padding:2rem"><h1>Pages placeholder</h1></main>`,
})
export class PagesPlaceholder {}
```

Create all eight files with the same shape, using these specific names and headings:

- `pages-placeholder.ts` → `PagesPlaceholder` → "Pages placeholder"
- `page-editor-placeholder.ts` → `PageEditorPlaceholder` → "Page editor placeholder"
- `profile-placeholder.ts` → `ProfilePlaceholder` → "Profile placeholder"
- `settings-placeholder.ts` → `SettingsPlaceholder` → "Settings placeholder"
- `page-types-placeholder.ts` → `PageTypesPlaceholder` → "Page types placeholder"
- `users-placeholder.ts` → `UsersPlaceholder` → "Users placeholder"
- `invitations-placeholder.ts` → `InvitationsPlaceholder` → "Invitations placeholder"
- `rebuild-index-placeholder.ts` → `RebuildIndexPlaceholder` → "Rebuild page index placeholder"

- [ ] **Step 2: Define the route table**

Overwrite `src/app/app.routes.ts`:

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pages' },

  {
    path: 'callback',
    loadComponent: () =>
      import('./features/callback/oauth-callback').then((m) => m.OAuthCallback),
  },

  { path: 'pages', loadComponent: () => import('./features/placeholder/pages-placeholder').then((m) => m.PagesPlaceholder) },
  { path: 'pages/:guid', loadComponent: () => import('./features/placeholder/pages-placeholder').then((m) => m.PagesPlaceholder) },
  { path: 'pages/:guid/edit', loadComponent: () => import('./features/placeholder/page-editor-placeholder').then((m) => m.PageEditorPlaceholder) },
  { path: 'profile', loadComponent: () => import('./features/placeholder/profile-placeholder').then((m) => m.ProfilePlaceholder) },

  { path: 'settings', loadComponent: () => import('./features/placeholder/settings-placeholder').then((m) => m.SettingsPlaceholder) },
  { path: 'admin/page-types', loadComponent: () => import('./features/placeholder/page-types-placeholder').then((m) => m.PageTypesPlaceholder) },
  { path: 'admin/users', loadComponent: () => import('./features/placeholder/users-placeholder').then((m) => m.UsersPlaceholder) },
  { path: 'admin/invitations', loadComponent: () => import('./features/placeholder/invitations-placeholder').then((m) => m.InvitationsPlaceholder) },
  { path: 'admin/rebuild-page-index', loadComponent: () => import('./features/placeholder/rebuild-index-placeholder').then((m) => m.RebuildIndexPlaceholder) },

  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
```

- [ ] **Step 3: 404 component**

Create `src/app/features/not-found/not-found.ts`:

```ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'wiki-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main style="padding:2rem; text-align:center;">
      <h1>404</h1>
      <p>Page not found.</p>
      <a routerLink="/" mat-stroked-button>Go home</a>
    </main>
  `,
})
export class NotFound {}
```

- [ ] **Step 4: App renders the router outlet**

Replace `src/app/app.html`:

```html
<mat-toolbar color="primary">
  <a routerLink="/pages" style="color: inherit; text-decoration: none;">BlueFinWiki</a>
</mat-toolbar>
<router-outlet></router-outlet>
```

Replace `src/app/app.ts`:

```ts
import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
```

Update the existing `app.spec.ts` so it provides `RouterTestingHarness` or use `provideRouter([])` to avoid the missing-RouterOutlet error:

```ts
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('renders the toolbar title', async () => {
    await render(App, { providers: [provideRouter([])] });
    expect(screen.getByText('BlueFinWiki')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Verify lint, build, test, serve**

```bash
npm run lint && npm run build && npm test
```

Expected: all three green.

```bash
npm start
```

Visit `http://localhost:5173/pages` — expect "Pages placeholder". Visit `/admin/users` — expect "Users placeholder". Visit `/nope` — expect 404. Stop server.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): routing skeleton with placeholder components for every route"
```

---

## Task 10: Cognito config + OAuth helpers (port of `utils/cognitoAuth.ts`)

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/cognito-config.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/cognito-oauth.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/cognito-oauth.spec.ts`
- Modify: `BluefinWiki/frontend-angular/package.json`

- [ ] **Step 1: Install Cognito SDK**

```bash
npm install amazon-cognito-identity-js@6
```

- [ ] **Step 2: cognito-config.ts**

```ts
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

const { userPoolId, clientId, endpoint } = environment.cognito;

const missing: string[] = [];
if (!userPoolId) missing.push('cognito.userPoolId');
if (!clientId) missing.push('cognito.clientId');

if (missing.length > 0 && !environment.disableAuth) {
  throw new Error(
    `Missing required Cognito config: ${missing.join(', ')}. ` +
      'Set NG_APP_COGNITO_* env vars at build time, or set NG_APP_DISABLE_AUTH=true for local dev.',
  );
}

export const userPool = new CognitoUserPool({
  UserPoolId: userPoolId || 'us-east-1_placeholder',
  ClientId: clientId || 'placeholder',
  endpoint: endpoint || undefined,
});
```

- [ ] **Step 3: cognito-oauth.ts — port behaviour, not just code**

```ts
import {
  CognitoAccessToken,
  CognitoIdToken,
  CognitoRefreshToken,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

export interface AuthResult {
  session: CognitoUserSession;
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

const STATE_KEY = 'oauth_state';

export function redirectToLogin(): void {
  const { domain, clientId, redirectUri } = environment.cognito;
  if (!domain || !clientId || !redirectUri) {
    throw new Error(
      'Cognito Hosted UI is not configured. Set NG_APP_COGNITO_DOMAIN, ' +
        'NG_APP_COGNITO_CLIENT_ID, NG_APP_COGNITO_REDIRECT_URI.',
    );
  }

  const state = generateRandomString(32);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    scope: 'openid email profile',
  });

  window.location.href = `https://${domain}/oauth2/authorize?${params.toString()}`;
}

export async function handleOAuthCallback(code: string, state: string): Promise<AuthResult> {
  const savedState = sessionStorage.getItem(STATE_KEY);
  if (state !== savedState) throw new Error('State mismatch. Possible CSRF attack.');
  sessionStorage.removeItem(STATE_KEY);

  const { domain, clientId, redirectUri } = environment.cognito;
  if (!domain || !clientId || !redirectUri) throw new Error('Cognito Hosted UI is not configured.');

  const response = await fetch(`https://${domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) throw new Error('Failed to exchange authorization code for tokens');

  const tokens = (await response.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokens.id_token || !tokens.access_token) {
    throw new Error('Missing tokens in OAuth response');
  }

  const session = new CognitoUserSession({
    IdToken: new CognitoIdToken({ IdToken: tokens.id_token }),
    AccessToken: new CognitoAccessToken({ AccessToken: tokens.access_token }),
    RefreshToken: new CognitoRefreshToken({ RefreshToken: tokens.refresh_token ?? 'no-refresh-token' }),
  });

  return {
    session,
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
  };
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
```

- [ ] **Step 4: Tests**

`cognito-oauth.spec.ts`:

```ts
import { handleOAuthCallback, redirectToLogin } from './cognito-oauth';

describe('cognito-oauth', () => {
  const originalLocation = window.location;
  let assignSpy: jest.Mock;

  beforeEach(() => {
    sessionStorage.clear();
    assignSpy = jest.fn();
    // jsdom location is read-only; redefine for the test
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '', assign: assignSpy } as Location,
    });
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  describe('redirectToLogin', () => {
    it('stores a state token in sessionStorage and sets window.location.href', () => {
      redirectToLogin();
      const stored = sessionStorage.getItem('oauth_state');
      expect(stored).not.toBeNull();
      expect(stored!.length).toBe(32);
      expect(window.location.href).toMatch(/^https:\/\/.+\/oauth2\/authorize\?/);
      expect(window.location.href).toContain(`state=${stored}`);
    });
  });

  describe('handleOAuthCallback', () => {
    it('throws when state mismatches saved value', async () => {
      sessionStorage.setItem('oauth_state', 'aaaaaaaa');
      await expect(handleOAuthCallback('code', 'bbbbbbbb')).rejects.toThrow('State mismatch');
    });

    it('exchanges code for tokens and returns a session', async () => {
      sessionStorage.setItem('oauth_state', 'matching');
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id_token: 'idt',
            access_token: 'act',
            refresh_token: 'ref',
          }),
      });

      const result = await handleOAuthCallback('thecode', 'matching');
      expect(result.idToken).toBe('idt');
      expect(result.accessToken).toBe('act');
      expect(result.refreshToken).toBe('ref');
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
    });

    it('throws when token endpoint returns non-ok', async () => {
      sessionStorage.setItem('oauth_state', 'matching');
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
      await expect(handleOAuthCallback('thecode', 'matching')).rejects.toThrow('Failed to exchange');
    });

    it('throws when response is missing tokens', async () => {
      sessionStorage.setItem('oauth_state', 'matching');
      (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await expect(handleOAuthCallback('thecode', 'matching')).rejects.toThrow('Missing tokens');
    });
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- cognito-oauth
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): port Cognito Hosted UI auth-code helpers"
```

---

## Task 11: Auth service (+ typed `OAuthError`, +`USER_POOL` DI)

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/core/auth/cognito-oauth.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/core/auth/cognito-oauth.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/core/auth/cognito-config.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth.types.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth.spec.ts`

**Why this task does more than the title suggests:** The Task 10 code review (commit `a8e68d5`) flagged two architectural choices that should land before the Auth service ossifies its public API. (1) Replace the four string-throws in `cognito-oauth.ts` with a typed `OAuthError` union so callers can branch on `.code` instead of substring-matching `.message`. (2) Move `userPool` from a module-load singleton to a tree-shakeable `USER_POOL` `InjectionToken` so tests can substitute fakes without module mocking — and so the config-validation throw fires on first injection, not at module load. Both refactors fold into Task 11 because the Auth service is their only consumer; reshaping the API once is cheaper than refactoring after Tasks 12-13.

- [ ] **Step 1: Add `OAuthError` to `cognito-oauth.ts`**

Add this immediately after the imports in `cognito-oauth.ts`, before the `AuthResult` interface:

```ts
export type OAuthErrorCode =
  | 'config_missing'
  | 'state_mismatch'
  | 'token_exchange_failed'
  | 'missing_tokens';

export class OAuthError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}
```

Then replace each `throw new Error(...)` site with `throw new OAuthError(code, message)`, keeping the existing messages verbatim:

| Throw site | Code | Existing message (unchanged) |
| --- | --- | --- |
| `buildAuthorizeUrl` (Hosted UI config check) | `'config_missing'` | `'Cognito Hosted UI is not configured. Set NG_APP_COGNITO_DOMAIN, NG_APP_COGNITO_CLIENT_ID, NG_APP_COGNITO_REDIRECT_URI.'` |
| `handleOAuthCallback` (state check) | `'state_mismatch'` | `'State mismatch. Possible CSRF attack.'` |
| `handleOAuthCallback` (config check) | `'config_missing'` | `'Cognito Hosted UI is not configured.'` |
| `handleOAuthCallback` (network check) | `'token_exchange_failed'` | `'Failed to exchange authorization code for tokens'` |
| `handleOAuthCallback` (missing tokens check) | `'missing_tokens'` | `'Missing tokens in OAuth response'` |

Messages stay identical to preserve log/debug parity with the React port; only the type changes.

- [ ] **Step 2: Tighten the assertions in `cognito-oauth.spec.ts`**

Import `OAuthError` alongside the existing imports. For each of the four `handleOAuthCallback` rejection tests, replace `.rejects.toThrow('substring')` with a structural assertion that also pins the `code`:

```ts
await expect(handleOAuthCallback('code', 'bbbbbbbb')).rejects.toMatchObject({
  name: 'OAuthError',
  code: 'state_mismatch',
  message: expect.stringContaining('State mismatch'),
});
```

Apply the same pattern with codes `token_exchange_failed` and `missing_tokens` for the corresponding tests. The `buildAuthorizeUrl` test does not exercise any throw path and stays unchanged.

- [ ] **Step 3: Replace the `userPool` singleton with a `USER_POOL` token in `cognito-config.ts`**

Overwrite `cognito-config.ts` with:

```ts
import { InjectionToken } from '@angular/core';
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';

/**
 * Lazily-constructed `CognitoUserPool`, exposed via Angular DI so tests can
 * substitute a fake and so the config-validation throw fires on first
 * injection rather than at module load.
 */
export function createUserPool(): CognitoUserPool {
  const { userPoolId, clientId, endpoint } = environment.cognito;

  const missing: string[] = [];
  if (!userPoolId) missing.push('cognito.userPoolId');
  if (!clientId) missing.push('cognito.clientId');

  if (missing.length > 0 && !environment.disableAuth) {
    throw new Error(
      `Missing required Cognito config: ${missing.join(', ')}. ` +
        'Set NG_APP_COGNITO_* env vars at build time, or set NG_APP_DISABLE_AUTH=true for local dev.',
    );
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId || 'us-east-1_placeholder',
    ClientId: clientId || 'placeholder',
    endpoint: endpoint || undefined,
  });
}

export const USER_POOL = new InjectionToken<CognitoUserPool>('USER_POOL', {
  providedIn: 'root',
  factory: createUserPool,
});
```

Tree-shakeable token with `providedIn: 'root'` + `factory` means no provider wiring in `app.config.ts` and no module-load throw — the factory runs the first time `USER_POOL` is injected. Tests override via `{ provide: USER_POOL, useValue: fakeUserPool }`. The previous `export const userPool` is gone; the only consumer is the Auth service in Step 5.

- [ ] **Step 4: Auth types**

Create `auth.types.ts`:

```ts
export type Role = 'Admin' | 'Standard';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  emailVerified: boolean;
}
```

- [ ] **Step 5: Auth**

Create `auth.ts`:

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { CognitoUser, type CognitoUserPool, type CognitoUserSession } from 'amazon-cognito-identity-js';
import { environment } from '../../../environments/environment';
import { USER_POOL } from './cognito-config';
import { handleOAuthCallback, redirectToLogin, type AuthResult } from './cognito-oauth';
import type { AuthUser, Role } from './auth.types';

const ID_TOKEN_KEY = 'idToken';
const ACCESS_TOKEN_KEY = 'accessToken';

const MOCK_ADMIN: AuthUser = {
  userId: 'local-dev-user-id',
  email: 'dev@example.com',
  displayName: 'Local Dev User',
  role: 'Admin',
  emailVerified: true,
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly userPool = inject(USER_POOL);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isLoading = signal(true);
  private readonly _error = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly roles = computed<readonly Role[]>(() => {
    const u = this._user();
    return u ? [u.role] : [];
  });

  constructor() {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      if (environment.disableAuth) {
        localStorage.setItem(ID_TOKEN_KEY, 'mock-jwt-token');
        localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-jwt-token');
        this._user.set(MOCK_ADMIN);
        return;
      }

      const cognitoUser = this.userPool.getCurrentUser();
      if (!cognitoUser) {
        this._user.set(null);
        return;
      }

      const session = await getSessionAsync(cognitoUser);
      if (!session.isValid()) {
        this.clearTokens();
        this._user.set(null);
        return;
      }

      this.persistSession(session);
      this._user.set(extractUser(session, cognitoUser));
    } finally {
      this._isLoading.set(false);
    }
  }

  async completeOAuthCallback(code: string, state: string): Promise<void> {
    const result: AuthResult = await handleOAuthCallback(code, state);
    const username = readUsernameFromPayload(result.session);
    const cognitoUser = new CognitoUser({ Username: username, Pool: this.userPool });
    cognitoUser.setSignInUserSession(result.session);
    this.persistSession(result.session);
    this._user.set(extractUser(result.session, cognitoUser));
    this._isLoading.set(false);
  }

  signOut(): void {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    this.clearTokens();
    this._user.set(null);
  }

  redirectToLogin(): void {
    redirectToLogin();
  }

  getIdToken(): string | null {
    return localStorage.getItem(ID_TOKEN_KEY);
  }

  async refreshIdToken(): Promise<string | null> {
    if (environment.disableAuth) return localStorage.getItem(ID_TOKEN_KEY);
    const cognitoUser = this.userPool.getCurrentUser();
    if (!cognitoUser) return null;
    try {
      const session = await getSessionAsync(cognitoUser);
      if (!session.isValid()) return null;
      this.persistSession(session);
      return session.getIdToken().getJwtToken();
    } catch {
      return null;
    }
  }

  private persistSession(session: CognitoUserSession): void {
    localStorage.setItem(ID_TOKEN_KEY, session.getIdToken().getJwtToken());
    localStorage.setItem(ACCESS_TOKEN_KEY, session.getAccessToken().getJwtToken());
  }

  private clearTokens(): void {
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

function getSessionAsync(user: CognitoUser): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err) reject(err);
      else if (session) resolve(session);
      else reject(new Error('No session found'));
    });
  });
}

function extractUser(session: CognitoUserSession, cognitoUser: CognitoUser): AuthUser {
  const payload = session.getIdToken().payload as Record<string, unknown>;
  return {
    userId: String(payload['sub'] ?? ''),
    email: String(payload['email'] ?? cognitoUser.getUsername()),
    displayName: String(payload['name'] ?? payload['cognito:username'] ?? cognitoUser.getUsername()),
    role: (payload['custom:role'] as Role) ?? 'Standard',
    emailVerified: Boolean(payload['email_verified']),
  };
}

function readUsernameFromPayload(session: CognitoUserSession): string {
  const payload = session.getIdToken().payload as Record<string, unknown>;
  return String(payload['cognito:username'] ?? payload['email'] ?? payload['sub'] ?? 'unknown');
}
```

- [ ] **Step 6: Tests**

Create `auth.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import type { CognitoUserPool } from 'amazon-cognito-identity-js';

import { environment } from '../../../environments/environment';
import { Auth } from './auth';
import { USER_POOL } from './cognito-config';

function fakeUserPool(overrides: Partial<CognitoUserPool> = {}): CognitoUserPool {
  return {
    getCurrentUser: () => null,
    ...overrides,
  } as unknown as CognitoUserPool;
}

describe('Auth', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  describe('with NG_APP_DISABLE_AUTH=true', () => {
    beforeEach(() => {
      environment.disableAuth = true;
      TestBed.configureTestingModule({
        providers: [{ provide: USER_POOL, useValue: fakeUserPool() }],
      });
    });

    it('signs in a mock Admin on bootstrap', async () => {
      const svc = TestBed.inject(Auth);
      // bootstrap is async; flush microtasks
      await Promise.resolve();
      await Promise.resolve();
      expect(svc.isAuthenticated()).toBe(true);
      expect(svc.user()?.role).toBe('Admin');
      expect(localStorage.getItem('idToken')).toBe('mock-jwt-token');
    });

    it('signOut clears tokens and user', async () => {
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      svc.signOut();
      expect(svc.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('idToken')).toBeNull();
    });
  });

  describe('with real auth (disableAuth=false) and no stored token', () => {
    beforeEach(() => {
      environment.disableAuth = false;
      TestBed.configureTestingModule({
        providers: [{ provide: USER_POOL, useValue: fakeUserPool() }],
      });
    });

    it('is unauthenticated on bootstrap', async () => {
      const svc = TestBed.inject(Auth);
      await Promise.resolve();
      await Promise.resolve();
      expect(svc.isAuthenticated()).toBe(false);
      expect(svc.user()).toBeNull();
    });
  });
});
```

- [ ] **Step 7: Run**

```bash
npm test -- cognito-oauth auth
npm run lint
npm run build
```

Expected: 5 `cognito-oauth` tests pass (with typed-error assertions) and 3 `auth` tests pass; lint and build clean.

- [ ] **Step 8: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): Auth service + typed OAuthError + USER_POOL DI"
```

### Post-review polish

The Task 11 code review found three Important issues that landed in a follow-up commit on the same branch (after the Step 8 commit, before Task 12 starts):

- **`_error` signal was exposed but never written.** `bootstrap` now has a `catch (err: unknown)` that calls `clearTokens()`, sets `_user` to `null`, and writes `errorMessage(err)` to `_error`. `completeOAuthCallback` got the same `try/catch/finally` shape — sets `_error` and rethrows so the callback route component can navigate to an error state. Adds two tests: a synthetic-SDK-failure bootstrap test (provider injects a fake `USER_POOL` whose `getCurrentUser` throws), and a state-mismatch callback test that asserts both `_error` is written and the `OAuthError` is rethrown.
- **`redirectToLogin` import shadowed the method.** `auth.ts` renames the import to `cognitoRedirectToLogin` so the method body reads `cognitoRedirectToLogin()` instead of relying on lexical scope to disambiguate from `this.redirectToLogin`. No behaviour change; eliminates the "added `this.` to fix it, hit infinite recursion" footgun.
- **`cognito-config.ts` JSDoc overstated the throw-timing change.** Rewritten to lead with the testability win (overridable token via `{ provide: USER_POOL, useValue: ... }`) and treat the lazy-throw timing as the secondary side benefit it actually is.

The fourth review finding (role runtime validation) is captured in the spec-to-plan adjustments above and as a `TODO` in `auth.ts`; it stays deferred.

---

## Task 12: Functional `authGuard` and `adminGuard`

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth-guard.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/admin-guard.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth-guard.spec.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/admin-guard.spec.ts`

- [ ] **Step 1: authGuard**

```ts
// auth-guard.ts
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  if (auth.isAuthenticated()) return true;
  auth.redirectToLogin();
  return false;
};
```

- [ ] **Step 2: adminGuard**

```ts
// admin-guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.user()?.role === 'Admin') return true;
  // Authenticated but not admin: bounce to /pages
  return router.createUrlTree(['/pages']);
};
```

- [ ] **Step 3: Tests — authGuard**

```ts
// auth-guard.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  let redirect: jest.Mock;
  let isAuthenticated: jest.Mock;

  beforeEach(() => {
    redirect = jest.fn();
    isAuthenticated = jest.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: Auth, useValue: { isAuthenticated, redirectToLogin: redirect } }],
    });
  });

  function run(): boolean | unknown {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('returns true when authenticated', () => {
    isAuthenticated.mockReturnValue(true);
    expect(run()).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects and returns false when not authenticated', () => {
    isAuthenticated.mockReturnValue(false);
    expect(run()).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Tests — adminGuard**

```ts
// admin-guard.spec.ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Auth } from './auth';
import { adminGuard } from './admin-guard';

describe('adminGuard', () => {
  let user: jest.Mock;
  let router: { createUrlTree: jest.Mock };

  beforeEach(() => {
    user = jest.fn();
    router = { createUrlTree: jest.fn(() => ({}) as UrlTree) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { user } },
        { provide: Router, useValue: router },
      ],
    });
  });

  function run(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  it('returns true for Admin user', () => {
    user.mockReturnValue({ role: 'Admin' });
    expect(run()).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /pages for Standard user', () => {
    user.mockReturnValue({ role: 'Standard' });
    run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/pages']);
  });

  it('redirects to /pages for null user', () => {
    user.mockReturnValue(null);
    run();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/pages']);
  });
});
```

- [ ] **Step 5: Run**

```bash
npm test -- auth-guard admin-guard
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): functional authGuard + adminGuard"
```

---

## Task 13: Auth interceptor

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth-interceptor.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/auth/auth-interceptor.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.config.ts`

- [ ] **Step 1: Interceptor**

```ts
// auth-interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { EMPTY, catchError, from, switchMap, throwError } from 'rxjs';
import { Auth } from './auth';

const API_PREFIX = '/api';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  if (!req.url.startsWith(API_PREFIX) && !req.url.includes('/api/')) {
    return next(req);
  }

  const auth = inject(Auth);
  const token = auth.getIdToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        return from(auth.refreshIdToken()).pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              const retry = req.clone({ setHeaders: { Authorization: `Bearer ${refreshed}` } });
              return next(retry);
            }
            auth.redirectToLogin();
            return EMPTY;
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
```

- [ ] **Step 2: Wire it**

In `src/app/app.config.ts`, update `withInterceptors`:

```ts
import { authInterceptor } from './core/auth/auth.interceptor';
// ...
provideHttpClient(withInterceptors([authInterceptor])),
```

- [ ] **Step 3: Tests**

```ts
// auth-interceptor.spec.ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: { getIdToken: jest.Mock; refreshIdToken: jest.Mock; redirectToLogin: jest.Mock };

  beforeEach(() => {
    auth = {
      getIdToken: jest.fn().mockReturnValue('tok-1'),
      refreshIdToken: jest.fn().mockResolvedValue('tok-2'),
      redirectToLogin: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches Bearer token to /api/* requests', () => {
    http.get('/api/pages').subscribe();
    const req = httpMock.expectOne('/api/pages');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush({});
  });

  it('does not touch non-api requests', () => {
    http.get('/assets/config.json').subscribe();
    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({});
  });

  it('refreshes token and retries on 401', (done) => {
    http.get('/api/pages').subscribe({
      next: () => {
        expect(auth.refreshIdToken).toHaveBeenCalled();
        done();
      },
    });
    const req1 = httpMock.expectOne('/api/pages');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });

    setTimeout(() => {
      const req2 = httpMock.expectOne('/api/pages');
      expect(req2.request.headers.get('Authorization')).toBe('Bearer tok-2');
      req2.flush({});
    }, 0);
  });

  it('redirects to login when refresh fails', (done) => {
    auth.refreshIdToken.mockResolvedValueOnce(null);
    http.get('/api/pages').subscribe({
      complete: () => {
        expect(auth.redirectToLogin).toHaveBeenCalled();
        done();
      },
    });
    const req1 = httpMock.expectOne('/api/pages');
    req1.flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
```

- [ ] **Step 4: Run**

```bash
npm test -- auth-interceptor
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): auth interceptor with 401 retry + redirect"
```

---

## Task 14: Error interceptor + `ApiError` type

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/core/api/api.types.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/api/error-interceptor.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/api/error-interceptor.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.config.ts`

- [ ] **Step 1: `ApiError` type**

```ts
// api.types.ts
export interface ApiError {
  status: number;
  code: string;
  message: string;
  requestId?: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' && value !== null &&
    'status' in value && 'code' in value && 'message' in value
  );
}
```

- [ ] **Step 2: Interceptor**

```ts
// error-interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ApiError } from './api.types';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as Partial<ApiError> | null;
        const apiError: ApiError = {
          status: err.status,
          code: body?.code ?? 'http_error',
          message: body?.message ?? err.message ?? 'Request failed',
          requestId: body?.requestId,
        };
        return throwError(() => apiError);
      }
      return throwError(() => err);
    }),
  );
```

- [ ] **Step 3: Wire it (after authInterceptor)**

```ts
// app.config.ts
provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
```

(Order: authInterceptor handles 401 first; everything else falls through to errorInterceptor.)

- [ ] **Step 4: Tests**

```ts
// error-interceptor.spec.ts
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { isApiError } from './api.types';
import { errorInterceptor } from './error-interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps 500 with body to ApiError', (done) => {
    http.get('/api/x').subscribe({
      error: (err) => {
        expect(isApiError(err)).toBe(true);
        expect(err.status).toBe(500);
        expect(err.code).toBe('boom');
        expect(err.message).toBe('Something went wrong');
        expect(err.requestId).toBe('req-1');
        done();
      },
    });
    httpMock.expectOne('/api/x').flush(
      { code: 'boom', message: 'Something went wrong', requestId: 'req-1' },
      { status: 500, statusText: 'Internal Server Error' },
    );
  });

  it('falls back to defaults when body has no envelope', (done) => {
    http.get('/api/x').subscribe({
      error: (err) => {
        expect(err.code).toBe('http_error');
        expect(err.status).toBe(404);
        done();
      },
    });
    httpMock.expectOne('/api/x').flush('not found', { status: 404, statusText: 'Not Found' });
  });
});
```

- [ ] **Step 5: Run**

```bash
npm test -- error-interceptor
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): error interceptor normalising HTTP errors to ApiError"
```

---

## Task 15: GlobalErrorHandler

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/core/error/global-error-handler.ts`
- Create: `BluefinWiki/frontend-angular/src/app/core/error/global-error-handler.spec.ts`
- Modify: `BluefinWiki/frontend-angular/src/app/app.config.ts`

- [ ] **Step 1: Handler**

```ts
// global-error-handler.ts
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private snack = inject(MatSnackBar);

  handleError(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorHandler]', error);
    this.snack.open('Something went wrong — try again.', 'Reload', { duration: 6000 })
      .onAction()
      .subscribe(() => window.location.reload());
  }
}
```

- [ ] **Step 2: Wire**

In `app.config.ts`:

```ts
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './core/error/global-error-handler';
// ...
providers: [
  // ...existing...
  { provide: ErrorHandler, useClass: GlobalErrorHandler },
],
```

- [ ] **Step 3: Test**

```ts
// global-error-handler.spec.ts
import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let snack: { open: jest.Mock };
  let actionSubject: Subject<void>;

  beforeEach(() => {
    actionSubject = new Subject<void>();
    const ref = { onAction: () => actionSubject.asObservable() } as Partial<MatSnackBarRef<unknown>>;
    snack = { open: jest.fn().mockReturnValue(ref) };
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: snack }, GlobalErrorHandler],
    });
  });

  it('logs and opens a snack-bar on handleError', () => {
    const handler = TestBed.inject(GlobalErrorHandler);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    handler.handleError(new Error('boom'));
    expect(spy).toHaveBeenCalled();
    expect(snack.open).toHaveBeenCalledWith(
      'Something went wrong — try again.',
      'Reload',
      expect.objectContaining({ duration: 6000 }),
    );
    spy.mockRestore();
  });
});
```

- [ ] **Step 4: Run**

```bash
npm test -- global-error-handler
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): GlobalErrorHandler with snack-bar + reload"
```

---

## Task 16: OAuth `/callback` component

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/features/callback/oauth-callback.ts`
- Create: `BluefinWiki/frontend-angular/src/app/features/callback/oauth-callback.spec.ts`

- [ ] **Step 1: Component**

```ts
// oauth-callback.ts
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'wiki-oauth-callback',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatButtonModule],
  template: `
    @if (error()) {
      <main style="padding:2rem; text-align:center;">
        <h1>Sign in failed</h1>
        <p>{{ error() }}</p>
        <button mat-flat-button color="primary" (click)="retry()">Try again</button>
      </main>
    } @else {
      <main style="padding:2rem; text-align:center;">
        <mat-spinner diameter="40" style="margin:auto"></mat-spinner>
        <p>Completing sign in…</p>
      </main>
    }
  `,
})
export class OAuthCallback {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(Auth);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.complete();
  }

  private async complete(): Promise<void> {
    try {
      const params = this.route.snapshot.queryParamMap;
      const code = params.get('code');
      const state = params.get('state');
      if (!code || !state) throw new Error('Missing authorization code or state in callback URL.');
      await this.auth.completeOAuthCallback(code, state);
      await this.router.navigate(['/pages'], { replaceUrl: true });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Authentication callback failed.');
    }
  }

  retry(): void {
    this.error.set(null);
    this.auth.redirectToLogin();
  }
}
```

- [ ] **Step 2: Tests**

```ts
// oauth-callback.spec.ts
import { render, screen } from '@testing-library/angular';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { OAuthCallback } from './oauth-callback';

interface SetupOpts {
  code: string | null;
  state: string | null;
  completeBehavior: 'resolve' | 'reject';
}

function makeProviders({ code, state, completeBehavior }: SetupOpts) {
  const queryParamMap = convertToParamMap({
    ...(code !== null ? { code } : {}),
    ...(state !== null ? { state } : {}),
  });
  const auth = {
    completeOAuthCallback: jest
      .fn()
      .mockImplementation(() =>
        completeBehavior === 'resolve' ? Promise.resolve() : Promise.reject(new Error('State mismatch')),
      ),
    redirectToLogin: jest.fn(),
  };
  const router = { navigate: jest.fn().mockResolvedValue(true) };
  return {
    auth,
    router,
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap } } },
      { provide: Auth, useValue: auth },
      { provide: Router, useValue: router },
    ],
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('OAuthCallback', () => {
  it('shows error when code is missing', async () => {
    const { providers } = makeProviders({ code: null, state: 'abc', completeBehavior: 'resolve' });
    await render(OAuthCallback, { providers });
    expect(await screen.findByText(/Sign in failed/)).toBeInTheDocument();
    expect(await screen.findByText(/Missing authorization code/)).toBeInTheDocument();
  });

  it('shows error when state is missing', async () => {
    const { providers } = makeProviders({ code: 'thecode', state: null, completeBehavior: 'resolve' });
    await render(OAuthCallback, { providers });
    expect(await screen.findByText(/Sign in failed/)).toBeInTheDocument();
  });

  it('shows error when completeOAuthCallback rejects', async () => {
    const { providers } = makeProviders({ code: 'thecode', state: 'abc', completeBehavior: 'reject' });
    await render(OAuthCallback, { providers });
    expect(await screen.findByText('State mismatch')).toBeInTheDocument();
  });

  it('navigates to /pages on success', async () => {
    const { providers, auth, router } = makeProviders({ code: 'thecode', state: 'abc', completeBehavior: 'resolve' });
    await render(OAuthCallback, { providers });
    await flushMicrotasks();
    expect(auth.completeOAuthCallback).toHaveBeenCalledWith('thecode', 'abc');
    expect(router.navigate).toHaveBeenCalledWith(['/pages'], { replaceUrl: true });
  });
});
```

- [ ] **Step 3: Run**

```bash
npm test -- oauth-callback
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): OAuth /callback component with error UI"
```

---

## Task 17: Wire guards into routes

**Files:**
- Modify: `BluefinWiki/frontend-angular/src/app/app.routes.ts`

- [ ] **Step 1: Add `canActivate` arrays**

Edit `src/app/app.routes.ts` so the route definitions become:

```ts
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pages' },

  {
    path: 'callback',
    loadComponent: () =>
      import('./features/callback/oauth-callback').then((m) => m.OAuthCallback),
  },

  { path: 'pages', canActivate: [authGuard], loadComponent: () => import('./features/placeholder/pages-placeholder').then((m) => m.PagesPlaceholder) },
  { path: 'pages/:guid', canActivate: [authGuard], loadComponent: () => import('./features/placeholder/pages-placeholder').then((m) => m.PagesPlaceholder) },
  { path: 'pages/:guid/edit', canActivate: [authGuard], loadComponent: () => import('./features/placeholder/page-editor-placeholder').then((m) => m.PageEditorPlaceholder) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./features/placeholder/profile-placeholder').then((m) => m.ProfilePlaceholder) },

  { path: 'settings', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/placeholder/settings-placeholder').then((m) => m.SettingsPlaceholder) },
  { path: 'admin/page-types', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/placeholder/page-types-placeholder').then((m) => m.PageTypesPlaceholder) },
  { path: 'admin/users', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/placeholder/users-placeholder').then((m) => m.UsersPlaceholder) },
  { path: 'admin/invitations', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/placeholder/invitations-placeholder').then((m) => m.InvitationsPlaceholder) },
  { path: 'admin/rebuild-page-index', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/placeholder/rebuild-index-placeholder').then((m) => m.RebuildIndexPlaceholder) },

  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
```

- [ ] **Step 2: Manual verification with `DISABLE_AUTH=true`**

With `environment.disableAuth: true` in dev `environment.ts`:

```bash
npm start
```

Visit each route — every route renders the placeholder (because the mock Admin is signed in and `adminGuard` passes too). Stop the server.

- [ ] **Step 3: Verify lint, build, test**

```bash
npm run lint && npm run build && npm test
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): wire authGuard + adminGuard into routes"
```

---

## Task 18: `PermissionGuard` structural directive

**Files:**
- Create: `BluefinWiki/frontend-angular/src/app/shared/components/permission.ts`
- Create: `BluefinWiki/frontend-angular/src/app/shared/components/permission.spec.ts`

- [ ] **Step 1: Directive**

```ts
// permission.ts
import { Directive, EmbeddedViewRef, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Auth } from '../../core/auth/auth';
import type { Role } from '../../core/auth/auth.types';

@Directive({
  selector: '[appPermission]',
  standalone: true,
})
export class Permission {
  private template = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  private auth = inject(Auth);

  readonly appPermission = input.required<Role>();

  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const required = this.appPermission();
      const userRole = this.auth.user()?.role;
      const allowed = userRole === 'Admin' || userRole === required;
      if (allowed && !this.view) {
        this.view = this.vcr.createEmbeddedView(this.template);
      } else if (!allowed && this.view) {
        this.vcr.clear();
        this.view = null;
      }
    });
  }
}
```

(Admin is treated as a superset of Standard — matches the React `PermissionGuard` behaviour where Admin can see Standard-gated content.)

- [ ] **Step 2: Tests**

```ts
// permission.spec.ts
import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { Auth } from '../../core/auth/auth';
import type { AuthUser } from '../../core/auth/auth.types';
import { Permission } from './permission';

@Component({
  selector: 'wiki-host',
  standalone: true,
  imports: [Permission],
  template: `
    <div *appPermission="'Admin'">admin-only</div>
    <div *appPermission="'Standard'">any-user</div>
  `,
})
class HostComponent {}

function authStub(user: AuthUser | null) {
  return { user: signal(user) };
}

describe('Permission', () => {
  it('shows Admin block to Admin and hides for Standard', async () => {
    await render(HostComponent, {
      providers: [{ provide: Auth, useValue: authStub({
        userId: 'u', email: 'e', displayName: 'd', role: 'Admin', emailVerified: true,
      }) }],
    });
    expect(screen.getByText('admin-only')).toBeInTheDocument();
    expect(screen.getByText('any-user')).toBeInTheDocument();
  });

  it('hides Admin block from Standard, shows Standard block', async () => {
    await render(HostComponent, {
      providers: [{ provide: Auth, useValue: authStub({
        userId: 'u', email: 'e', displayName: 'd', role: 'Standard', emailVerified: true,
      }) }],
    });
    expect(screen.queryByText('admin-only')).not.toBeInTheDocument();
    expect(screen.getByText('any-user')).toBeInTheDocument();
  });

  it('hides both blocks when not signed in', async () => {
    await render(HostComponent, {
      providers: [{ provide: Auth, useValue: authStub(null) }],
    });
    expect(screen.queryByText('admin-only')).not.toBeInTheDocument();
    expect(screen.queryByText('any-user')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run**

```bash
npm test -- permission
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): Permission for *appPermission template gating"
```

---

## Task 19: CI — build the Angular app alongside React in the home repo

**Files:**
- Modify: `home/.github/workflows/deploy-bluefinwiki.yml`

This task runs in the home repo, not BluefinWiki. The commit lands on `master` in the home repo (the workflow ships only when merged anyway).

- [ ] **Step 1: Add a `build-frontend-angular` job**

In `home/.github/workflows/deploy-bluefinwiki.yml`, alongside the existing `build-frontend` job, add a parallel job that mirrors its shape but targets `frontend-angular`:

```yaml
  build-frontend-angular:
    name: Build Angular frontend (parallel)
    runs-on: ubuntu-latest
    needs: [resolve-config]
    defaults:
      run:
        working-directory: BluefinWiki/frontend-angular
    steps:
      - name: Checkout (home repo)
        uses: actions/checkout@v4
        with:
          submodules: false

      - name: Checkout BluefinWiki submodule with deploy key
        uses: actions/checkout@v4
        with:
          repository: BlueFin605/BluefinWiki
          path: BluefinWiki
          ssh-key: ${{ secrets.BLUEFINWIKI_DEPLOY_KEY }}
          ref: ${{ github.event.inputs.ref || 'master' }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: BluefinWiki/frontend-angular/package-lock.json

      - name: Skip if frontend-angular doesn't exist yet
        id: check
        run: |
          if [ ! -f package.json ]; then
            echo "skip=true" >> $GITHUB_OUTPUT
            echo "frontend-angular not present; skipping"
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi

      - name: Install
        if: steps.check.outputs.skip == 'false'
        run: npm ci

      - name: Lint
        if: steps.check.outputs.skip == 'false'
        run: npm run lint

      - name: Type check
        if: steps.check.outputs.skip == 'false'
        run: npx tsc --noEmit -p tsconfig.app.json

      - name: Test
        if: steps.check.outputs.skip == 'false'
        run: npm run test:ci

      - name: Build (dev configuration, no NG_APP_* needed)
        if: steps.check.outputs.skip == 'false'
        run: npm run build
```

This job runs in parallel with `build-frontend`. It uses `dev` configuration (no env-var requirement) — it's a build/test gate, not a deploy.

Note: feature branches in submodules are sometimes pushed before the home-repo `master` references them. The `ref: master` line should be changed to `ref: feat/angular-rewrite` while developing the rewrite, then changed back to `master` (or removed) at Phase 8. **For this task, set `ref: feat/angular-rewrite`** so CI exercises the new code.

- [ ] **Step 2: Verify the workflow lints/parses**

```bash
cd ~/Development/Projects/Home  # or wherever the home repo lives
npx --yes @action-validator/cli .github/workflows/deploy-bluefinwiki.yml
```

If `@action-validator/cli` is unavailable, just visually compare to other build jobs in the file for shape consistency.

- [ ] **Step 3: Commit in the home repo**

From the home repo root:

```bash
git add .github/workflows/deploy-bluefinwiki.yml
git commit -m "ci(bluefinwiki): add build-frontend-angular parallel job for Phase 1 foundation"
```

Do **not** push yet — wait until the BluefinWiki branch has been pushed first so the workflow can find the submodule ref.

- [ ] **Step 4: Push BluefinWiki branch, then home repo**

```bash
git -C BluefinWiki push -u origin feat/angular-rewrite
git push
```

Watch the GitHub Actions run for the home repo: the new `build-frontend-angular` job should be green.

- [ ] **Step 5: If CI fails, fix and recommit**

Debug locally first (`cd BluefinWiki/frontend-angular && npm ci && npm run lint && npm test && npm run build`). Push the BluefinWiki fix, re-trigger the workflow.

---

## Task 20: Local smoke test + phase exit checklist

**Files:** none (verification only)

- [ ] **Step 1: Clean install in a fresh checkout-like state**

```bash
cd BluefinWiki/frontend-angular
rm -rf node_modules dist
npm ci
```

- [ ] **Step 2: Run the full local gate**

```bash
npm run lint && npm test && npm run build
```

Expected: all three green, in under ~3 minutes total.

- [ ] **Step 3: Boot dev server with DISABLE_AUTH bypass**

The dev `environment.ts` already has `disableAuth: true`. Start:

```bash
npm start
```

Walk every route, verify each renders its placeholder:
- `http://localhost:5173/` → redirects to `/pages` → "Pages placeholder"
- `/pages/abc123`
- `/pages/abc123/edit`
- `/profile`
- `/settings`
- `/admin/page-types`
- `/admin/users`
- `/admin/invitations`
- `/admin/rebuild-page-index`
- `/nope` → 404

Stop the server.

- [ ] **Step 4: Boot dev server with auth on (no real Cognito needed)**

Edit `src/environments/environment.ts` and flip `disableAuth: false`. Restart `npm start`. Visit `/pages` — expect to be redirected to a Cognito Hosted UI URL (the redirect will likely fail because `testPoolId0`/`testclientid…` aren't real, but the redirect attempt is what we're verifying). Look at the browser URL — it should begin `https://auth.dev.bluefinwiki.bluefin605.com/oauth2/authorize?` (matching the dev environment.ts default).

Restore `disableAuth: true` after the check.

- [ ] **Step 5: Phase exit checklist**

All boxes must be true before declaring Phase 1 complete:

- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] `npm test` — all tests pass, 0 skipped, JUnit XML emitted
- [ ] `npm run build` — succeeds, dist artifacts in `dist/frontend-angular/browser/`
- [ ] `npm run build:prod` — succeeds with stub `NG_APP_*` env vars
- [ ] `npm start` — dev server on port 5173, all placeholder routes render
- [ ] DISABLE_AUTH off → `/pages` redirects to `auth.dev.…/oauth2/authorize?…` (correct URL shape, even with stub IDs)
- [ ] `home/.github/workflows/deploy-bluefinwiki.yml` `build-frontend-angular` job is green on the most recent push
- [ ] Spec section "Public/private boundary" honoured: no real Cognito IDs, account numbers, or domains in committed files (placeholders only)

- [ ] **Step 6: Tag the phase**

```bash
git -C BluefinWiki tag phase-1-foundation
git -C BluefinWiki push origin phase-1-foundation
```

---

## What's next

Phase 1 leaves you with a placeholder Angular app that builds, tests, deploys to CI, and authenticates. The React app is untouched and still ships to production.

Hand back to the writing-plans skill to draft **Phase 2: Markdown infrastructure** (unified pipeline, ported remark plugins, CodeMirror wrapper, MarkdownRenderer + WikiLink + WikiMermaid).
