# React → Angular Conversion — Phase 8: PWA + Local Cutover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-bluefinwiki-react-to-angular-design.md`
**Roadmap:** `docs/superpowers/plans/2026-05-21-bluefinwiki-react-to-angular-roadmap.md`
**Branch:** `feat/angular-rewrite` (continues from local tag `phase-7-search-ai`, commit `bd08f60`).
**Working directory:** `BluefinWiki/` (the cutover touches the whole submodule, not just one frontend folder).

**Goal:** Add `@angular/pwa` with a service-worker config that mirrors today's `vite-plugin-pwa` runtime cache for `/api/*`. Update Aspire AppHost to launch the Angular dev server instead of the React Vite app. **Locally** swap directories: delete `frontend/` (React), rename `frontend-angular/` → `frontend/` (Angular). At this point Aspire AppHost runs the Angular app under `frontend/`. Phase 8 deliberately **skips** all push/deploy steps per Dean's local-only constraint — the home-repo workflow + submodule pointer bump + S3 deploy land later when Dean manually pushes.

**Architecture:**
- **PWA:** `ng add @angular/pwa` generates `ngsw-config.json`, `manifest.webmanifest`, the service-worker registration in `app.config.ts`, and icon assets. We replace the generated `ngsw-config.json` with a runtimeCache config matching React's: `NetworkFirst` for `/api/*`, 3s timeout, 100 entries, 24h max age.
- **Aspire:** Replace `builder.AddViteApp("frontend", "../../frontend")` with `builder.AddNpmApp("frontend", "../../frontend", "start")` so Aspire runs `npm start` (which the Angular CLI handles via `ng serve`). Rename the `VITE_*` env vars on the resource to `NG_APP_*` — the Angular app reads them via `scripts/build-env.mjs` at build time, but for dev they're still useful as documentation. (`disableAuth: true` is already in `environment.ts` dev defaults.)
- **Directory swap:** `git rm -r BluefinWiki/frontend/` then `git mv BluefinWiki/frontend-angular/ BluefinWiki/frontend/`. Per the spec the Aspire AppHost's path `../../frontend` then resolves to the Angular app. The proxy config + Angular CLI workspace stay relative to that path.
- **Submodule pointer (home repo):** **Do not** bump. The home repo's `deploy-bluefinwiki.yml` still points at the React build path; bumping the submodule pointer now would break the deploy. The bump lands when Dean is ready to ship.

**Cross-phase reminders:** Local-only execution per `feedback_bluefinwiki_angular_local_only` — no `git push`, no `deploy-infra`, no submodule-pointer commits in the home repo, no tag push.

---

## Task 1: `ng add @angular/pwa` baseline

**Files:**
- Modify: `BluefinWiki/frontend-angular/package.json` (adds `@angular/service-worker`)
- Modify: `BluefinWiki/frontend-angular/angular.json` (adds `serviceWorker: "ngsw-config.json"`, `assets` includes manifest)
- Create: `BluefinWiki/frontend-angular/ngsw-config.json`
- Create: `BluefinWiki/frontend-angular/public/manifest.webmanifest`
- Modify: `BluefinWiki/frontend-angular/src/index.html` (link manifest, set theme color)
- Modify: `BluefinWiki/frontend-angular/src/app/app.config.ts` (`provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })`)

From `BluefinWiki/frontend-angular/`:

- [ ] **Step 1: Add the package**

```bash
npm install @angular/service-worker
```

Zero-warning rule applies (per `feedback_npm_install_zero_warnings`). If a deprecated transitive shows up, capture it in the commit body.

- [ ] **Step 2: Run the generator**

```bash
npx ng add @angular/pwa --project frontend-angular --skip-install
```

If `ng add` errors because the package is already installed, run the schematic directly:
```bash
npx ng generate @angular/pwa:ng-add --project frontend-angular
```

Confirm it created `ngsw-config.json`, `public/manifest.webmanifest`, icon stubs in `public/icons/`, and modified `angular.json` + `app.config.ts` + `index.html`.

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: success. The build now also emits `ngsw-worker.js` and the manifest into `dist/<project>/browser/`.

- [ ] **Step 4: Verify tests still pass**

```bash
npm test
```

Expected: 381 tests pass. The service worker doesn't activate under jest/jsdom, so nothing regresses here.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "chore(angular): add @angular/pwa baseline (service worker + manifest)"
```

---

## Task 2: Mirror React's runtime cache + manifest

**Files:**
- Modify: `BluefinWiki/frontend-angular/ngsw-config.json`
- Modify: `BluefinWiki/frontend-angular/public/manifest.webmanifest`
- Copy PWA icons from `BluefinWiki/frontend/public/` → `BluefinWiki/frontend-angular/public/`

- [ ] **Step 1: Copy icons from the React app**

```bash
cp BluefinWiki/frontend/public/apple-touch-icon-180x180.png BluefinWiki/frontend-angular/public/
cp BluefinWiki/frontend/public/favicon.svg BluefinWiki/frontend-angular/public/
cp BluefinWiki/frontend/public/maskable-icon-512x512.png BluefinWiki/frontend-angular/public/
cp BluefinWiki/frontend/public/pwa-64x64.png BluefinWiki/frontend-angular/public/
cp BluefinWiki/frontend/public/pwa-192x192.png BluefinWiki/frontend-angular/public/
cp BluefinWiki/frontend/public/pwa-512x512.png BluefinWiki/frontend-angular/public/
```

- [ ] **Step 2: Overwrite manifest.webmanifest**

```json
{
  "name": "BlueFinWiki",
  "short_name": "BlueFinWiki",
  "description": "Family Wiki",
  "theme_color": "#2563eb",
  "background_color": "#f9fafb",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [
    { "src": "pwa-64x64.png", "sizes": "64x64", "type": "image/png" },
    { "src": "pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "pwa-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Overwrite ngsw-config.json**

```json
{
  "$schema": "./node_modules/@angular/service-worker/config/schema.json",
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": {
        "files": [
          "/favicon.ico",
          "/favicon.svg",
          "/index.html",
          "/manifest.webmanifest",
          "/*.css",
          "/*.js"
        ]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": [
          "/media/**",
          "/*.(svg|cur|jpg|jpeg|png|apng|webp|avif|gif|otf|ttf|woff|woff2|ico)"
        ]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "api-cache",
      "urls": ["/api/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 100,
        "maxAge": "1d",
        "timeout": "3s"
      }
    }
  ]
}
```

(`strategy: "freshness"` = NetworkFirst. `timeout: "3s"` = 3-second network timeout before falling back to cache. `maxSize: 100` matches React's `maxEntries`. `maxAge: "1d"` matches the 86400-second React value.)

- [ ] **Step 4: Verify build still passes**

```bash
npm run build
```

Expected: success. The output now bundles the runtime config into `ngsw.json` for the service worker.

- [ ] **Step 5: Commit**

```bash
git -C BluefinWiki add frontend-angular/
git -C BluefinWiki commit -m "feat(angular): PWA manifest + ngsw-config matching React's vite-plugin-pwa"
```

---

## Task 3: Update Aspire `Program.cs`

**Files:**
- Modify: `BluefinWiki/aspire/BlueFinWiki.AppHost/Program.cs`

Replace the Vite resource block with an `AddNpmApp` call. The path stays `"../../frontend"` because we'll rename `frontend-angular/` → `frontend/` in Task 4, but for now while both folders exist we point at `../../frontend-angular`.

Current React block (lines ~52–63):

```csharp
var frontend = builder.AddViteApp("frontend", "../../frontend")
    .WithEnvironment("NODE_ENV", "development")
    .WithEnvironment("VITE_DISABLE_AUTH", "true")
    .WithEnvironment("VITE_API_BASE_URL", "http://localhost:3000")
    .WithEnvironment("VITE_ALLOW_LOCAL_API_IN_PROD", "true")
    .WithEnvironment("VITE_AWS_REGION", "us-east-1")
    .WithEnvironment("VITE_COGNITO_USER_POOL_ID", "local_abc123")
    .WithEnvironment("VITE_COGNITO_CLIENT_ID", "local-client-id")
    .WithEnvironment("VITE_COGNITO_ENDPOINT", "http://localhost:9229")
    .WithEnvironment("VITE_LOCALSTACK_ENDPOINT", "http://localhost:4566")
    .WithExternalHttpEndpoints();
```

Replace with the Angular-app version. Comment the block out (don't delete yet) — Task 4 deletes it after the directory swap is verified.

- [ ] **Step 1: Add the Angular block (commented out for now)**

Append after the Vite block:

```csharp
// Angular frontend (after Phase 8 cutover lands in this directory).
// var frontendAngular = builder.AddNpmApp("frontend-angular", "../../frontend-angular", "start")
//     .WithEnvironment("NODE_ENV", "development")
//     .WithEnvironment("NG_APP_API_BASE_URL", "http://localhost:3000")
//     .WithHttpEndpoint(port: 5174, env: "PORT")
//     .WithExternalHttpEndpoints();
```

(Phase 8 doesn't run the Angular app under Aspire until after the rename in Task 4. For now the React app continues to run on :5173, and the developer launches the Angular app manually on :5174 via `npm start` in `frontend-angular/` if they want to dual-test.)

- [ ] **Step 2: Verify Aspire still builds**

```bash
cd BluefinWiki/aspire/BlueFinWiki.AppHost
dotnet build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git -C BluefinWiki add aspire/
git -C BluefinWiki commit -m "chore(aspire): document Angular AddNpmApp block (commented; activates after cutover)"
```

---

## Task 4: THE BIG SWAP — delete `frontend/`, rename `frontend-angular/` → `frontend/`

**Files:**
- Delete (entire tree): `BluefinWiki/frontend/`
- Rename (entire tree): `BluefinWiki/frontend-angular/` → `BluefinWiki/frontend/`
- Modify: `BluefinWiki/aspire/BlueFinWiki.AppHost/Program.cs` (uncomment Angular block, delete Vite block)
- Update `proxy.conf.json`, scripts, env paths, etc. relative to new location

**Safety net:** Do this as a single commit on the `feat/angular-rewrite` branch. If anything breaks, `git revert <sha>` brings everything back.

- [ ] **Step 1: Delete `frontend/` (React)**

```bash
git -C BluefinWiki rm -rf frontend/
```

- [ ] **Step 2: Rename the Angular app**

```bash
git -C BluefinWiki mv frontend-angular frontend
```

- [ ] **Step 3: Update Aspire — uncomment Angular block, delete Vite block**

Edit `BluefinWiki/aspire/BlueFinWiki.AppHost/Program.cs`. Final state of the frontend block:

```csharp
// Angular frontend (Phase 8 cutover).
var frontend = builder.AddNpmApp("frontend", "../../frontend", "start")
    .WithEnvironment("NODE_ENV", "development")
    .WithEnvironment("NG_APP_API_BASE_URL", "http://localhost:3000")
    .WithHttpEndpoint(port: 5173, env: "PORT")
    .WithExternalHttpEndpoints();
```

(`PORT=5173` matches the React app's old port. Angular CLI reads PORT via its build environment.)

Delete the old Vite block entirely. Confirm no `VITE_*` env vars remain in `Program.cs`.

- [ ] **Step 4: Confirm package.json name still works**

```bash
cat BluefinWiki/frontend/package.json | grep '"name"'
```

The name `"frontend-angular"` is harmless — it's just for npm. We can leave it or rename. **Decision:** leave it for this commit; renaming the package can be a follow-up that doesn't risk breaking anything.

- [ ] **Step 5: Re-run the full local gate**

```bash
cd BluefinWiki/frontend
npm install            # in case anything reshuffled
npm run lint
npm test
npm run build
npm run build:prod     # with the same stub NG_APP_* env vars as prior phases
```

Expected: all green. Test count unchanged from Phase 7 (~381 tests).

- [ ] **Step 6: Aspire builds**

```bash
cd BluefinWiki/aspire/BlueFinWiki.AppHost
dotnet build
```

Expected: success.

- [ ] **Step 7: Commit the cutover**

```bash
git -C BluefinWiki add .
git -C BluefinWiki commit -m "feat(angular): cutover — delete React frontend, rename frontend-angular to frontend"
```

(One commit captures the whole swap — easier to revert if needed.)

---

## Task 5: Local Aspire smoke + Phase 8 exit gate

**Files:** no source changes.

- [ ] **Step 1: Local lint+test+build gate**

```bash
cd BluefinWiki/frontend
npm run lint && npm test && npm run build && npm run build:prod
```

All four must succeed.

- [ ] **Step 2: Aspire end-to-end (manual — deferred to user if running non-interactively)**

```bash
cd BluefinWiki/aspire/BlueFinWiki.AppHost
dotnet run
```

In the Aspire dashboard, the resources should show:
- `localstack`, `cognito-local`, `mailhog`, `backend` — running, healthy
- `frontend` (Angular) — running on http://localhost:5173

Open http://localhost:5173 in a browser:
- [ ] `/pages` renders. Sidebar shows pages from the backend.
- [ ] Click a page → renders via the Phase 2 markdown pipeline.
- [ ] Click Edit → CodeMirror loads. Save works.
- [ ] Ctrl/Cmd+K → SearchDialog opens.
- [ ] AI button (if Chrome AI is on) reveals the sidebar.
- [ ] DevTools → Application → Service Workers → `ngsw-worker.js` is registered.
- [ ] DevTools → Application → Manifest → BluefinWiki name + theme color visible.

Stop Aspire.

- [ ] **Step 3: Phase 8 exit checklist**

- [ ] `npm run lint` clean
- [ ] `npm test` all green, 0 skipped (modulo the documented Phase 2 xit)
- [ ] `npm run build` succeeds
- [ ] `npm run build:prod` succeeds (with stub env)
- [ ] Aspire dashboard launches all resources cleanly
- [ ] Service worker registers in the dev build
- [ ] Manifest renders in DevTools
- [ ] **No `git push`, no `deploy-infra`, no submodule-pointer bump in the home repo, no tag push**

- [ ] **Step 4: Local tag**

```bash
git -C BluefinWiki tag phase-8-pwa-cutover
```

Do **not** push.

- [ ] **Step 5: Commit any smoke follow-ups**

If the manual smoke surfaced fixes:

```bash
git -C BluefinWiki status
git -C BluefinWiki add .
git -C BluefinWiki commit -m "fix(angular): Phase 8 smoke-test follow-ups"
```

---

## What's left after Phase 8 (NOT in this phase — Dean does these manually)

- [ ] `git push origin feat/angular-rewrite` (when Dean is ready to share with the home repo or open a PR — local only for now).
- [ ] Update the home repo's `.github/workflows/deploy-bluefinwiki.yml`:
  - `working-directory: BluefinWiki/frontend` stays the same (the directory is renamed, the path doesn't change)
  - artifact path: `BluefinWiki/frontend/dist/<project>/browser/` (Angular CLI default)
  - `aws s3 sync` source: `BluefinWiki/frontend/dist/<project>/browser/`
  - env vars renamed `VITE_*` → `NG_APP_*`
- [ ] In the home repo, commit the submodule pointer bump and push.
- [ ] Manual deploy to staging via the home repo's workflow. Smoke. Then production.

The Angular conversion is **functionally complete** at Phase 8's local cutover. Production rollout is Dean's call.
