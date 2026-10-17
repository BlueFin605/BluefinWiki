# API suite gap log

## FullyRested gaps
- Empty folders are plain directories, so git drops them; a `.gitkeep` is needed in each (no folder manifest in the .frcol).
- Collection variables vs environment variables: `pageGuid` is an env variable the seeded data must fill by hand; no documented way to capture a created guid from one response into later requests (to verify in later tickets; raise if awkward).
- `tree` omits the selected environment and validation detail, so layout checks need `environments` as a second call.
- No MCP-client request type, so the `mcp` folder cannot hold real MCP smoke calls (only raw JSON-RPC over POST /mcp if supported).

## BlueFinWiki behaviour (confirmed by request against localhost:3000)
- FIXED (f13484d3, 9eed3d0f): `GET /pages/search` was shadowed by `GET /pages/:guid` in the local server (400 "Invalid GUID format"); the search route is now registered first. Deployed API Gateway was never affected (static resource wins over {guid}).
- FIXED (7727ee02): `DELETE /admin/invitations/<code>` returned 400 "Invitation code is required" because the handler read `pathParameters.code` while both the local route and the API Gateway resource name the param `invitationCode`. Handler now reads `invitationCode` (the deployed path was affected too).
- FIXED (d40def49): `POST /admin/rebuild-page-index` was unauthenticated locally; now routed through the deployed withAuth+withRole handler (401/401/403 asserted).
- `pages/board-order backfill` has an unauthenticated case; confirm that route's auth expectation when the pages ticket is done.

## Ticket 9bd37d0d (health and auth/profile)
- Runs cannot override the request body (only variables, headers, params, auth, validation), so per-case bodies need a `{{variable}}` placeholder in the body and a variable on each run.
- A request with runs sends only its runs (the bare request is not a case), so the happy path needs its own run too.
- `new_request` with a `{{baseUrl}}/...` url defaults to https; `set_url` with an `http://` prefix is needed to get protocol http.
- `set_body` contentType `json` sends a literal `Content-Type: json` header; `application/json` is needed.
- An empty variable cannot produce an empty request body (it was sent as `""`), so the register "Request body is required" 400 is untested.
- No capture of a created invite code into a later request, so register 201 and 409 are not written; locally POST /auth/register with a valid invite also returns 500 (no Cognito user pool in the local stack).
- Express used to return an HTML 400 for a malformed JSON body on POST /auth/register (FIXED, kanban 763fc0e6: now JSON 400 `{error: "Invalid JSON", code: "INVALID_JSON"}`); the `malformed body` run sends an empty variable (a bare `""`), which is rejected by the JSON parser the same way, and asserts the new shape.

## Ticket 2b07e530 (pages CRUD)
- No capture of a created guid into later requests, so the suite cannot create-then-GET/PUT/DELETE: GET/PUT 200 use an env variable `crudPageGuid` holding a hand-created fixture page (like `pageGuid`; it must be re-created if the local stack is reset), and the create runs leak one page each (remove them by hand).
- DELETE 200, recursive delete of descendants, and the 409 HAS_CHILDREN case (non-recursive delete of a page with children, confirmed by curl) are not covered: a delete consumes its page and needs a freshly created guid on every run.
- Runs cannot send an empty request body, so the "Request body is required" 400 on POST /pages and PUT /pages/:guid is untested.
- A Standard-role 403 case uses an unsigned JWT in env variable `standardToken` (not a secret); the local backend decodes it without verifying and gives it role Standard, so it works.
- PUT /pages/:guid 404 returns only `{error}` without `code`, while GET returns `code: PAGE_NOT_FOUND` (inconsistent error shape).
- Malformed JSON on POST /pages returned Express HTML 400 (FIXED, kanban 763fc0e6: now JSON 400 `{error, code: INVALID_JSON}`) (schema check in `malformed body` run).
- The seeded `pageGuid` was no longer present locally (404), so `board-order backfill > existing page` fails until it is re-seeded.

## Ticket 07f68685 (pages tree, search and ticket-key requests)
- A `{{variable}}` inside another variable's value (run `payload` holding `{{crudPageGuid}}`) is not expanded, so self-move, reorder and similar bodies hard-code the fixture guid `0ea160d4-...` (re-create and edit if the local stack is reset).
- No hierarchy fixture without capture: circular move (move under own descendant), reorder 200 that changes order (`updated` > 0) and children paging (limit/cursor/depth with real children) are untested.
- `GET /ticket-keys/:key` 200, `POST /pages/:guid/ticket-keys/backfill` 200 and idempotency are untested (need an Initiative with keyPrefix and a captured key); only 400/401/403/404 are covered.
- `GET /pages/:guid/backlinks` 200 only asserts an empty list (no way to create a linking page and capture its guid).
- Empty request body (400 "Request body is required") on PUT /pages/:guid/move and PUT /pages/reorder is untested (runs cannot send an empty body).
- FIXED: `GET /pages/search` shadowing (see above); both search runs now pass.
- FIXED (b59dd774): `GET /pages/:guid/ancestors` returned 200 `{ancestors: []}` for an unknown guid and for a non-GUID string; it now returns 404 `{error: "Page not found"}` for both (no 400 for a malformed guid).
- Fixed (5ae81991): `POST /pages/:guid/board-order/backfill` with a non-GUID now returns 400 "Invalid GUID format" (was 500); run `invalid guid returns 400` passes.
- `pages/board-order backfill > existing page` still fails (seeded `pageGuid` 404 locally); `crud fixture page` runs cover the 200 and idempotency instead.
- Reorder 400 on empty `orderedGuids` returns zod `details` as an array while move returns it as an object (inconsistent shape).

## Ticket 59c17563 (comments requests)
- No capture of a created comment id into later requests, so GET/PUT/DELETE use hand-created fixture comments in env variables `commentId` (top-level, on `crudPageGuid`) and `replyCommentId` (reply to it); re-create via POST if the local stack is reset. The reply-to-reply run hard-codes the reply id (nested variables are not expanded).
- DELETE 200 is not covered (it consumes the fixture comment and needs a fresh id per run); semantics confirmed by curl: a comment with replies is soft-deleted (body blanked, deletedAt set, stays in the list, later PUT/DELETE give 404 COMMENT_NOT_FOUND); a comment without replies is removed outright; admin may delete others' comments.
- Soft-deleted parent tombstones are never purged once its replies are deleted (observed via curl: empty-body deleted row remains in GET list).
- The `created top-level` and `created reply` runs leak one comment each per run on the fixture page (no cleanup without captured ids).
- "Request body is required" 400 on POST/PUT comments is untested (runs cannot send an empty body).
- PUT/DELETE comments on a non-existent page are not asserted precisely (update `page not found` accepts PAGE_NOT_FOUND or COMMENT_NOT_FOUND 404).
- Malformed JSON on POST comments returned Express HTML 400 (FIXED, kanban 763fc0e6: now JSON 400 `{error, code: INVALID_JSON}`) (schema check in `malformed body` run).

## Ticket 52e19d59 (attachments requests)
- Multipart upload 201/415/413 on `POST /pages/:guid/attachments` is not expressible: the body is text and the handler requires CRLF line breaks, but `set_body` text is stored with LF, so a hand-written multipart body gets 500 "No file found in multipart payload"; there is also no file/binary part type, so the oversize (10MB image / 50MB document) upload cases cannot be built.
- FIXED (37db7698): malformed multipart (no parseable file part, missing body, missing boundary) returned 500; the upload handler now returns 400 with the parser's message. Same handler serves Lambda and local, so deployed was affected too. Run `LF-delimited multipart returns 400` passes.
- A run cannot override the url, so invalid-guid runs override the `crudPageGuid` variable with `not-a-guid`.
- `GET/POST/DELETE` attachment 200 cases depend on a hand-created fixture `api-suite-fixture.txt` (21 bytes, text/plain) on `crudPageGuid`, uploaded by curl multipart; re-create it if the local stack is reset. The `confirm > confirmed` run hard-codes the fixture page guid in `attachmentKey` (nested variables are not expanded).
- Confirm 413 (stored object over the limit) is untested: needs an oversize object put into storage. Real DELETE of an existing attachment is untested (it would consume the fixture and cannot be re-created inside the suite).
- FIXED (kanban 83760b81): the presigned PUT URL embedded `x-amz-checksum-crc32=AAAAAA==` (empty-body CRC32) because the SDK defaults to `requestChecksumCalculation: WHEN_SUPPORTED`; this affected deployed S3 too, not just LocalStack. `S3StoragePlugin` now sets `WHEN_REQUIRED`. Verified manually (presign -> PUT 200 -> confirm 200 -> delete 200). Still not expressible in the suite: a run cannot capture `uploadUrl` from the presign response into a later PUT to an absolute URL, so the non-empty PUT leg is covered by the backend unit test `S3StoragePlugin.presign-checksum.test.ts` and the presign cases only.
- `DELETE /pages/:guid/attachments/:filename` for a missing file returns 200 success (idempotent), not 404; covered as `missing file is idempotent 200`.
- FIXED (kanban 763fc0e6): malformed JSON on presign/confirm returned Express HTML 400 with a stack trace including local file paths; the local server now has a four-argument error handler (`local-error-handler.ts`) returning JSON 400 `{error: "Invalid JSON", code: "INVALID_JSON"}` (and a generic JSON 500 with no message or stack for any other unhandled error). Deployed Lambda was never affected (API Gateway hands handlers the raw body; they return JSON). The `malformed body` runs now assert the JSON shape. Wrong Content-Type on the upload route (JSON) is parsed by body-parser first, so the handler's "Content-Type must be multipart/form-data" 400 is only reachable with a non-JSON type (run uses text/plain).
- "Request body is required" 400 on presign/confirm is untested (runs cannot send an empty body).
- Download/list/delete/upload on a non-existent page: list returns 404 PAGE_NOT_FOUND and presign 404; other routes' unknown-page behaviour is not asserted.

## Ticket 794284c5 (admin invitations and users requests)
- No throwaway users: register returns 500 locally (no Cognito pool), so suspend/activate success, already-suspended/already-active, delete 200, already-deleted, last-admin guards (update role, delete) and PUT 200 are untested; only the self-guards (never mutating `local-dev-user-id`) and 404s are covered.
- Local `local-dev-user-id` profile has no email, role or status (only userId, displayName, updatedAt), so `activate` on it would flip status and the role/status filters on GET /admin/users match nothing.
- No capture of a created invite code into later requests, so DELETE /admin/invitations/:code 200/409/404 and revoke-then-list-revoked are untested; create runs leak one pending invitation each.
- FIXED (7727ee02): `DELETE /admin/invitations/:invitationCode` param mismatch; the unknown-code 404 and malformed-code 400 runs now pass.
- FIXED (kanban 2680a20e): Zod 400 "Validation error" from the admin handlers (and auth-profile-update) had no `details` because they read `error.errors`, which zod 4 does not provide; they now return `error.issues` (deployed Lambdas were affected too). Schemas now require a non-empty `details` array.
- Create invitation with `email` (SES path, emailSent/emailError) is untested to avoid sending mail; "Request body is required" 400 is untested (runs cannot send an empty body); PUT /admin/users/:userId with an empty body hits zod 400 instead.
- Malformed JSON on POST /admin/invitations and PUT /admin/users/:userId returned Express HTML 400 (FIXED, kanban 763fc0e6: now JSON 400 `{error, code: INVALID_JSON}`) (schema check in `malformed body` runs).

## Ticket 1166ac1c (tags and page-types requests)
- `{{$guid}}` and other dynamic values are not expanded in run variables, so `POST /tags` 201 cannot use a unique tag name; the 201 run was dropped because a fixed name returns 409 on the second run (201 untested; 409 is covered against hand-created fixture tag `api-suite-fixture` in scope `api-suite`).
- A request with no runs is sent bare, so adding `delete page type` / `update page type` before their runs existed deleted the fixture page type; there is no way to mark a request as "runs only".
- No capture of a created page-type guid: GET/PUT/DELETE use hand-created fixtures (env `pageTypeGuid` = `api-suite-fixture-type`, hard-coded guids of `api-suite-fixture-child` and `api-suite-fixture-parent`, the latter with the child allowed); re-create via POST /page-types and update the env variable and the hard-coded guids in the get/list/allowed-children/update schemas if the local stack is reset.
- DELETE /page-types/:guid 200 is untested (it consumes the fixture and needs a fresh guid per run); the `created *` runs leak three page types per run (no cleanup without captured guids).
- Page-type routes did no guid validation (non-GUID returned 404 instead of 400) (FIXED, kanban 45bf3c1e: GET/PUT/DELETE /page-types/:guid and /allowed-children now return 400 `Invalid GUID format`; covered as `non-guid is bad request` on get/update/delete/allowed children).
- No tag delete endpoint, so tag fixtures and the stray literal `api-suite-{{$guid}}` tag in scope `api-suite` cannot be cleaned up.
- GET /tags has no 400/404 cases: any scope string is accepted and an unknown scope returns 200 with an empty list.
- "Request body is required" 400 on POST /tags, POST /page-types and PUT /page-types/:guid is untested (runs cannot send an empty body).
- Malformed JSON on POST /tags, POST /page-types and PUT /page-types/:guid returned Express HTML 400 (FIXED, kanban 763fc0e6: now JSON 400 `{error, code: INVALID_JSON}`) (schema check in `malformed body` runs).
- Zod 400 `details` shape still varies by handler: tags/page-types use zod's format object, admin/profile/reorder/register use the issues array.

## Ticket 78935bf7 (search, fetch-url, imdb and admin rebuild requests)
- Fixed (d40def49): `POST /admin/rebuild-page-index` was unauthenticated in local-server.ts; it now uses the deployed handler (withAuth + withRole Admin), and the three cases assert 401/401/403.
- Fixed (8ac985b8): local-server registered `POST /imdb/show-details` while the deployed API (UnifiedStack.cs) and the frontend (`ai-tools.ts`) use GET only; it now registers `GET`, the POST route is gone, and the collection's `imdb show details` request is a GET (the duplicate `imdb show details GET` request was removed; its 400 case is `missing query and imdbId`).
- `GET /search?q=<non-empty>` returns 500 "Search unavailable" locally (Bedrock embeddings not supported by LocalStack), so result shape, `scope`, `limit` and `offset` paging are untested; only empty/missing/sanitised-to-empty q (200 empty) and auth are covered. The 500 is asserted as the documented local behaviour.
- `GET /pages/search` cases stay in the pages folder (shadowing fixed); nothing duplicated here.
- fetch-url 200, 502 and imdb 200/404 hit the public internet (example.com, TVmaze/IMDb) so they can fail offline; 502 from redirect/oversize/unsupported-content-type/timeout and the local `ALLOW_HTTP` path are untested (no controllable upstream); an unresolvable host and a non-https scheme return 400, not 502.
- imdb lookup by `imdbId` is untested (same upstream dependency as `query`).
- fetch-url "Request body is required" 400 is now covered by the `empty body` run (FullyRested run body override `none`, kanban 690fe18c); malformed JSON returned Express HTML 400 (FIXED, kanban 763fc0e6: now JSON 400 `{error, code: INVALID_JSON}`) (schema check in `malformed body` run).
- FIXED (kanban WSS-3): the local server's unknown-route 404 was `{error: "Not Found", message}`; it is now `{error: "Route not found", code: "NOT_FOUND"}` and the unknown-route runs assert that. Deployed, API Gateway answers an unmatched path itself with 403 `{"message":"Missing Authentication Token"}` (no catch-all Lambda; UnifiedStack.cs only customises DEFAULT_4XX/5XX CORS headers); changing that needs an infra change (a gateway response template or a `{proxy+}` route) and is not done. The frontend error interceptor reads `message ?? error`, so it handles both.
- Kanban 690fe18c: fetch-url `upstream redirect becomes 502` (httpbin.org) and `unsupported content type returns 500` now exist against the public internet (still offline-fragile). The handler's SSRF guard blocks loopback, so a local stub upstream is impossible; oversize and timeout stay untested. Unsupported content-type answered 500 'Failed to fetch URL' (FIXED, kanban WSS-2: now 502 'Upstream returned unsupported content-type: ...'); the `unsupported content type returns 502` run asserts it. Search with non-empty q stays untestable locally (Bedrock is not in LocalStack).

## Ticket 2627ae20 (WebSocket event tests)
- RESOLVED by FullyRested websocket triggers (ticket 3b632605): each ws request names an http request in `ws/` (`trigger publish` PUT, `trigger move` PUT to root) that FullyRested fires repeatedly during the run; `ws-trigger.mjs` is gone. The triggers are idempotent writes on `crudPageGuid`, so nothing leaks. Remaining gap: a trigger cannot capture ids from its response, so cleanup-needs-capture (create a page, then delete it using its returned guid) is still not expressible; that is why the triggers reuse the fixture page instead of create/delete.
- Covered: `upsert on publish` (upsert {pages, tags, origin}) and `invalidate on move` (invalidate {tags, origin}; triggered by a PUT move to root, not a delete: a delete would consume the fixture page and needs a captured guid, so the delete-time invalidate is untested), count 1, match any, extras ignore, timeout 10000.
- Not covered: nothing-sent-on-connect (a test needs count >= 1), exact tag values per write type (comment, attachment, move, page-type), X-Client-Id as origin, MCP-write origin null; match-any with a schema cannot pin tags to a specific write when the trigger repeats.
## Ticket ecdf556c (mcp smoke requests)
- FullyRested has no MCP-client request type: /mcp is smoked as raw JSON-RPC over POST with the body in a `{{rpc}}` run variable (no initialize/session handling, no tools/call result decoding beyond a JSON Schema on the text content); friction worth an fr-gap ticket.
- Local /mcp has no auth at all (prod is guarded by an API Gateway API key, not Cognito/Bearer): there is no 401 to test locally; run `tools list no token` asserts 200 as the documented local behaviour, and the prod API-key 403 is untested.
- `GET /mcp` is not routed locally (Express 404 `{error, code: NOT_FOUND}`); the handler's 405 with `Allow: POST, DELETE` only exists behind Lambda/API Gateway, so run `GET not routed locally` asserts the local 404 and the 405 is untested.
- Malformed JSON on POST /mcp returned Express HTML 400 (FIXED, kanban 763fc0e6: now JSON 400 `{error, code: INVALID_JSON}`), so the JSON-RPC parse error (-32700) is never reachable locally (schema check in `malformed body` run).
- FIXED (kanban 348b5267): `call bad arguments` (get_backlinks with no pageGuid) returned isError with a raw JS message "Cannot read properties of undefined (reading 'trim')"; every MCP tool call is now checked against its inputSchema (required, types, enums) and answers isError with `Missing required argument: pageGuid`; the run asserts that exact text.
- `call get_page` hard-codes the fixture guid `0ea160d4-...` in the rpc variable (nested variables are not expanded).

## Ticket 9a7e5b90 (ws cases rewritten through MCP, full run)
- The ws requests were rewritten MCP-only (new_request, set_type, set_auth with placement `token`, set_message, set_expect, new_run); the token now comes from `{{devToken}}` instead of sitting in the URL.
- Superseded: the ws cases now use `set_trigger`, so authoring is MCP-only end to end (see ticket 2627ae20 note).
- `new_run` takes `request` (not `action` like run/show_request), an inconsistent parameter name across tools.
- `new_request` has no websocket option: it creates an http request and needs a separate `set_type`; a `ws://` url is accepted but the file keeps `protocol: https`.
- `set_expect` cannot be seen back (no show of expect in `tree`/`settings`), so a ws case's expect is only checkable by reading the .frreq or running it.
