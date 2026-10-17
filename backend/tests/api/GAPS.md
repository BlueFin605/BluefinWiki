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
- FIXED: `GET /pages/search` shadowing (see above); both search runs now pass.
- Known failure: `GET /pages/:guid/ancestors` returns 200 `{ancestors: []}` for an unknown guid and for a non-GUID string (no 400/404).
- Known failure: `POST /pages/:guid/board-order/backfill` with a non-GUID returns 500 "Failed to backfill boardOrder" instead of 400.
- `pages/board-order backfill > existing page` still fails (seeded `pageGuid` 404 locally); `crud fixture page` runs cover the 200 and idempotency instead.
- Reorder 400 on empty `orderedGuids` returns zod `details` as an array while move returns it as an object (inconsistent shape).

## Ticket 59c17563 (comments requests)
- No capture of a created comment id into later requests, so GET/PUT/DELETE use hand-created fixture comments in env variables `commentId` (top-level, on `crudPageGuid`) and `replyCommentId` (reply to it); re-create via POST if the local stack is reset. The reply-to-reply run hard-codes the reply id (nested variables are not expanded).
- DELETE 200 is not covered (it consumes the fixture comment and needs a fresh id per run); semantics confirmed by curl: a comment with replies is soft-deleted (body blanked, deletedAt set, stays in the list, later PUT/DELETE give 404 COMMENT_NOT_FOUND); a comment without replies is removed outright; admin may delete others' comments.
- Soft-deleted parent tombstones are never purged once its replies are deleted (observed via curl: empty-body deleted row remains in GET list).
- The `created top-level` and `created reply` runs leak one comment each per run on the fixture page (no cleanup without captured ids).
- "Request body is required" 400 on POST/PUT comments is untested (runs cannot send an empty body).
- Empty body `{"body":""}` returns zod `Validation failed` with details (the INVALID_COMMENT code only fires for whitespace-only bodies): two different 400 shapes for the same mistake.
- PUT/DELETE comments on a non-existent page are not asserted precisely (update `page not found` accepts PAGE_NOT_FOUND or COMMENT_NOT_FOUND 404).
- Malformed JSON on POST comments returns Express HTML 400 rather than the JSON error shape (header check in `malformed body` run).

## Ticket 52e19d59 (attachments requests)
- Multipart upload 201/415/413 on `POST /pages/:guid/attachments` is not expressible: the body is text and the handler requires CRLF line breaks, but `set_body` text is stored with LF, so a hand-written multipart body gets 500 "No file found in multipart payload"; there is also no file/binary part type, so the oversize (10MB image / 50MB document) upload cases cannot be built.
- Known failure: malformed multipart (no parseable file part) returns 500 instead of 400 (run `KNOWN FAILURE LF-delimited multipart returns 500 not 400`).
- A run cannot override the url, so invalid-guid runs override the `crudPageGuid` variable with `not-a-guid`.
- `GET/POST/DELETE` attachment 200 cases depend on a hand-created fixture `api-suite-fixture.txt` (21 bytes, text/plain) on `crudPageGuid`, uploaded by curl multipart; re-create it if the local stack is reset. The `confirm > confirmed` run hard-codes the fixture page guid in `attachmentKey` (nested variables are not expanded).
- Confirm 413 (stored object over the limit) is untested: needs an oversize object put into storage. Real DELETE of an existing attachment is untested (it would consume the fixture and cannot be re-created inside the suite).
- Suspected backend/LocalStack bug: the presigned PUT URL embeds `x-amz-checksum-crc32=AAAAAA==` (checksum of an empty body), so a PUT of any non-empty file is rejected by LocalStack with 400 InvalidRequest; the presign -> PUT -> confirm flow cannot be exercised locally.
- `DELETE /pages/:guid/attachments/:filename` for a missing file returns 200 success (idempotent), not 404; covered as `missing file is idempotent 200`.
- Malformed JSON on presign/confirm returns Express HTML 400 with a stack trace including local file paths (header check in `malformed body` runs); wrong Content-Type on the upload route (JSON) is parsed by body-parser first, so the handler's "Content-Type must be multipart/form-data" 400 is only reachable with a non-JSON type (run uses text/plain).
- "Request body is required" 400 on presign/confirm is untested (runs cannot send an empty body).
- Download/list/delete/upload on a non-existent page: list returns 404 PAGE_NOT_FOUND and presign 404; other routes' unknown-page behaviour is not asserted.

## Ticket 794284c5 (admin invitations and users requests)
- No throwaway users: register returns 500 locally (no Cognito pool), so suspend/activate success, already-suspended/already-active, delete 200, already-deleted, last-admin guards (update role, delete) and PUT 200 are untested; only the self-guards (never mutating `local-dev-user-id`) and 404s are covered.
- Local `local-dev-user-id` profile has no email, role or status (only userId, displayName, updatedAt), so `activate` on it would flip status and the role/status filters on GET /admin/users match nothing.
- No capture of a created invite code into later requests, so DELETE /admin/invitations/:code 200/409/404 and revoke-then-list-revoked are untested; create runs leak one pending invitation each.
- FIXED (7727ee02): `DELETE /admin/invitations/:invitationCode` param mismatch; the unknown-code 404 and malformed-code 400 runs now pass.
- Zod 400 "Validation error" from admin handlers has no `details` (handler reads `error.errors`, which zod 4 does not provide), unlike the intended shape; schemas assert only `error`.
- Create invitation with `email` (SES path, emailSent/emailError) is untested to avoid sending mail; "Request body is required" 400 is untested (runs cannot send an empty body); PUT /admin/users/:userId with an empty body hits zod 400 instead.
- Malformed JSON on POST /admin/invitations and PUT /admin/users/:userId returns Express HTML 400 (header check in `malformed body` runs).

## Ticket 1166ac1c (tags and page-types requests)
- `{{$guid}}` and other dynamic values are not expanded in run variables, so `POST /tags` 201 cannot use a unique tag name; the 201 run was dropped because a fixed name returns 409 on the second run (201 untested; 409 is covered against hand-created fixture tag `api-suite-fixture` in scope `api-suite`).
- A request with no runs is sent bare, so adding `delete page type` / `update page type` before their runs existed deleted the fixture page type; there is no way to mark a request as "runs only".
- No capture of a created page-type guid: GET/PUT/DELETE use hand-created fixtures (env `pageTypeGuid` = `api-suite-fixture-type`, hard-coded guids of `api-suite-fixture-child` and `api-suite-fixture-parent`, the latter with the child allowed); re-create via POST /page-types and update the env variable and the hard-coded guids in the get/list/allowed-children/update schemas if the local stack is reset.
- DELETE /page-types/:guid 200 is untested (it consumes the fixture and needs a fresh guid per run); the `created *` runs leak three page types per run (no cleanup without captured guids).
- Page-type routes do no guid validation: a non-GUID returns 404 "Page type not found" (covered as `non-guid is not found`), not 400.
- No tag delete endpoint, so tag fixtures and the stray literal `api-suite-{{$guid}}` tag in scope `api-suite` cannot be cleaned up.
- GET /tags has no 400/404 cases: any scope string is accepted and an unknown scope returns 200 with an empty list.
- "Request body is required" 400 on POST /tags, POST /page-types and PUT /page-types/:guid is untested (runs cannot send an empty body).
- Malformed JSON on POST /tags, POST /page-types and PUT /page-types/:guid returns Express HTML 400 (header check in `malformed body` runs).
- Zod 400 on tags/page-types includes `details` (zod format object), unlike admin handlers which omit it (inconsistent shape).

## Ticket 78935bf7 (search, fetch-url, imdb and admin rebuild requests)
- Fixed (d40def49): `POST /admin/rebuild-page-index` was unauthenticated in local-server.ts; it now uses the deployed handler (withAuth + withRole Admin), and the three cases assert 401/401/403.
- Known failure: `GET /imdb/show-details` is not routed locally (404 "Route GET ... not found"); local-server registers `POST /imdb/show-details` while the handler (and its doc comment) reads query-string params as a GET, so the POST must carry `?query=` and a JSON body is ignored. Run `KNOWN FAILURE GET not routed locally` expects the handler's 400.
- `GET /search?q=<non-empty>` returns 500 "Search unavailable" locally (Bedrock embeddings not supported by LocalStack), so result shape, `scope`, `limit` and `offset` paging are untested; only empty/missing/sanitised-to-empty q (200 empty) and auth are covered. The 500 is asserted as the documented local behaviour.
- `GET /pages/search` cases stay in the pages folder (shadowing fixed); nothing duplicated here.
- fetch-url 200, 502 and imdb 200/404 hit the public internet (example.com, TVmaze/IMDb) so they can fail offline; 502 from redirect/oversize/unsupported-content-type/timeout and the local `ALLOW_HTTP` path are untested (no controllable upstream); an unresolvable host and a non-https scheme return 400, not 502.
- imdb lookup by `imdbId` is untested (same upstream dependency as `query`).
- fetch-url "Request body is required" 400 is untested (runs cannot send an empty body); malformed JSON returns Express HTML 400 (header check in `malformed body` run).
- Unknown-route 404 body is `{error: "Not Found", message}` (differs from the `{error}`-only shape elsewhere).

## Ticket 2627ae20 (WebSocket event tests)
- RESOLVED by FullyRested websocket triggers (ticket 3b632605): each ws request names an http request in `ws/` (`trigger publish` PUT, `trigger move` PUT to root) that FullyRested fires repeatedly during the run; `ws-trigger.mjs` is gone. The triggers are idempotent writes on `crudPageGuid`, so nothing leaks. Remaining gap: a trigger cannot capture ids from its response, so cleanup-needs-capture (create a page, then delete it using its returned guid) is still not expressible; that is why the triggers reuse the fixture page instead of create/delete.
- Covered: `upsert on publish` (upsert {pages, tags, origin}) and `invalidate on move` (invalidate {tags, origin}; triggered by a PUT move to root, not a delete: a delete would consume the fixture page and needs a captured guid, so the delete-time invalidate is untested), count 1, match any, extras ignore, timeout 10000.
- Not covered: nothing-sent-on-connect (a test needs count >= 1), exact tag values per write type (comment, attachment, move, page-type), X-Client-Id as origin, MCP-write origin null; match-any with a schema cannot pin tags to a specific write when the trigger repeats.
## Ticket ecdf556c (mcp smoke requests)
- FullyRested has no MCP-client request type: /mcp is smoked as raw JSON-RPC over POST with the body in a `{{rpc}}` run variable (no initialize/session handling, no tools/call result decoding beyond a JSON Schema on the text content); friction worth an fr-gap ticket.
- Local /mcp has no auth at all (prod is guarded by an API Gateway API key, not Cognito/Bearer): there is no 401 to test locally; run `tools list no token` asserts 200 as the documented local behaviour, and the prod API-key 403 is untested.
- `GET /mcp` is not routed locally (Express 404 `{error, message}`); the handler's 405 with `Allow: POST, DELETE` only exists behind Lambda/API Gateway, so run `GET not routed locally` asserts the local 404 and the 405 is untested.
- Malformed JSON on POST /mcp returns Express HTML 400 before the handler runs, so the JSON-RPC parse error (-32700) is never reachable locally (header check in `malformed body` run).
- `call bad arguments` (get_backlinks with no pageGuid) returns isError with a raw JS message "Cannot read properties of undefined (reading 'trim')" rather than a validation message; asserted only as isError true.
- `call get_page` hard-codes the fixture guid `0ea160d4-...` in the rpc variable (nested variables are not expanded).

## Ticket 9a7e5b90 (ws cases rewritten through MCP, full run)
- The ws requests were rewritten MCP-only (new_request, set_type, set_auth with placement `token`, set_message, set_expect, new_run); the token now comes from `{{devToken}}` instead of sitting in the URL.
- Superseded: the ws cases now use `set_trigger`, so authoring is MCP-only end to end (see ticket 2627ae20 note).
- `new_run` takes `request` (not `action` like run/show_request), an inconsistent parameter name across tools.
- `new_request` has no websocket option: it creates an http request and needs a separate `set_type`; a `ws://` url is accepted but the file keeps `protocol: https`.
- `set_expect` cannot be seen back (no show of expect in `tree`/`settings`), so a ws case's expect is only checkable by reading the .frreq or running it.
- The `get ancestors > unknown page (known failure: returns 200)` run does not use the `KNOWN FAILURE` name prefix, so name-based known-failure filtering misses it.
