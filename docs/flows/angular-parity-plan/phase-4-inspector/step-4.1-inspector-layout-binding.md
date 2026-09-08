# Step 4.1 — Inspector layout binding

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Inspector panel" → "Panel placement"; F5; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 1.3 (layout store + dividers), 1.5 (mobile sheet) |
| Est. size | S |

## Problem

The inspector is a fixed 360 px `mat-sidenav position=end`. Its open state is a
**local** signal, not `layout.inspectorVisible`. It is not resizable and has no
mobile sheet. React: desktop right resizable panel bound to
`inspectorWidth` / `inspectorVisible`; mobile bottom sheet.

## Target behaviour

- Open/close state reads and writes `layout.inspectorVisible` (via
  `layout.update({ inspectorVisible })`) so it persists across reload and route
  changes.
- Width binds to `layout.inspectorWidth()` with the divider wired in step 1.3
  (250–600 clamp). Remove the hardcoded 360 px.
- Mobile: below the breakpoint (step 1.5) the panel renders as a bottom sheet /
  full-screen overlay instead of the side panel. Expose the hook; final
  behaviour owned by the responsive sub-spec.

## Implementation notes

**Files:** `features/editor/inspector-panel.ts`,
`features/pages/page-detail.ts` (where the inspector toggle lives),
`core/layout/layout.ts` (already done in 1.3).

- Replace the local `open` signal with `layout.inspectorVisible()` +
  `layout.update`.
- If step 1.3 already added the inspector divider, just bind width here;
  otherwise add the divider now against `inspectorWidth`.

## Tests first (TDD)

- `inspector-panel.spec.ts` / `page-detail.spec.ts`: toggling the inspector
  calls `layout.update({ inspectorVisible })`; on mount the panel reflects the
  stored value; width style reflects `layout.inspectorWidth()`.

## Acceptance criteria

- [ ] Open/close state persists via `Layout`.
- [ ] Width bound to `inspectorWidth` + divider; no hardcoded width.
- [ ] Mobile sheet hook exposed.
- [ ] Tests cover persistence + width binding.

## Out of scope

- Tab contents (4.2–4.9).
- Final mobile sheet behaviour (→ 1.5).
