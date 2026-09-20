# Phase 2 — Page tree & CRUD

**Goal:** restore tree drag-and-drop (reorder + constraints), keyboard
navigation, and the create/rename/delete flows to React parity.

**Depends on:** Phase 1 — especially **step 1.1 (PageTypes wiring)**. Steps 2.2,
2.4, 2.6 assume a populated page-types map reaches the tree and modals.

**Backend note:** `Pages.reorderPages()` and `PUT /api/pages/reorder` **already
exist** (`features/pages/pages.ts:211`). The gap is that the tree never calls
them. `MovePageRequest` / `PUT /api/pages/:guid/move` also exist and work.

## Steps

| # | Step | Impact | Depends on |
|---|---|---|---|
| 2.1 | [Tree DnD — positional reorder](step-2.1-tree-dnd-positional-reorder.md) | 🔴 | 1.1 |
| 2.2 | [Tree DnD — type-constraint UI](step-2.2-tree-dnd-type-constraints-ui.md) | 🔴 | 1.1, 2.1 |
| 2.3 | [Tree arrow keys + ensureExpanded](step-2.3-tree-arrow-keys-ensure-expanded.md) | 🟠 | — |
| 2.4 | [Tree row icons](step-2.4-tree-row-icons.md) | ⚪→🟠 | 1.1 |
| 2.5 | [Rename modal — real title](step-2.5-rename-modal-real-title.md) | 🔴 | — |
| 2.6 | [New Page modal](step-2.6-new-page-modal.md) | 🔴 | 1.1 |
| 2.7 | [Create-Page-from-Link](step-2.7-create-page-from-link.md) | 🔴 | — |
| 2.8 | [Delete — ConfirmDialog](step-2.8-delete-confirm-dialog.md) | 🟠 | — |

Parallel-safe groups: {2.3, 2.5, 2.8} independent; {2.1 → 2.2} sequential;
{2.4, 2.6} after 1.1; 2.7 independent (pairs with step 3.8).

## Phase exit criteria

- [x] All step acceptance criteria met; `npm test` + `npm run lint` green.
      (96 suites / 950 tests, lint + `npm run build` AOT clean, whole-branch
      review + fix-wave re-review both passed — see `.superpowers/sdd/progress.md`.)
- [ ] Manual: drag a sibling above/below another → order persists after reload.
      (Automated: covered by jsdom tests incl. the nested-forwarding fix;
      **mouse-only** — touch drag-drop is a known residual gap, see below.)
- [ ] Manual: drag a page onto a disallowed parent type → amber warning shown
      during hover, drop silently blocked (no alert — the post-drop dialog
      was unreachable via any real pointer-driven drag and was removed as
      dead code; the hover-time amber highlight + inline warning is the real
      blocking UX).
- [ ] Manual: `→`/`←` expand/collapse tree rows; creating a child expands the
      parent.
- [ ] Manual: rename a page → the field is pre-filled with its real title.
- [ ] Manual: create a child under a typed parent → only allowed types offered,
      auto-selected when exactly one; new page opens in edit mode with
      `# Title` boilerplate; parent expands.
- [ ] Manual: create from a broken link → source markdown is rewritten to the
      new GUID; "save the page" hint shown.
- [ ] Manual: delete a page with children → `ConfirmDialog` with child-aware
      copy; server error surfaced on failure.

**Status (2026-09-13): code-complete.** All 8 steps implemented + task-reviewed
(spec ✅ each) + a whole-branch review (1 Critical + 5 Important found, all
fixed in a follow-up wave, re-reviewed clean — **ready to merge: yes**). The
manual walkthrough above (real browser, all 7 rows) is **still owed**, same as
Phase 1b's responsive matrix — jsdom cannot verify actual pointer/CDK behavior.

**Known gap carried forward:** touch drag-drop still can't reach the
before/after (positional-reorder) zones — CDK v21 gives a touch pointer
implicit capture to the dragged row, so per-row `pointermove` can't see the
hovered row during a touch drag; every touch drop still defaults to reparent
(`onto`). Root-caused against `@angular/cdk`'s drag-drop source; fix path
identified (drive the drop zone from `(cdkDragMoved)` + `elementFromPoint`
instead of per-row `pointermove`) but not implemented this phase. Desktop
mouse drag is unaffected. See `.superpowers/sdd/progress.md`'s "Residual debt
from the final-fix wave" for the full list of small follow-ups.
