# Step 2.5 — Rename modal: real title

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.3 "Rename" → "Pre-filled with the real current title" (**broken**); punch list 🔴 #2 |
| Impact | 🔴 Functional |
| Depends on | none |
| Est. size | S |

## Problem

`pages-view.ts:170` hardcodes `this.renameTarget.set({ guid, title: 'Page' })`.
The rename field (`page-rename-inline`, bound via `[initialTitle]`) therefore
always shows "Page" instead of the actual title. `PageTree`'s
`(renameRequested)` output emits **only the guid** (`onRenameRequested(guid)`).

## Target behaviour

- The rename field is pre-filled with the page's **real** current title,
  auto-focused and all-selected (focus/select already work).
- Unchanged title on save just cancels (already handled in `page-rename-inline`).

## Implementation notes

**Files:** `features/pages/page-tree.ts` + `page-tree-item.ts` (change the
`renameRequested` output payload from `string` to
`{ guid: string; title: string }`), `features/pages/pages-view.ts`
(`onRenameRequested` takes the object, sets `renameTarget` with the real title).

- The tree row already has the `PageSummary` (it renders the title) — include
  `title` in the emitted payload. This is the minimal, correct fix; do **not**
  add a fetch just to get the title.
- Update the `renameTarget` signal type is already
  `{ guid: string; title: string }` — only the *source* of `title` is wrong.

## Tests first (TDD)

- `page-tree-item.spec.ts`: triggering rename (context menu / `F2` / dblclick)
  emits `{ guid, title }` with the row's real title.
- `pages-view.spec.ts`: `onRenameRequested({ guid: 'g', title: 'Real Title' })`
  → `renameTarget()` is `{ guid: 'g', title: 'Real Title' }`; the
  `wiki-page-rename-inline` receives `initialTitle="Real Title"`.

## Acceptance criteria

- [ ] Rename field shows the actual page title, not "Page".
- [ ] `renameRequested` carries the title; no extra network call.
- [ ] Tests cover the emit + the binding.

## Out of scope

- Save-on-blur (⚪, not in scope).
