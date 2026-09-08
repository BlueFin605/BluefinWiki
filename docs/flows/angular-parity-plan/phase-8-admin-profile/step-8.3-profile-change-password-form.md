# Step 8.3 — Profile: Change Password form

| | |
|---|---|
| Phase | 8 — Admin & profile polish |
| Gap refs | §9 "Change Password form"; punch list 🔴 #14 |
| Impact | 🔴 Functional |
| Depends on | — |
| Est. size | S |

## Problem

Angular's `/profile` has **no** change-password form. React: Current / New /
Confirm fields, a client-side match check ("New passwords do not match"),
`POST /auth/change-password`, a success message + field clear, submit disabled
until all three are filled.

## Target behaviour

- Three password inputs: Current, New, Confirm.
- Submit disabled until all three are non-empty.
- Client check: New ≠ Confirm → inline "New passwords do not match" and block
  submit.
- On submit: `POST /api/auth/change-password` with `{ currentPassword,
  newPassword }`; on success show a success message and clear all three fields;
  on failure show the server message (e.g. wrong current password).

## Implementation notes

**Files:** `features/profile/profile-page.ts`, `core/auth/auth.ts` or an
auth-api service (`changePassword(current, next)`).

- Keep it a plain template-driven or reactive form; no need to integrate with
  Cognito SDK directly if the backend endpoint handles it.
- Do not log or echo password values.

## Tests first (TDD)

- `profile-page.spec.ts`: submit disabled until all three filled; mismatch →
  inline message + blocked; match + submit → `POST /api/auth/change-password`
  with the right body, success message shown, fields cleared; failure → server
  message shown, fields retained.

## Acceptance criteria

- [ ] Three-field form with the fill-gate and match-check.
- [ ] `POST /auth/change-password` on submit.
- [ ] Success message + field clear; failure message.
- [ ] No password values logged.
- [ ] Tests cover gate / mismatch / success / failure.

## Out of scope

- Password strength meter (not in React).
