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
