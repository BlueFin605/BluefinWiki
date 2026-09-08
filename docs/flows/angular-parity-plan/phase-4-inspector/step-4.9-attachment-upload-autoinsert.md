# Step 4.9 — Attachment upload auto-insert

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Attachment upload" (`attachment-uploader.ts`); §11 checklist; punch list 🔴 #10 |
| Impact | 🟠 |
| Depends on | 3.4 (shared `insertMarkdownAtCursor` helper) |
| Est. size | S |

## Problem

The upload pipeline (validate → presign → S3 PUT with progress → confirm,
sequential) already works. But after a successful upload the returned markdown
is **not auto-inserted** — `inspector-panel` only stores `$event.filename`, so
the user has to click "Insert" on the row. React auto-inserts the returned
markdown at the cursor and refreshes the list.

## Target behaviour

- On the uploader's `uploaded` event, call the shared
  `insertMarkdownAtCursor(markdown)` (same helper the toolbar Attachment button
  and the manager's Insert action use).
- The list still refreshes (via step 1.2 invalidation of
  `attachments:<guid>`).
- First error still shown inline (unchanged).

## Implementation notes

**Files:** `features/editor/inspector-panel.ts` (route the event),
`features/attachments/attachment-uploader.ts` (ensure the event payload carries
the ready-to-insert markdown, not just the filename),
`features/pages/page-detail.ts` (owns the cursor / CodeMirror handle → exposes
`insertMarkdownAtCursor`).

- If the uploader currently emits only `{ filename }`, extend it to emit
  `{ filename, markdown }` (build the markdown the same way the manager's Copy
  Markdown does — keep one source of truth).

## Tests first (TDD)

- `inspector-panel.spec.ts` / `page-detail.spec.ts`: an `uploaded` event with
  `markdown: '![x](x.png)'` calls `insertMarkdownAtCursor` with that string;
  the attachments resource is invalidated; an upload error is shown inline and
  does not insert.

## Acceptance criteria

- [ ] Successful upload auto-inserts the markdown at the cursor.
- [ ] List refreshes; error still inline.
- [ ] One shared markdown-builder + one shared insert helper (no duplication
      across toolbar / manager / uploader).
- [ ] Tests cover success + error.

## Out of scope

- Manager row actions (→ 4.8).
