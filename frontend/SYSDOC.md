# Frontend — BlueFinWiki

What this is: the Angular SPA — editor, page tree, boards, admin panels, auth UI. Served via `ng serve` locally (through Aspire) and as a CloudFront + S3 static site in production.

Built with: Angular 21 (standalone components, Angular Material, Angular CDK), CodeMirror for the Markdown editor, `amazon-cognito-identity-js` for auth, Jest for unit tests.

Note: `frontend/README.md` is the unedited Angular CLI boilerplate readme — it's accurate for basic `ng` commands but doesn't describe this app; treat this SYSDOC and the source as authoritative instead.

## Where things are

- `src/app/core/` — app-wide singletons (auth, HTTP, guards, etc.)
- `src/app/features/` — one folder per feature area: `admin`, `ai`, `attachments`, `board`, `editor`, `page-types`, `pages`, `profile`, `search`, `tags`, `callback`, `errors`, `not-found`
- `src/app/shared/` — shared components/pipes/directives
- `src/app/testing/` — test utilities
- `src/environments/` — environment config (dev/production), populated by `scripts/build-env.mjs`
- `ngsw-config.json` — Angular service worker config (production builds only)

## Running / using this area

- Dev server: normally started by Aspire (see `../aspire/SYSDOC.md`), not run standalone. If needed directly: `npm start` (wraps `ng serve`, respects `$PORT`, defaults to 5173).
- Unit tests: `npm test` (Jest). `npm run test:watch` for watch mode.
- Type-check only: `npm run type-check`.
- Production build: `npm run build:prod` (runs `scripts/build-env.mjs` first to inject environment values, then `ng build --configuration production`).
- E2E coverage for this app lives in `../e2e/`, not here — see `e2e/SYSDOC.md`.
