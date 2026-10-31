# Single router Lambda — design

Date: 2026-10-31
Ticket: "UnifiedStack nearing CloudFormation 500-resource limit" (BlueFinWiki board, page `c59df29b-728a-4e56-b423-c064af0b148b`)

## Problem

`UnifiedStack` synthesizes to 433 resources against CloudFormation's 500 limit, leaving room for roughly 8-10 more endpoints at 6-8 resources each. Five resource types make up 366 of the 433: 110 `Lambda::Permission`, 96 `ApiGateway::Method`, 59 `Lambda::Function`, 57 `Logs::LogGroup`, 44 `ApiGateway::Resource`. Most of the Methods are per-route `OPTIONS` mocks from `DefaultCorsPreflightOptions`.

All 59 functions deploy the same `../backend/dist` asset (~56 MB, unbundled `tsc` output plus `node_modules`) and differ only by `Handler` string, so the split into functions buys nothing at runtime.

## Goals

- Headroom well below the 500 limit (target roughly 100-150 resources).
- Faster deploys (one function to update instead of ~50).
- Fewer per-endpoint cold starts; lighter cold starts via lazy handler loading and an esbuild bundle.
- New endpoints become a route-table entry instead of 6-8 resources.

Non-goals: cost savings (negligible either way), per-route throttling (none is used today), changing the public API (URL, stage, key and responses stay identical), restructuring handlers.

## Design

### Router Lambda

A new `api-router` function replaces the ~50 per-route API Lambdas.

- **Route table:** a static array of `{method, pattern, handler}`. The CDK stack is the source of truth for which routes exist; `local-server.ts` is a template for the table, not the authority (it has extras such as `/pages/root/children` and `/health`).
- **Matching:** static segments beat parameters (`/pages/search`, `/pages/children`, `/pages/reorder`, `/pages/links/resolve` beat `/pages/{guid}`; `/page-types/{guid}/allowed-children` beats `/page-types/{guid}`). No match → 404; known path with wrong method → 405. Both carry CORS headers.
- **Dispatch:** set `pathParameters`, `resource` and `path` on the API Gateway event, then call the existing handler. Handlers and the `withAuth` claims flow do not change. Param names must match what each handler reads.
- **Param quirk:** the invitation-revoke handler reads `pathParameters.code` but the route param is `invitationCode` (in CDK and local-server). The router maps `invitationCode` to `code` for that route. Needs a test.
- **Loading:** each handler is loaded with `await import()` on first use.
- **Results:** returned unchanged, including `isBase64Encoded` and headers, so attachment download and multipart upload keep working (`BinaryMediaTypes=multipart/form-data` is API-wide and still applies).
- **Role and config:** the shared `lambdaRole`, `commonEnvVars`, 30 s timeout, 512 MB, X-Ray active.

### API Gateway

- `{proxy+}` ANY with the Cognito authorizer.
- Explicit resources beside it (explicit resources take precedence over `{proxy+}`):
  - `POST /auth/register` — no authorizer.
  - `/mcp` (POST, GET) — `ApiKeyRequired`, usage plan unchanged, points at the existing `mcp` function.
  - The three long-running routes (see below), each pointing at its own function.
- CORS: one `OPTIONS` handling preflight for the proxy; the 4XX/5XX gateway responses with CORS headers stay. The per-route `OPTIONS` mocks are removed.
- Stage, throttling (50 rps / 100 burst), logging, deployment stage and API key are unchanged, so the API URL, frontend and MCP registration need no change.

### Stays as separate Lambdas

- 4 Cognito triggers (`auth/auth-pre-signup`, `-post-confirmation`, `-pre-token-generation`, `-custom-message`).
- 3 WebSocket Lambdas (`realtime/ws-connect`, `ws-disconnect`, `ws-default`).
- `search/vector-index-builder` (S3 event trigger, 5 min).
- `mcp` — own reduced IAM role and env, needs `Host` and `event.path`.
- `proxy-fetch-url` — own no-data-access role; its isolation is SSRF defense in depth.
- `ticket-keys-backfill`, `board-order-backfill`, `admin-rebuild-page-index` — 5 min / 1 GB, beyond API Gateway's 29 s integration timeout. Left exactly as they are today (explicit routes to their own functions).

### Observability

- A wrapper around each dispatch adds `route` (the pattern, e.g. `GET /pages/{guid}`), `requestId` and `status` to every log line, plus one summary line per request with duration. One log group instead of 57.
- Per-route metrics via an EMF log line per request with `route` as a dimension (API Gateway stage metrics no longer distinguish routes).
- X-Ray stays on; the router adds the route as a segment annotation.
- Unhandled handler throws are caught and returned as 500 with CORS headers.

### Build

Add an esbuild step after `tsc` in both `.github/workflows/backend.yml` and Home's `deploy-bluefinwiki.yml` build job. Bundle the router and the retained separate-handler entry points; output keeps the same `dir/file.handler` layout so the `Code.FromAsset("../backend/dist")` calls and the deploy workflow's `update-function-code` loop keep working. ESM, `--platform=node --target=node24`, with a `createRequire` banner if bundled dependencies use `require`. `local-server.ts` (`express`, `cors`, `ws`) must not be pulled into the Lambda bundle.

### Local dev

`local-server.ts` uses the same route table through the router, so local and production share one routing path and the two tables stop drifting.

## Testing

- Unit tests for matching: static beats param, 404, 405, param extraction for every route, the `invitationCode` → `code` mapping.
- Parity test: fails if a route exists in the CDK stack but not in the table, or the reverse.
- Existing handler tests unchanged.
- A FullyRested API collection run against the deployed stage before and after the change (see the `bluefin-api-testing` skill).
- `cdk synth` resource count before and after.

## Cutover and risks

- The deploy deletes the old per-route Lambdas and log groups; their log history goes with them.
- Production deploy is a manual Dean task via the Deploy BluefinWiki workflow, with a `cdk diff` reviewed first.
- A shared process means module-level caches and singletons are shared across routes; not a correctness issue but worth a read-through. `withAuth` already uses `AsyncLocalStorage` for per-request origin, which is safe.
- Concurrent requests still start extra containers; the account concurrency cap of 50 is unaffected.
- Authorizer moves from per-method to the proxy; `pagesCreate` currently has its own `PagesCreateAuthorizer` — confirm during planning that nothing depends on the difference.
- Lost: per-route API Gateway metrics, IAM and memory/timeout isolation between the routed endpoints.

## Docs impact

`infrastructure/SYSDOC.md`, `infrastructure/INFRASTRUCTURE.md`, `backend/SYSDOC.md`, and the root `SYSDOC.md` architecture text ("each endpoint is a separate handler") need updating. This is an infrastructure change to an existing HTTP surface: no endpoint is added or removed, so no new API-collection requests are needed beyond the before/after run.
