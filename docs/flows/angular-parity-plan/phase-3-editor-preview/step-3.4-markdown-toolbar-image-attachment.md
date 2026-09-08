# Step 3.4 — Toolbar: Image + Attachment + compact variant

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "Markdown toolbar"; §3.4 "Save the page before uploading attachments"; punch list 🔴 #6 |
| Impact | 🔴 Functional |
| Depends on | Phase 1b (step 1b.6) for the mobile parts |
| Est. size | M |

## Problem

`markdown-toolbar.ts` has Bold / Italic / Strike | Heading (H1–H6) | UL / OL /
Task | **Link** | Inline code / Code block. Missing vs React: **Image button**,
**Attachment-upload button**, and a **compact / mobile variant** (hides
OL/Task/codeblock, pinned to the bottom on mobile, heading menu opens upward).

## Target behaviour

- **Image button** → inserts an image markdown skeleton at the cursor
  (`![alt](filename)` or opens a small prompt for URL/alt — match React's
  behaviour: it inserts a placeholder to fill in).
- **Attachment button** → triggers the attachment upload flow
  (`attachment-uploader`) for the current page. Guard: if the page has unsaved
  never-persisted state such that no guid exists, show "Save the page before
  uploading attachments." In Angular pages are created server-side first so a
  guid always exists — implement the guard defensively but it will rarely
  fire; the uploaded markdown is inserted at the cursor (this is also step 4.9,
  keep the insert logic shared).
- **Compact variant**: an `input` (`compact` / `dense`) that hides OL, Task,
  and Code-block buttons and flips the heading menu to open upward. The
  responsive layer (Phase 1b, step 1b.6) decides *when* to pass it and pins the toolbar to
  the bottom on mobile.

## Implementation notes

**Files:** `features/editor/markdown-toolbar.ts`,
`features/attachments/attachment-uploader.ts` (invoked),
`shared/codemirror/wiki-codemirror.ts` (`applyAction` for image insert),
`features/pages/page-detail.ts` (wire the attachment button to the uploader +
cursor insert).

- Add `image` and `attachment` action ids alongside the existing ones; reuse
  `applyAction` for `image`.
- The attachment button opens the uploader (dialog or inline panel — match how
  `inspector-panel` invokes it); on `uploaded`, call the shared
  `insertMarkdownAtCursor(md)`.

## Tests first (TDD)

- `markdown-toolbar.spec.ts`: Image button emits the `image` action; Attachment
  button emits `attachment`; `compact` hides OL/Task/Code-block and sets the
  heading menu direction.
- `page-detail.spec.ts`: the `attachment` action opens the uploader; an
  `uploaded` event inserts the returned markdown at the cursor.

## Acceptance criteria

- [ ] Image and Attachment buttons present and functional.
- [ ] Attachment upload from the toolbar inserts markdown at the cursor.
- [ ] "Save the page first" guard implemented (even if rarely reached).
- [ ] Compact variant hides the right buttons + flips the heading menu.
- [ ] Tests cover the new actions + compact.

## Out of scope

- Deciding when compact/mobile applies and bottom-pinning (→ 1.5).
- The attachment *manager* actions (→ 4.8).
