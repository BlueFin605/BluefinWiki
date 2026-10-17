# BlueFinWiki API suite

FullyRested collection (`bluefinwiki.frcol`) covering the REST API, run against the local stack. Folders mirror the API areas (`admin`, `attachments`, `pages`, `search-and-utilities`, `mcp`, ...); `ws` holds three websocket tests (upsert on publish, invalidate on archive, invalidate on move); each has a FullyRested trigger (an http request in the same folder, fired repeatedly during the run) that provokes the pushed message, so no helper script is needed. The triggers are idempotent writes on the captured 00-setup fixture page, so the ws folder creates no pages.

## Run it

1. Start the local stack (Aspire, `start-aspire.ps1`) so the API answers on http://localhost:3000.
2. From the BluefinWiki repo root, build the FullyRested CLI once (`FullyRested/App/cli-command`), then run everything:

```
node ../FullyRested/App/cli-command/dist/index.js run -c backend/tests/api/bluefinwiki.frcol -e local --all
```

The same run is available from the FullyRested MCP `run` tool with `all: true`, environment `local`.

**The command exits with code 1 whenever any case fails, and it always will while known failures exist.** A clean exit 0 is not expected until every bug below is fixed; judge a run by the counts, not the exit code.

## Reading the counts

Baseline: 400 passed, 0 failed (400 cases), verified by two consecutive full runs against localhost:3000 on 2026-10-18 with the rebuilt FullyRested CLI; the three ws test requests and their three trigger requests are among the passes. Any failure is a regression. There are no known failures at present.

Any case named `KNOWN FAILURE` would assert the correct behaviour of a real BlueFinWiki bug, so they fail until it is fixed. Do not delete them.

## Known failures

Bug tickets are on the Kanban board (story "BlueFinWiki full API suite", WebSocket Support initiative).

None at present. When a bug is found, add a case named `KNOWN FAILURE ...` asserting the correct behaviour and list it here.

## Fixtures and tokens

- No fixture ids are stored in the `local` environment any more. The suite creates what it needs and removes it: `00-setup/` creates the shared fixture page (captured `crudPageGuid`), each area creates its own comments, page types, tags, attachments and invitations (file-name prefixes `01-`, `10-`... order the flows; cases that must not be sent bare are `runs-only`), and `zz-teardown/` deletes/revokes what the earlier folders left. Order is tree order, so run the whole collection (`--all`); a single request alone has nothing captured.
- Standard-role 403 cases use `standardToken`, an unsigned JWT in the `local` environment: the local backend decodes without verifying and gives it role Standard. Admin cases use `Bearer mock-jwt-token`.
- `attachments/` runs presign -> PUT of 25 bytes to the captured `uploadUrl` -> confirm -> list -> download (fetch the captured url) -> delete, and a multipart upload -> delete. It needs LocalStack (S3) up.
- `mcp/` uses the FullyRested `mcp` request type; `GET /mcp` 404, malformed JSON and the missing-Accept 406 stay plain http.
- `user-lifecycle/` is a numbered, order-dependent flow (see its cases); it ends by soft-deleting its throwaway user. Local `POST /auth/register` needs no Cognito (local mode); the server seeds the `local-dev-user-id` profile (dev@example.com, Admin, active) on startup.
- The last-admin cases send `ghostAdminToken` (an unsigned Admin JWT for a sub with no profile); they pass only while `local-dev-user-id` is the sole non-deleted Admin profile locally.
- Still leaks per run: one tag in scope `api-suite` (no tag delete endpoint), one tombstone for the soft-deleted parent comments, and revoked (not deleted) invitations. No pages leak.

## Gaps

`GAPS.md` (same folder) logs what FullyRested could not express and untested cases, per ticket. Read it before adding cases.
