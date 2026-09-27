# Backend — BlueFinWiki

What this is: AWS Lambda function handlers implementing the BlueFinWiki API (pages, auth, storage, search, tags, page types, an MCP server for AI tooling). In production each handler runs as a Lambda behind API Gateway; locally, `local-server.ts` wraps the same handlers in an Express app (run via Aspire, port 3000) so nothing behaves differently between environments.

Built with: Node.js 20 + TypeScript, AWS SDK v3 clients (S3, DynamoDB, Cognito, SES, Bedrock), `aws-jwt-verify`, `zod` for validation, Vitest for tests.

## Where things are

- `src/auth/` — Cognito-based auth: registration, JWT triggers, custom email templates, invitations, and admin user-management handlers (`admin-users-*.ts`).
- `src/middleware/auth.ts` — the `withAuth`/`withRole` middleware used by every protected handler.
- `src/pages/` — the `/pages` CRUD handlers (create/get/update/delete/move/list-children), wiki-link extraction and resolution, and backlink tracking.
- `src/storage/` — the pluggable storage abstraction (`StoragePlugin` interface) that all page/attachment persistence goes through; ships an S3 implementation. Pages are Markdown + YAML frontmatter, GUID-named, with children stored under a `{parent-guid}/` directory — this is the on-disk contract any new storage backend must preserve. Full interface and error-code reference: `src/storage/PLUGIN-DEVELOPER-GUIDE.md`; design rationale: `src/storage/S3-STORAGE-ARCHITECTURE.md`.
- `src/search/`, `src/tags/`, `src/page-types/` — handlers for full-text search indexing, the tag registry, and page-type schema management.
- `src/mcp/` — an MCP server (`mcp-handler.ts` + `tools/`) exposing wiki operations as tools for AI clients.
- `src/middleware/` — shared Lambda middleware (auth plus other cross-cutting concerns).
- `src/local-server.ts` — Express entry point used only for local dev via Aspire; not used in production.

## Running / using this area

- Local dev: normally started by Aspire (see `../aspire/SYSDOC.md`); direct invocation is `npm run dev` (port 3000, via `local-server.ts`).
- Unit tests: `npm test` (Vitest). Integration tests against LocalStack: `npm run test:integration` — requires Aspire/LocalStack running first (`dotnet run --project ../aspire/BlueFinWiki.AppHost`); see `src/storage/TESTING-WITH-ASPIRE.md` for the full integration-test walkthrough and troubleshooting.
- `npm run test:all` runs both unit and integration suites.
