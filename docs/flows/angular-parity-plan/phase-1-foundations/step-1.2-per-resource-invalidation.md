# Step 1.2 — Per-resource invalidation (F2)

| | |
|---|---|
| Phase | 1 — Cross-cutting enablers |
| Gap refs | F2; §11 "caching stance"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | none (do before Phase 2–5 mutation work to avoid rework) |
| Est. size | L |

## Problem

Every API service (`Pages`, `PageTypes`, `Attachments`, `users`, `invitations`,
`search`, …) holds a single `_version` signal. **Every** mutation calls
`bumpVersion()`, which refetches **every** live `rxResource` of that service —
"refresh everything on any write". `Pages` alone has 7 resources keyed on
`v: this._version()`.

**Decision:** tighten to per-resource invalidation. A mutation invalidates only
the resource(s) whose data it actually changed.

## Target behaviour

- Introduce a small invalidation primitive, e.g. `InvalidationBus` (root
  service) keyed by string tags, or a per-service `Map<tag, WritableSignal<number>>`
  with `bump(tag)` / `version(tag)`.
- Each `rxResource` depends on `version('<its-tag>')` instead of a global `v`.
- Each mutation calls `bump(...)` for the specific tags it affects. Examples
  (`Pages`):
  | Mutation | Invalidates |
  |---|---|
  | `createPage` | `children:<parentGuid>` (or `children:root`), `ancestors` unaffected |
  | `updatePage(guid)` | `page:<guid>`, `backlinks:<guid>` if links changed, `children:<parentGuid>` if title/order-visible fields changed |
  | `movePage(guid)` | `children:<oldParent>`, `children:<newParent>`, `ancestors:<guid>` |
  | `reorderPages` | `children:<parentGuid>` |
  | `deletePage(guid)` | `children:<parentGuid>`, `page:<guid>` |
- Where a mutation's blast radius is genuinely broad (e.g. a page-type schema
  change touching many pages), a coarse tag is fine — be pragmatic, not
  dogmatic.
- Document the final model in a top-of-file comment on the primitive and in
  the plan's README (already summarised there).

## Implementation notes

**Files:** new `core/api/invalidation.ts` (or similar); every service under
`core/api/`, `features/*/*.ts` that defines `rxResource` + `_version`.

- Keep the public resource method signatures unchanged so consumers don't move.
- Tag helpers: `pageTag(guid)`, `childrenTag(parentGuid | 'root')`, etc., so
  call sites read well and typos surface.
- Migrate service-by-service; run that service's specs after each.
- `childrenResource` currently keys on `parentGuid` already — its tag is
  `children:<parentGuid ?? 'root'>`.
- This is the largest step in Phase 1. It is safe to split into one commit per
  service.

## Tests first (TDD)

- `invalidation.spec.ts`: `bump(tag)` bumps only that tag's version;
  unrelated tags unchanged.
- Per service, e.g. `pages.spec.ts`: after `createPage`, the `children`
  resource for the target parent re-requests; the `page:<other>` resource does
  **not** (spy on `HttpClient` / `HttpTestingController`).
- Regression: after each migration, existing service specs still pass.

## Acceptance criteria

- [ ] No service retains a blanket `_version` that all its resources read.
- [ ] Each mutation bumps only the tags it affects (documented table honoured).
- [ ] A spy confirms an unrelated resource is not refetched after a scoped
      mutation.
- [ ] All service specs green.

## Out of scope

- Adding caching / `staleTime` semantics — resources still refetch on
  (scoped) invalidation and on param change, as today.
