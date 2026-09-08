# Step 2.8 — Delete: ConfirmDialog

| | |
|---|---|
| Phase | 2 — Page tree & CRUD |
| Gap refs | §3.3 "Delete"; punch list 🟠 "Delete page: native confirm, always-recursive, generic message" |
| Impact | 🟠 |
| Depends on | none |
| Est. size | S |

## Problem

Page delete uses `window.confirm('Delete this page and all its children?')` —
always the same copy, native `confirm` (not the app's `ConfirmDialog`), and
`deletePage` is called with a hardcoded `recursive: true`. Failure shows
`alert('Failed to delete page.')` — generic, drops the server message. Admin
gating in the UI is already correct (`page-context-menu.canDelete`).

## Target behaviour

- Use `shared/components/confirm-dialog.ts`.
- Copy varies:
  - leaf page → "Delete this page?"
  - has children → "Delete this page and all N child pages? This cannot be
    undone." (match React's has-children wording).
- `deletePage(guid, { recursive: hasChildren })` — only recursive when it
  actually has children.
- On failure surface the **server** error message (from the `HttpErrorResponse`
  body) in a snackbar, not a generic string.
- Invalidate `children:<parent>` + `page:<guid>` per step 1.2.

## Implementation notes

**Files:** wherever the delete is triggered — `features/pages/pages-view.ts`
(`onDeleteRequested`) and/or `features/pages/page-context-menu.ts`;
`features/pages/pages.ts` (`deletePage` already accepts a body).

- `hasChildren` from the `PageSummary` on the row; include it in the
  `deleteRequested` output payload if not already present.
- Extract server message: `err.error?.message ?? err.message`.

## Tests first (TDD)

- `pages-view.spec.ts`: leaf → `ConfirmDialog` opened with leaf copy,
  `deletePage` called with `recursive: false`; has-children → child-aware copy,
  `recursive: true`; dialog dismissed → no call.
- Failure path: `deletePage` rejects with an `HttpErrorResponse` carrying
  `error.message` → that message shown.

## Acceptance criteria

- [ ] `ConfirmDialog` replaces `window.confirm`.
- [ ] Copy differs for leaf vs has-children.
- [ ] `recursive` reflects `hasChildren`.
- [ ] Server error message surfaced on failure.
- [ ] Tests cover both copy paths + failure.

## Out of scope

- Admin gating (already correct).
