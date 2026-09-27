# Step 8.2 — Profile: Display Name form

| | |
|---|---|
| Phase | 8 — Admin & profile polish |
| Gap refs | §9 "Display Name form"; punch list 🔴 #14 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | S |

## Problem

Angular's `/profile` shows the display name **read-only**. React has a form:
`PUT /auth/profile { displayName }`, success toast, `refreshUser()`, Save
disabled if blank or unchanged.

## Target behaviour

- An editable Display Name field + Save button.
- Save disabled when the value is blank/whitespace or equal to the current
  name.
- On save: `PUT /api/auth/profile` with `{ displayName }`, then a success
  snackbar and `Auth.refreshUser()` (add this method if missing — re-reads the
  session / user so `auth.user()` reflects the new name).
- On failure: snackbar with the server message; field keeps the entered value.

## Implementation notes

**Files:** `features/profile/profile-page.ts`, `core/auth/auth.ts`
(a `refreshUser()` / `updateProfile()` helper + the `PUT`),
possibly a `Profile`/`AuthApi` service if that's the pattern.

- `refreshUser()` can re-run the relevant part of `bootstrap()` or just patch
  `_user` with the new `displayName` after a successful `PUT`.

## Tests first (TDD)

- `profile-page.spec.ts`: blank / unchanged → Save disabled; changed → enabled;
  Save issues `PUT /api/auth/profile` with the name, shows the toast, and
  `auth.user().displayName` updates; failure shows the server message.

## Acceptance criteria

- [ ] Display name is editable and persists via `PUT /auth/profile`.
- [ ] Save gating (blank / unchanged).
- [ ] Success toast + `auth.user()` reflects the change.
- [ ] Failure surfaces the server message.
- [ ] Tests cover gating + success + failure.

## Out of scope

- Change Password (→ 8.3).
