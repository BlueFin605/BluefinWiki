# Step 8.4 — Members polish

| | |
|---|---|
| Phase | 8 — Admin & profile polish |
| Gap refs | §5 "Edit dialog … Edit disabled for `deleted`", "Load error … no Retry"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

Two small gaps in `/admin/users` (`user-management.ts`):

1. The **Edit** button is shown even for `deleted` users. React disables Edit
   for `deleted`.
2. The load-error state is plain text "Failed to load members." with **no
   Retry**. React shows a red banner + Retry.

(Suspend / Activate / Delete are already correctly hidden for self + `deleted`.
Mutation errors via snackbar are an improvement — keep.)

## Target behaviour

- Edit button `disabled` (or hidden) when `user.status === 'deleted'`.
- Load error shows a Retry that calls the members resource's `reload()`.

## Implementation notes

**Files:** `features/admin/user-management.ts` (Edit button binding + error
template).

## Tests first (TDD)

- `user-management.spec.ts`: a `deleted` user row → Edit disabled; a non-deleted
  row → Edit enabled; load failure → a Retry button that triggers a refetch.

## Acceptance criteria

- [ ] Edit disabled for `deleted` users.
- [ ] Load error has a working Retry.
- [ ] Tests cover both.

## Out of scope

- Coloured badges, self-row highlight, column choice (⚪).
