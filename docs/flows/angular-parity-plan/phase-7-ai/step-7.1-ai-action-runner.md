# Step 7.1 — AI action runner

| | |
|---|---|
| Phase | 7 — AI sidebar |
| Gap refs | §3.7 "Proposed actions (ActionPreview)"; §11 checklist; punch list 🔴 #13 |
| Impact | 🔴 Functional |
| Depends on | 1.2 (invalidation) |
| Est. size | L |

## Problem

`ActionPreview` renders per-type cards with Apply / Discard, but
`onAccept()` → `ai.acceptAction()` **only flips the message status to
`applied`** — **no HTTP mutation is ever dispatched**. GUIDs are shown raw in
`<code>`. `chat-message.ts` does not render `actionStatus`, so the outcome
leaves no trace in the log.

## Target behaviour

- An **action runner** that, on Apply, dispatches the matching call:
  | `action.type` | Call |
  |---|---|
  | `create_page` | `Pages.createPage(...)` |
  | `update_page` | `Pages.updatePage(guid, ...)` |
  | `delete_page` | `Pages.deletePage(guid, { recursive })` |
  | `move_page` | `Pages.movePage(guid, { newParentGuid })` |
  (`delete_page` / `move_page` only when `environment.aiAllowDestructive`.)
- Per-message status lifecycle: `pending → applying → applied | failed`
  (and `discarded` on Discard). `chat-message.ts` renders the current status
  (spinner / ✓ / ✕ + error text).
- After a successful apply, bump the precise invalidation tags (step 1.2) —
  e.g. `create_page` → `children:<parent>`; `update_page` → `page:<guid>`.
- **Resolve referenced GUIDs → page titles** in the preview card (with links),
  matching React (`resolves referenced GUIDs → page titles`). Use a small
  lookup (search-by-guid or an existing title cache); fall back to the GUID.
- Failure: status `failed`, show the server message on the card and in the log;
  the draft/action stays so the user can retry or discard.

## Implementation notes

**Files:** new `features/ai/ai-action-runner.ts` (or a method on `ai.ts`),
`features/ai/action-preview.ts` (call the runner, reflect status),
`features/ai/ai-sidebar.ts` (provide the runner / wire outputs),
`features/ai/chat-message.ts` (render `actionStatus`),
`features/ai/ai.ts` (`acceptAction` becomes real).

- The runner depends on `Pages` (and `Attachments` if any attachment action
  exists). Keep it a thin dispatcher — one `switch` on `action.type`.
- GUID→title resolution as an injectable helper so it's mockable in tests.

## Tests first (TDD)

- `ai-action-runner.spec.ts`: each `action.type` dispatches the right `Pages`
  method with the right args; destructive types are refused when
  `aiAllowDestructive` is false; success bumps the expected tag; failure
  surfaces the server message.
- `action-preview.spec.ts`: Apply → status `applying` then `applied`; Discard →
  `discarded`; failure → `failed` + message; GUIDs render as resolved titles.
- `chat-message.spec.ts`: renders each `actionStatus` variant.

## Acceptance criteria

- [ ] Apply performs the real mutation for all enabled action types.
- [ ] Status lifecycle shown on the card **and** in the transcript.
- [ ] Precise invalidation after success.
- [ ] GUIDs resolved to titles (fallback to GUID).
- [ ] Destructive gate honoured.
- [ ] Runner + preview + message unit-tested.

## Out of scope

- The fetch-tool loop (→ 7.2) and instruction injection (→ 7.3).
