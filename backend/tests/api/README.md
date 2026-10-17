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

Baseline: 293 passed, 2 failed (295 cases; verified by a full run against localhost:3000 on 2026-10-17 after the 37db7698 fix; the two ws trigger requests count as 2 of the passes; a first run once showed one transient extra failure that did not recur). Any other failure is a regression. Anything fewer than 2 failures means a bug was fixed: rename the case (drop `KNOWN FAILURE`) and remove it from the list.

Cases named `KNOWN FAILURE` assert the correct behaviour of a real BlueFinWiki bug, so they fail until it is fixed. Do not delete them.

## Known failures

Bug tickets are on the Kanban board (story "BlueFinWiki full API suite", WebSocket Support initiative).

- `pages/board-order backfill > existing page` - not a bug: seeded `pageGuid` is missing locally; c54a2220-2f4b-41e7-b16c-ef2d2636e36a (re-point off the seeded guid)
- `search-and-utilities/imdb show details GET > KNOWN FAILURE GET not routed locally should be 400 missing params` - 8ac985b8-880d-4a84-ab3f-03ffa947d0a8

## Fixtures and tokens

- Fixture ids (`pageGuid`, `crudPageGuid`, `commentId`, `replyCommentId`, `pageTypeGuid`, ...) live in the `local` environment and some guids are hard-coded in request bodies. They must be re-created by hand if the local stack is reset.
- Standard-role 403 cases use `standardToken`, an unsigned JWT in the `local` environment: the local backend decodes without verifying and gives it role Standard. Admin cases use `Bearer mock-jwt-token`.
- Create runs leak pages, comments, invitations and page types on each run; remove them by hand.

## Gaps

`GAPS.md` (same folder) logs what FullyRested could not express and untested cases, per ticket. Read it before adding cases.
