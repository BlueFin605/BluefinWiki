# Backend — BlueFinWiki

What this is: AWS Lambda function handlers implementing the BlueFinWiki API (pages, auth, storage, search, tags, page types, an MCP server for AI tooling). In production most routes run inside one `api-router` Lambda, which looks the request up in the route table (`src/router/routes.ts`) and calls that route's handler; the Cognito triggers, WebSocket Lambdas, vector-index builder, MCP server, URL-fetch proxy and the three long-running admin jobs keep their own Lambdas. Locally, `local-server.ts` sends every request through the same route table inside an Express app (run via Aspire, port 3000), so routing is identical in both places.

Built with: Node.js 24 + TypeScript, esbuild, AWS SDK v3 clients (S3, DynamoDB, Cognito, SES, Bedrock), `aws-jwt-verify`, `zod` for validation, Vitest for tests.

## Where things are

- `src/auth/` — Cognito-based auth: registration, JWT triggers, custom email templates, invitations, and admin user-management handlers (`admin-users-*.ts`).
- `src/middleware/auth.ts` — the `withAuth`/`withRole` middleware used by every protected handler.
- `src/pages/` — the `/pages` CRUD handlers (create/get/update/delete/move/list-children), wiki-link extraction and resolution, and backlink tracking.
- `src/storage/` — the pluggable storage abstraction (`StoragePlugin` interface) that all page/attachment persistence goes through; ships an S3 implementation. Pages are Markdown + YAML frontmatter, GUID-named, with children stored under a `{parent-guid}/` directory — this is the on-disk contract any new storage backend must preserve. Full interface and error-code reference: `src/storage/PLUGIN-DEVELOPER-GUIDE.md`; design rationale: `src/storage/S3-STORAGE-ARCHITECTURE.md`.
- `src/search/`, `src/tags/`, `src/page-types/` — handlers for full-text search indexing, the tag registry, and page-type schema management.
- `src/mcp/` — an MCP server (`mcp-handler.ts` + `tools/`) exposing wiki operations as tools for AI clients. `tools/kanban/` adds the `kanban_*` tools that treat an Initiative page and its Epic/Story/Task descendants as a dev Kanban board (used by the `bluefin-kanban` skill).
- `src/realtime/` — realtime publishing (`upsert` / `invalidate` messages) and the WebSocket connection Lambdas; `src/storage/BroadcastingStoragePlugin.ts` publishes after every storage write. The message contract is in the root `../SYSDOC.md` "Realtime updates" section.
- `src/middleware/` — shared Lambda middleware (auth plus other cross-cutting concerns).
- `src/router/` — the API router: `routes.ts` (every REST route -> handler, and which ones keep their own Lambda), `match.ts`/`dispatch.ts`, and `lambda.ts` (the `api-router` entry).
- `src/local-server.ts` — Express entry point used only for local dev via Aspire; mounts the router through `src/local-adapter.ts` (Express <-> API Gateway event bridge). Not used in production.

## Running / using this area

- Local dev: normally started by Aspire (see `../aspire/SYSDOC.md`); direct invocation is `npm run dev` (port 3000, via `local-server.ts`). The MCP server is at `POST http://localhost:3000/mcp` locally, with no API key (prod requires the API Gateway key).
- Unit tests: `npm test` (Vitest). Integration tests against LocalStack: `npm run test:integration` — requires Aspire/LocalStack running first (`dotnet run --project ../aspire/BlueFinWiki.AppHost`); see `src/storage/TESTING-WITH-ASPIRE.md` for the full integration-test walkthrough and troubleshooting.
- `npm run test:all` runs both unit and integration suites.
- Adding an endpoint: add an entry to `src/router/routes.ts`. `npm test` runs `cdk-parity.test.ts`, which fails if API Gateway in `UnifiedStack.cs` can't reach the route or the two disagree on which routes have their own Lambda.
- Build: `npm run build` bundles the Lambda entry points listed in `scripts/lambda-entries.mjs` with esbuild into `dist/` (the asset CDK deploys); `npm run verify:dist` loads each one.
