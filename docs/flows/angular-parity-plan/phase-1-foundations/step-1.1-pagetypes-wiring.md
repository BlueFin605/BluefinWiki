# Step 1.1 — PageTypes wiring

| | |
|---|---|
| Phase | 1 — Cross-cutting enablers |
| Gap refs | §3.2 (type-emoji "dead", constraint map "empty"), §3.3 (allowed-child scoping "dead"), §3.5 (board eligibility), §7 note; punch list 🔴 #3, part of #1 & #11 |
| Impact | 🔴 root cause — one fix re-enables five features |
| Depends on | none |
| Est. size | M |

## Problem

`pages-view.ts` passes a hardcoded empty map:
`pageTypesMap = signal({})` with a comment "Phase 6 will inject
PageTypesService". Consequently:

- The page tree never shows type emoji (§3.2).
- `check-type-constraints.ts` is fed the empty map, so it **never rejects**
  anything (§3.2).
- `new-page-modal` shows **all** types regardless of parent; no auto-select
  (§3.3).
- Board child-state eligibility / boardable-type filtering have no type data
  (§3.5, steps 5.1 / 5.5).
- The inspector schema merge has nothing to merge (step 4.4).

`PageTypes` service (`features/page-types/page-types.ts`) is fully implemented.

## Target behaviour

- `pages-view` injects `PageTypes`, builds a real
  `Map<typeGuid, PageType>` (or the shape `PageTree` / `check-type-constraints`
  expect — confirm from their signatures), and feeds it to:
  - `<page-tree [pageTypesMap]="…">`
  - the New Page modal open call (see step 2.6 for `parentPageType`)
  - `check-type-constraints` invocations
- The map is a resource/signal that refreshes when page types change
  (respect step 1.2's invalidation once it lands; a `_version`-style bump is
  acceptable until then).
- Remove the "Phase 6 will inject" comment and the empty `signal({})`.

## Implementation notes

**Files:** `features/pages/pages-view.ts` (+ its template),
possibly `features/pages/page-tree.ts` / `page-tree-item.ts` input types,
`features/pages/check-type-constraints.ts` callers.

- Check `PageTypes` for an existing resource/list accessor; reuse it. Do not
  add a second fetch path.
- Keep the map keyed the way consumers already assume (grep for
  `pageTypesMap(` and `pageTypes` in the pages feature to see the expected
  shape — the analysis implies a guid→type lookup).
- This step only **wires the data in**. The visual/behavioural consumers
  (folder icon, amber warning, modal scoping, auto-select) are their own steps
  (2.4, 2.2, 2.6). Verify each of those now *receives* a populated map.

## Tests first (TDD)

- `pages-view.spec.ts`: with `PageTypes` returning two types, `PageTree`
  receives a 2-entry map (not `{}`).
- `check-type-constraints.spec.ts`: already tests the pure logic — add/confirm
  a test that a populated map actually rejects a disallowed child.
- Integration: opening the New Page modal from a typed parent passes a
  non-empty allowed-types set (fuller assertion in step 2.6).

## Acceptance criteria

- [ ] `pages-view` no longer contains `signal({})` / the "Phase 6" comment.
- [ ] `PageTree` renders a type emoji for a typed page (manual).
- [ ] `check-type-constraints` receives a populated map at every call site.
- [ ] No duplicate page-types fetch introduced.
- [ ] Tests cover the wiring.

## Out of scope

- Folder/doc icon distinction (→ 2.4), amber warning UI (→ 2.2), modal scoping
  + auto-select (→ 2.6), board eligibility (→ 5.1). They consume this map.
