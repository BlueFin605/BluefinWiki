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

Baseline: 322 passed, 1 failed (323 cases; includes the 23 `user-lifecycle` cases from WSS-1 / 60920384 (register 201/409, suspend/activate/update/delete, last-admin guards); verified by a full run against localhost:3000 on 2026-10-17; the earlier baseline of 296/1 (297 cases) included the page-type `non-guid is bad request` cases from 45bf3c1e; verified by a full run against localhost:3000 on 2026-10-17 after the 348b5267 (MCP argument validation; `call bad arguments` asserts the validation text), 8ac985b8 (GET /imdb/show-details routed locally; duplicate imdb GET request removed),  37db7698, 763fc0e6 (JSON error handler, all `malformed body` runs assert `{error, code: INVALID_JSON}`) and 2680a20e (admin/profile zod 400 now carries `details`; schemas require it) fixes; the two ws trigger requests count as 2 of the passes; a first run once showed one transient extra failure that did not recur). Any other failure is a regression. Anything fewer than 1 failure means a bug was fixed: rename the case (drop `KNOWN FAILURE`) and remove it from the list.

Cases named `KNOWN FAILURE` assert the correct behaviour of a real BlueFinWiki bug, so they fail until it is fixed. Do not delete them.

## Known failures

Bug tickets are on the Kanban board (story "BlueFinWiki full API suite", WebSocket Support initiative).

- `pages/board-order backfill > existing page` - not a bug: seeded `pageGuid` is missing locally; c54a2220-2f4b-41e7-b16c-ef2d2636e36a (re-point off the seeded guid)

## Fixtures and tokens

- Fixture ids (`pageGuid`, `crudPageGuid`, `commentId`, `replyCommentId`, `pageTypeGuid`, ...) live in the `local` environment and some guids are hard-coded in request bodies. They must be re-created by hand if the local stack is reset.
- Standard-role 403 cases use `standardToken`, an unsigned JWT in the `local` environment: the local backend decodes without verifying and gives it role Standard. Admin cases use `Bearer mock-jwt-token`.
- `user-lifecycle/` is a numbered, order-dependent flow: it creates an invitation, registers a throwaway user (`{{$guid}}` email), captures the invite codes and user id, and ends by soft-deleting that user, so it leaks nothing but one used invitation. Run the folder as a whole (`-f user-lifecycle`); a single request alone has nothing captured.
- Local `POST /auth/register` needs no Cognito: in local mode (`NODE_ENV=development` or a `local_` pool id, and never inside a Lambda) the handler skips Cognito, rejects a duplicate live email with 409 and stores the profile as `active`. The server seeds the `local-dev-user-id` profile (dev@example.com, Admin, active) on startup.
- The last-admin cases send `ghostAdminToken` (an unsigned Admin JWT for a sub with no profile, like `standardToken`), so the caller is not the target; they pass only while `local-dev-user-id` is the sole non-deleted Admin profile locally.
- Create runs leak pages, comments, invitations and page types on each run; remove them by hand.

## Gaps

`GAPS.md` (same folder) logs what FullyRested could not express and untested cases, per ticket. Read it before adding cases.
