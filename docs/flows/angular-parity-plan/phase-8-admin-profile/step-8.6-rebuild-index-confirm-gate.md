# Step 8.6 — Rebuild page index: confirm gate

| | |
|---|---|
| Phase | 8 — Admin & profile polish |
| Gap refs | §8 "Confirm gate"; §8 "orphan-GUID list"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

`/admin/rebuild-page-index` (`rebuild-page-index.ts`): **"Rebuild now" fires
immediately** — no confirmation. React gates it: "Rebuild now" → an inline
confirm block ("scan the entire pages bucket and overwrite every row… Continue?")
→ "Yes, rebuild". Also missing: a collapsible **deleted-orphan-GUID** list in
the result card (errors list is already collapsible).

## Target behaviour

- Clicking "Rebuild now" reveals an inline confirm block (or a `ConfirmDialog`)
  with the warning copy; the rebuild runs only on explicit confirm.
- In the result card, add a `<details>` disclosure listing the deleted orphan
  GUIDs (alongside the existing collapsible errors list).

## Implementation notes

**Files:** `features/admin/rebuild-page-index.ts`.

- Inline confirm matches React more closely than a modal — a local
  `confirming` signal toggling the block. Either is acceptable.
- The orphan-GUID list: the rebuild result already carries the count; confirm
  the response also includes the GUID array (it should, per React) and render
  it in a `<details>`.

## Tests first (TDD)

- `rebuild-page-index.spec.ts`: "Rebuild now" does **not** call the endpoint
  until confirm; confirm triggers it; cancel aborts; a result with orphan
  GUIDs renders the collapsible list.

## Acceptance criteria

- [ ] Rebuild requires an explicit confirm step.
- [ ] Result card has a collapsible deleted-orphan-GUID list.
- [ ] Tests cover confirm / cancel / orphan list.

## Out of scope

- In-progress spinner + "don't close this page" (already present).
