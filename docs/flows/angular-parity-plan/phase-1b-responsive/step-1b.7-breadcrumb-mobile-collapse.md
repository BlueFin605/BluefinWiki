# Step 1b.7 — Breadcrumb mobile collapse

| | |
|---|---|
| Phase | 1b — Responsive / mobile layer |
| Design | DESIGN.md §"Per-surface behaviour" |
| Gap refs | §3.4 "Breadcrumbs"; §0.5 |
| Impact | 🟠 |
| Depends on | 1b.1; step 3.5 |
| Est. size | S |

## Problem

Step 3.5 adds the Home segment + per-segment truncation, and collapses `>3`
segments on mobile — but gated on an interim `window.matchMedia` with a
`TODO(1.5)`. This step swaps in the real `Breakpoint` service.

## Target behaviour

- `breadcrumbs` injects `Breakpoint`; the collapse rule is
  `!bp.isDesktop() && segments.length > 3` → render `Home ▸ … ▸ Current`
  (the `…` matches React — static, or expands on click if React's does).
- Desktop always renders the full trail (with truncation from step 3.5).
- The `TODO(1.5)` / interim `matchMedia` in `breadcrumbs.ts` is removed.

## Implementation notes

**Files:** `shared/components/breadcrumbs.ts`.

- Trivial once step 3.5 has structured the collapse; just replace the gate
  expression and the import.

## Tests first (TDD)

- `breadcrumbs.spec.ts` (Breakpoint stub): 5 segments + `isDesktop = false` →
  `Home … Current`; same data + `isDesktop = true` → full trail; ≤3 segments →
  never collapsed regardless of breakpoint.

## Acceptance criteria

- [ ] Collapse driven by `Breakpoint.isDesktop()`, not `matchMedia`.
- [ ] `>3` segments collapse only below 1024.
- [ ] No `TODO(1.5)` left in `breadcrumbs.ts`.
- [ ] Spec covers both breakpoints + the ≤3 case.

## Out of scope

- Home segment / truncation / tooltip (→ step 3.5).
