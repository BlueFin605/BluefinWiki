# Step 8.1 — Admin back navigation

| | |
|---|---|
| Phase | 8 — Admin & profile polish |
| Gap refs | §4–§9 "Back-chevron"; punch list 🟠 "Admin screens: no back navigation" |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

React admin screens (and `/settings`, `/profile`) have a back-chevron →
`/pages`. Angular has just an `<h1>` on every one.

## Target behaviour

- A consistent back affordance (chevron/arrow button + label) at the top of:
  `/settings`, `/admin/users`, `/admin/invitations`, `/admin/page-types`,
  `/admin/rebuild-page-index`, `/profile`.
- Navigates to `/pages` (React parity — not `history.back()`).

## Implementation notes

**Files:** a small shared `AdminBackHeader` component in `features/admin/`
(or `shared/components/`), used by each screen; alternatively add the same
markup to each — a shared component is preferred (six call sites).

- `<button mat-icon-button (click)="router.navigate(['/pages'])">` +
  `<mat-icon>arrow_back</mat-icon>` + the page title slot.

## Tests first (TDD)

- `admin-back-header.spec.ts`: renders the title; clicking back navigates to
  `/pages`.
- One consumer spec (e.g. `settings-page.spec.ts`) asserts the header is
  present.

## Acceptance criteria

- [ ] All six screens have the back affordance → `/pages`.
- [ ] Shared component (no six-way copy-paste).
- [ ] Tests cover the component + one consumer.

## Out of scope

- Restyling the screens otherwise (⚪).
