# Real-time updates over WebSocket — design

Date: 2026-10-05 · Piece 5 of the Board & UI improvements (Wiki Enhancements board)

## Goal

Changes made in one tab — or by Claude through the MCP server — appear in
every other open tab without a reload: tree, boards, open pages, comments,
attachments, page types.

## Approach

The frontend already refetches through a tag-based invalidation bus
(`core/api/invalidation.ts`). Real-time = the server pushes **tag names**; the
client bumps them. No data travels in the message.

```json
{ "type": "invalidate", "tags": ["page:abc", "children:any"], "origin": "tab-uuid-or-null" }
```

`origin` is the per-tab id the client sends as `X-Client-Id` on every API
call. A tab ignores events with its own origin (it already bumped those tags
itself). MCP writes carry `origin: null`, so every tab applies them.

## Backend

### Change tags — `backend/src/realtime/change-tags.ts`

Pure functions, deliberately coarse (an extra refetch is cheap):

| Write | Tags |
|---|---|
| `savePage(page)` | `page:<guid>`, `children:<folderId \|\| 'root'>`, `children:any`, `ancestors:any`, `backlinks:any` |
| `deletePage(guid)` | `page:<guid>`, `children:any`, `ancestors:any`, `backlinks:any` |
| `movePage(guid, parent)` | `page:<guid>`, `children:<parent \|\| 'root'>`, `children:any`, `ancestors:any`, `backlinks:any` |
| `saveComments(guid)` | `comments:<guid>` |
| attachment writes (`uploadAttachment`, `deleteAttachment`, `saveAttachmentMetadata`, `deleteAttachmentByKey`) | `attachments:<guid>` (key-only delete: `attachments:any` is not a client tag, so skip unless the guid is derivable from the key) |
| page type create/update/delete | `page-types:list`, `page-type:<guid>` |

### Broadcaster — `backend/src/realtime/broadcaster.ts`

```ts
export interface RealtimeEvent { type: 'invalidate'; tags: string[]; origin: string | null }
export interface Broadcaster { publish(event: RealtimeEvent): Promise<void> }
export function setBroadcaster(b: Broadcaster): void;   // local server installs its own
export function getBroadcaster(): Broadcaster;           // ApiGw when REALTIME_WS_ENDPOINT set, else installed one, else no-op
export async function publishChange(tags: string[]): Promise<void>;
//   origin from the request context; never throws; awaits at most 1000 ms
```

### Request origin — `backend/src/realtime/request-origin.ts`

`AsyncLocalStorage<string | null>`; `withAuth` (Lambda) and an Express
middleware (local server) run the handler inside `runWithOrigin(header('x-client-id'))`.
MCP requests don't send it → `null`.

### Publish points

- `BroadcastingStoragePlugin` (`backend/src/storage/BroadcastingStoragePlugin.ts`):
  wraps a `StoragePlugin`, delegating every method; after a write method
  resolves it calls `publishChange(tagsFor…)`; if the write throws, nothing is
  published. `getStoragePlugin()` returns the wrapped instance.
- `page-types-service.ts` `createPageType` / `updatePageType` /
  `deletePageType` call `publishChange` after success.

### Local transport

`local-server.ts` switches `app.listen` to `http.createServer(app)` + a `ws`
`WebSocketServer({ server, path: '/ws' })`, and installs a broadcaster that
sends the JSON to every open socket. Auth follows the local `withAuth` rule
(`IS_LOCAL` accepts `mock-jwt-token`). Messages `{"type":"ping"}` are
ignored. Frontend dev proxy (`proxy.conf.json`) adds `"/ws": { target:
"http://localhost:3000", ws: true }`.

### Production transport (API Gateway WebSocket API)

- Lambdas (handlers in `backend/src/realtime/`):
  - `ws-connect.ts` — `$connect`: verify `queryStringParameters.token` with
    the same `CognitoJwtVerifier` config as `middleware/auth.ts`; on success
    `PutItem { connectionId, userId, expiresAt: now+24h }` into
    `RealtimeConnections`; 401 otherwise.
  - `ws-disconnect.ts` — `$disconnect`: `DeleteItem`.
  - `ws-default.ts` — `$default`: returns 200 (pings keep the connection
    alive; nothing else is accepted).
- `ApiGwBroadcaster`: `Scan` the table (projection `connectionId`),
  `PostToConnectionCommand` to each via `ApiGatewayManagementApiClient({ endpoint: REALTIME_WS_ENDPOINT })`
  in parallel; on `GoneException` (410) delete the row; other errors logged.
- CDK (`UnifiedStack.cs`):
  - `RealtimeConnections` table (PK `connectionId`, TTL `expiresAt`, on-demand,
    `RemovalPolicy.DESTROY` — ephemeral data).
  - `WebSocketApi` (`aws-cdk-lib.aws_apigatewayv2` + integrations) with the
    three routes, stage `prod` auto-deployed; function names follow the
    `{prefix}-{env}-ws-*` convention so Home's deploy workflow updates them.
  - Created **before** `commonEnvVars` so every Lambda (shared `lambdaRole`)
    and the MCP Lambda get `REALTIME_WS_ENDPOINT` (the `https://…/prod`
    callback URL) and `REALTIME_CONNECTIONS_TABLE`; grant both roles
    `RealtimeConnections` read/write and `execute-api:ManageConnections` on
    the API.
  - `CfnOutput RealtimeUrl` = `wss://…/prod`.
  - `INFRASTRUCTURE.md` cost section updated.
- Backend deps: `ws` (+ `@types/ws`, dev-only use in local server) and
  `@aws-sdk/client-apigatewaymanagementapi`.

### Cost

For a handful of users: API Gateway WebSocket $1.00/M messages +
$0.25/M connection-minutes (one tab 8 h/day ≈ 15k min/month ≈ $0.004);
DynamoDB on-demand for a few rows and scans — cents; three tiny Lambdas — free
tier. Expected well under $0.10/month.

## Frontend

- `environment.types.ts` gains `realtimeUrl: string` — dev `'/ws'` (resolved
  against `location` to `ws(s)://host/ws`), prod from `NG_APP_REALTIME_URL`
  (optional in `build-env.mjs`; empty disables realtime).
- `core/api/client-id-interceptor.ts` — adds `X-Client-Id: <tab uuid>` to
  every API request; the uuid comes from `core/realtime/client-id.ts`
  (`crypto.randomUUID()` once per tab, kept in `sessionStorage`).
- `core/realtime/realtime.ts` — `Realtime` service:
  - `start()` / `stop()`; started by the `App` root once `Auth.user()` is set,
    stopped when it clears.
  - connects to `realtimeUrl?token=<Auth.getIdToken() ?? 'mock-jwt-token' when disableAuth>`;
  - on `invalidate` with `origin !== clientId`: if `PageContext.mode() === 'edit'`
    and `PageContext.dirty()` and the tags include `page:<PageContext.guid()>`,
    drop that tag and set `PageContext.remoteChange.set(true)`; bump the rest
    with `bus.bumpMany`;
  - reconnect with backoff 1 s, 2 s, 4 s … capped at 30 s (reset on open);
    ping every 5 min; pause while `document.hidden`, resume on visible;
  - after every (re)open except the first: catch-up bump of `children:any`,
    `ancestors:any`, `page-types:list` and `page:<current guid>` (unless held
    back as above).
- `PageContext` gains `dirty: WritableSignal<boolean>` (published by
  page-detail from its existing `dirty()` computed) and
  `remoteChange: WritableSignal<boolean>` (cleared by `reset()` and on
  navigation).
- `page-detail` banner when `pageContext.remoteChange()`: "This page was
  changed elsewhere." **Reload** (discard draft, refetch — the same path as the
  existing Refresh/discard) · **Dismiss** (clear the flag, keep editing).
- No UI for connection state; failures log a console warning only.

## Home repo (deploy wiring)

On the Home repo's `feature/wiki-enhancements` branch:

- `.github/workflows/deploy-bluefinwiki.yml` — resolve `RealtimeUrl` from the
  stack outputs (like `ApiUrl`) and pass `NG_APP_REALTIME_URL` to the frontend
  build.
- `configuration/bluefinwiki/deploy-infra.ps1` — same for its local
  frontend-build env block.

## Testing

Backend (vitest): change-tags per write; decorator publishes only after
success and never on failure, and publish errors don't fail the write;
`publishChange` timeout; origin from `runWithOrigin`; `ApiGwBroadcaster` 410
cleanup (mocked clients); `ws-connect` accepts/rejects tokens; local `ws`
broadcaster delivers to a connected client.

Frontend (Jest): interceptor header; `Realtime` with a fake `WebSocket` —
bumps tags, skips own origin, holds back the dirty edited page and sets
`remoteChange`, reconnect backoff + catch-up, pause on hidden; banner Reload /
Dismiss.

E2E (Playwright, local stack with real `ws`), `realtime.spec.ts`:
1. Two contexts on the same tree; rename a page in B → A's tree shows the new
   title without reload.
2. A board open in A; change a card's `state` via the API (as the MCP does,
   no `X-Client-Id`) → the card moves column in A.
3. A editing page X with an unsaved change; B saves X → A shows the banner and
   keeps its draft; Reload shows B's version.

CDK: `cdk synth` succeeds; Dean runs `cdk diff` and reviews before deploying.

## Out of scope

Presence, collaborative editing, payloads in messages, admin lists
(`users:list`, `invitations:list`), connection-status UI.
