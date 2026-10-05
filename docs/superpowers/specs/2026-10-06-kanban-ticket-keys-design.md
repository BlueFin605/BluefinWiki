# Kanban Ticket Keys — Design

**Date:** 2026-10-06
**Initiative:** Wiki Enhancements (`89aab66d-f4e4-484b-b334-a4ce199ebbbd`)
**Branch:** `feature/wiki-enhancements`

## Goal

Give every Kanban ticket a short, human-friendly key in the Jira style —
`{PREFIX}-{n}`, e.g. `BGT-1382` — alongside its opaque page GUID. An Initiative
supplies the prefix; the backend allocates the number. Keys are shown in the UI
and MCP output and accepted anywhere the `kanban_*` tools take a GUID.

The GUID remains the page's identity. Storage layout, links, moves and the page
index are unchanged; the key is an additional, immutable alias.

## Decisions

| Question | Decision |
|---|---|
| Prefix scope | **Shared namespace.** The counter belongs to the prefix, not the initiative. Several initiatives may use `BGT` and share one sequence. No uniqueness check between initiatives. |
| Which pages get a key | **All tickets** — Epic, Story, Task (any page type with a `state` property other than Initiative) under an Initiative with a prefix. The Initiative itself has no key. |
| Where the prefix lives | `boardConfig.keyPrefix` on the Initiative page, edited in Board Settings. Page-only: never part of a page type's `boardDefaults`. No page-type schema change. |
| Storage / lookup | New `ticket-keys` DynamoDB table holding counters and write-once key→GUID mappings (Approach A). |
| Moves | A ticket keeps its key forever, including when moved to another initiative. |
| Prefix change | Affects new tickets only. Existing keys keep their old prefix and still resolve. |
| Deleted tickets | Key is never reused. Its mapping is left in place; resolving it yields a GUID that 404s like any deleted page. |

## 1. Data model and assignment

### Prefix

`BoardConfig.keyPrefix?: string` (backend `types/index.ts`, frontend page types,
`pages/board-config-schema.ts`). Validation: `^[A-Z][A-Z0-9]{1,9}$` (2–10
characters, upper-case letters/digits, starting with a letter). Absent or empty
means the initiative does not key its tickets.

`keyPrefix` is **page-only**. It is stripped from page-type `boardDefaults`
(the page-types create/update schemas omit it), and the frontend's board-defaults
machinery carries it through untouched: it is not a `BoardGroup`, survives
"Reset to default" and "Save as default", and is never shown as overridden.

### Key on the page

`PageContent.ticketKey?: string` — a top-level frontmatter field, serialised and
parsed in `S3StoragePlugin` exactly like `boardOrder`. It is also projected onto
`PageSummary.ticketKey` in `listChildren`, so board cards and kanban trees get it
without extra loads.

`ticketKey` is **not** writable through the page update APIs (REST
`pages-update.ts` and MCP `update-page.ts` ignore/strip it, and preserve the
existing value on save). Only the ticket-keys service sets it.

### `ticket-keys` table

| Item | `id` (PK, string) | Attributes |
|---|---|---|
| Counter | `seq#BGT` | `next` (number) — the last number allocated |
| Mapping | `key#BGT-12` | `guid` (string), `createdAt` (ISO 8601) |

- Allocation: `UpdateItem` on `seq#{PREFIX}` with `ADD next :1`,
  `ReturnValues: UPDATED_NEW` → `n`. Key = `{PREFIX}-{n}`. The first allocation
  for a prefix creates the item and returns 1.
- Mapping: `PutItem` with `attribute_not_exists(id)` condition. A conflict on the
  same GUID is treated as success (idempotent); a conflict with a different GUID
  is an error.
- Pay-per-request; `RETAIN` in prod, `DESTROY` elsewhere (same as the page-index
  table). Env var `TICKET_KEYS_TABLE` (+ `DYNAMODB_TICKET_KEYS_TABLE` local
  alias, matching existing convention); local default
  `bluefinwiki-ticket-keys-local`.

### `backend/src/ticket-keys/ticket-keys-service.ts`

- `keyForNewPage(parentGuid: string | null, pageType: string | undefined): Promise<string | undefined>`
  — returns `undefined` unless `pageType` is a ticket type (its definition has a
  `state` property) and is not the Initiative type. Walks ancestors from
  `parentGuid` to the nearest page whose type is named `Initiative`. If that
  page's `boardConfig.keyPrefix` is set, allocates and returns `{PREFIX}-{n}`;
  otherwise `undefined`. No Initiative ancestor → `undefined`.
- `recordKey(key: string, guid: string): Promise<void>` — writes the mapping.
- `resolveKey(key: string): Promise<string | null>` — upper-cases the input,
  `GetItem` on `key#{KEY}`, returns the GUID or `null`.
- `isTicketKey(ref: string): boolean` — `/^[A-Za-z][A-Za-z0-9]*-\d+$/`.

The DynamoDB client follows the pattern in `storage/PageIndexService.ts`
(lazy client, `AWS_ENDPOINT_URL` for LocalStack).

### Create paths

Both `pages/pages-create.ts` (REST) and `mcp/tools/create-page.ts` (MCP — used
by `kanban_create`) do, after validation and before `savePage`:

```ts
const ticketKey = await keyForNewPageSafe(parentGuid, pageType); // undefined on failure
// ...pageContent includes ...(ticketKey ? { ticketKey } : {})
await storagePlugin.savePage(guid, parentGuid, pageContent);
if (ticketKey) await recordKeySafe(ticketKey, guid);
```

### Failure handling

- Allocation throws → log a warning, create the page **without** a key. The
  backfill assigns one later.
- `savePage` fails after allocation → the number is burned (a gap). Gaps are
  acceptable.
- `recordKey` fails → log a warning; the page keeps its `ticketKey`. The backfill
  rewrites missing mappings from frontmatter.

Page creation never fails because of key assignment.

## 2. API and MCP

### REST

- `GET /api/ticket-keys/{key}` → `200 { key, guid, title }` or `404` (unknown key,
  or the mapped page no longer exists). Case-insensitive; `key` is the canonical
  upper-case form. Same auth as reading a page.
- `POST /api/pages/{guid}/ticket-keys/backfill` → `200 { assigned, repaired }`.
  Admin only. `400` if the page is not an Initiative or has no `keyPrefix`.
  Walks the Initiative's ticket descendants (published + draft, ticket types
  only). Tickets lacking `ticketKey` get one, in ascending `createdAt` order,
  via `updatePage`-equivalent storage save that sets `ticketKey`, then
  `recordKey`. Tickets that already have a key get `recordKey` re-run
  (`repaired` counts mappings that were missing). Idempotent.

Each endpoint is its own Lambda in `infrastructure/src/Infrastructure/Stacks/UnifiedStack.cs`
(granted read/write on the new table plus the existing page storage grants) and a
route in `backend/src/local-server.ts`. The MCP Lambda role also gets read/write
on the table. Aspire local dev creates the table alongside the existing ones.

### MCP `kanban_*`

- **Input.** Every `guid`, `parentGuid` and `initiative` argument accepts either
  a GUID or a key. `KanbanDeps` gains `resolveRef(ref: string): Promise<string>`
  — keys go through `resolveKey` (unknown key → error `unknown ticket key "X"`),
  anything else is returned unchanged. `fake-wiki.ts` implements it in memory.
- **Output.** `line()` shows `ticketKey ?? guid`:
  `Task · Ready · Fix login · BGT-12 · #dean`. Unkeyed tickets render exactly as
  today. `kanban_create`'s per-node output lines and `closeable:` / `closed:`
  lines follow the same rule.
- `kanban_get` adds a `Guid: <guid>` line after the header (keyed tickets only)
  so the generic page tools can still be used.
- `kanban_initiatives` shows the prefix when set:
  `<guid> · [BGT] <title> · <state> · N open`.

Generic page tools (`get_page`, `move_page`, …) do not accept keys in this pass.

## 3. Frontend (Angular, `frontend/`)

- **Board Settings dialog** — "Ticket key prefix" text field, shown only when the
  page's type is Initiative. Upper-cases input; validates the backend pattern;
  saved as `boardConfig.keyPrefix`. Beside it, an admin-only **"Assign keys to
  existing tickets"** button, enabled when a prefix is saved; calls the backfill
  endpoint and shows `Assigned N, repaired M` in a snackbar.
- **Board cards** — the key as a small muted label above the title. No label when
  the card has no key.
- **Page header** — a key chip beside the title on keyed pages; click copies the
  key to the clipboard.
- **`/t/:key` route** — a component that resolves the key and navigates to
  `/pages/{guid}` with `replaceUrl: true`; unknown key → the existing not-found
  page.
- **Search** — when the query matches the key pattern, the search box resolves it
  in parallel with the normal search and, if found, pins `BGT-12 · <title>` as
  the first result. Normal results are unchanged.

## 4. Testing

- **Backend (Vitest):** `ticket-keys-service` with a mocked DynamoDB client —
  allocation, nearest-Initiative walk, no prefix, non-ticket type, Initiative
  type, allocation failure, mapping conflict (same / different GUID). Both create
  paths assign keys and survive key failures. Frontmatter round-trip of
  `ticketKey`; update APIs cannot change it. Backfill: ordering, idempotency,
  repair. Kanban tool tests: keys accepted as input, shown in output, unknown key
  error, `Guid:` line, prefix in `kanban_initiatives`.
- **Frontend (Jest):** prefix field + validation + Initiative-only visibility,
  backfill button, card label, header chip copy, redirect route (found / not
  found), search pinning.
- **E2E (Playwright):** set a prefix on an Initiative; create tickets via
  `kanban_create`; keys appear on board cards; `/t/KEY` lands on the page;
  tickets created before the prefix get keys from the backfill button.

## 5. Rollout

Dean release tasks: merge; `cdk diff` then `deploy-infra.ps1` (new table +
Lambdas + grants); deploy BluefinWiki; set prefixes on live initiatives and run
the backfill on each.

Claude follow-up after deploy: update the `bluefin-kanban` skill and
`.superpowers/sdd/common-implementer.md` to use keys (`Kanban: BGT-12` commit
trailers, key arguments).

## Out of scope

- `[[BGT-12]]` wiki-link syntax.
- Keys in generic page MCP tools.
- Re-keying tickets on move or prefix change.
