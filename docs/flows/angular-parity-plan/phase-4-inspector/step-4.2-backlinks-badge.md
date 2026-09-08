# Step 4.2 — Backlinks badge

| | |
|---|---|
| Phase | 4 — Inspector |
| Gap refs | §3.4 "Backlinks badge count on the Links tab"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | XS |

## Problem

`backlinkCount` is already computed but **not shown** on the Links (Linked) tab
label. React shows a badge count on the tab.

## Target behaviour

- The Links tab label shows the count as a badge (e.g. `Links (3)` or a
  `matBadge`), hidden / `0`-styled when there are none.
- Updates when backlinks refetch (per step 1.2 invalidation of
  `backlinks:<guid>`).

## Implementation notes

**Files:** `features/editor/inspector-panel.ts` (the `mat-tab` label template),
possibly `features/pages/linked-pages-panel.ts` if the count lives there.

- Use `matBadge` on the tab label span, or interpolate `({{ backlinkCount() }})`.
- Match the existing badge style used elsewhere in the app if there is one.

## Tests first (TDD)

- `inspector-panel.spec.ts`: with `backlinkCount()` = 3 the Links tab shows
  "3"; with 0 it shows no badge (or a muted 0, matching React — pick one and
  assert it).

## Acceptance criteria

- [ ] Links tab shows the backlink count.
- [ ] Zero state handled.
- [ ] Test covers non-zero + zero.

## Out of scope

- The backlinks list content / copy (⚪).
