# Step 3.3 — Save-status pill + failure reassurance

| | |
|---|---|
| Phase | 3 — Editor & preview |
| Gap refs | §3.4 "Save-status pill", "Save model … failure message"; §11 checklist; punch list 🟠 |
| Impact | 🟠 |
| Depends on | — |
| Est. size | S |

## Problem

React shows a save-status pill: **Read-only** / **Saving…** / **● Unsaved
changes** / **✓ All changes saved**. Angular has only a Save button, a
"Saving..." label, and a `saveError` span. On save failure React keeps the draft
and shows "Your changes are still here — click Save again to retry." in a
dismissible banner; Angular shows a generic non-dismissible `Save failed: <msg>`
span.

## Target behaviour

- A single status pill reflecting, in priority order:
  - read-only (not in edit mode / no permission) → "Read-only"
  - a save in flight → "Saving…"
  - `dirty()` → "● Unsaved changes"
  - else → "✓ All changes saved"
- On save failure:
  - the draft is **kept** (already the case — `drafts.clear` only on success),
  - a **dismissible** banner: "Save failed: {server message}. Your changes are
    still here — click Save again to retry."
  - the pill returns to "● Unsaved changes".

## Implementation notes

**Files:** `features/pages/page-detail.ts` (template + a `saveStatus` computed +
a `saveErrorDismissed` signal).

- `saveStatus` is a pure `computed` from existing signals
  (`mode`, `saving`, `dirty`, permission). Add a small helper if it aids
  testing.
- Banner is a `mat-card` / inline alert with a close button that sets
  `saveErrorDismissed`; a new save attempt resets it.

## Tests first (TDD)

- `page-detail.spec.ts`: pill text for each of the four states; failed save →
  dismissible banner with the reassurance copy + server message; dismiss hides
  it; retrying resets and (on success) pill shows "✓ All changes saved".

## Acceptance criteria

- [ ] Pill shows the correct one of the four states at all times.
- [ ] Save failure shows the dismissible reassurance banner with the server
      message.
- [ ] Draft retained on failure (regression-guard the existing behaviour).
- [ ] Tests cover all four states + failure/dismiss.

## Out of scope

- Autosave timing (already 400 ms + unmount stash — leave).
