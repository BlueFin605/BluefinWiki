# Phase 8 — Admin & profile polish

**Goal:** close the remaining 🟠 gaps on the admin screens and the Profile page.
Mostly small, independent items.

**Depends on:** Phase 0 step 0.6 (the `/403` route already exists by now).

**Not in scope (⚪):** coloured role/status badges, self-row highlight, inline-vs-
modal create forms, column choice differences, `alert`→snackbar (already an
improvement), master-detail vs stacked layout, "Run again" wording.

## Steps

| # | Step | Impact | Files |
|---|---|---|---|
| 8.1 | [Admin back navigation](step-8.1-admin-back-navigation.md) | 🟠 | `settings-page.ts`, `user-management.ts`, `invitation-management.ts`, `page-types-admin.ts`, `rebuild-page-index.ts`, `profile-page.ts` |
| 8.2 | [Profile: Display Name form](step-8.2-profile-display-name-form.md) | 🔴 | `profile-page.ts`, `auth` |
| 8.3 | [Profile: Change Password form](step-8.3-profile-change-password-form.md) | 🔴 | `profile-page.ts`, `auth` |
| 8.4 | [Members polish](step-8.4-members-polish.md) | 🟠 | `user-management.ts`, `user-edit-dialog.ts` |
| 8.5 | [Invitations polish](step-8.5-invitations-polish.md) | 🟠 | `invitation-management.ts`, `invitation-create-dialog.ts` |
| 8.6 | [Rebuild index confirm gate](step-8.6-rebuild-index-confirm-gate.md) | 🟠 | `rebuild-page-index.ts` |

All parallel-safe (different files), except 8.2 + 8.3 share `profile-page.ts` —
do them together or in sequence.

## Phase exit criteria

- [ ] All step acceptance criteria met; `npm test` + `npm run lint` green.
- [ ] Manual: every admin screen + `/settings` + `/profile` has a back
      affordance to `/pages`.
- [ ] Manual: Profile can change the display name (persists, toast,
      `refreshUser`) and change the password.
- [ ] Manual: Members — Edit is disabled for `deleted` users; the load error
      has a Retry.
- [ ] Manual: Invitations — status filter pills work; a created invitation
      shows its code; `expiryDays` is validated 1–30 (default 7).
- [ ] Manual: Rebuild page index asks for confirmation before running.
