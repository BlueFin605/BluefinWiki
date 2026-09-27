# Step 5.5 — Board Settings: boardable types

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "Board Settings"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | 1.1 (page-types map) |
| Est. size | S |

## Problem

`board-settings-panel.ts` has columns add/remove/reorder + the 8-swatch
palette, the toggles, and default view — all matching. But the **"Show pages of
type"** target-type list shows **ALL** page types, not just those with a
`state` property ("boardable types").

(Snackbar-on-persist-failure vs React's silent failure is an **improvement** —
keep it.)

## Target behaviour

- The target-type `<select>` lists only types whose schema defines a `state`
  property (`boardableTypes`).
- If there are no boardable types, the control is empty/disabled with a hint.

## Implementation notes

**Files:** `features/board/board-settings-panel.ts`, a pure
`boardableTypes(pageTypesMap) => PageType[]` helper (a type is boardable if
`schema.some(f => f.name === 'state')` — confirm the exact property key React
uses for "state").

## Tests first (TDD)

- `boardable-types.spec.ts`: given three types where one has a `state`
  property → only that one is returned.
- `board-settings-panel.spec.ts`: the target-type select options equal
  `boardableTypes(map)`, not the full map.

## Acceptance criteria

- [ ] Target-type list filtered to state-bearing types.
- [ ] Empty/disabled state when none.
- [ ] `boardableTypes` unit-tested.
- [ ] Snackbar-on-failure retained.

## Out of scope

- Column palette / toggles (already parity).
