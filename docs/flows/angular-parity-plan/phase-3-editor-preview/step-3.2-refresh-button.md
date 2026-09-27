# Step 3.2 — Refresh button

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "Refresh button"; punch list 🔴 #5 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | S |

## Problem

React's editor toolbar has a **Refresh** button: discard the local draft,
refetch the page, reset the dirty baseline, bump the reload version. Angular
only wires `resource.reload()` to the "Retry" link on a load **error** — there
is no deliberate refresh affordance.

## Target behaviour

- A Refresh control in the editor/page toolbar (icon button, `refresh` icon).
- On click:
  1. `drafts.clear(guid)` (and the in-memory `Map` front),
  2. reload the page resource (invalidate `page:<guid>` per step 1.2, or
     `resource.reload()`),
  3. reset the dirty baseline to the freshly fetched server content,
  4. if there were unsaved changes, confirm first ("Discard unsaved changes and
     reload?") via `ConfirmDialog`.
- After refresh the save-status pill (step 3.3) reads "✓ All changes saved".

## Implementation notes

**Files:** `features/pages/page-detail.ts` (toolbar template + handler),
`features/pages/drafts.ts` (already has `clear`).

- Reuse the baseline-reset logic the initial load already performs; factor it
  into a method both paths call.
- Only prompt when `dirty()` is true.

## Tests first (TDD)

- `page-detail.spec.ts`: clean state → Refresh reloads, no prompt; dirty state
  → prompt; confirm → draft cleared, resource reloaded, `dirty()` false;
  cancel → nothing happens.

## Acceptance criteria

- [ ] Refresh control present in the toolbar.
- [ ] Clears draft, reloads, resets baseline.
- [ ] Confirms first when there are unsaved changes.
- [ ] Tests cover clean + dirty + cancel.

## Out of scope

- The load-error "Retry" link (already present — leave it).
