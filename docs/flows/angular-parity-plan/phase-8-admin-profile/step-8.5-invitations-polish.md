# Step 8.5 — Invitations polish

| | |
|---|---|
| Phase | 8 — Admin & profile polish |
| Gap refs | §6 "Status filter pills", "expiryDays validation", "Green 'Invitation created: <code>' confirmation"; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | M |

## Problem

`/admin/invitations` (`invitation-management.ts` + `invitation-create-dialog.ts`)
gaps:

1. **No status filter pills** (all / pending / used / expired / revoked). The
   backend supports `?status=`.
2. **`expiryDays` validation unconfirmed** — React enforces a number 1–30,
   default 7. Verify the dialog enforces it; add if not.
3. **No created-code confirmation** — after create, the list just refreshes;
   the new code is not surfaced. React shows a green "Invitation created:
   <code>".

(Attribution columns "by <name>" / "Used by <name>" and coloured badges are ⚪.)

## Target behaviour

- Filter pills above the table: All / Pending / Used / Expired / Revoked;
  selecting one re-queries with `?status=` (All = no param). Default All.
- `invitation-create-dialog`: `expiryDays` is a number input, min 1, max 30,
  default 7; invalid values block submit with an inline message.
- After a successful create, show a dismissible green banner "Invitation
  created: {code}" (with a copy-to-clipboard affordance is a nice-to-have,
  optional).

## Implementation notes

**Files:** `features/admin/invitation-management.ts` (pills + banner),
`features/admin/invitation-create-dialog.ts` (validation),
`features/admin/invitations.ts` (accept a `status` param on the list resource).

- Pills as a `mat-button-toggle-group` bound to a `status` signal feeding the
  resource params.
- The create call already returns the invitation (with its `code`) — surface
  that in the banner.

## Tests first (TDD)

- `invitation-management.spec.ts`: selecting "Pending" re-queries with
  `status=pending`; "All" sends no `status`; after create, the green banner
  shows the returned code; dismiss hides it.
- `invitation-create-dialog.spec.ts`: `expiryDays` defaults to 7; 0 / 31 /
  blank → inline error + submit blocked; 14 → allowed.

## Acceptance criteria

- [ ] Status filter pills drive `?status=`.
- [ ] `expiryDays` validated 1–30, default 7.
- [ ] Created-code confirmation banner.
- [ ] Tests cover filter, validation, banner.

## Out of scope

- Attribution columns + coloured badges (⚪).
