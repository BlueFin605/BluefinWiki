# Step 3.1 — Split view

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "View modes", "Draft-vs-server opens in split"; §11 checklist; punch list 🔴 #5 |
| Impact | 🔴 Functional |
| Depends on | 1.3 (layout store: `editorSplitPosition` + divider) |
| Est. size | L |

## Problem

React has an `Edit | Split | Preview` segmented control. Angular has a
`View | Edit` toggle only, implemented as navigation between `/pages/:guid` and
`/pages/:guid/edit`. There is **no side-by-side** mode. Also: React opens in
**Split** when a local draft differs from the server copy; Angular just loads
`draft ?? server` into the single surface.

## Target behaviour

- Three modes: **Edit** (editor only), **Split** (editor + live preview side by
  side), **Preview** (rendered only).
- Split renders the CodeMirror editor and the `markdown-renderer` preview in two
  panes divided by a `wiki-resize-divider` bound to
  `layout.editorSplitPosition()` (clamp 20–80, from step 1.3). Dragging updates
  the store; position persists.
- Preview in Split updates live as the buffer changes (reuse the existing
  debounced value the autosave path already produces — do not add a second
  debounce).
- On load, if `drafts.get(guid)` exists **and** differs from the server
  content, open in **Split** (so the user sees both). Otherwise open in the
  mode implied by the route.
- Decide route model: either keep `/edit` = Edit and add a `?view=split`
  query param, or make the segmented control purely client state on
  `page-detail`. **Prefer client state** on `page-detail` (simpler; the route
  still distinguishes read vs edit). Document the choice.

## Implementation notes

**Files:** `features/pages/page-detail.ts` (mode state + layout), its template,
`core/layout/layout.ts` (already has `editorSplitPosition` + clamp from 1.3),
`shared/components/resize-divider.ts`.

- Mode as a `signal<'edit'|'split'|'preview'>`; the segmented control is a
  `mat-button-toggle-group`.
- Split layout: CSS grid / flex with the left pane at
  `editorSplitPosition%` and the right pane the remainder.
- Keep the existing draft/autosave/dirty machinery untouched — Split is a view
  concern.

## Tests first (TDD)

- `page-detail.spec.ts`: segmented control switches modes; Split shows both
  panes; the divider `resized` event calls `layout.update({ editorSplitPosition })`
  clamped; editing the buffer updates the Split preview.
- Draft-diff: with a stored draft ≠ server content, `page-detail` initialises
  in `split`; with no draft (or an equal draft) it does not.

## Acceptance criteria

- [ ] Edit / Split / Preview all selectable; Split is genuinely side-by-side.
- [ ] Split divider bound to `editorSplitPosition`, clamped, persisted.
- [ ] Draft-vs-server difference opens Split on load.
- [ ] No second debounce added for the live preview.
- [ ] Route/state model decision documented in the PR.

## Out of scope

- Mobile: Split is disabled on mobile (edit/preview only) — that rule lives in
  step 1.5 / the responsive sub-spec.
