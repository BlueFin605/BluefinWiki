# Step 3.5 — Breadcrumbs: Home segment + collapse + truncation

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "Breadcrumbs"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | Phase 1b (step 1b.7) for the breakpoint wiring |
| Est. size | S |

## Problem

React: `Home ▸ ancestors ▸ Current`; Home clears selection; ancestors select;
mobile collapses `>3` to `Home ▸ … ▸ Current`; 200 px truncation per segment +
`title` tooltip. Angular (`shared/components/breadcrumbs.ts`):
`ancestors ▸ Current` — **no Home segment**, separator `/`, no collapse, no
truncation/tooltip.

## Target behaviour

- Leading **Home** segment → navigates to `/pages` and clears the active page
  selection.
- Ancestor segments navigate to their page (already `routerLink`s — keep).
- When there are more than 3 segments **and** the viewport is below the mobile
  breakpoint, collapse the middle to an ellipsis: `Home ▸ … ▸ Current`
  (the `…` can expand on click, or just be static — match React; static is
  fine if React's is).
- Each segment truncates at ~200 px with `text-overflow: ellipsis` and a
  `title` attribute carrying the full text.

## Implementation notes

**Files:** `shared/components/breadcrumbs.ts` (+ its consumer in
`features/pages/page-detail.ts` if the Home click needs to clear selection at
the `pages-view` level).

- Home click → `router.navigate(['/pages'])`; selection clears because the
  route no longer has a `:guid` (confirm `pages-view.activeGuid` derives from
  the URL).
- Collapse rule reads the `Breakpoint` service (Phase 1b, step 1b.7). Until 1b lands, gate
  on a simple `@media` / `window.matchMedia` and leave a `TODO(1.5)` to swap
  in the service.
- Keep the separator change optional (⚪) — not required.

## Tests first (TDD)

- `breadcrumbs.spec.ts`: renders a leading Home; Home click navigates to
  `/pages`; with 5 ancestors + mobile flag → renders `Home … Current`; each
  segment has a `title` with the full text and the truncation class.

## Acceptance criteria

- [ ] Home segment present; clears selection / navigates to `/pages`.
- [ ] `>3` segments collapse on mobile.
- [ ] Segments truncate with a `title` tooltip.
- [ ] Tests cover Home, collapse, truncation.

## Out of scope

- The exact mobile breakpoint value (owned by 1.5).

**Mobile collapse DONE in Phase 1b step 1b.7** (`7eed2cc`): the interim
non-reactive `window.matchMedia` gate (finding 3.5-M3) was replaced with
`Breakpoint.isDesktop()` — the `>3`-segment collapse now re-evaluates on
resize/rotate. All `TODO(1b.7)` markers removed.
