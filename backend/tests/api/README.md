# BlueFinWiki API suite

FullyRested collection (`bluefinwiki.frcol`) covering the REST API, run against the local stack. Folders mirror the API areas (`admin`, `attachments`, `pages`, `search-and-utilities`, `mcp`, ...); `ws` holds two websocket tests; each has a FullyRested trigger (an http request in the same folder, fired repeatedly during the run) that provokes the pushed message, so no helper script is needed.

## Run it

1. Start the local stack (Aspire, `start-aspire.ps1`) so the API answers on http://localhost:3000.
2. From the BluefinWiki repo root, build the FullyRested CLI once (`FullyRested/App/cli-command`), then run everything:

```
node ../FullyRested/App/cli-command/dist/index.js run -c backend/tests/api/bluefinwiki.frcol -e local --all
```

The same run is available from the FullyRested MCP `run` tool with `all: true`, environment `local`.

**The command exits with code 1 whenever any case fails, and it always will while known failures exist.** A clean exit 0 is not expected until every bug below is fixed; judge a run by the counts, not the exit code.

## Reading the counts

Baseline: 283 passed, 12 failed (295 cases; re-verified by two consecutive full runs against localhost:3000 on 2026-10-17; the two ws trigger requests count as 2 of the passes; a first run once showed one transient extra failure that did not recur). Any other failure is a regression. Anything fewer than 12 failures means a bug was fixed: rename the case (drop `KNOWN FAILURE`) and remove it from the list.

Cases named `KNOWN FAILURE` assert the correct behaviour of a real BlueFinWiki bug, so they fail until it is fixed. Do not delete them.

## Known failures

Bug tickets are on the Kanban board (story "BlueFinWiki full API suite", WebSocket Support initiative).

- `pages/search pages > KNOWN FAILURE shadowed by guid route` - f13484d3-969f-44dc-8670-16dbb037ec44
- `pages/search pages > KNOWN FAILURE missing q should be 400 missing q` - 9eed3d0f-dd3e-45ff-b129-2d5affe9ec68
- `pages/get ancestors > unknown page (known failure: returns 200)` - b59dd774-d086-4c13-bf9d-c2738a359150
- `pages/board-order backfill > KNOWN FAILURE invalid guid returns 500` - 5ae81991-59f4-40c6-9ac0-07d50fc77b11
- `pages/board-order backfill > existing page` - not a bug: seeded `pageGuid` is missing locally; c54a2220-2f4b-41e7-b16c-ef2d2636e36a (re-point off the seeded guid)
- `admin/revoke invitation > KNOWN FAILURE valid code should be 404 not found` - 7727ee02-2b37-44e2-a643-886342df74e4
- `admin/revoke invitation > KNOWN FAILURE malformed code should be 400 invalid format` - 7727ee02-2b37-44e2-a643-886342df74e4
- `admin/rebuild page index > KNOWN FAILURE unauthenticated should be 401` - d40def49-c4f2-43ee-b3de-5e8c2c606ccb
- `admin/rebuild page index > KNOWN FAILURE invalid token should be 401` - d40def49-c4f2-43ee-b3de-5e8c2c606ccb
- `admin/rebuild page index > KNOWN FAILURE non-admin should be 403` - d40def49-c4f2-43ee-b3de-5e8c2c606ccb
- `attachments/upload attachment > KNOWN FAILURE LF-delimited multipart returns 500 not 400` - 37db7698-96e8-4473-8506-a4899cb46fb1
- `search-and-utilities/imdb show details GET > KNOWN FAILURE GET not routed locally should be 400 missing params` - 8ac985b8-880d-4a84-ab3f-03ffa947d0a8

## Fixtures and tokens

- Fixture ids (`pageGuid`, `crudPageGuid`, `commentId`, `replyCommentId`, `pageTypeGuid`, ...) live in the `local` environment and some guids are hard-coded in request bodies. They must be re-created by hand if the local stack is reset.
- Standard-role 403 cases use `standardToken`, an unsigned JWT in the `local` environment: the local backend decodes without verifying and gives it role Standard. Admin cases use `Bearer mock-jwt-token`.
- Create runs leak pages, comments, invitations and page types on each run; remove them by hand.

## Gaps

`GAPS.md` (same folder) logs what FullyRested could not express and untested cases, per ticket. Read it before adding cases.
