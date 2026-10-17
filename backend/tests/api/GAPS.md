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
