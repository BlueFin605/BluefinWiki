# Step 5.1 — Child-state eligibility

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "Eligibility"; §11 checklist; punch list part of 🔴 #11 |
| Impact | 🟠 |
| Depends on | 1.1 (page-types map) |
| Est. size | S |

## Problem

React board eligibility = `boardConfig.targetTypeGuid` is set **OR** any direct
child has a `state`-property type with a value. Angular only shows the board
when `boardConfig` is truthy (`page-detail`:
`mode()==='view' && boardConfig()`). The "children have state"
auto-eligibility is missing.

## Target behaviour

- `isBoardEligible(page, children, pageTypesMap)` returns true when:
  - `boardConfig?.targetTypeGuid` is set, **or**
  - at least one direct child's page type defines a `state` property **and**
    that child has a non-empty value for it.
- The Content | Board toggle appears whenever eligible; `defaultView` still
  decides which opens first.

## Implementation notes

**Files:** `features/pages/page-detail.ts` (the `boardConfig()` gate),
`features/board/board-view.ts` or `group-by-state.ts` (a pure
`isBoardEligible` helper), needs the children-with-properties list + the
page-types map (from step 1.1).

- A lightweight children fetch may be needed just to test eligibility before
  the board mounts — reuse `childrenWithPropertiesResource` with a small
  `limit`, or check whatever the tree already knows about `hasChildren` + types.
- Keep it a pure helper for testing.

## Tests first (TDD)

- `is-board-eligible.spec.ts`: `targetTypeGuid` set → true; no config but a
  child of a state-bearing type with a value → true; children of state-bearing
  types but all values empty → false; no config, no state children → false.

## Acceptance criteria

- [ ] Board toggle shows for the child-state case, not only when `boardConfig`
      exists.
- [ ] `isBoardEligible` is a tested pure helper.
- [ ] `defaultView` behaviour unchanged.

## Out of scope

- Board Settings type filtering (→ 5.5).
