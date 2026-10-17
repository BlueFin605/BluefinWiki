# API suite gap log

## FullyRested gaps
- Empty folders are plain directories, so git drops them; a `.gitkeep` is needed in each (no folder manifest in the .frcol).
- Collection variables vs environment variables: `pageGuid` is an env variable the seeded data must fill by hand; no documented way to capture a created guid from one response into later requests (to verify in later tickets; raise if awkward).
- `tree` omits the selected environment and validation detail, so layout checks need `environments` as a second call.
- No MCP-client request type, so the `mcp` folder cannot hold real MCP smoke calls (only raw JSON-RPC over POST /mcp if supported).
- Websocket requests exist only on feature/websocket-support, so the `ws` folder stays empty until that branch is merged.

## BlueFinWiki behaviour (confirmed by request against localhost:3000)
- CONFIRMED: `GET /pages/search?q=a` returns 400 "Invalid GUID format" (route shadowed by `GET /pages/:guid`).
- CONFIRMED: `DELETE /admin/invitations/<code>` returns 400 "Invitation code is required" (param not passed to handler).
- CONFIRMED: `POST /admin/rebuild-page-index` with no Authorization header returns 200 (no auth).
- `pages/board-order backfill` has an unauthenticated case; confirm that route's auth expectation when the pages ticket is done.

## Ticket 9bd37d0d (health and auth/profile)
- Runs cannot override the request body (only variables, headers, params, auth, validation), so per-case bodies need a `{{variable}}` placeholder in the body and a variable on each run.
- A request with runs sends only its runs (the bare request is not a case), so the happy path needs its own run too.
- `new_request` with a `{{baseUrl}}/...` url defaults to https; `set_url` with an `http://` prefix is needed to get protocol http.
- `set_body` contentType `json` sends a literal `Content-Type: json` header; `application/json` is needed.
- An empty variable cannot produce an empty request body (it was sent as `""`), so the register "Request body is required" 400 is untested.
- No capture of a created invite code into a later request, so register 201 and 409 are not written; locally POST /auth/register with a valid invite also returns 500 (no Cognito user pool in the local stack).
- Express returns an HTML 400 (not JSON) for a malformed JSON body on POST /auth/register; covered by the `malformed body` run with a header check.

## Ticket 2b07e530 (pages CRUD)
- No capture of a created guid into later requests, so the suite cannot create-then-GET/PUT/DELETE: GET/PUT 200 use an env variable `crudPageGuid` holding a hand-created fixture page (like `pageGuid`; it must be re-created if the local stack is reset), and the create runs leak one page each (remove them by hand).
- DELETE 200, recursive delete of descendants, and the 409 HAS_CHILDREN case (non-recursive delete of a page with children, confirmed by curl) are not covered: a delete consumes its page and needs a freshly created guid on every run.
- Runs cannot send an empty request body, so the "Request body is required" 400 on POST /pages and PUT /pages/:guid is untested.
- A Standard-role 403 case uses an unsigned JWT in env variable `standardToken` (not a secret); the local backend decodes it without verifying and gives it role Standard, so it works.
- PUT /pages/:guid 404 returns only `{error}` without `code`, while GET returns `code: PAGE_NOT_FOUND` (inconsistent error shape).
- Malformed JSON on POST /pages returns Express HTML 400, not the JSON error shape (header check in `malformed body` run).
- The seeded `pageGuid` was no longer present locally (404), so `board-order backfill > existing page` fails until it is re-seeded.

## Ticket 07f68685 (pages tree, search and ticket-key requests)
- A `{{variable}}` inside another variable's value (run `payload` holding `{{crudPageGuid}}`) is not expanded, so self-move, reorder and similar bodies hard-code the fixture guid `0ea160d4-...` (re-create and edit if the local stack is reset).
- No hierarchy fixture without capture: circular move (move under own descendant), reorder 200 that changes order (`updated` > 0) and children paging (limit/cursor/depth with real children) are untested.
- `GET /ticket-keys/:key` 200, `POST /pages/:guid/ticket-keys/backfill` 200 and idempotency are untested (need an Initiative with keyPrefix and a captured key); only 400/401/403/404 are covered.
- `GET /pages/:guid/backlinks` 200 only asserts an empty list (no way to create a linking page and capture its guid).
- Empty request body (400 "Request body is required") on PUT /pages/:guid/move and PUT /pages/reorder is untested (runs cannot send an empty body).
- Known failure: `GET /pages/search` shadowed by `GET /pages/:guid` (400 "Invalid GUID format"); both search runs (results, missing q) fail until the route order is fixed.
- Known failure: `GET /pages/:guid/ancestors` returns 200 `{ancestors: []}` for an unknown guid and for a non-GUID string (no 400/404).
- Known failure: `POST /pages/:guid/board-order/backfill` with a non-GUID returns 500 "Failed to backfill boardOrder" instead of 400.
- `pages/board-order backfill > existing page` still fails (seeded `pageGuid` 404 locally); `crud fixture page` runs cover the 200 and idempotency instead.
- Reorder 400 on empty `orderedGuids` returns zod `details` as an array while move returns it as an object (inconsistent shape).
