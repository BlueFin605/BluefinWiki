# Step 5.6 — Card: respect `showParentTitle`

| | |
|---|---|
| Phase | 5 — Board view |
| Gap refs | §3.5 "Cards"; punch list ⚪ (bundled) |
| Impact | ⚪ in the doc — small |
| Depends on | — |
| Est. size | XS |

## Problem

React cards show the parent subtitle **only when `showParentTitle`** (and
`swapTitles` flips title/parent). Angular's card **always** shows `parentTitle`
if present, ignoring `showParentTitle`.

## Target behaviour

- Parent subtitle renders only when `boardConfig.showParentTitle` is true.
- `swapTitles` behaviour unchanged (already correct).

## Implementation notes

**Files:** `features/board/board-card.ts` — gate the parent-title element on
the `showParentTitle` input/config.

## Tests first (TDD)

- `board-card.spec.ts`: `showParentTitle: false` → no parent subtitle even when
  `parentTitle` is set; `true` → shown; `swapTitles` still flips.

## Acceptance criteria

- [ ] Parent subtitle honours `showParentTitle`.
- [ ] Test covers on/off + swap.

## Out of scope

- Up-to-3 non-`state` props display (already correct).
